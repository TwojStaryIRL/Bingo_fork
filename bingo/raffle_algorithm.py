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

PLACEHOLDERS = {"Event", "Ktoś", "Ktokolwiek"}  
PLACEHOLDER_LIMIT = 99            



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

            if not text or not assigned_user:
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

def build_grid_two_phase(
    pool: Sequence[PoolItem],
    used_global_all: Set[UniqKey],
    target: int,
    max_per_user: int = 2,
    adaptive_limit: bool = False,
) -> Tuple[List[Optional[PoolItem]], Set[UniqKey]]:
    """
    Faza A: bierz nieużyte globalnie.
    Faza B: dobierz brakujące z pełnej puli (powtórki globalne dozwolone).
    Twardo: brak duplikatów w gridzie.
    Limit per assigned_user: max_per_user (opcjonalnie adaptacyjny).
    """
    def attempt(limit: int) -> Tuple[List[Optional[PoolItem]], Set[UniqKey]]:
        chosen: List[Optional[PoolItem]] = []
        used_local: Set[UniqKey] = set()
        counts = Counter()

        def can_take(item: PoolItem) -> bool:
            u = uniq_key(item)
            if u in used_local:
                return False

            assigned = (item.get("assigned_user") or "").strip()
            if assigned:
                user_limit = PLACEHOLDER_LIMIT if assigned in PLACEHOLDERS else limit
                if counts[assigned] >= user_limit:
                    return False

            return True


        def take(item: PoolItem):
            u = uniq_key(item)
            chosen.append(item)
            used_local.add(u)
            assigned = (item.get("assigned_user") or "").strip()
            if assigned:
                counts[assigned] += 1

        phase_a = [x for x in pool if uniq_key(x) not in used_global_all]
        for item in random.sample(list(phase_a), len(phase_a)):
            if len(chosen) >= target:
                break
            if can_take(item):
                take(item)

        if len(chosen) < target:
            for item in random.sample(list(pool), len(pool)):
                if len(chosen) >= target:
                    break
                if can_take(item):
                    take(item)

        while len(chosen) < target:
            chosen.append(None)

        return chosen, used_local

    if not adaptive_limit:
        return attempt(max_per_user)

    # adaptacyjnie luzuj limit, jeśli mimo fallbacku brakuje pól
    for lim in (max_per_user, max_per_user + 1, max_per_user + 2, max_per_user + 3, max_per_user + 4):
        items, used_local = attempt(lim)
        if all(x is not None for x in items):
            return items, used_local
    return items, used_local

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
def normalize_used_global(used_raw: Any) -> List[List[Any]]:
    """
    raffle_used_global w session trzymamy jako listę list:
    [[board_id, cell, text], ...]
    """
    if not isinstance(used_raw, list):
        return []
    return used_raw

def normalize_used_sets(used_sets_raw: Any, grids_count: int = 3) -> List[List[List[Any]]]:
    """
    used_sets w session trzymamy jako listę list (JSON-friendly), np.:
      used_sets_raw[grid_idx] = [[board_id, cell, text], [...], ...]
    """
    if not isinstance(used_sets_raw, list) or len(used_sets_raw) != grids_count:
        return [[] for _ in range(grids_count)]
    return used_sets_raw

def to_grids_2d(raffle_grids, size=4):
    out = []
    for g in raffle_grids:  # g = lista 16 elementów
        rows = []
        for r in range(size):
            rows.append(g[r*size:(r+1)*size])
        out.append(rows)
    return out

def normalize_grids(grids: Any) -> Optional[List[List[Optional[PoolItem]]]]:
    if not isinstance(grids, list) or len(grids) < 1:
        return None
    return grids

def parse_grid_idx(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None



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

def generate_initial_state(current_user, grids_count: int = 3, size: int = 5):
    base_pool = extract_pool_for_user(current_user)

    grids: List[List[Optional[PoolItem]]] = []
    target = size * size

    used_global_all: Set[UniqKey] = set()

    for _ in range(grids_count):
        pool = list(base_pool)
        random.shuffle(pool)

        items, used_local = build_grid_two_phase(
            pool,
            used_global_all,
            target=target,
            adaptive_limit=False,    # 
            max_per_user=2,          # ewentualniezmienić na true jakby było dużo NONE
        )
        grids.append(items)
        used_global_all |= used_local

    grids_2d = [grid_to_2d(g, size=size) for g in grids]

    session_patch = {
    "raffle_grids": grids,
    "raffle_used_global": [list(x) for x in used_global_all],
    "raffle_rerolls_used": 0,
    "raffle_shuffles_used": 0,
    "size": size,
}

    return session_patch, grids_2d

def reroll_one_grid(current_user, session_data: dict, post_data: dict, size: int = 5):
    size = int(session_data.get("size") or size)
    grid_idx = parse_grid_idx(post_data.get("grid"))
    if grid_idx is None:
        return False, 400, {"ok": False, "error": "Bad grid index"}, {}

    grids = normalize_grids(session_data.get("raffle_grids"))
    if grids is None:
        return False, 409, {"ok": False, "error": "Session expired. Refresh."}, {}

    if grid_idx < 0 or grid_idx >= len(grids):
        return False, 400, {"ok": False, "error": "Bad grid index"}, {}


    # globalna pamięć użytych 
    used_global_raw = normalize_used_global(session_data.get("raffle_used_global"))
    used_global_all = set(tuple(x) for x in used_global_raw)

    pool = extract_pool_for_user(current_user)
    target = size * size

    # losowanie: preferuj nieużyte, potem fallback do pełnej puli
    new_items, used_local = build_grid_two_phase(
        pool,
        used_global_all,
        target=target,
        max_per_user=2,
        adaptive_limit=False,  # ewentualnie zmienić na true jakby były None Wartości, ale nie powinno być
    )

    # dopisz użyte globalnie
    used_global_all |= used_local

    # podmień grid
    grids[grid_idx] = new_items

    new_used = int(session_data.get("raffle_rerolls_used") or 0) + 1

    session_patch = {
        "raffle_grids": grids,
        "raffle_used_global": [list(x) for x in used_global_all],
        "raffle_rerolls_used": new_used,

        "size": size,
        
    }

    cells = [(item.get("text") or "").strip() if isinstance(item, dict) else "—" for item in new_items]

    payload = {
        "ok": True,
        "grid": grid_idx,
        "cells": cells,
        "rerolls_used": new_used,
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
