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
from django.db import transaction

from .user_plugins import get_user_plugin
from .models import BingoBoard,RaffleState
from .raffle_algorithm import generate_initial_state,reroll_one_grid,consume_shuffle,to_grids_2d
        


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
    state, _ = RaffleState.objects.get_or_create(user=request.user)

    payload = state.generated_board_payload or {}
    grids_2d = payload.get("grids_2d")

    # dodatkowo: jeśli raffle_grids jest złe (np. 2D), też regeneruj
    from .raffle_algorithm import normalize_grids

    raffle_grids_ok = normalize_grids(payload.get("raffle_grids")) is not None

    if not (isinstance(grids_2d, list) and grids_2d) or not raffle_grids_ok:
        session_patch, grids_2d = generate_initial_state(request.user, grids_count=3, size=4)

        state.generated_board_payload = {
            **session_patch,      # ✅ raffle_grids (flat), raffle_used_sets, raffle_rerolls_used, raffle_shuffles_used
            "grids_2d": grids_2d, # ✅ do rendera w HTML
            "size": 4,
            "grids_count": 3,
        }
        state.save(update_fields=["generated_board_payload", "updated_at"])

    return render(request, "raffle.html", {
        "grids": grids_2d,
        "rerolls_left": state.rerolls_left,
        "shuffles_left": state.shuffles_left,
    })
@login_required
@require_POST
def raffle_reroll_all(request):
    with transaction.atomic():
        state, _ = RaffleState.objects.select_for_update().get_or_create(user=request.user)

        if state.rerolls_left <= 0:
            return JsonResponse({
                "ok": False,
                "error": "Chcialoby sie wiecej co ?",
                "rerolls_left": 0,
                "shuffles_left": state.shuffles_left,
            }, status=429)

        ok, status, payload, patch = reroll_one_grid(
            current_user=request.user,
            session_data=state.generated_board_payload or {},
            post_data=request.POST,
            size=4,
        )

        if not isinstance(payload, dict):
            payload = {"ok": False, "error": "Invalid server payload"}

        if not ok:
            payload.setdefault("ok", False)
            payload.setdefault("rerolls_left", state.rerolls_left)
            payload.setdefault("shuffles_left", state.shuffles_left)
            return JsonResponse(payload, status=status)

        # --- sukces ---
        state.rerolls_left = max(0, state.rerolls_left - 1)

        new_payload = dict(state.generated_board_payload or {})
        if isinstance(patch, dict) and patch:
            new_payload.update(patch)

        size = int(new_payload.get("size") or 4)

        # przelicz zawsze na grids_2d i zapisz
        grids_2d_all = None
        if isinstance(new_payload.get("raffle_grids"), list):
            grids_2d_all = to_grids_2d(new_payload["raffle_grids"], size=size)
            new_payload["grids_2d"] = grids_2d_all

        state.generated_board_payload = new_payload
        state.save(update_fields=["rerolls_left", "generated_board_payload", "updated_at"])

        # przygotuj cells dla aktywnego grida (to jest to, czego potrzebuje JS)
        try:
            grid_idx = int(request.POST.get("grid", 0))
        except Exception:
            grid_idx = 0

        cells = []
        if isinstance(grids_2d_all, list) and 0 <= grid_idx < len(grids_2d_all):
            grid2d = grids_2d_all[grid_idx]
            for row in grid2d:
                for cell in row:
                    if isinstance(cell, dict):
                        cells.append((cell.get("text") or "").strip())
                    else:
                        cells.append(str(cell).strip())

        return JsonResponse({
            "ok": True,
            "grid": grid_idx,
            "cells": cells,  # <-- kluczowe dla JS
            "rerolls_left": state.rerolls_left,
            "shuffles_left": state.shuffles_left,
        }, status=200)
@login_required
@require_POST
def raffle_shuffle_use(request):
    with transaction.atomic():
        state, _ = RaffleState.objects.select_for_update().get_or_create(user=request.user)

        if state.shuffles_left <= 0:
            return JsonResponse({
                "ok": False,
                "error": "No more shuffles for u baby",
                "rerolls_left": state.rerolls_left,
                "shuffles_left": 0,
            }, status=429)

        state.shuffles_left = max(0, state.shuffles_left - 1)

        new_payload = dict(state.generated_board_payload or {})
        used = int(new_payload.get("raffle_shuffles_used") or 0) + 1
        new_payload["raffle_shuffles_used"] = used

        state.generated_board_payload = new_payload
        state.save(update_fields=["shuffles_left", "generated_board_payload", "updated_at"])

        return JsonResponse({
            "ok": True,
            "shuffles_left": state.shuffles_left,
            "rerolls_left": state.rerolls_left,
            "shuffles_used": used,
        }, status=200)