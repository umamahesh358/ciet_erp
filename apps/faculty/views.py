import json
import csv
import io
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.decorators import login_required
from django.views import View
from django.views.generic import TemplateView
from django.utils.timezone import now
from django.db.models import Count, Avg, Q, Sum
from django.http import HttpResponse, JsonResponse

from apps.accounts.models import User
from apps.academics.models import Department, Section, Subject, Marks, Attendance
from apps.students.models import StudentProfile
from apps.faculty.models import (
    StudentMentorAssignment, LessonPlan, Timetable, AcademicCalendar,
    TrainingProgram, SyllabusCoverage, Cohort, InstitutionCourse,
    SectionClassTeacherAssignment, SectionTimetable,
    CourseMaterial, CourseAssessment, StudentCourseScore
)
from apps.core.models import Announcement, Event
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


def _get_hod_department(user):
    departments = list(user.departments.all())
    if departments:
        return departments[0]
    return Department.objects.filter(hod=user).first()


def _hod_access_context(request):
    user = request.user
    dept = _get_hod_department(user)
    current_year = f"{now().year}-{now().year + 1}"
    mentors = User.objects.none()
    teachers = User.objects.none()
    sections = Section.objects.none()
    if dept:
        mentors = User.objects.filter(departments=dept, role='Mentor', is_active=True)
        teachers = User.objects.filter(departments=dept, role__in=['Faculty', 'Mentor'], is_active=True)
        sections = Section.objects.filter(department=dept).order_by('name')
    return {
        'dept': dept,
        'current_year': current_year,
        'mentors': mentors,
        'teachers': teachers,
        'sections': sections,
    }


class HODCoursesView(RoleRequiredMixin, View):
    allowed_roles = ['HOD']

    def get(self, request):
        ctx = _hod_access_context(request)
        dept = ctx['dept']
        if not dept:
            return render(request, 'HOD/courses.html', {'no_dept': True})
        subjects = Subject.objects.filter(department=dept).select_related('faculty').order_by('semester', 'code')
        faculty_list = User.objects.filter(departments=dept, role__in=['Faculty', 'Mentor'], is_active=True).order_by('full_name', 'email')
        training_programs = TrainingProgram.objects.filter(department=dept, is_deleted=False).order_by('-start_date')
        return render(request, 'HOD/courses.html', {
            **ctx,
            'subjects': subjects,
            'faculty_list': faculty_list,
            'training_programs': training_programs,
        })

    def post(self, request):
        dept = _get_hod_department(request.user)
        if not dept:
            return redirect('hod-dashboard')
        action = request.POST.get('action')
        current_year = f"{now().year}-{now().year + 1}"
        if action == 'save_subject':
            subject_id = request.POST.get('subject_id')
            payload = {
                'name': request.POST.get('name', '').strip(),
                'code': request.POST.get('code', '').strip(),
                'semester': request.POST.get('semester') or 1,
                'credits': request.POST.get('credits') or 3,
                'type': request.POST.get('type', Subject.SubjectType.THEORY),
                'faculty_id': request.POST.get('faculty_id') or None,
            }
            if payload['name'] and payload['code']:
                if subject_id:
                    subject = get_object_or_404(Subject, id=subject_id, department=dept)
                    for key, value in payload.items():
                        setattr(subject, key, value)
                    subject.department = dept
                    subject.save()
                else:
                    Subject.objects.create(department=dept, **payload)
        elif action == 'assign_course_to_teacher':
            subject_id = request.POST.get('subject_id')
            faculty_id = request.POST.get('faculty_id')
            if subject_id and faculty_id:
                subject = get_object_or_404(Subject, id=subject_id, department=dept)
                subject.faculty_id = faculty_id
                subject.save(update_fields=['faculty', 'updated_at'])
        elif action == 'upload_lesson_plan':
            subject_id = request.POST.get('subject_id')
            acad_year = request.POST.get('academic_year', current_year)
            f = request.FILES.get('file')
            if subject_id and f:
                LessonPlan.objects.create(subject_id=subject_id, department=dept, uploaded_by=request.user, file=f, academic_year=acad_year)
        return redirect('hod-courses')


