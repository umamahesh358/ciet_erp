from django.http import HttpResponseForbidden
from django.middleware.csrf import get_token


class EnsureCsrfCookieMiddleware:
    """
    Ensures CSRF cookie is set on safe requests.
    Helps prevent CSRF token mismatch on auth forms.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Touch CSRF token early so CsrfViewMiddleware can set cookie
        if request.method in ('GET', 'HEAD', 'OPTIONS', 'TRACE'):
            get_token(request)
        return self.get_response(request)


class RoleMiddleware:
    ROLE_URL_MAP = {
        '/faculty/':       ['HOD', 'Mentor', 'Faculty'],
        '/students/':      ['Director', 'HOD', 'Mentor', 'Faculty', 'Examcell'],
        '/student/':       ['Student', 'HOD', 'Mentor', 'Faculty', 'Examcell'],
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            if request.user.is_superuser:
                return self.get_response(request)
            for prefix, roles in self.ROLE_URL_MAP.items():
                if request.path.startswith(prefix):
                    if request.user.role not in roles:
                        return HttpResponseForbidden('Access Denied')
        return self.get_response(request)
