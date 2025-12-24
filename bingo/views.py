# Create your views here.


from django.http import HttpResponse
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.contrib.auth.views import LoginView


class LandingLoginView(LoginView):
    template_name = "registration/login.html"
    redirect_authenticated_user = True


def game(request):
    return render(request, "game.html", {"rows": range(4), "cols": range(4)})