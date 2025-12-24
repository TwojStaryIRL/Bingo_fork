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
def raffle(request):
    user = request.user
    pool = _extract_pool_for_user(user)

    TARGET = 9  # 3x3
    chosen = []
    used_set = set()
    counts = Counter()

    for item in pool:
        if len(chosen) >= TARGET:
            break

        u = _uniq(item)
        if u in used_set:
            continue

        assigned = (item.get("assigned_user") or "").strip()
        if assigned and counts[assigned] >= 2:
            continue

        chosen.append(item)
        used_set.add(u)
        if assigned:
            counts[assigned] += 1

    while len(chosen) < TARGET:
        chosen.append(None)
    request.session["raffle_items"] = chosen
    request.session["raffle_used"] = list(used_set)
    request.session["raffle_rerolled"] = [False] * TARGET 
    request.session.modified = True

    grid = [chosen[i:i+3] for i in range(0, TARGET, 3)]
    return render(request, "raffle.html", {"grid": grid})


@login_required
@require_POST
def raffle_reroll(request):
    user = request.user

    try:
        index = int(request.POST.get("index", "-1"))
    except ValueError:
        return JsonResponse({"ok": False, "error": "Bad index"}, status=400)

    if index < 0 or index > 8:
        return JsonResponse({"ok": False, "error": "Index out of range"}, status=400)

    items = request.session.get("raffle_items")
    used_list = request.session.get("raffle_used")
    rerolled = request.session.get("raffle_rerolled")

    if not isinstance(items, list) or len(items) != 9:
        return JsonResponse({"ok": False, "error": "Session expired. Refresh raffle."}, status=409)
    if not isinstance(used_list, list):
        used_list = []
    if not isinstance(rerolled, list) or len(rerolled) != 9:
        rerolled = [False] * 9

    if rerolled[index] is True:
        return JsonResponse({"ok": False, "error": "This tile already rerolled."}, status=403)

    used_global = set(tuple(x) for x in used_list)

    for i, it in enumerate(items):
        if i == index or not it:
            continue
        used_global.add(_uniq(it))

    counts = _counts_without_index(items, index)

    pool = _extract_pool_for_user(user)

    new_item = None
    for cand in pool:
        u = _uniq(cand)
        if u in used_global:
            continue
        assigned = (cand.get("assigned_user") or "").strip()
        if assigned and counts[assigned] >= 2:
            continue
        new_item = cand
        break
    if not new_item:
        return JsonResponse({"ok": False, "error": "No more available items."}, status=200)
    items[index] = new_item
    rerolled[index] = True
    used_global.add(_uniq(new_item))
    request.session["raffle_items"] = items
    request.session["raffle_rerolled"] = rerolled
    request.session["raffle_used"] = list(used_global)
    request.session.modified = True
    return JsonResponse({
        "ok": True,
        "index": index,
        "text": new_item["text"],
    })