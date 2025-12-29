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
    SIZE = 5
    INITIAL_GRIDS = 1
    state, _ = RaffleState.objects.get_or_create(user=request.user)

    payload = state.generated_board_payload or {}
    grids_2d = payload.get("grids_2d")
    max_grids = int(payload.get("grids_count") or 0)
    has_state = isinstance(grids_2d, list) and (len(grids_2d) == max_grids) and max_grids > 0

    unlocked = int(payload.get("unlocked_grids") or 0)
    visible_grids = grids_2d[:unlocked] if has_state else []


    return render(request, "raffle.html", {
        "grids": visible_grids,
        "has_state": has_state,
        "unlocked_grids": unlocked,
        "rerolls_left": state.rerolls_left,
        "shuffles_left": state.shuffles_left,
        "grid_size": int(payload.get("size") or SIZE),
    })


@login_required
@require_POST
def raffle_init(request):
    from .raffle_algorithm import generate_initial_state

    SIZE = 5
    MAX_GRIDS = 3
    INITIAL_UNLOCK = 0

    with transaction.atomic():
        state, _ = RaffleState.objects.select_for_update().get_or_create(user=request.user)
        payload = dict(state.generated_board_payload or {})

        grids_2d = payload.get("grids_2d")
        has_state = isinstance(grids_2d, list) and len(grids_2d) == MAX_GRIDS

        # jeśli już jest stan -> nic nie generuj drugi raz
        if has_state:
            payload.setdefault("unlocked_grids", INITIAL_UNLOCK)
            payload.setdefault("grids_count", MAX_GRIDS)
            payload.setdefault("size", SIZE)

            state.generated_board_payload = payload
            state.save(update_fields=["generated_board_payload", "updated_at"])

            return JsonResponse({
                "ok": True,
                "already": True,
                "unlocked_grids": int(payload.get("unlocked_grids") or INITIAL_UNLOCK),
                "grids_count": int(payload.get("grids_count") or MAX_GRIDS),
                "rerolls_left": state.rerolls_left,
                "shuffles_left": state.shuffles_left,
            }, status=200)

        session_patch, grids_2d_new = generate_initial_state(request.user, grids_count=MAX_GRIDS, size=SIZE)

        new_payload = {
            **payload,
            **session_patch,
            "grids_2d": grids_2d_new,
            "size": SIZE,
            "grids_count": MAX_GRIDS,
            "unlocked_grids": INITIAL_UNLOCK,
        }

        state.generated_board_payload = new_payload
        state.save(update_fields=["generated_board_payload", "updated_at"])

        return JsonResponse({
            "ok": True,
            "already": False,
            "unlocked_grids": INITIAL_UNLOCK,
            "grids_count": MAX_GRIDS,
            "rerolls_left": state.rerolls_left,
            "shuffles_left": state.shuffles_left,
        }, status=200)



