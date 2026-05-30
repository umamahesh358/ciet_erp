import json
import csv
import io
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.decorators import login_required
from django.views import View
from django.views.generic import TemplateView
from django.utils.timezone import now
from django.db.models import Count, Avg, Q, Sum
from django.http import HttpResponse, JsonResponse

from apps.accounts.models import User
from apps.academics.models import Department, Subject, Marks, Attendance
from apps.students.models import StudentProfile
from apps.faculty.models import (
    StudentMentorAssignment, LessonPlan, Timetable, AcademicCalendar,
    TrainingProgram, SyllabusCoverage, Cohort, InstitutionCourse,
    CourseMaterial, CourseAssessment, StudentCourseScore
)
from apps.core.models import Announcement
from apps.notifications.models import Notification, NotificationRecipient
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from apps.faculty import selectors


# ── ROLE GUARD MIXIN ───────────────────────────────────────────────────────────
class RoleRequiredMixin(LoginRequiredMixin):
    allowed_roles = []

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('login')
        if self.allowed_roles and request.user.role not in self.allowed_roles:
            return redirect('dashboard')
        return super().dispatch(request, *args, **kwargs)


class FacultyHubTemplateView(RoleRequiredMixin, TemplateView):
    allowed_roles = ['Faculty', 'Mentor', 'HOD']
    
    def get(self, request, *args, **kwargs):
        """Mark notifications as read when visiting any faculty portal page."""
        user = request.user
        
        # Get user's departments
        user_departments = list(user.departments.all())
        if user.role == 'HOD' and not user_departments:
            hod_dept = Department.objects.filter(hod=user).first()
            if hod_dept:
                user_departments = [hod_dept]
        
        # Build department filter (same logic as context processor)
        dept_filter = Q(target_department__isnull=True)
        if user_departments:
            dept_filter = dept_filter | Q(target_department__in=user_departments)
        
        # Get all relevant notifications for this user
        relevant_notifications = Notification.objects.filter(
            Q(is_global=True) |
            (
                (Q(target_role='All') | Q(target_role=user.role)) &
                dept_filter
            )
        ).distinct()
        
        # Mark all relevant notifications as read for this user
        for notification in relevant_notifications:
            NotificationRecipient.objects.get_or_create(
                user=user,
                notification=notification,
                defaults={'is_read': True, 'read_at': now()}
            )
            # If it already exists and isn't marked as read, update it
            NotificationRecipient.objects.filter(
                user=user,
                notification=notification,
                is_read=False
            ).update(is_read=True, read_at=now())
        
        return super().get(request, *args, **kwargs)
    
    def get_context_data(self, **kwargs):
        """Add unread notifications count to context for all faculty portal pages."""
        context = super().get_context_data(**kwargs)
        user = self.request.user
        
        # Get user's departments
        user_departments = list(user.departments.all())
        if user.role == 'HOD' and not user_departments:
            hod_dept = Department.objects.filter(hod=user).first()
            if hod_dept:
                user_departments = [hod_dept]
        
        # Build department filter
        dept_filter = Q(target_department__isnull=True)
        if user_departments:
            dept_filter = dept_filter | Q(target_department__in=user_departments)
        
        # Get updated unread count
        total_relevant = Notification.objects.filter(
            Q(is_global=True) |
            (
                (Q(target_role='All') | Q(target_role=user.role)) &
                dept_filter
            )
        ).count()
        
        read_count = NotificationRecipient.objects.filter(user=user, is_read=True).count()
        unread_count = max(0, total_relevant - read_count)
        
        context['hod_unread_count'] = unread_count
        return context


class FacultyHubCohortsView(FacultyHubTemplateView):
    template_name = 'faculty/cohorts.html'


class FacultyHubExploreStudentsView(FacultyHubTemplateView):
    template_name = 'faculty/explore_students.html'


class FacultyHubHodUpdatesView(FacultyHubTemplateView):
    template_name = 'faculty/hod_updates.html'


