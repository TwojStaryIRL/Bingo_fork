# bingo/raffle_algorithm.py
from __future__ import annotations

import random
from dataclasses import dataclass
from collections import Counter
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

from .models import BingoBoard

# Typy pomocnicze
PoolItem = Dict[str, Any]
UniqKey = Tuple[int, Any, str]  # (source_board_id, cell, text)


# =========================
#  POOL (źródło elementów)
# =========================
def extract_pool_for_user(current_user) -> List[PoolItem]:
    """
    Buduje listę wszystkich dostępnych pól (teksty) z tablic innych użytkowników.

    Zasady filtrowania:
    - pomijamy puste teksty
    - pomijamy komórki przypisane do aktualnie zalogowanego usera (assigned_user == current_user.username)
    """
    boards = BingoBoard.objects.exclude(user=current_user).select_related("user")

    pool: List[PoolItem] = []

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


def uniq_key(item: PoolItem) -> UniqKey:
    """Klucz unikalności pola."""
    return (item["source_board_id"], item.get("cell"), item["text"])


# =========================
#  GRID BUILDING
# =========================
def build_grid(
    pool: Sequence[PoolItem],
    used_global: Set[UniqKey],
    target: int = 16,
    max_per_user: int = 2,
) -> Tuple[List[Optional[PoolItem]], Set[UniqKey]]:
    """
    Buduje grid (domyślnie 16 pól = 4x4).

    Reguły:
    - nie używamy elementów już w used_global
    - lokalnie w tym gridzie również brak duplikatów
    - max max_per_user elementów na jednego assigned_user w obrębie grida
    """
    chosen: List[Optional[PoolItem]] = []
    used_local: Set[UniqKey] = set()
    counts = Counter()

    for item in random.sample(list(pool), len(pool)):
        if len(chosen) >= target:
            break

        u = uniq_key(item)
        if u in used_global:
            continue
        if u in used_local:
            continue

        assigned = (item.get("assigned_user") or "").strip()
        if assigned and counts[assigned] >= max_per_user:
            continue

        chosen.append(item)
        used_local.add(u)
        if assigned:
            counts[assigned] += 1

    # Jeśli zabraknie elementów, dopełniamy None (frontend pokazuje "—")
    while len(chosen) < target:
        chosen.append(None)

    return chosen, used_local


def grid_to_2d(items: Sequence[Optional[PoolItem]], size: int = 4):
    """Z listy 16 elementów robi 2D 4x4."""
    return [list(items[i:i + size]) for i in range(0, size * size, size)]


# =========================
#  SESSION HELPERS (czysta logika na danych)
# =========================
def normalize_used_sets(used_sets_raw: Any, grids_count: int = 3) -> List[List[List[Any]]]:
    """
    used_sets w session trzymamy jako listę list (JSON-friendly), np.:
      used_sets_raw[grid_idx] = [[board_id, cell, text], [...], ...]
    """
    if not isinstance(used_sets_raw, list) or len(used_sets_raw) != grids_count:
        return [[] for _ in range(grids_count)]
    return used_sets_raw


def normalize_grids(grids: Any, grids_count: int = 3) -> Optional[List[List[Optional[PoolItem]]]]:
    """Sprawdza czy grids z session wygląda poprawnie."""
    if not isinstance(grids, list) or len(grids) != grids_count:
        return None
    return grids


def parse_grid_idx(value: Any) -> Optional[int]:
    """Bezpieczne parsowanie grid_idx (musi być 0/1/2)."""
    try:
        idx = int(value)
    except (TypeError, ValueError):
        return None
    return idx if idx in (0, 1, 2) else None


@dataclass(frozen=True)
class LimitResult:
    """Wynik sprawdzenia i zużycia limitu."""
    ok: bool
    new_used: int
    error: Optional[str] = None


