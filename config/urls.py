"""
URL configuration for myerp project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

from apps.core.views import (
    DashboardView, StudentListView, FacultyListView,
    EventListView, EventCreateView
)
from apps.core.search_views import GlobalSearchView
from apps.students.urls import ui_urlpatterns as student_ui_urlpatterns
from apps.faculty.urls import ui_urlpatterns as faculty_ui_urlpatterns
from apps.accounts.bulk_upload import bulk_upload_view, download_sample_csv

urlpatterns = [
    path('', DashboardView.as_view(), name='dashboard'),
    path('students/', StudentListView.as_view(), name='ui-students'),
    path('faculty/', FacultyListView.as_view(), name='ui-faculty'),
    path('events/', include([
        path('', EventListView.as_view(), name='event-list'),
        path('create/', EventCreateView.as_view(), name='event-create'),
    ])),
    path('api/v1/core/search/', GlobalSearchView.as_view(), name='global-search'),
    # Bulk CSV upload (must be BEFORE admin/ to catch the custom URL)
    path('admin/bulk-upload/', bulk_upload_view, name='admin-bulk-upload'),
    path('admin/download-sample-csv/', download_sample_csv, name='admin-download-sample-csv'),
    path('admin/login/', ensure_csrf_cookie(admin.site.login), name='admin-login'),
    path('admin/', admin.site.urls),
    path('accounts/', include('apps.accounts.urls')),
    # Student portal UI (all under /student/)
    path('student/', include(student_ui_urlpatterns)),
    # Faculty portal UI (all under /faculty-portal/)
    path('faculty-portal/', include(faculty_ui_urlpatterns)),
    # Parent portal
    path('parent/', include('apps.parents.urls')),
    # Notifications
    path('notifications/', include('apps.notifications.urls')),
    # Backwards-compat redirects for stale browser cache
    path('api/v1/students/portal/', RedirectView.as_view(url='/student/portal/', permanent=False)),
    path('student-portal/', RedirectView.as_view(url='/student/portal/', permanent=False)),

    # API Version 1
    path('api/v1/auth/', include(('apps.accounts.urls', 'accounts'), namespace='api-auth')),
    path('api/v1/students/', include('apps.students.urls')),
    path('api/v1/faculty/', include('apps.faculty.urls')),

    # Schema & Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