class HODStudentsView(RoleRequiredMixin, View):
    allowed_roles = ['HOD']

    def get(self, request):
        ctx = _hod_access_context(request)
        dept = ctx['dept']
        if not dept:
            return render(request, 'HOD/students.html', {'no_dept': True})
        students = StudentProfile.objects.filter(department=dept, is_deleted=False).select_related('user', 'section')
        student_reports = []
        section_reports = []
        for section in ctx['sections']:
            section_students = students.filter(section=section)
            total = section_students.count()
            pass_count = section_students.filter(cgpa__gte=5).count()
            attendance_count = sum(Attendance.objects.filter(student=s).count() for s in section_students)
            attendance_present = sum(Attendance.objects.filter(student=s, is_present=True).count() for s in section_students)
            section_reports.append({
                'section': section,
                'student_count': total,
                'pass_pct': round((pass_count / total * 100) if total else 0, 1),
                'attendance_pct': round((attendance_present / attendance_count * 100) if attendance_count else 0, 1),
                'avg_cgpa': round(float(section_students.aggregate(avg=Avg('cgpa'))['avg'] or 0), 2),
            })
        for student in students:
            total_att = Attendance.objects.filter(student=student).count()
            present = Attendance.objects.filter(student=student, is_present=True).count()
            student_reports.append({
                'student': student,
                'pass_status': 'Pass' if float(student.cgpa or 0) >= 5 else 'Fail',
                'attendance_pct': round((present / total_att * 100) if total_att else 0, 1),
                'marks_avg': round(float(Marks.objects.filter(student=student).aggregate(avg=Avg('total'))['avg'] or 0), 1),
            })
        college_total = students.count()
        college_pass_pct = round((students.filter(cgpa__gte=5).count() / college_total * 100) if college_total else 0, 1)
        college_attendance_count = sum(Attendance.objects.filter(student=s).count() for s in students)
        college_attendance_present = sum(Attendance.objects.filter(student=s, is_present=True).count() for s in students)
        college_attendance_pct = round((college_attendance_present / college_attendance_count * 100) if college_attendance_count else 0, 1)
        college_avg_cgpa = round(float(students.aggregate(avg=Avg('cgpa'))['avg'] or 0), 2)
        college_chart_values = [college_pass_pct, college_attendance_pct, college_avg_cgpa]
        section_labels = [r['section'].name for r in section_reports]
        section_pass_values = [r['pass_pct'] for r in section_reports]
        section_attendance_values = [r['attendance_pct'] for r in section_reports]
        return render(request, 'HOD/students.html', {
            **ctx,
            'students': students,
            'section_reports': section_reports,
            'student_reports': student_reports,
            'college_total': college_total,
            'college_pass_pct': college_pass_pct,
            'college_attendance_pct': college_attendance_pct,
            'college_avg_cgpa': college_avg_cgpa,
            'college_chart_values': college_chart_values,
            'section_labels': section_labels,
            'section_pass_values': section_pass_values,
            'section_attendance_values': section_attendance_values,
        })


