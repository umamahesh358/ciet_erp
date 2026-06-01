from django.urls import path
from apps.faculty import views

# ── Faculty Portal UI URLs ──────────────────────────────────────────────────
ui_urlpatterns = [
    path('hod/',     views.HODDashboardView.as_view(),    name='hod-dashboard'),
    path('hod/courses/', views.HODCoursesView.as_view(), name='hod-courses'),
    path('hod/students/', views.HODStudentsView.as_view(), name='hod-students'),
    path('hod/faculty/', views.HODFacultyView.as_view(), name='hod-faculty'),
    path('hod/timetable/', views.HODTimetableView.as_view(), name='hod-timetable'),
    path('hod/events/', views.HODEventsView.as_view(), name='hod-events'),
    path('mentor/',  views.MentorDashboardView.as_view(), name='mentor-dashboard'),
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
