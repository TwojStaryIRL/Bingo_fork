from django.shortcuts import redirect
from django.urls import reverse

class ForcePasswordChangeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            prof = getattr(request.user, "userprofile", None)
            if prof and prof.must_change_password:
                allowed = {
                    reverse("password_change"),        # /accounts/password_change/
                    reverse("password_change_done"),   # /accounts/password_change/done/
                    reverse("logout"),                 # /accounts/logout/
                }
                if request.path not in allowed:
                    return redirect("password_change")
        return self.get_response(request)