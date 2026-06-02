from django.contrib import admin

from apps.messaging.models import DirectMessage


@admin.register(DirectMessage)
class DirectMessageAdmin(admin.ModelAdmin):
    list_display = ('sender', 'recipient', 'created_at', 'read_at', 'is_deleted')
    list_filter = ('sender__role', 'recipient__role', 'read_at', 'is_deleted')
    search_fields = ('sender__email', 'sender__full_name', 'recipient__email', 'recipient__full_name', 'body')
    readonly_fields = ('created_at', 'updated_at')
