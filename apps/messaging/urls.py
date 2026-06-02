from django.urls import path

from apps.messaging import views


app_name = 'messaging'

urlpatterns = [
    path('inbox/', views.inbox, name='inbox'),
    path('unread/', views.unread, name='unread'),
    path('send/', views.send, name='send'),
]
