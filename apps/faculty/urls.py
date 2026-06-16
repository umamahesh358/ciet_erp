from django.urls import path
from apps.faculty import views

# ── Faculty Portal UI URLs ──────────────────────────────────────────────────
ui_urlpatterns = [
    path('hod/',     views.HODDashboardView.as_view(),    name='hod-dashboard'),
    path('mentor/',  views.MentorDashboardView.as_view(), name='mentor-dashboard'),
    path('mentor/profile/', views.MentorTemplatePageView.as_view(template_name='faculty/Mentor-Dashboard/mentor_profile.html'), name='mentor-profile'),
    path('mentor/students/', views.MentorTemplatePageView.as_view(template_name='faculty/Mentor-Dashboard/assigned_students.html'), name='mentor-students'),
    path('mentor/courses/', views.MentorTemplatePageView.as_view(template_name='faculty/Mentor-Dashboard/courses.html'), name='mentor-courses'),
    path('mentor/assign-marks/', views.MentorTemplatePageView.as_view(template_name='faculty/Mentor-Dashboard/assign_marks.html'), name='mentor-assign-marks'),
    path('mentor/upload-attendance/', views.MentorTemplatePageView.as_view(template_name='faculty/Mentor-Dashboard/upload_attendance.html'), name='mentor-upload-attendance'),
    path('mentor/cohorts/', views.MentorTemplatePageView.as_view(template_name='faculty/Mentor-Dashboard/cohorts.html'), name='mentor-cohorts'),
    path('portal/',  views.FacultyDashboardView.as_view(), name='faculty-dashboard'),
    path('portal/cohorts/', views.FacultyHubCohortsView.as_view(), name='faculty-cohorts'),
    path('portal/explore-students/', views.FacultyHubExploreStudentsView.as_view(), name='faculty-explore-students'),
    path('portal/hod-updates/', views.FacultyHubHodUpdatesView.as_view(), name='faculty-hod-updates'),
    path('portal/courses/', views.FacultyHubCoursesView.as_view(), name='faculty-courses'),
    path('portal/institution-courses/', views.FacultyHubInstitutionCoursesView.as_view(), name='faculty-institution-courses'),
    path('portal/settings/', views.FacultyHubSettingsView.as_view(), name='faculty-settings'),
    path('courses/<str:course_id>/score-template/',
         views.download_score_template, name='score-template-download'),
]

# ── Legacy API URLs (kept for backward compat) ─────────────────────────────
urlpatterns = [
    path('subjects/',      views.FacultySubjectsView.as_view(),      name='faculty-subjects'),
    path('pending-certs/', views.PendingCertificationsView.as_view(), name='pending-certs'),
]
