from django.contrib import admin
from django.urls import path, include
from bingo.views import LandingLoginView
from bingo.views import game # tu import nazwy z patha z appki (komentarz do pierwszego żebyśmy wiedzieli jak uzywać potem usunąć)

urlpatterns = [
    # path("", home,name='home'),
    path("", LandingLoginView.as_view(), name="landing_login"),
    path("accounts/login/", LandingLoginView.as_view(), name="login"),
    path('admin/', admin.site.urls),
    path("game/", game, name="game"), 
    path("accounts/", include("django.contrib.auth.urls")), # dodane game page które ma nazwę game (komentarz do pierwszego żebyśmy wiedzieli jak uzywać potem usunąć)
]

