"""
Bulk CSV upload for Users and Students.
Admin-only views that allow importing users from CSV files.
"""
import csv
import io
from django.contrib import messages
from django.views.decorators.csrf import csrf_exempt
from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.db import transaction
from django.utils import timezone
from apps.accounts.models import User
from apps.academics.models import Department, Section
from apps.students.models import StudentProfile, SemesterResult


VALID_ROLES = [r[0] for r in User.Role.choices]


def _get_department_by_code_or_name(dept_code: str):
    if not dept_code:
        return None
    try:
        return Department.objects.get(code__iexact=dept_code)
    except Department.DoesNotExist:
        try:
            return Department.objects.get(name__iexact=dept_code)
        except Department.DoesNotExist:
            return None


def _resolve_departments_for_staff(role: str, dept_code: str):
    """
    For Faculty/Mentor: if assigned to AI or AIML, auto-assign both.
    For other roles: single department if provided.
    """
    dept = _get_department_by_code_or_name(dept_code)
    if not dept:
        return []

    if role in ['Faculty', 'Mentor']:
        if dept.code.upper() in ['AI', 'AIML'] or dept.name.upper() in ['AI', 'AIML']:
            ai = Department.objects.filter(code__iexact='AI').first() or Department.objects.filter(name__iexact='AI').first()
            aiml = Department.objects.filter(code__iexact='AIML').first() or Department.objects.filter(name__iexact='AIML').first()
            return [d for d in [ai, aiml] if d]
    return [dept]


@csrf_exempt
@staff_member_required
def bulk_upload_view(request):
    """Main CSV upload page with tabs for Users and Students."""
    context = {
        'title': 'Bulk CSV Upload',
        'valid_roles': VALID_ROLES,
        'departments': Department.objects.all().order_by('code'),
    }

    if request.method == 'POST':
        upload_type = request.POST.get('upload_type', '')
        csv_file = request.FILES.get('csv_file')
        pdf_file = request.FILES.get('pdf_file')

        if upload_type == 'semester_results_pdf':
            result = _import_semester_result_pdf(request, pdf_file)
            if result['created']:
                messages.success(request, result['message'])
            else:
                messages.error(request, result['message'])
            return render(request, 'admin/bulk_upload.html', context)

        if not csv_file:
            messages.error(request, 'Please select a CSV file.')
            return render(request, 'admin/bulk_upload.html', context)

        if not csv_file.name.endswith('.csv'):
            messages.error(request, 'Only .csv files are accepted.')
            return render(request, 'admin/bulk_upload.html', context)

        try:
            decoded = csv_file.read().decode('utf-8-sig')  # Handle BOM
            reader = csv.DictReader(io.StringIO(decoded))
            rows = list(reader)
        except Exception as e:
            messages.error(request, f'Error reading CSV: {e}')
            return render(request, 'admin/bulk_upload.html', context)

        if not rows:
            messages.error(request, 'CSV file is empty.')
            return render(request, 'admin/bulk_upload.html', context)

        if upload_type == 'users':
            result = _import_users(rows)
        elif upload_type == 'students':
            result = _import_students(rows)
        elif upload_type == 'semester_results_csv':
            result = _import_semester_results(rows, request.user)
        else:
            messages.error(request, 'Invalid upload type.')
            return render(request, 'admin/bulk_upload.html', context)

        # Report results
        if result['created']:
            messages.success(request, f"✅ Successfully created {result['created']} records.")
        if result['skipped']:
            messages.warning(request, f"⚠️ Skipped {result['skipped']} rows (duplicates or errors).")
        if result['errors']:
            for err in result['errors'][:20]:  # Show max 20 errors
                messages.error(request, err)
            if len(result['errors']) > 20:
                messages.error(request, f"... and {len(result['errors']) - 20} more errors.")

        return render(request, 'admin/bulk_upload.html', context)

    return render(request, 'admin/bulk_upload.html', context)