class FacultyHubCoursesView(FacultyHubTemplateView):
    template_name = 'faculty/courses.html'


class FacultyHubInstitutionCoursesView(FacultyHubTemplateView):
    def get(self, request, *args, **kwargs):
        return redirect(f"{request.path.replace('institution-courses/', 'courses/')}?type=institutional")


class FacultyHubSettingsView(FacultyHubTemplateView):
    template_name = 'faculty/settings.html'


# ══════════════════════════════════════════════════════════════════════════════
# HOD DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
class HODDashboardView(RoleRequiredMixin, View):
    allowed_roles = ['HOD']

    def get(self, request):
        dept = Department.objects.filter(hod=request.user).first()
        if not dept:
            return render(request, 'faculty/hod_dashboard.html', {'no_dept': True})

        # ── Faculty in dept ──
        faculty_list = User.objects.filter(
            departments=dept, role__in=['Faculty', 'Mentor'], is_active=True
        ).annotate(subject_count=Count('subjects_taught'))

        # ── Mentor list for assignment ──
        mentors = User.objects.filter(departments=dept, role='Mentor', is_active=True)

        current_year = f"{now().year}-{now().year + 1}"
        direct_assignments = StudentMentorAssignment.objects.filter(
            academic_year=current_year,
            students__department=dept
        ).distinct()

        dept_students = StudentProfile.objects.filter(
            department=dept, is_deleted=False
        ).select_related('user')

        # ── Dept performance (avg CGPA by batch) ──
        batch_performance = (
            StudentProfile.objects
            .filter(department=dept, is_deleted=False)
            .values('batch')
            .annotate(avg_cgpa=Avg('cgpa'), count=Count('id'))
            .order_by('batch')
        )
        perf_labels = [b['batch'] for b in batch_performance]
        perf_values = [float(b['avg_cgpa'] or 0) for b in batch_performance]

        # ── Lesson plans ──
        lesson_plans = LessonPlan.objects.filter(
            department=dept, is_deleted=False
        ).select_related('subject', 'uploaded_by').order_by('-created_at')[:10]

        # ── Timetables ──
        timetables = Timetable.objects.filter(
            department=dept, is_deleted=False
        ).order_by('-created_at')[:5]

        # ── Academic Calendars ──
        calendars = AcademicCalendar.objects.filter(
            department=dept, is_deleted=False
        ).order_by('-created_at')[:5]

        # ── Training programs ──
        training_programs = TrainingProgram.objects.filter(
            department=dept, is_deleted=False
        ).order_by('-start_date')[:10]

        # ── Announcements (global) ──
        announcements = Announcement.objects.filter(
            is_active=True, is_deleted=False
        ).order_by('-created_at')[:10]


        # ── Syllabus completion (dept-wide) ──
        dept_subjects = Subject.objects.filter(department=dept)
        syllabus_summary = (
            SyllabusCoverage.objects
            .filter(subject__in=dept_subjects)
            .values('subject__name', 'subject__code')
            .annotate(
                total=Sum('total_topics'),
                covered=Sum('covered_topics')
            )
        )
        syllabus_totals = SyllabusCoverage.objects.filter(subject__in=dept_subjects).aggregate(
            total=Sum('total_topics'),
            covered=Sum('covered_topics'),
        )
        syllabus_total = float(syllabus_totals.get('total') or 0)
        syllabus_covered = float(syllabus_totals.get('covered') or 0)
        syllabus_pct = round((syllabus_covered / syllabus_total) * 100, 1) if syllabus_total else 0

        # ── Principal-forwarded summary (graph) ──
        total_students = StudentProfile.objects.filter(department=dept, is_deleted=False).count()
        assigned_count = StudentMentorAssignment.objects.filter(
            academic_year=current_year, students__department=dept
        ).values('students__id').distinct().count()
        unassigned_count = max(total_students - assigned_count, 0)
        avg_cgpa = (
            StudentProfile.objects
            .filter(department=dept, is_deleted=False)
            .aggregate(avg=Avg('cgpa'))['avg'] or 0
        )
        principal_labels = ['Avg CGPA', 'Mentor Assigned', 'Mentor Unassigned', 'Syllabus %']
        principal_values = [round(float(avg_cgpa), 2), assigned_count, unassigned_count, syllabus_pct]

        return render(request, 'faculty/hod_dashboard.html', {
            'dept':               dept,
            'faculty_list':       faculty_list,
            'mentors':            mentors,
            'direct_assignments': direct_assignments,
            'dept_students':      dept_students,
            'current_year':       current_year,
            'lesson_plans':       lesson_plans,
            'timetables':         timetables,
            'calendars':          calendars,
            'training_programs':  training_programs,
            'announcements':      announcements,
            'announcement_categories': Announcement.Category.choices,
            'syllabus_summary':   list(syllabus_summary),
            'subjects':           dept_subjects,
            'perf_labels':        json.dumps(perf_labels),
            'perf_values':        json.dumps(perf_values),
            'principal_labels':   json.dumps(principal_labels),
            'principal_values':   json.dumps(principal_values),
        })

    def post(self, request):
        """Handle mentor assignments and file uploads."""
        action = request.POST.get('action')
        dept = Department.objects.filter(hod=request.user).first()
        if not dept:
            return redirect('hod-dashboard')
        current_year = f"{now().year}-{now().year + 1}"

        if action == 'assign_mentor_students':
            mentor_id  = request.POST.get('mentor_id')
            student_ids = request.POST.getlist('student_ids')
            if mentor_id and student_ids:
                assignment, _ = StudentMentorAssignment.objects.update_or_create(
                    mentor_id=mentor_id, academic_year=current_year,
                    defaults={'assigned_by': request.user}
                )
                assignment.students.set(student_ids)

        elif action == 'upload_lesson_plan':
            subject_id = request.POST.get('subject_id')
            acad_year  = request.POST.get('academic_year', current_year)
            f = request.FILES.get('file')
            if subject_id and f:
                LessonPlan.objects.create(
                    subject_id=subject_id, department=dept,
                    uploaded_by=request.user, file=f, academic_year=acad_year
                )

        elif action == 'upload_timetable':
            semester   = request.POST.get('semester')
            valid_from = request.POST.get('valid_from')
            f = request.FILES.get('file')
            if semester and valid_from and f:
                Timetable.objects.create(
                    department=dept, uploaded_by=request.user,
                    semester=semester, valid_from=valid_from, file=f,
                    academic_year=current_year
                )

        elif action == 'upload_calendar':
            title    = request.POST.get('title')
            semester = request.POST.get('semester')
            f = request.FILES.get('file')
            if title and semester and f:
                AcademicCalendar.objects.create(
                    department=dept, uploaded_by=request.user,
                    title=title, academic_year=current_year, semester=semester, file=f
                )

        elif action == 'create_training':
            title = request.POST.get('title', '').strip()
            description = request.POST.get('description', '')
            start_date = request.POST.get('start_date')
            end_date = request.POST.get('end_date') or None
            venue = request.POST.get('venue', '').strip()
            is_active = request.POST.get('is_active') == 'on'
            if title and start_date:
                TrainingProgram.objects.create(
                    department=dept,
                    title=title,
                    description=description,
                    start_date=start_date,
                    end_date=end_date,
                    venue=venue,
                    created_by=request.user,
                    is_active=is_active,
                )

        elif action == 'update_training':
            training_id = request.POST.get('training_id')
            title = request.POST.get('title', '').strip()
            description = request.POST.get('description', '')
            start_date = request.POST.get('start_date')
            end_date = request.POST.get('end_date') or None
            venue = request.POST.get('venue', '').strip()
            is_active = request.POST.get('is_active') == 'on'
            if training_id and title and start_date:
                training = get_object_or_404(TrainingProgram, id=training_id, is_deleted=False)
                if training.department == dept:
                    training.title = title
                    training.description = description
                    training.start_date = start_date
                    training.end_date = end_date
                    training.venue = venue
                    training.is_active = is_active
                    training.save(update_fields=[
                        'title', 'description', 'start_date', 'end_date',
                        'venue', 'is_active', 'updated_at'
                    ])

        elif action == 'create_announcement':
            title = request.POST.get('title', '').strip()
            content = request.POST.get('content', '').strip()
            category = request.POST.get('category', Announcement.Category.NEWS)
            link = request.POST.get('link', '').strip() or None
            is_active = request.POST.get('is_active') == 'on'
            if title and content:
                Announcement.objects.create(
                    title=title,
                    content=content,
                    category=category,
                    link=link,
                    is_active=is_active,
                )

        return redirect('hod-dashboard')


