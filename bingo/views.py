# Create your views here.

import json
import re

from django.contrib.staticfiles import finders
from django.http import JsonResponse, HttpResponseBadRequest
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.contrib.auth.views import LoginView
from django.contrib.auth import get_user_model
from django.views.decorators.http import require_POST
from django.urls import reverse

from .user_plugins import get_user_plugin
from .models import BingoBoard
from .raffle_algorithm import generate_initial_state,reroll_one_grid,consume_shuffle



class LandingLoginView(LoginView):
    template_name = "registration/login.html"
    redirect_authenticated_user = True

User = get_user_model()

@login_required
def game(request):
    # lista userów do dropdowna - bez staff i superuserów
    users = (
        User.objects
        .filter(is_active=True, is_staff=False, is_superuser=False)
        .order_by("username")
        .values_list("username", flat=True)
    )

    # zapis planszy 
    board = BingoBoard.objects.filter(user=request.user).first()
    saved_grid = board.grid if board else {}

    # plugin personalny dla danego usera, żeby nie ładować wszystkiego
    plugin_path = None
    username = request.user.username or ""

    # szukanie nazwy pliku po userze
    if re.match(r"^[a-zA-Z0-9_-]+$", username):
        candidate = f"bingo/js/plugins/{username}.js"
        if finders.find(candidate):
            plugin_path = candidate

    #sfx load per user
    plugin_cfg = get_user_plugin(request.user.username)
    plugin_path = plugin_cfg.js_plugin if plugin_cfg else None
    plugin_sfx = plugin_cfg.sfx if plugin_cfg else {}




    # render jak wcześniej
    return render(request, "game.html", {
        "rows": range(4),   # albo to co masz obecnie
        "cols": range(4),
        "usernames": list(users),
        "saved_grid": saved_grid,
        "plugin_path": plugin_path,
        "plugin_sfx": plugin_sfx,
    })
    # old code
    # return render(request, "game.html", {"rows": range(4), "cols": range(4)})


#!SECTION - zapis do bay danych - jako user + email + json z tą tabelką 4x4
@login_required
@require_POST
def save_board(request):
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        return HttpResponseBadRequest("Invalid JSON")

    grid = payload.get("grid")
    if not isinstance(grid, list):
        return HttpResponseBadRequest("Missing grid")

    # email
    email = (payload.get("email") or request.user.email or "").strip()

    BingoBoard.objects.update_or_create(
        user=request.user,
        defaults={"email": email, "grid": payload},
    )

    return JsonResponse({"ok": True})
@login_required
def raffle(request):
    session_patch, grids_2d = generate_initial_state(request.user, grids_count=3, size=4)

    for k, v in session_patch.items():
        request.session[k] = v
    request.session.modified = True

    return render(request, "raffle.html", {"grids": grids_2d})



@login_required
@require_POST
def raffle_reroll_all(request):
    ok, status, payload, session_patch = reroll_one_grid(
        current_user=request.user,
        session_data=dict(request.session),
        post_data=request.POST,
        size=4,
    )

    if session_patch:
        for k, v in session_patch.items():
            request.session[k] = v
        request.session.modified = True

    return JsonResponse(payload, status=status)


@login_required
@require_POST
def raffle_shuffle_use(request):
    ok, status, payload, session_patch = consume_shuffle(dict(request.session))

    if session_patch:
        for k, v in session_patch.items():
            request.session[k] = v
        request.session.modified = True

    return JsonResponse(payload, status=status)