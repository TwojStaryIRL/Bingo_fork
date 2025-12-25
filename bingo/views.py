# Create your views here.

import json
from django.http import HttpResponse, JsonResponse, HttpResponseBadRequest
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.contrib.auth.views import LoginView, get_user_model
from django.views.decorators.http import require_POST
from .models import BingoBoard
import random
from collections import Counter



class LandingLoginView(LoginView):
    template_name = "registration/login.html"
    redirect_authenticated_user = True

User = get_user_model()

@login_required
def game(request):
    # 1) lista userów do dropdowna - bez staff i superuserów
    users = (
        User.objects
        .filter(is_active=True, is_staff=False, is_superuser=False)
        .order_by("username")
        .values_list("username", flat=True)
    )

    # 2) zapis planszy 
    board = BingoBoard.objects.filter(user=request.user).first()
    saved_grid = board.grid if board else {}

    # 3) render jak wcześniej
    return render(request, "game.html", {
        "rows": range(4),   # albo to co masz obecnie
        "cols": range(4),
        "usernames": list(users),
        "saved_grid": saved_grid,
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
def _extract_pool_for_user(current_user):
    boards = BingoBoard.objects.exclude(user=current_user).select_related("user")

    pool = []
    for b in boards:
        data = b.grid

        if isinstance(data, dict):
            cells = data.get("grid") or []
        elif isinstance(data, list):
            cells = data
        else:
            cells = []

        for c in cells:
            if not isinstance(c, dict):
                continue

            text = (c.get("text") or "").strip()
            assigned_user = (c.get("assigned_user") or "").strip()
            cell_id = c.get("cell")
            if not text:
                continue
            if assigned_user and assigned_user == current_user.username:
                continue
            pool.append({
                "text": text,
                "assigned_user": assigned_user,
                "source_board_id": b.id,
                "cell": cell_id,
            })
    random.shuffle(pool)
    return pool
def _uniq(item):
    return (item["source_board_id"], item.get("cell"), item["text"])

def _counts_without_index(items, skip_index):
    cnt = Counter()
    for i, it in enumerate(items):
        if i == skip_index or not it:
            continue
        a = (it.get("assigned_user") or "").strip()
        if a:
            cnt[a] += 1
    return cnt


@login_required
def _extract_pool_for_user(current_user):
    """Pula z wszystkich BingoBoardów poza current_user. Usuwa puste. Wyklucza assigned_user == current_user."""
    boards = BingoBoard.objects.exclude(user=current_user).select_related("user")

    pool = []
    for b in boards:
        data = b.grid

        if isinstance(data, dict):
            cells = data.get("grid") or []
        elif isinstance(data, list):
            cells = data
        else:
            cells = []

        for c in cells:
            if not isinstance(c, dict):
                continue

            text = (c.get("text") or "").strip()
            assigned_user = (c.get("assigned_user") or "").strip()
            cell_id = c.get("cell")

            if not text:
                continue

            # 1) nie losuj siebie
            if assigned_user and assigned_user == current_user.username:
                continue

            pool.append({
                "text": text,
                "assigned_user": assigned_user,
                "source_board_id": b.id,
                "cell": cell_id,
            })

    random.shuffle(pool)
    return pool


def _uniq(item):
    """Unikalny klucz elementu (musi być hashowalny)."""
    return (item["source_board_id"], item.get("cell"), item["text"])


def _build_grid(pool, used_global, target=16):
    """
    Buduje grid target pól:
    - brak duplikatów w gridzie
    - max 2 na osobę w gridzie
    - globalnie nie używa niczego, co jest w used_global
    """
    chosen = []
    used_local = set()
    counts = Counter()

    for item in pool:
        if len(chosen) >= target:
            break

        u = _uniq(item)
        if u in used_global:
            continue
        if u in used_local:
            continue

        assigned = (item.get("assigned_user") or "").strip()
        if assigned and counts[assigned] >= 2:
            continue

        chosen.append(item)
        used_local.add(u)
        if assigned:
            counts[assigned] += 1

    while len(chosen) < target:
        chosen.append(None)

    return chosen, used_local


def _grid_to_2d(items, size=4):
    return [items[i:i+size] for i in range(0, size*size, size)]


@login_required
def raffle(request):
    user = request.user
    pool = _extract_pool_for_user(user)

    # GLOBAL used: wszystko co już kiedykolwiek pokazaliśmy w tym losowaniu (na start: puste)
    used_global = set()

    grids = []
    for _ in range(3):
        items, used_local = _build_grid(pool, used_global, target=16)
        grids.append(items)
        # dodaj to co weszło do global used, żeby 3 gridy na starcie były różne
        used_global |= used_local

    # zapis do sesji (ważne: tuple -> list dla JSON serializer)
    request.session["raffle_grids"] = grids
    request.session["raffle_used_global"] = [list(x) for x in used_global]  # ✅
    request.session["raffle_rerolls_used"] = 0  # ✅ max 3 dla całej strony
    request.session.modified = True

    grids_2d = [_grid_to_2d(g, size=4) for g in grids]
    return render(request, "raffle.html", {"grids": grids_2d})


@login_required
@require_POST
def raffle_reroll_all(request):
    """
    REROLL całego grida (active grid):
    - max 3 rerolle łącznie dla wszystkich gridów
    - wyklucza WSZYSTKO co kiedykolwiek wypadło wcześniej (globalnie)
    """
    user = request.user

    try:
        grid_idx = int(request.POST.get("grid", "-1"))
    except ValueError:
        return JsonResponse({"ok": False, "error": "Bad grid index"}, status=400)

    if grid_idx not in (0, 1, 2):
        return JsonResponse({"ok": False, "error": "Grid out of range"}, status=400)

    grids = request.session.get("raffle_grids")
    used_raw = request.session.get("raffle_used_global")
    rerolls_used = request.session.get("raffle_rerolls_used", 0)

    if not isinstance(grids, list) or len(grids) != 3:
        return JsonResponse({"ok": False, "error": "Session expired. Refresh."}, status=409)
    if not isinstance(used_raw, list):
        used_raw = []
    if not isinstance(rerolls_used, int):
        rerolls_used = 0

    # LIMIT 3 łącznie
    if rerolls_used >= 3:
        return JsonResponse({"ok": False, "error": "Limit rerolli osiągnięty (3/3)."}, status=403)

    used_global = set(tuple(x) for x in used_raw)

    # Dodaj aktualnie widoczne pola (ze wszystkich 3 gridów) do used_global,
    # żeby nigdy nie wróciły w tym losowaniu.
    for g in grids:
        for it in g:
            if it:
                used_global.add(_uniq(it))

    pool = _extract_pool_for_user(user)

    # zbuduj nowy grid dla grid_idx
    new_items, used_local = _build_grid(pool, used_global, target=16)
    # po zbudowaniu dodaj to co weszło
    used_global |= used_local

    grids[grid_idx] = new_items
    rerolls_used += 1

    request.session["raffle_grids"] = grids
    request.session["raffle_used_global"] = [list(x) for x in used_global]  # ✅ tuple->list
    request.session["raffle_rerolls_used"] = rerolls_used
    request.session.modified = True

    # zwracamy nowy grid jako 16 tekstów (frontend poukłada)
    payload = []
    for it in new_items:
        payload.append(it["text"] if it else "—")

    return JsonResponse({
        "ok": True,
        "grid": grid_idx,
        "rerolls_used": rerolls_used,
        "cells": payload,  # length 16
    })