# ══════════════════════════════════════════════════════════════════════════════
# MENTOR DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
class MentorDashboardView(RoleRequiredMixin, View):
    allowed_roles = ['Mentor']

    def get(self, request):
        current_year = f"{now().year}-{now().year + 1}"
        direct_students = StudentProfile.objects.filter(
            direct_mentor_assignments__mentor=request.user,
            direct_mentor_assignments__academic_year=current_year,
            is_deleted=False
        ).select_related('user', 'department', 'section').distinct()
        students = direct_students

        # ── Per-student academic overview ──
        student_stats = []
        for s in students:
            avg_marks = Marks.objects.filter(student=s).aggregate(avg=Avg('total'))['avg'] or 0
            total_att = Attendance.objects.filter(student=s).count()
            present   = Attendance.objects.filter(student=s, is_present=True).count()
            att_pct   = round((present / total_att * 100) if total_att else 0)
            student_stats.append({
                'student':    s,
                'avg_marks':  round(float(avg_marks), 1),
                'att_pct':    att_pct,
                'cgpa':       s.cgpa,
            })

        # ── Subjects mentor can upload marks for ──
        subjects = Subject.objects.filter(
            department__in=request.user.departments.all()
        ).select_related('department') if request.user.departments.exists() else Subject.objects.none()

        # ── Institution courses published to this mentor's dashboard ──
        inst_courses = InstitutionCourse.objects.filter(
            cohorts__students__in=students
        ).distinct()

        return render(request, 'faculty/mentor_dashboard.html', {
            'student_stats':  student_stats,
            'subjects':       subjects,
            'assignments':    [],
            'inst_courses':   inst_courses,
            'current_year':   current_year,
        })

    def post(self, request):
        """Upload marks or attendance for mentored students."""
        action = request.POST.get('action')

        if action == 'upload_marks':
            student_id = request.POST.get('student_id')
            subject_id = request.POST.get('subject_id')
            internal   = request.POST.get('internal', 0)
            external   = request.POST.get('external', 0)
            total      = float(internal) + float(external)
            grade      = request.POST.get('grade', '')
            if student_id and subject_id:
                Marks.objects.update_or_create(
                    student_id=student_id, subject_id=subject_id,
                    defaults={'internal': internal, 'external': external,
                              'total': total, 'grade': grade}
                )

        elif action == 'upload_attendance':
            student_id  = request.POST.get('student_id')
            subject_id  = request.POST.get('subject_id')
            date_str    = request.POST.get('date')
            is_present  = request.POST.get('is_present') == 'on'
            if student_id and subject_id and date_str:
                Attendance.objects.get_or_create(
                    student_id=student_id, subject_id=subject_id, date=date_str,
                    defaults={'is_present': is_present, 'recorded_by': request.user}
                )

        return redirect('mentor-dashboard')