def _import_users(rows):
    """
    Import generic users (Director, Examcell, HOD, Mentor, Faculty, Parent, etc.)
    Expected CSV columns: full_name, email, phone, role, department_code, password
    """
    result = {'created': 0, 'skipped': 0, 'errors': []}
    required = {'full_name', 'email', 'role', 'password'}

    headers = set(rows[0].keys()) if rows else set()
    missing = required - headers
    if missing:
        result['errors'].append(f"Missing required columns: {', '.join(missing)}")
        return result

    for i, row in enumerate(rows, start=2):  # Row 2 = first data row
        email = row.get('email', '').strip().lower()
        full_name = row.get('full_name', '').strip()
        role = row.get('role', '').strip()
        phone = row.get('phone', '').strip()
        password = row.get('password', '').strip()
        dept_code = row.get('department_code', '').strip().upper()

        if not email or not role or not password:
            result['errors'].append(f"Row {i}: Missing email, role, or password.")
            result['skipped'] += 1
            continue
        if role in ['Faculty', 'Mentor', 'HOD'] and not dept_code:
            result['errors'].append(f"Row {i}: Department required for role '{role}'.")
            result['skipped'] += 1
            continue

        if role not in VALID_ROLES:
            result['errors'].append(f"Row {i}: Invalid role '{role}'. Valid: {', '.join(VALID_ROLES)}")
            result['skipped'] += 1
            continue

        if User.objects.filter(email__iexact=email).exists():
            result['errors'].append(f"Row {i}: Email '{email}' already exists — skipped.")
            result['skipped'] += 1
            continue

        departments = _resolve_departments_for_staff(role, dept_code) if dept_code else []
        if dept_code and not departments:
            result['errors'].append(f"Row {i}: Department '{dept_code}' not found — skipped.")
            result['skipped'] += 1
            continue

        try:
            user = User.objects.create_user(
                email=email,
                password=password,
                full_name=full_name,
                role=role,
                phone=phone,
                is_active=True,
                is_staff=(role == 'Director'),
                is_superuser=(role == 'Director'),
            )
            if departments:
                user.departments.set(departments)
            if role == 'HOD' and departments:
                # Enforce single department for HOD
                departments[0].hod = user
                departments[0].save(update_fields=['hod', 'updated_at'])
            result['created'] += 1
        except Exception as e:
            result['errors'].append(f"Row {i}: {str(e)}")
            result['skipped'] += 1

    return result


def _import_semester_results(rows, verifier):
    """
    Import semester results for existing students.
    Expected CSV columns:
      roll_no, semester, exam_name, subject_code, subject_name, score, max_score, grade
    """
    result = {'created': 0, 'skipped': 0, 'errors': []}
    required = {'roll_no', 'semester', 'subject_name', 'score'}

    headers = set(rows[0].keys()) if rows else set()
    missing = required - headers
    if missing:
        result['errors'].append(f"Missing required columns: {', '.join(missing)}")
        return result

    for i, row in enumerate(rows, start=2):
        roll_no = row.get('roll_no', '').strip().upper()
        semester = row.get('semester', '').strip()
        subject_name = row.get('subject_name', '').strip()
        if not roll_no or not semester or not subject_name:
            result['errors'].append(f"Row {i}: Missing roll_no, semester, or subject_name.")
            result['skipped'] += 1
            continue

        student = StudentProfile.objects.filter(roll_no__iexact=roll_no).first()
        if not student:
            result['errors'].append(f"Row {i}: Student roll_no '{roll_no}' not found.")
            result['skipped'] += 1
            continue

        try:
            score = float(row.get('score', 0))
            max_score = float(row.get('max_score', 100) or 100)
        except ValueError:
            result['errors'].append(f"Row {i}: score/max_score must be numeric.")
            result['skipped'] += 1
            continue

        obj, created = SemesterResult.objects.update_or_create(
            student=student,
            semester=int(semester),
            exam_name=(row.get('exam_name', 'Semester Exam').strip() or 'Semester Exam'),
            subject_code=row.get('subject_code', '').strip(),
            subject_name=subject_name,
            defaults={
                'score': score,
                'max_score': max_score,
                'grade': row.get('grade', '').strip(),
                'is_verified': True,
                'verified_by': verifier,
                'verified_at': timezone.now(),
                'rejection_reason': '',
            }
        )
        result['created'] += 1 if created else 0

    return result


def _import_semester_result_pdf(request, pdf_file):
    """
    Create/update one semester result using form fields and an uploaded PDF proof.
    """
    if not pdf_file:
        return {'created': False, 'message': 'Please upload a PDF file.'}
    if not pdf_file.name.lower().endswith('.pdf'):
        return {'created': False, 'message': 'Only PDF format is accepted for this upload.'}

    roll_no = request.POST.get('roll_no', '').strip().upper()
    semester = request.POST.get('semester', '').strip()
    subject_name = request.POST.get('subject_name', '').strip()
    score = request.POST.get('score', '').strip()
    if not (roll_no and semester and subject_name and score):
        return {'created': False, 'message': 'roll_no, semester, subject_name, and score are required.'}

    student = StudentProfile.objects.filter(roll_no__iexact=roll_no).first()
    if not student:
        return {'created': False, 'message': f"Student roll_no '{roll_no}' not found."}

    try:
        score_val = float(score)
        max_score_val = float(request.POST.get('max_score', 100) or 100)
    except ValueError:
        return {'created': False, 'message': 'Score and max score must be numeric.'}

    obj, _ = SemesterResult.objects.update_or_create(
        student=student,
        semester=int(semester),
        exam_name=(request.POST.get('exam_name', 'Semester Exam').strip() or 'Semester Exam'),
        subject_code=request.POST.get('subject_code', '').strip(),
        subject_name=subject_name,
        defaults={
            'score': score_val,
            'max_score': max_score_val,
            'grade': request.POST.get('grade', '').strip(),
            'is_verified': True,
            'verified_by': request.user,
            'verified_at': timezone.now(),
            'rejection_reason': '',
        }
    )
    obj.proof = pdf_file
    obj.save(update_fields=['proof', 'updated_at'])
    return {'created': True, 'message': f"Semester result uploaded for {roll_no} ({subject_name})."}