class HODFacultyView(RoleRequiredMixin, View):
    allowed_roles = ['HOD']

    def get(self, request):
        ctx = _hod_access_context(request)
        dept = ctx['dept']
        if not dept:
            return render(request, 'HOD/faculty.html', {'no_dept': True})
        faculty = User.objects.filter(departments=dept, role__in=['Faculty', 'Mentor'], is_active=True).order_by('role', 'full_name', 'email')
        dept_students = StudentProfile.objects.filter(department=dept, is_deleted=False).select_related('user', 'section').order_by('roll_no')
        mentor_assignments = StudentMentorAssignment.objects.filter(academic_year=ctx['current_year'], students__department=dept).distinct()
        class_assignments = SectionClassTeacherAssignment.objects.filter(academic_year=ctx['current_year'], section__department=dept).select_related('section', 'teacher')
        return render(request, 'HOD/faculty.html', {
            **ctx,
            'faculty': faculty,
            'dept_students': dept_students,
            'mentor_assignments': mentor_assignments,
            'class_assignments': class_assignments,
        })

    def post(self, request):
        dept = _get_hod_department(request.user)
        if not dept:
            return redirect('hod-faculty')
        action = request.POST.get('action')
        current_year = f"{now().year}-{now().year + 1}"

        if action == 'assign_mentor_students':
            mentor_id = request.POST.get('mentor_id')
            student_ids = request.POST.getlist('student_ids')
            if mentor_id and student_ids:
                assignment, _ = StudentMentorAssignment.objects.update_or_create(
                    mentor_id=mentor_id,
                    academic_year=current_year,
                    defaults={'assigned_by': request.user},
                )
                assignment.students.set(student_ids)
                messages.success(request, 'Mentor assignment saved.')

        elif action == 'assign_class_teacher':
            section_id = request.POST.get('section_id')
            teacher_id = request.POST.get('teacher_id')
            academic_year = request.POST.get('academic_year', current_year)
            if section_id and teacher_id:
                section = get_object_or_404(Section, id=section_id, department=dept)
                SectionClassTeacherAssignment.objects.update_or_create(
                    section=section,
                    academic_year=academic_year,
                    defaults={'teacher_id': teacher_id, 'assigned_by': request.user},
                )
                messages.success(request, 'Class teacher assignment saved.')

        return redirect('hod-faculty')


class HODTimetableView(RoleRequiredMixin, View):
    allowed_roles = ['HOD']

    def get(self, request):
        ctx = _hod_access_context(request)
        dept = ctx['dept']
        if not dept:
            return render(request, 'HOD/timetable.html', {'no_dept': True})
        sem_timetables = Timetable.objects.filter(department=dept, is_deleted=False).order_by('-created_at')
        class_timetables = SectionTimetable.objects.filter(department=dept, is_deleted=False).select_related('section').order_by('-created_at')
        calendars = AcademicCalendar.objects.filter(department=dept, is_deleted=False).order_by('-created_at')
        events = Event.objects.filter(is_deleted=False).order_by('-date')[:8]
        return render(request, 'HOD/timetable.html', {
            **ctx,
            'sem_timetables': sem_timetables,
            'class_timetables': class_timetables,
            'calendars': calendars,
            'events': events,
        })

    def post(self, request):
        dept = _get_hod_department(request.user)
        if not dept:
            return redirect('hod-dashboard')
        action = request.POST.get('action')
        current_year = f"{now().year}-{now().year + 1}"
        if action == 'upload_sem_timetable':
            semester = request.POST.get('semester')
            valid_from = request.POST.get('valid_from')
            f = request.FILES.get('file')
            if semester and valid_from and f:
                Timetable.objects.create(department=dept, uploaded_by=request.user, semester=semester, valid_from=valid_from, file=f, academic_year=current_year)
        elif action == 'upload_class_timetable':
            section_id = request.POST.get('section_id')
            semester = request.POST.get('semester')
            valid_from = request.POST.get('valid_from')
            f = request.FILES.get('file')
            if section_id and semester and valid_from and f:
                section = get_object_or_404(Section, id=section_id, department=dept)
                SectionTimetable.objects.create(department=dept, section=section, uploaded_by=request.user, semester=semester, valid_from=valid_from, file=f, academic_year=current_year)
        elif action == 'upload_calendar':
            title = request.POST.get('title', '').strip()
            semester = request.POST.get('semester')
            f = request.FILES.get('file')
            if title and semester and f:
                AcademicCalendar.objects.create(department=dept, uploaded_by=request.user, title=title, academic_year=current_year, semester=semester, file=f)
        elif action == 'create_event':
            title = request.POST.get('title', '').strip()
            description = request.POST.get('description', '').strip()
            date = request.POST.get('date')
            location = request.POST.get('location', '').strip()
            image = request.FILES.get('image')
            if title and description and date and location:
                Event.objects.create(title=title, description=description, date=date, location=location, image=image, created_by=request.user)
        return redirect('hod-timetable')


