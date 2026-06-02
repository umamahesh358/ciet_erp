from apps.messaging.services import unread_count


def messaging_context(request):
    if not getattr(request, 'user', None) or not request.user.is_authenticated:
        return {'direct_message_unread_count': 0}
    return {'direct_message_unread_count': unread_count(request.user)}
