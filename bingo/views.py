# Create your views here.


from django.http import HttpResponse
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.contrib.auth.views import LoginView, PasswordChangeView
from django.urls import reverse_lazy



class LandingLoginView(LoginView):
    template_name = "registration/login.html"
    redirect_authenticated_user = True

@login_required
def game(request):
    return render(request, "game.html", {"rows": range(4), "cols": range(4)})


class FirstPasswordChangeView(PasswordChangeView):
    success_url = reverse_lazy("password_change_done")

    def form_valid(self, form):
        resp = super().form_valid(form)
        prof = self.request.user.userprofile
        prof.must_change_password = False
        prof.save(update_fields=["must_change_password"])
        return resp