class HODEventsView(RoleRequiredMixin, View):
    allowed_roles = ['HOD']

    def get(self, request):
        ctx = _hod_access_context(request)
        events = Event.objects.filter(is_deleted=False).order_by('-date')
        return render(request, 'HOD/events.html', {**ctx, 'events': events})

    def post(self, request):
        action = request.POST.get('action')
        if action == 'create_event':
            title = request.POST.get('title', '').strip()
            description = request.POST.get('description', '').strip()
            date = request.POST.get('date')
            location = request.POST.get('location', '').strip()
            image = request.FILES.get('image')
            if title and description and date and location:
                Event.objects.create(title=title, description=description, date=date, location=location, image=image, created_by=request.user)
        return redirect('hod-events')


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
            return render(request, 'HOD/hod_dashboard.html', {'no_dept': True})

        # ── Faculty in dept ──
        faculty_list = User.objects.filter(
            departments=dept, role__in=['Faculty', 'Mentor'], is_active=True
        ).annotate(subject_count=Count('subjects_taught')).order_by('full_name', 'email')

        # ── Mentor list for assignment ──
        mentors = User.objects.filter(departments=dept, role='Mentor', is_active=True)
        teachers = User.objects.filter(departments=dept, role__in=['Faculty', 'Mentor'], is_active=True)
        sections = Section.objects.filter(department=dept).order_by('name')

        current_year = f"{now().year}-{now().year + 1}"
        direct_assignments = StudentMentorAssignment.objects.filter(
            academic_year=current_year,
            students__department=dept
        ).distinct()
        class_teacher_assignments = SectionClassTeacherAssignment.objects.filter(
            academic_year=current_year,
            section__department=dept
        ).select_related('section', 'teacher', 'assigned_by').order_by('section__name')

        dept_students = StudentProfile.objects.filter(
            department=dept, is_deleted=False
        ).select_related('user', 'section')

        assigned_student_ids = set(
            StudentMentorAssignment.objects.filter(
                academic_year=current_year,
                students__department=dept
            ).values_list('students__id', flat=True)
        )

        total_students = dept_students.count()
        avg_cgpa = dept_students.aggregate(avg=Avg('cgpa'))['avg'] or 0
        pass_count = dept_students.filter(cgpa__gte=5).count()
        fail_count = max(total_students - pass_count, 0)
        mentor_assigned = len(assigned_student_ids)
        mentor_unassigned = max(total_students - mentor_assigned, 0)

        attendance_rows = []
        total_attendance_records = 0
        total_present_records = 0
        for student in dept_students:
            total_att = Attendance.objects.filter(student=student).count()
            present = Attendance.objects.filter(student=student, is_present=True).count()
            total_attendance_records += total_att
            total_present_records += present
            attendance_rows.append({
                'student': student,
                'total': total_att,
                'present': present,
                'percentage': round((present / total_att * 100) if total_att else 0, 1),
                'status': 'Pass' if float(student.cgpa or 0) >= 5 else 'Fail',
            })
        overall_attendance_pct = round((total_present_records / total_attendance_records * 100) if total_attendance_records else 0, 1)

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
        principal_labels = ['Avg CGPA', 'Mentor Assigned', 'Mentor Unassigned', 'Attendance %', 'Pass %']
        principal_values = [
            round(float(avg_cgpa), 2),
            mentor_assigned,
            mentor_unassigned,
            overall_attendance_pct,
            round((pass_count / total_students * 100) if total_students else 0, 1),
        ]

        section_reports = []
        for section in sections:
            section_students = dept_students.filter(section=section)
            section_total = section_students.count()
            section_pass = section_students.filter(cgpa__gte=5).count()
            section_fail = max(section_total - section_pass, 0)
            section_att_total = 0
            section_att_present = 0
            for student in section_students:
                total_att = Attendance.objects.filter(student=student).count()
                present = Attendance.objects.filter(student=student, is_present=True).count()
                section_att_total += total_att
                section_att_present += present
            section_reports.append({
                'section': section,
                'student_count': section_total,
                'pass_count': section_pass,
                'fail_count': section_fail,
                'avg_cgpa': round(float(section_students.aggregate(avg=Avg('cgpa'))['avg'] or 0), 2),
                'attendance_pct': round((section_att_present / section_att_total * 100) if section_att_total else 0, 1),
                'class_teacher': next((a.teacher for a in class_teacher_assignments if a.section_id == section.id), None),
            })

        subject_rows = list(Subject.objects.filter(department=dept).select_related('faculty').order_by('semester', 'code'))

        return render(request, 'HOD/hod_dashboard.html', {
            'dept':               dept,
            'faculty_list':       faculty_list,
            'mentors':            mentors,
            'teachers':           teachers,
            'sections':           sections,
            'class_teacher_assignments': class_teacher_assignments,
            'direct_assignments': direct_assignments,
            'dept_students':      dept_students,
            'student_reports':    attendance_rows,
            'section_reports':    section_reports,
            'current_year':       current_year,
            'lesson_plans':       lesson_plans,
            'timetables':         timetables,
            'calendars':          calendars,
            'training_programs':  training_programs,
            'announcements':      announcements,
            'announcement_categories': Announcement.Category.choices,
            'syllabus_summary':   list(syllabus_summary),
            'subjects':           subject_rows,
            'total_students':     total_students,
            'avg_cgpa':           round(float(avg_cgpa), 2),
            'pass_count':         pass_count,
            'fail_count':         fail_count,
            'mentor_assigned':    mentor_assigned,
            'mentor_unassigned':  mentor_unassigned,
            'attendance_pct':     overall_attendance_pct,
            'perf_labels':        perf_labels,
            'perf_values':        perf_values,
            'principal_labels':   principal_labels,
            'principal_values':   principal_values,
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
                messages.success(request, 'Mentor assignment saved.')

        elif action == 'assign_class_teacher':
            section_id = request.POST.get('section_id')
            teacher_id = request.POST.get('teacher_id')
            academic_year = request.POST.get('academic_year', current_year)
            if section_id and teacher_id:
                section = get_object_or_404(Section, id=section_id, department=dept)
                SectionClassTeacherAssignment.objects.update_or_create(
                    section=section,
                    academic_year=academic_year,
                    defaults={'teacher_id': teacher_id, 'assigned_by': request.user}
                )
                messages.success(request, 'Class teacher assignment saved.')

        elif action == 'save_subject':
            subject_id = request.POST.get('subject_id')
            payload = {
                'name': request.POST.get('name', '').strip(),
                'code': request.POST.get('code', '').strip(),
                'semester': request.POST.get('semester') or 1,
                'credits': request.POST.get('credits') or 3,
                'type': request.POST.get('type', Subject.SubjectType.THEORY),
                'faculty_id': request.POST.get('faculty_id') or None,
            }
            if payload['name'] and payload['code']:
                if subject_id:
                    subject = get_object_or_404(Subject, id=subject_id, department=dept)
                    for key, value in payload.items():
                        setattr(subject, key, value)
                    subject.department = dept
                    subject.save()
                else:
                    Subject.objects.create(department=dept, **payload)
                messages.success(request, 'Curriculum updated.')

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
                messages.success(request, 'Training session saved.')

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
                    messages.success(request, 'Training session updated.')

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
                messages.success(request, 'Announcement published.')

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