def _import_students(rows):
    """
    Import students — creates User + StudentProfile in one go.
    Expected CSV columns: full_name, email, phone, roll_no, batch, department_code, section, password
    """
    result = {'created': 0, 'skipped': 0, 'errors': []}
    required = {'full_name', 'email', 'roll_no', 'batch', 'department_code', 'password'}

    headers = set(rows[0].keys()) if rows else set()
    missing = required - headers
    if missing:
        result['errors'].append(f"Missing required columns: {', '.join(missing)}")
        return result

    for i, row in enumerate(rows, start=2):
        email = row.get('email', '').strip().lower()
        full_name = row.get('full_name', '').strip()
        phone = row.get('phone', '').strip()
        roll_no = row.get('roll_no', '').strip().upper()
        batch = row.get('batch', '').strip()
        dept_code = row.get('department_code', '').strip().upper()
        section_name = row.get('section', '').strip().upper()
        password = row.get('password', '').strip()

        if not email or not roll_no or not batch or not dept_code or not password:
            result['errors'].append(f"Row {i}: Missing required field(s).")
            result['skipped'] += 1
            continue

        if User.objects.filter(email__iexact=email).exists():
            result['errors'].append(f"Row {i}: Email '{email}' already exists — skipped.")
            result['skipped'] += 1
            continue

        if StudentProfile.objects.filter(roll_no__iexact=roll_no).exists():
            result['errors'].append(f"Row {i}: Roll No '{roll_no}' already exists — skipped.")
            result['skipped'] += 1
            continue

        department = _get_department_by_code_or_name(dept_code)
        if not department:
            result['errors'].append(f"Row {i}: Department '{dept_code}' not found — skipped.")
            result['skipped'] += 1
            continue
        section = None
        if section_name:
            section = Section.objects.filter(department=department, name__iexact=section_name).first()
            if not section:
                result['errors'].append(f"Row {i}: Section '{section_name}' not found for {department.code} — skipped.")
                result['skipped'] += 1
                continue

        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    email=email,
                    password=password,
                    full_name=full_name,
                    role='Student',
                    phone=phone,
                    is_active=True,
                )
                user.departments.set([department])
                StudentProfile.objects.create(
                    user=user,
                    roll_no=roll_no,
                    batch=batch,
                    department=department,
                    section=section,
                )
            result['created'] += 1
        except Exception as e:
            result['errors'].append(f"Row {i}: {str(e)}")
            result['skipped'] += 1

    return result


@staff_member_required
def download_sample_csv(request):
    """Download a sample CSV template for the selected upload type."""
    upload_type = request.GET.get('type', 'users')

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="sample_{upload_type}.csv"'
    writer = csv.writer(response)

    if upload_type == 'students':
        writer.writerow(['full_name', 'email', 'phone', 'roll_no', 'batch', 'department_code', 'section', 'password'])
        writer.writerow(['Ravi Kumar', 'ravi@ciet.edu.in', '9876543210', '22B01A0501', '2022-2026', 'CSE', 'A', 'Welcome@123'])
        writer.writerow(['Priya Sharma', 'priya@ciet.edu.in', '9876543211', '22B01A0502', '2022-2026', 'CSE', 'B', 'Welcome@123'])
        writer.writerow(['Kiran Reddy', 'kiran@ciet.edu.in', '9876543212', '22B01A0301', '2022-2026', 'ECE', 'A', 'Welcome@123'])
    elif upload_type == 'semester_results':
        writer.writerow(['roll_no', 'semester', 'exam_name', 'subject_code', 'subject_name', 'score', 'max_score', 'grade'])
        writer.writerow(['22B01A0501', '4', 'Semester Exam', 'CS401', 'Compiler Design', '78', '100', 'A'])
        writer.writerow(['22B01A0502', '4', 'Semester Exam', 'CS402', 'Operating Systems', '83', '100', 'A+'])
    else:
        writer.writerow(['full_name', 'email', 'phone', 'role', 'department_code', 'password'])
        writer.writerow(['Dr. Ramesh', 'ramesh@ciet.edu.in', '9876543213', 'Faculty', 'CSE', 'Faculty@123'])
        writer.writerow(['Prof. Suresh', 'suresh@ciet.edu.in', '9876543214', 'HOD', 'ECE', 'Hod@12345'])
        writer.writerow(['Dr. Anita', 'anita@ciet.edu.in', '9876543215', 'Director', '', 'Director@123'])

    return response
