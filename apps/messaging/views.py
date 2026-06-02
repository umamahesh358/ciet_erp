from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils.timezone import now
from django.views.decorators.http import require_GET, require_POST

from apps.accounts.models import User
from apps.messaging.models import DirectMessage
from apps.messaging.services import (
    allowed_recipient_queryset,
    can_send_message,
    message_payload,
    recipient_payload,
    unread_count,
)


@login_required
@require_GET
def inbox(request):
    user = request.user
    DirectMessage.objects.filter(
        recipient=user,
        read_at__isnull=True,
        is_deleted=False,
    ).update(read_at=now())

    messages = DirectMessage.objects.filter(
        is_deleted=False,
    ).filter(
        sender=user,
    ) | DirectMessage.objects.filter(
        is_deleted=False,
        recipient=user,
    )

    messages = messages.select_related('sender', 'recipient').order_by('-created_at')[:80]
    recipients = allowed_recipient_queryset(user).select_related('student_profile').order_by('role', 'full_name', 'email')

    return JsonResponse({
        'messages': [message_payload(message, user) for message in messages],
        'recipients': [recipient_payload(recipient) for recipient in recipients],
        'can_compose': user.role in ['Faculty', 'HOD', 'Mentor'],
        'reply_only': user.role == 'Student',
        'unread_count': 0,
    })


@login_required
@require_GET
def unread(request):
    return JsonResponse({'unread_count': unread_count(request.user)})


@login_required
@require_POST
def send(request):
    recipient_id = request.POST.get('recipient_id', '').strip()
    body = request.POST.get('body', '').strip()
    parent_id = request.POST.get('parent_id', '').strip()

    if not recipient_id or not body:
        return JsonResponse({'ok': False, 'error': 'Choose a recipient and write a message.'}, status=400)
    if len(body) > 2000:
        return JsonResponse({'ok': False, 'error': 'Message is too long.'}, status=400)

    recipient = get_object_or_404(User, id=recipient_id, is_active=True)
    if not can_send_message(request.user, recipient):
        return JsonResponse({'ok': False, 'error': 'You are not allowed to message this user.'}, status=403)

    parent = None
    if parent_id:
        parent = DirectMessage.objects.filter(
            id=parent_id,
            is_deleted=False,
        ).filter(
            sender__in=[request.user, recipient],
            recipient__in=[request.user, recipient],
        ).first()

    message = DirectMessage.objects.create(
        sender=request.user,
        recipient=recipient,
        body=body,
        parent=parent,
    )

    return JsonResponse({
        'ok': True,
        'message': message_payload(message, request.user),
    })
