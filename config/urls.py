"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
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
from bingo.views import LandingLoginView
from bingo.views import game 
from bingo.views import save_board
from bingo.views import raffle
from bingo.views import raffle_reroll_all
from bingo.views import raffle_shuffle_use
from bingo.views import raffle_unlock_next



urlpatterns = [
    path("", LandingLoginView.as_view(), name="landing_login"),
    path("accounts/login/", LandingLoginView.as_view(), name="login"),
    path('admin/', admin.site.urls),
    path("game/", game, name="game"), 
    path("accounts/", include("django.contrib.auth.urls")), 
    path("game/save/", save_board, name="save_board"),
    path("raffle/", raffle, name="raffle"),
    path("raffle/reroll/", raffle_reroll_all, name="raffle_reroll_all"),
    path("raffle/shuffle/", raffle_shuffle_use, name="raffle_shuffle_use"),
    path("raffle/unlock/", raffle_unlock_next, name="raffle_unlock_next"),
]