# ══════════════════════════════════════════════════════════════════════════════
# FACULTY DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
class FacultyDashboardView(RoleRequiredMixin, View):
    allowed_roles = ['Faculty', 'HOD', 'Mentor']

    def get(self, request):
        user = request.user
        departments = user.departments.all()
        
        # ── Mark notifications as read ──
        user_departments = list(user.departments.all())
        if user.role == 'HOD' and not user_departments:
            hod_dept = Department.objects.filter(hod=user).first()
            if hod_dept:
                user_departments = [hod_dept]
        
        # Build department filter
        dept_filter = Q(target_department__isnull=True)
        if user_departments:
            dept_filter = dept_filter | Q(target_department__in=user_departments)
        
        # Get all relevant notifications for this user
        relevant_notifications = Notification.objects.filter(
            Q(is_global=True) |
            (
                (Q(target_role='All') | Q(target_role=user.role)) &
                dept_filter
            )
        ).distinct()
        
        # Mark all relevant notifications as read for this user
        for notification in relevant_notifications:
            NotificationRecipient.objects.get_or_create(
                user=user,
                notification=notification,
                defaults={'is_read': True, 'read_at': now()}
            )
            # If it already exists and isn't marked as read, update it
            NotificationRecipient.objects.filter(
                user=user,
                notification=notification,
                is_read=False
            ).update(is_read=True, read_at=now())
        
        # ── My subjects ──
        my_subjects = Subject.objects.filter(
            faculty=user, is_deleted=False
        ).select_related('department')

        # ── Syllabus coverage per subject ──
        syllabus_by_subject = {}
        for subj in my_subjects:
            units = SyllabusCoverage.objects.filter(subject=subj, faculty=user).order_by('unit_number')
            total = units.aggregate(t=Sum('total_topics'))['t'] or 0
            covered = units.aggregate(c=Sum('covered_topics'))['c'] or 0
            syllabus_by_subject[subj.id] = {
                'subject': subj,
                'units':   units,
                'total':   total,
                'covered': covered,
                'pct':     round((covered / total * 100) if total else 0),
            }

        # ── Cohorts in my department (including admin-created) ──
        if departments.exists():
            my_cohorts = Cohort.objects.filter(
                department__in=departments,
                is_deleted=False,
                is_active=True
            ).annotate(student_count=Count('students'))
        else:
            my_cohorts = Cohort.objects.none()

        # ── Institution courses (own + admin + dept cohorts) ──
        my_courses = InstitutionCourse.objects.filter(
            Q(created_by=user) |
            Q(created_by__is_superuser=True) |
            Q(cohorts__department__in=departments)
        ).filter(is_deleted=False).distinct()

        # ── Student performance in my subjects ──
        subject_performance = []
        for subj in my_subjects:
            avg = Marks.objects.filter(subject=subj).aggregate(avg=Avg('total'))['avg']
            count = Marks.objects.filter(subject=subj).count()
            subject_performance.append({
                'subject': subj,
                'avg': round(float(avg), 1) if avg else 0,
                'count': count,
            })

        # ── Chart data ──
        perf_labels = [sp['subject'].code for sp in subject_performance]
        perf_values = [sp['avg'] for sp in subject_performance]

        # ── All students for cohort creation ──
        dept_students = StudentProfile.objects.filter(
            department__in=departments, is_deleted=False
        ).select_related('user', 'department') if departments.exists() else StudentProfile.objects.none()
        
        # ── Calculate unread notifications count ──
        total_relevant = Notification.objects.filter(
            Q(is_global=True) |
            (
                (Q(target_role='All') | Q(target_role=user.role)) &
                dept_filter
            )
        ).count()
        
        read_count = NotificationRecipient.objects.filter(user=user, is_read=True).count()
        unread_count = max(0, total_relevant - read_count)

        return render(request, 'faculty/faculty_dashboard.html', {
            'my_subjects':        my_subjects,
            'syllabus_by_subject': syllabus_by_subject,
            'my_cohorts':         my_cohorts,
            'my_courses':         my_courses,
            'subject_performance': subject_performance,
            'dept_students':      dept_students,
            'departments':        departments,
            'perf_labels':        json.dumps(perf_labels),
            'perf_values':        json.dumps(perf_values),
            'hod_unread_count':   unread_count,
        })

    def post(self, request):
        action = request.POST.get('action')

        # ── Create Cohort ──
        if action == 'create_cohort':
            name     = request.POST.get('name', '').strip()
            ctype    = request.POST.get('cohort_type', 'training')
            batch    = request.POST.get('batch', '')
            desc     = request.POST.get('description', '')
            stud_ids = request.POST.getlist('student_ids')
            department_id = request.POST.get('department_id')
            if name:
                department = None
                if department_id:
                    department = Department.objects.filter(
                        id=department_id, id__in=request.user.departments.values_list('id', flat=True)
                    ).first()
                cohort = Cohort.objects.create(
                    name=name, created_by=request.user,
                    department=department,
                    cohort_type=ctype, batch=batch, description=desc
                )
                if stud_ids:
                    cohort.students.set(stud_ids)

        # ── Update Cohort ──
        elif action == 'update_cohort':
            cohort_id = request.POST.get('cohort_id')
            name      = request.POST.get('name', '').strip()
            ctype     = request.POST.get('cohort_type', 'training')
            batch     = request.POST.get('batch', '')
            desc      = request.POST.get('description', '')
            stud_ids  = request.POST.getlist('student_ids')
            department_id = request.POST.get('department_id')
            if cohort_id and name:
                cohort = get_object_or_404(Cohort, id=cohort_id, is_deleted=False)
                if (not cohort.department or cohort.department_id in request.user.departments.values_list('id', flat=True)) and (
                    cohort.created_by == request.user or cohort.created_by.is_superuser
                ):
                    if department_id:
                        new_dept = Department.objects.filter(
                            id=department_id, id__in=request.user.departments.values_list('id', flat=True)
                        ).first()
                        cohort.department = new_dept
                    cohort.name = name
                    cohort.cohort_type = ctype
                    cohort.batch = batch
                    cohort.description = desc
                    cohort.save(update_fields=['name', 'cohort_type', 'batch', 'description', 'department', 'updated_at'])
                    cohort.students.set(stud_ids)

        # ── Create Institution Course ──
        elif action == 'create_course':
            name        = request.POST.get('name', '').strip()
            category    = request.POST.get('category', 'other')
            description = request.POST.get('description', '')
            publish     = request.POST.get('is_published_to_profile') == 'on'
            cohort_ids  = request.POST.getlist('cohort_ids')
            if name:
                course = InstitutionCourse.objects.create(
                    name=name, category=category, created_by=request.user,
                    description=description, is_published_to_profile=publish
                )
                if cohort_ids:
                    course.cohorts.set(cohort_ids)

        # ── Update Institution Course ──
        elif action == 'update_course':
            course_id  = request.POST.get('course_id')
            name        = request.POST.get('name', '').strip()
            category    = request.POST.get('category', 'other')
            description = request.POST.get('description', '')
            publish     = request.POST.get('is_published_to_profile') == 'on'
            cohort_ids  = request.POST.getlist('cohort_ids')
            if course_id and name:
                course = get_object_or_404(InstitutionCourse, id=course_id, is_deleted=False)
                if course.created_by == request.user or course.created_by.is_superuser:
                    course.name = name
                    course.category = category
                    course.description = description
                    course.is_published_to_profile = publish
                    course.save(update_fields=['name', 'category', 'description', 'is_published_to_profile', 'updated_at'])
                    course.cohorts.set(cohort_ids)

        # ── Upload Course Material ──
        elif action == 'upload_material':
            course_id = request.POST.get('course_id')
            title     = request.POST.get('title', '').strip()
            f         = request.FILES.get('file')
            if course_id and title and f:
                course = get_object_or_404(InstitutionCourse, id=course_id)
                if course.created_by == request.user or course.created_by.is_superuser:
                    CourseMaterial.objects.create(course=course, title=title, file=f)

        # ── Add Assessment ──
        elif action == 'add_assessment':
            course_id  = request.POST.get('course_id')
            aname      = request.POST.get('assessment_name', '').strip()
            max_score  = request.POST.get('max_score', 100)
            if course_id and aname:
                course = get_object_or_404(InstitutionCourse, id=course_id)
                if course.created_by == request.user or course.created_by.is_superuser:
                    CourseAssessment.objects.create(course=course, name=aname, max_score=max_score)

        # ── Update Syllabus Unit ──
        elif action == 'update_syllabus':
            subject_id     = request.POST.get('subject_id')
            unit_number    = request.POST.get('unit_number')
            unit_title     = request.POST.get('unit_title', '').strip()
            total_topics   = request.POST.get('total_topics', 1)
            covered_topics = request.POST.get('covered_topics', 0)
            doc            = request.FILES.get('document')
            remarks        = request.POST.get('remarks', '')
            if subject_id and unit_number:
                defaults = {
                    'unit_title': unit_title,
                    'total_topics': int(total_topics),
                    'covered_topics': int(covered_topics),
                    'remarks': remarks,
                }
                if doc:
                    defaults['document'] = doc
                SyllabusCoverage.objects.update_or_create(
                    subject_id=subject_id, faculty=request.user, unit_number=unit_number,
                    defaults=defaults
                )

        # ── Update Subject Marks ──
        elif action == 'update_marks':
            subject_id = request.POST.get('subject_id')
            student_id = request.POST.get('student_id')
            internal   = request.POST.get('internal', 0)
            external   = request.POST.get('external', 0)
            grade      = request.POST.get('grade', '')
            total      = float(internal) + float(external)
            if subject_id and student_id:
                Marks.objects.update_or_create(
                    student_id=student_id, subject_id=subject_id,
                    defaults={'internal': internal, 'external': external,
                              'total': total, 'grade': grade}
                )

        return redirect('faculty-dashboard')