def consume_limit(used: Any, limit: int, label: str) -> LimitResult:
    """
    Czysta logika limitów:
    - jeśli used nie jest int -> traktujemy jak 0
    - jeśli >= limit -> blokujemy
    - w przeciwnym razie inkrementujemy
    """
    if not isinstance(used, int):
        used = 0

    if used >= limit:
        return LimitResult(ok=False, new_used=used, error=f"Limit {label} {limit}/{limit}.")

    return LimitResult(ok=True, new_used=used + 1, error=None)


# =========================
#  HIGH-LEVEL OPERATIONS
# =========================
def generate_initial_state(current_user, grids_count: int = 3, size: int = 4):
    """
    Robi dokładnie to, co Twój widok raffle():
    - buduje pool
    - generuje 3 różne gridy
    - buduje used_sets (JSON-friendly)
    Zwraca gotowe dane do zapisania do session + grids_2d do rendera.
    """
    base_pool = extract_pool_for_user(current_user)

    grids: List[List[Optional[PoolItem]]] = []
    used_sets: List[List[List[Any]]] = []
    target = size * size

    for _ in range(grids_count):
        pool = list(base_pool)
        random.shuffle(pool)

        used_local: Set[UniqKey] = set()
        items, used_local = build_grid(pool, used_local, target=target)

        grids.append(items)
        used_sets.append([list(x) for x in used_local])

    grids_2d = [grid_to_2d(g, size=size) for g in grids]

    session_patch = {
        "raffle_grids": grids,
        "raffle_used_sets": used_sets,
        "raffle_rerolls_used": 0,
        "raffle_shuffles_used": 0,
    }

    return session_patch, grids_2d


def reroll_one_grid(current_user, session_data: dict, post_data: dict, size: int = 4):

    grid_idx = parse_grid_idx(post_data.get("grid"))#walidacja grid index
    if grid_idx is None:
        return False, 400, {"ok": False, "error": "Bad grid index"}, {}

    grids = normalize_grids(session_data.get("raffle_grids"))#walidacja session (czy grids istnieją)
    if grids is None:
        return False, 409, {"ok": False, "error": "Session expired. Refresh."}, {}

    used_sets_raw = normalize_used_sets(session_data.get("raffle_used_sets"))
    rerolls_used = session_data.get("raffle_rerolls_used", 0)

    lim = consume_limit(rerolls_used, limit=3, label="rerolli")#pilnowanie limitu rerolli (3)
    if not lim.ok:
        return False, 403, {"ok": False, "error": lim.error}, {}

    used_current: Set[UniqKey] = set(tuple(x) for x in used_sets_raw[grid_idx])

    pool = extract_pool_for_user(current_user)#budowanie poola i losowanie nowego grida
    target = size * size

    new_items, used_local = build_grid(pool, used_current, target=target)#losujemy z elementów nieużywanych w danym gridzie 
    used_current |= used_local

    grids[grid_idx] = new_items
    used_sets_raw[grid_idx] = [list(x) for x in used_current]

    session_patch = {
        "raffle_grids": grids,
        "raffle_used_sets": used_sets_raw,
        "raffle_rerolls_used": lim.new_used,
    }

    payload = {
        "ok": True,
        "grid": grid_idx,
        "rerolls_used": lim.new_used,
        "cells": [it["text"] if it else "—" for it in new_items],
    }

    return True, 200, payload, session_patch


def consume_shuffle(session_data: dict):
    """
    Robi CAŁĄ logikę 'shuffle limit' (bez Django):
    - pilnuje limitu 3
    - zwraca gotowy payload + session_patch
    """
    used = session_data.get("raffle_shuffles_used", 0)
    lim = consume_limit(used, limit=3, label="shuffle")

    if not lim.ok:
        return False, 403, {"ok": False, "error": lim.error}, {}

    session_patch = {"raffle_shuffles_used": lim.new_used}
    payload = {"ok": True, "shuffles_used": lim.new_used}
    return True, 200, payload, session_patch
