from django.db.models import Q

from apps.accounts.models import User
from apps.academics.models import Department
from apps.faculty.models import StudentMentorAssignment
from apps.students.models import StudentProfile
from apps.messaging.models import DirectMessage


STAFF_ROLES = ['Faculty', 'HOD', 'Mentor']


def display_name(user):
    if not user:
        return 'Unknown'
    name = user.full_name or user.email
    if user.role == User.Role.STUDENT and hasattr(user, 'student_profile'):
        return f'{name} ({user.student_profile.roll_no})'
    return f'{name} ({user.role})'


def user_departments(user):
    departments = list(user.departments.all())
    if user.role == User.Role.HOD and not departments:
        hod_dept = Department.objects.filter(hod=user).first()
        if hod_dept:
            departments = [hod_dept]
    if user.role == User.Role.STUDENT and hasattr(user, 'student_profile'):
        departments = [user.student_profile.department]
    return departments


def _student_users_for_departments(departments):
    return User.objects.filter(
        role=User.Role.STUDENT,
        is_active=True,
        student_profile__department__in=departments,
        student_profile__is_deleted=False,
    )


def _mentor_student_users(user):
    assignments = StudentMentorAssignment.objects.filter(mentor=user)
    return User.objects.filter(
        role=User.Role.STUDENT,
        is_active=True,
        student_profile__direct_mentor_assignments__in=assignments,
        student_profile__is_deleted=False,
    )


def allowed_recipient_queryset(user):
    if not user.is_authenticated:
        return User.objects.none()

    if user.role == User.Role.STUDENT:
        sender_ids = DirectMessage.objects.filter(
            recipient=user,
            is_deleted=False,
        ).values_list('sender_id', flat=True)
        return User.objects.filter(id__in=sender_ids, is_active=True)

    departments = user_departments(user)
    if user.role == User.Role.FACULTY:
        if departments:
            return _student_users_for_departments(departments).distinct()
        return User.objects.filter(role=User.Role.STUDENT, is_active=True)

    if user.role == User.Role.HOD:
        if departments:
            return User.objects.filter(
                Q(role=User.Role.STUDENT, student_profile__department__in=departments) |
                Q(role__in=[User.Role.FACULTY, User.Role.MENTOR], departments__in=departments),
                is_active=True,
            ).exclude(id=user.id).distinct()
        return User.objects.filter(
            role__in=[User.Role.STUDENT, User.Role.FACULTY, User.Role.MENTOR],
            is_active=True,
        ).exclude(id=user.id)

    if user.role == User.Role.MENTOR:
        staff = User.objects.none()
        students = _mentor_student_users(user)
        if departments:
            staff = User.objects.filter(
                role__in=[User.Role.FACULTY, User.Role.HOD],
                departments__in=departments,
                is_active=True,
            )
            dept_students = _student_users_for_departments(departments)
            students = (students | dept_students).distinct()
        return (staff | students).exclude(id=user.id).distinct()

    return User.objects.none()


def can_send_message(sender, recipient):
    if not sender.is_authenticated or not recipient or sender.id == recipient.id:
        return False
    return allowed_recipient_queryset(sender).filter(id=recipient.id).exists()


def message_payload(message, viewer):
    return {
        'id': str(message.id),
        'sender_id': str(message.sender_id),
        'recipient_id': str(message.recipient_id),
        'sender': display_name(message.sender),
        'recipient': display_name(message.recipient),
        'body': message.body,
        'created_at': message.created_at.strftime('%d %b %Y, %I:%M %p'),
        'direction': 'sent' if message.sender_id == viewer.id else 'received',
        'can_reply': message.sender_id != viewer.id and can_send_message(viewer, message.sender),
        'is_read': bool(message.read_at),
    }


def recipient_payload(user):
    return {
        'id': str(user.id),
        'name': display_name(user),
        'role': user.role,
    }


def unread_count(user):
    if not user.is_authenticated:
        return 0
    return DirectMessage.objects.filter(
        recipient=user,
        read_at__isnull=True,
        is_deleted=False,
    ).count()
