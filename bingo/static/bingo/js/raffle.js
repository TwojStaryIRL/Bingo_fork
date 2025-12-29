/* bingo/js/raffle.js
   Flow:
   - user wchodzi -> 0 plansz
   - 1 klik przycisku (ten sam) -> init (generuje 3 w DB, unlocked=0) + unlock (0->1) + reload
   - 2 klik -> unlock (1->2) + reload
   - 3 klik -> unlock (2->3) + reload
   - brak prawdziwego reroll-losowania
   - audio + overlay zostają (triggerują się przy każdym kliknięciu przycisku)
*/
(() => {
  function getJSONScript(id, fallback = null) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    try { return JSON.parse(el.textContent || "null"); } catch { return fallback; }
  }

  const { getCookie, showToast } = window.Bingo || {};

  function getCsrfToken() {
    if (typeof getCookie === "function") return getCookie("csrftoken");
    const v = `; ${document.cookie}`;
    const parts = v.split(`; csrftoken=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return "";
  }

  function showRerollOverlayForBoard(boardEl) {
    const overlay = boardEl?.querySelector(".reroll-overlay");
    if (!overlay) return null;

    overlay.hidden = false;

    // restart gif (żeby zawsze startował od początku)
    const img = overlay.querySelector("img");
    if (img && img.src) {
      const base = img.src.split("?")[0];
      img.src = `${base}?t=${Date.now()}`;
    }
    return overlay;
  }

  function hideRerollOverlay(overlay) {
    if (overlay) overlay.hidden = true;
  }

  function playRerollSoundAndBindOverlay(audioId, overlay) {
    const audio = document.getElementById(audioId);
    if (!audio) {
      hideRerollOverlay(overlay);
      return;
    }

    // od początku
    try { audio.currentTime = 0; } catch {}

    const cleanup = () => hideRerollOverlay(overlay);

    // znika dokładnie gdy audio się skończy
    audio.addEventListener("ended", cleanup, { once: true });
    audio.addEventListener("error", cleanup, { once: true });

    const p = audio.play();
    if (p && typeof p.catch === "function") p.catch(() => cleanup());
  }

  async function fetchJsonSafe(url, opts) {
    const res = await fetch(url, opts);
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      const text = await res.text().catch(() => "");
      const err = new Error("NON_JSON_RESPONSE");
      err.status = res.status;
      err.body = text.slice(0, 500);
      throw err;
    }
    const data = await res.json();
    return { res, data };
  }

  function readInt(el, fallback = 0) {
    const n = Number((el?.textContent || "").trim());
    return Number.isFinite(n) ? n : fallback;
  }

  function hardError(msg) {
    console.error(msg);
    showToast?.(msg, "error", 2800);
    try { alert(msg); } catch {}
  }

  function initRafflePlugin() {
    const cfg = getJSONScript("raffle-config", null);
    if (!cfg) {
      console.warn("[raffle] Missing #raffle-config");
      return;
    }

    const endpoints = cfg.endpoints || {};
    const size = cfg.gridSize || 4;
    const targetTiles = size * size;

    const csrftoken = getCsrfToken();

    // widoczne boards (z renderu Django) — mogą być 0
    const boards = Array.from(document.querySelectorAll(".raffle-board--set"));
    const left = document.querySelector(".raffle-nav--left");
    const right = document.querySelector(".raffle-nav--right");

    const btnReroll = document.getElementById("btnReroll");
    const btnShuffle = document.getElementById("btnShuffle");
    const btnPick = document.getElementById("btnPick");

    const badgeReroll = document.getElementById("badgeReroll");
    const badgeShuffle = document.getElementById("badgeShuffle");

    const audioRerollId = (cfg.audio && cfg.audio.rerollId) || "rerollSound";

    // flag: czy są jakiekolwiek widoczne plansze (has_state w Django: grids_2d istnieje, ale my renderujemy 0..unlocked)
    // UWAGA: tutaj używamy Twojego elementu #raffle-has-state, ale bez polegania na nim do unlock-flow
    const hasStateEl = document.getElementById("raffle-has-state");
    const hasAnyGeneratedState = (hasStateEl?.dataset?.has === "1");

    // liczniki z HTML (nie są kluczowe dla unlock-flow, ale zostawiamy)
    let rerollsLeft = readInt(badgeReroll, 3);
    let shufflesLeft = readInt(badgeShuffle, 3);

    let active = 0;

    function applyClasses() {
      if (!boards.length) return;
      boards.forEach((b, i) => {
        b.classList.remove("raffle-board--active", "raffle-board--prev", "raffle-board--next", "raffle-board--hidden");
        if (i === active) b.classList.add("raffle-board--active");
        else if (i === (active + boards.length - 1) % boards.length) b.classList.add("raffle-board--prev");
        else if (i === (active + 1) % boards.length) b.classList.add("raffle-board--next");
        else b.classList.add("raffle-board--hidden");
      });
    }

    function paintBadges() {
      if (badgeReroll) {
        badgeReroll.textContent = String(Math.max(0, rerollsLeft));
        badgeReroll.classList.toggle("btn-badge--disabled", rerollsLeft <= 0);
      }
      if (badgeShuffle) {
        badgeShuffle.textContent = String(Math.max(0, shufflesLeft));
        badgeShuffle.classList.toggle("btn-badge--disabled", shufflesLeft <= 0);
      }

      // W unlock-only flow NIE BLOKUJEMY przycisku “reroll/unlock” licznikiem.
      // Reroll badge może zostać dla wyglądu, ale przycisk ma działać aż do 3 unlocków.
      if (btnShuffle) btnShuffle.disabled = (shufflesLeft <= 0) || (boards.length === 0);
    }

    function syncCountersFromServer(data) {
      if (data && typeof data.rerolls_left === "number") rerollsLeft = data.rerolls_left;
      if (data && typeof data.shuffles_left === "number") shufflesLeft = data.shuffles_left;
      paintBadges();
    }

    function show(n) {
      if (!boards.length) return;
      active = (n + boards.length) % boards.length;
      applyClasses();
    }

    if (left) left.addEventListener("click", () => show(active - 1));
    if (right) right.addEventListener("click", () => show(active + 1));

    applyClasses();
    paintBadges();

    // -------------------------
    // SHUFFLE (działa tylko gdy jest widoczna plansza)
    // -------------------------
    if (btnShuffle) {
      btnShuffle.addEventListener("click", async () => {
        if (btnShuffle.disabled) return;

        const board = boards[active];
        const gridEl = board?.querySelector(".raffle-grid");
        const tiles = Array.from(board?.querySelectorAll(".raffle-tile") || []);
        const textsEls = Array.from(board?.querySelectorAll(".raffle-text") || []);
        if (!gridEl || tiles.length !== targetTiles) return;

        btnShuffle.disabled = true;

        const form = new FormData();
        form.append("grid", String(active));

        try {
          const { data } = await fetchJsonSafe(endpoints.shuffle, {
            method: "POST",
            credentials: "same-origin",
            headers: { "X-CSRFToken": csrftoken },
            body: form,
          });

          if (!data.ok) {
            syncCountersFromServer(data);
            showToast?.(data.error || "Shuffle blocked", "error", 2200);
            return;
          }

          syncCountersFromServer(data);

          // prosty update tekstów (animacje zostawiamy jak było)
          if (!Array.isArray(data.cells) || data.cells.length !== targetTiles) {
            hardError(`Shuffle: serwer nie zwrócił cells[${targetTiles}].`);
            return;
          }

          textsEls.forEach((t, i) => { t.textContent = data.cells[i] ?? "—"; });

        } catch (e) {
          console.error("[shuffle] error:", e);
          if (e && e.status) console.error("[shuffle] status/body:", e.status, e.body);
          hardError("Shuffle: błąd serwera/CSRF — sprawdź konsolę (Network).");
        } finally {
          paintBadges();
          btnShuffle.disabled = (shufflesLeft <= 0) || (boards.length === 0);
        }
      });
    }

    // -------------------------
    // UNLOCK FLOW NA PRZYCISKU REROLL (audio+overlay zostają)
    // -------------------------
    if (btnReroll) {
      // ustaw etykietę na starcie
      // 0 widocznych -> "UNLOCK"
      // >=1 widoczna -> "REROLL" (ale robi unlock kolejnej)
      btnReroll.textContent = (boards.length === 0) ? "UNLOCK" : "REROLL";

      btnReroll.addEventListener("click", async () => {
        if (btnReroll.disabled) return;

        // overlay+audio: jeśli nie ma boarda (0 widocznych), overlay pokażemy na całej scenie nie mamy gdzie.
        // więc: overlay tylko gdy istnieje aktywny board.
        const board = boards[active] || null;
        const overlay = board ? showRerollOverlayForBoard(board) : null;
        if (overlay) playRerollSoundAndBindOverlay(audioRerollId, overlay);
        // fallback dźwięk bez overlay, gdy 0 plansz:
        if (!overlay) {
          const audio = document.getElementById(audioRerollId);
          if (audio) { try { audio.currentTime = 0; } catch {} audio.play().catch(() => {}); }
        }

        // efekt CSS (jeśli board istnieje)
        const gridEl = board ? board.querySelector(".raffle-grid") : null;
        if (gridEl) gridEl.classList.add("is-rerolling");

        btnReroll.disabled = true;

        try {
          // CASE 1: 0 widocznych plansz -> init + unlock(1) + reload
          // rozpoznajemy po tym, że w DOM nie ma żadnego .raffle-board--set
          if (boards.length === 0) {
            // init (generuje 3 w DB, unlocked=0)
            const initRes = await fetchJsonSafe(endpoints.init, {
              method: "POST",
              credentials: "same-origin",
              headers: { "X-CSRFToken": csrftoken },
              body: new FormData(),
            });

            console.log("[init] response:", initRes.data);

            if (!initRes.data?.ok) {
              syncCountersFromServer(initRes.data);
              showToast?.(initRes.data?.error || "Init failed", "error", 2200);
              return;
            }

            // unlock first (0->1)
            const unlockRes = await fetchJsonSafe(endpoints.unlock, {
              method: "POST",
              credentials: "same-origin",
              headers: { "X-CSRFToken": csrftoken },
              body: new FormData(),
            });

            console.log("[unlock#1] response:", unlockRes.data);

            if (!unlockRes.data?.ok) {
              showToast?.(unlockRes.data?.error || "Unlock failed", "error", 2200);
              return;
            }

            location.reload();
            return;
          }

          // CASE 2: >=1 widoczna plansza -> tylko unlock kolejnej
          const { data } = await fetchJsonSafe(endpoints.unlock, {
            method: "POST",
            credentials: "same-origin",
            headers: { "X-CSRFToken": csrftoken },
            body: new FormData(),
          });

          console.log("[unlock] response:", data);

          if (!data?.ok) {
            showToast?.(data?.error || "All unlocked", "error", 1800);
            return;
          }

          // po unlock zawsze reload, bo Django musi wyrenderować nową planszę
          location.reload();
          return;

        } catch (e) {
          console.error("[btnReroll unlock-flow] error:", e);
          if (e && e.status) console.error("[btnReroll unlock-flow] status/body:", e.status, e.body);
          hardError("Unlock: błąd serwera/CSRF — sprawdź konsolę (Network).");
        } finally {
          setTimeout(() => {
            if (gridEl) gridEl.classList.remove("is-rerolling");
          }, 260);

          paintBadges();
          btnReroll.disabled = false;
        }
      });
    }

    // -------------------------
    // PICK (zawsze bierze board w focusie)
    // -------------------------
    if (btnPick) {
      btnPick.addEventListener("click", () => {
        const board = boards[active];
        if (!board) return;

        const texts = Array.from(board.querySelectorAll(".raffle-text"))
          .map(el => (el.textContent || "").trim());

        const grid2d = [];
        for (let r = 0; r < size; r++) {
          grid2d.push(texts.slice(r * size, r * size + size));
        }

        console.log(JSON.stringify({
          active_grid_index: active,
          size,
          generated_at: new Date().toISOString(),
          grid: grid2d,
          flat: texts
        }, null, 2));

        showToast?.("Grid JSON w konsoli ✅", "success", 1600);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRafflePlugin);
  } else {
    initRafflePlugin();
  }
})();
