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
@login_required
def raffle_view(request):
    user = request.user

    # bierzemy wszystkie boardy innych użytkowników
    boards = (
        BingoBoard.objects
        .exclude(user=user)
        .select_related("user")
    )

    pool = []
    # zbieramy wszystkie komórki z JSON-ów
    for b in boards:
        data = b.grid or {}
        cells = data.get("grid") or []
        for c in cells:
            text = (c.get("text") or "").strip()
            assigned_user = c.get("assigned_user")  # u Ciebie to string z selecta
            cell_id = c.get("cell")

            # pomijamy puste
            if not text:
                continue

            # 1) nie możesz wylosować zadania z samym sobą
            if assigned_user and assigned_user == user.username:
                continue

            # zapisujemy wraz z metadanymi do unikalności
            pool.append({
                "text": text,
                "assigned_user": assigned_user,
                "source_board_user": b.user.username,
                "source_board_id": b.id,
                "cell": cell_id,
            })

    random.shuffle(pool)

    chosen = []
    used = set()               # 4) unikalne elementy w tej iteracji
    per_person = Counter()     # 2) max 2x ta sama osoba na 1 board

    TARGET = 16

    for item in pool:
        if len(chosen) >= TARGET:
            break

        # unikalność elementu (ten sam kafelek z tego samego boarda nie może wejść drugi raz)
        uniq = (item["source_board_id"], item["cell"])
        if uniq in used:
            continue

        assigned = item["assigned_user"]
        if assigned:
            # 2) max 2 razy dana osoba
            if per_person[assigned] >= 2:
                continue

        chosen.append(item)
        used.add(uniq)
        if assigned:
            per_person[assigned] += 1

    # jak pula za mała — dopełniamy pustymi
    while len(chosen) < TARGET:
        chosen.append(None)

    grid = [chosen[i:i+4] for i in range(0, TARGET, 4)]
    return render(request, "raffle.html", {"grid": grid})