# ── SCORE TEMPLATE DOWNLOAD ────────────────────────────────────────────────────
@login_required
def download_score_template(request, course_id):
    course = get_object_or_404(InstitutionCourse, id=course_id)
    if course.created_by == request.user or course.created_by.is_superuser:
        assessments = course.assessments.all()

    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    header = ['roll_no', 'student_name']
    for a in assessments:
        header.append(f'{a.name} (max:{a.max_score})')
    writer.writerow(header)

    # Student rows
    for cohort in course.cohorts.all():
        for student in cohort.students.all():
            row = [student.roll_no, student.user.full_name or student.user.email]
            for a in assessments:
                try:
                    score = StudentCourseScore.objects.get(assessment=a, student=student)
                    row.append(score.score)
                except StudentCourseScore.DoesNotExist:
                    row.append('')
            writer.writerow(row)

    response = HttpResponse(output.getvalue(), content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{course.name}_scores.csv"'
    return response


# ── EXISTING API VIEWS (kept) ──────────────────────────────────────────────────
class FacultySubjectsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        subjects = selectors.get_subjects_by_faculty(request.user.id)
        data = [{"id": s.id, "name": s.name, "code": s.code,
                 "dept": s.department.name, "semester": s.semester} for s in subjects]
        return Response(data)


class PendingCertificationsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        dept_ids = list(request.user.departments.values_list('id', flat=True))
        if request.user.role == 'HOD' and not dept_ids:
            hod_dept = Department.objects.filter(hod=request.user).first()
            if hod_dept:
                dept_ids = [hod_dept.id]
        if not dept_ids:
            return Response([])
        certs = selectors.get_pending_certifications_for_dept(dept_ids)
        data = [{"id": c.id, "title": c.title, "student": c.student.roll_no,
                 "student_id": c.student.id,
                 "issuer": c.issuer, "date": c.issued_date} for c in certs]
        return Response(data)