# odblokowywanie gridów 
@login_required
@require_POST
def raffle_unlock_next(request):
    with transaction.atomic():
        state, _ = RaffleState.objects.select_for_update().get_or_create(user=request.user)
        payload = dict(state.generated_board_payload or {})
        if not isinstance(payload.get("grids_2d"), list) or not payload.get("grids_count"):
            return JsonResponse({"ok": False, "error": "Not initialized. Use init first."}, status=409)

        max_grids = int(payload.get("grids_count") or 3)
        unlocked = int(payload.get("unlocked_grids") or 0)

        # nic do zrobienia
        if unlocked >= max_grids:
            return JsonResponse({"ok": False, "error": "All grids already unlocked", "unlocked_grids": unlocked}, status=409)

        payload["unlocked_grids"] = unlocked + 1
        state.generated_board_payload = payload
        state.save(update_fields=["generated_board_payload", "updated_at"])

        return JsonResponse({"ok": True, "unlocked_grids": payload["unlocked_grids"]}, status=200)



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

        current_payload = state.generated_board_payload or {}
        if not isinstance(current_payload.get("raffle_grids"), list):
            return JsonResponse({"ok": False, "error": "Not initialized. Use generate first."}, status=409)
        if state.rerolls_left <= 0:
            return JsonResponse(
                {
                    "ok": False,
                    "error": "Out of rolls!",
                    "rerolls_left": 0,
                    "shuffles_left": state.shuffles_left,
                },
                status=429,
            )
        size = int(current_payload.get("size") or 5)

        ok, status, payload, patch = reroll_one_grid(
            current_user=request.user,
            session_data=current_payload,
            post_data=request.POST,
            size=size,
        )


        if not isinstance(payload, dict):
            payload = {"ok": False, "error": "Invalid server payload"}

        if not ok:
            payload.setdefault("ok", False)
            payload.setdefault("rerolls_left", state.rerolls_left)
            payload.setdefault("shuffles_left", state.shuffles_left)
            return JsonResponse(payload, status=status)

        # sukces -> odejmij limit w DB
        state.rerolls_left = max(0, state.rerolls_left - 1)

        # zapisz patch do DB
        new_payload = dict(state.generated_board_payload or {})
        if isinstance(patch, dict) and patch:
            new_payload.update(patch)

        max_grids = int(new_payload.get("grids_count") or 3)
        unlocked = int(new_payload.get("unlocked_grids") or 1)

        # if unlocked < max_grids:
        #     new_payload["unlocked_grids"] = unlocked + 1

        # kluczowe: przelicz raffle_grids -> grids_2d, żeby GET /raffle/ renderował aktualny stan
        size = int(new_payload.get("size") or 5)
        if isinstance(new_payload.get("raffle_grids"), list):
            new_payload["grids_2d"] = to_grids_2d(new_payload["raffle_grids"], size=size)

        state.generated_board_payload = new_payload
        state.save(update_fields=["rerolls_left", "generated_board_payload", "updated_at"])

        payload["ok"] = True
        payload["rerolls_left"] = state.rerolls_left
        payload["shuffles_left"] = state.shuffles_left
        payload["unlocked_grids"] = int(new_payload.get("unlocked_grids") or 1)
        payload["grids_count"] = int(new_payload.get("grids_count") or 3)

        return JsonResponse(payload, status=status)


@login_required
@require_POST
def raffle_shuffle_use(request):
    import random
    from .raffle_algorithm import to_grids_2d

    with transaction.atomic():
        state, _ = RaffleState.objects.select_for_update().get_or_create(user=request.user)

        if state.shuffles_left <= 0:
            return JsonResponse({
                "ok": False,
                "error": "No more shuffles for u baby",
                "rerolls_left": state.rerolls_left,
                "shuffles_left": 0,
            }, status=429)

        payload = dict(state.generated_board_payload or {})
        size = int(payload.get("size") or 5)

        try:
            grid_idx = int(request.POST.get("grid"))
        except (TypeError, ValueError):
            return JsonResponse({"ok": False, "error": "Bad grid index"}, status=400)

        raffle_grids = payload.get("raffle_grids")
        if not isinstance(raffle_grids, list) or grid_idx < 0 or grid_idx >= len(raffle_grids):
            return JsonResponse({"ok": False, "error": "Session expired. Refresh."}, status=409)

        grid = raffle_grids[grid_idx]
        if not isinstance(grid, list) or len(grid) != size * size:
            return JsonResponse({"ok": False, "error": "Bad grid payload"}, status=409)

        # tasuj i zapisz do db
        random.shuffle(grid)
        raffle_grids[grid_idx] = grid
        payload["raffle_grids"] = raffle_grids
        payload["grids_2d"] = to_grids_2d(raffle_grids, size=size)

        # liczniki
        state.shuffles_left = max(0, state.shuffles_left - 1)
        payload["raffle_shuffles_used"] = int(payload.get("raffle_shuffles_used") or 0) + 1

        state.generated_board_payload = payload
        state.save(update_fields=["shuffles_left", "generated_board_payload", "updated_at"])

        cells = [(item.get("text") or "").strip() if isinstance(item, dict) else "—" for item in grid]

        return JsonResponse({
            "ok": True,
            "grid": grid_idx,
            "cells": cells,
            "shuffles_left": state.shuffles_left,
            "rerolls_left": state.rerolls_left,
            "shuffles_used": payload["raffle_shuffles_used"],
        }, status=200)
