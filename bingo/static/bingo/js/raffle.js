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

    try { audio.currentTime = 0; } catch {}
    const cleanup = () => hideRerollOverlay(overlay);

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

  function waitForAudioEnd(audioId, fallbackMs = 4500) {
  return new Promise((resolve) => {
    const audio = document.getElementById(audioId);
    if (!audio) return resolve();

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      audio.removeEventListener("ended", finish);
      audio.removeEventListener("error", finish);
      resolve();
    };

    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });

    // fail-safe gdyby ended nie przyszedł
    setTimeout(finish, fallbackMs);
  });
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
    const size = cfg.gridSize || 5;
    const targetTiles = size * size;

    const csrftoken = getCsrfToken();

    // ✅ REAL boards (bez placeholdera)
    const boards = Array.from(document.querySelectorAll(".raffle-board--set:not(.raffle-board--placeholder)"));
    const placeholderBoard = document.querySelector(".raffle-board--placeholder") || null;

    const left = document.querySelector(".raffle-nav--left");
    const right = document.querySelector(".raffle-nav--right");

    const btnReroll = document.getElementById("btnReroll");
    const btnShuffle = document.getElementById("btnShuffle");
    const btnPick = document.getElementById("btnPick");

    const badgeReroll = document.getElementById("badgeReroll");
    const badgeShuffle = document.getElementById("badgeShuffle");

    const audioRerollId = (cfg.audio && cfg.audio.rerollId) || "rerollSound";

    let rerollsLeft = readInt(badgeReroll, 3);
    let shufflesLeft = readInt(badgeShuffle, 3);

    let active = 0;

    function applyClasses() {
      // jeśli nie ma real boards, nic nie pokazujemy – placeholder zostaje
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

      // ✅ reroll przy 0 ma być zablokowany
      if (btnReroll) btnReroll.disabled = (rerollsLeft <= 0);

      // shuffle/pick bez planszy = off
      if (btnShuffle) btnShuffle.disabled = (shufflesLeft <= 0) || (boards.length <= 0);
      if (btnPick) btnPick.disabled = (boards.length <= 0);
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

    // ========= SHUFFLE (nie robi reload, tylko aktualizuje DOM: text + assigned_user) =========
    if (btnShuffle) {
      btnShuffle.addEventListener("click", async () => {
        if (btnShuffle.disabled) return;

        const board = boards[active];
        if (!board) return;

        const gridEl = board.querySelector(".raffle-grid");
        const tiles = Array.from(board.querySelectorAll(".raffle-tile") || []);
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

          if (!data?.ok) {
            showToast?.(data?.error || "Shuffle blocked", "error", 2200);
            return;
          }

          if (typeof data.shuffles_left === "number") shufflesLeft = data.shuffles_left;
          if (typeof data.rerolls_left === "number") rerollsLeft = data.rerolls_left;
          paintBadges();

          if (!Array.isArray(data.cells) || data.cells.length !== targetTiles) {
            hardError(`Shuffle: serwer nie zwrócił cells[${targetTiles}].`);
            return;
          }

          // users jest opcjonalne – jeśli backend nie zwróci, to potraktujemy jak puste
          const users = Array.isArray(data.users) ? data.users : [];

          tiles.forEach((tile, i) => {
            const wrap = tile.querySelector(".raffle-text") || tile;

            const textEl = tile.querySelector(".cell-text");
            if (textEl) textEl.textContent = data.cells[i] ?? "—";

            const u = (users[i] ?? "").trim();
            let userEl = tile.querySelector(".cell-user");

            if (u) {
              if (!userEl) {
                userEl = document.createElement("div");
                userEl.className = "cell-user";
                wrap.appendChild(userEl);
              }
              userEl.textContent = u;
            } else {
              if (userEl) userEl.remove();
            }
          });

        } catch (e) {
          console.error("[shuffle] error:", e);
          if (e && e.status) console.error("[shuffle] status/body:", e.status, e.body);
          hardError("Shuffle: błąd serwera/CSRF — sprawdź konsolę (Network).");
        } finally {
          paintBadges();
          btnShuffle.disabled = (shufflesLeft <= 0) || (boards.length <= 0);
        }
      });
    }

    // ========= UNLOCK FLOW pod btnReroll (iluzja wyboru; odejmowanie licznika z DB) =========
    async function initThenUnlockOnce() {
      // 1) init
      const initRes = await fetchJsonSafe(endpoints.init, {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRFToken": csrftoken },
        body: new FormData(),
      });
      if (!initRes.data?.ok) return { ok: false, step: "init", data: initRes.data };

      // 2) unlock 1 planszę
      const unlockRes = await fetchJsonSafe(endpoints.unlock, {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRFToken": csrftoken },
        body: new FormData(),
      });
      if (!unlockRes.data?.ok) return { ok: false, step: "unlock", data: unlockRes.data };

      return { ok: true, data: unlockRes.data };
    }

    async function unlockOnce() {
      const unlockRes = await fetchJsonSafe(endpoints.unlock, {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRFToken": csrftoken },
        body: new FormData(),
      });
      return unlockRes;
    }

    if (btnReroll) {
      btnReroll.addEventListener("click", async () => {
        if (btnReroll.disabled) return;

        // overlay+audio zawsze (nawet przy 0 plansz)
        const boardForFx = boards[active] || placeholderBoard;
        const overlay = showRerollOverlayForBoard(boardForFx);
        playRerollSoundAndBindOverlay(audioRerollId, overlay);

        btnReroll.disabled = true;

        try {
          // najpierw próbujemy unlock
          let { res, data } = await unlockOnce();

          // jeśli server mówi „nie zainicjalizowano” -> init + unlock
          if (!data?.ok && res.status === 409 && String(data?.error || "").toLowerCase().includes("not initialized")) {
            const result = await initThenUnlockOnce();
            if (!result.ok) {
              showToast?.(result.data?.error || "Init/Unlock failed", "error", 2200);
              return;
            }

            // ✅ zaktualizuj licznik z DB jeśli backend zwraca rerolls_left
            if (typeof result.data?.rerolls_left === "number") rerollsLeft = result.data.rerolls_left;
            paintBadges();

            await waitForAudioEnd(audioRerollId, 3200);
            location.reload();
            return;

          }

          // normalny unlock
          if (!data?.ok) {
            if (typeof data?.rerolls_left === "number") rerollsLeft = data.rerolls_left;
            paintBadges();
            showToast?.(data?.error || "All unlocked", "error", 1800);
            return;
          }

          // ✅ sukces: aktualizuj licznik z DB
          if (typeof data?.rerolls_left === "number") rerollsLeft = data.rerolls_left;
          paintBadges();

          // etykieta: jeśli licznik spadł do 0, nie cofamy na ROLL (template i tak ustawi po reload)
          // jeśli chcesz 100% pewności, odkomentuj:
          // btnReroll.textContent = "REROLL";

          await waitForAudioEnd(audioRerollId, 3200);
          location.reload();
          return;


        } catch (e) {
          console.error("[unlock-flow] error:", e);
          if (e && e.status) console.error("[unlock-flow] status/body:", e.status, e.body);
          hardError("Unlock: błąd serwera/CSRF — sprawdź konsolę (Network).");
        } finally {
          btnReroll.disabled = (rerollsLeft <= 0);
        }
      });
    }

    // ===== PICK (save active board to DB) =====
    if (btnPick) {
      btnPick.addEventListener("click", async () => {
        const board = boards[active];
        if (!board) {
          showToast?.("Nie ma aktywnej planszy do zapisu.", "error", 1800);
          return;
        }

        btnPick.disabled = true;

        try {
          const form = new FormData();
          form.append("grid", String(active));

          const { data } = await fetchJsonSafe(endpoints.pick, {
            method: "POST",
            credentials: "same-origin",
            headers: { "X-CSRFToken": csrftoken },
            body: form,
          });

          if (!data?.ok) {
            showToast?.(data?.error || "Zapis nieudany", "error", 2200);
            return;
          }

          showToast?.("Zapisano planszę w bazie ✅", "success", 1800);
          console.log("[pick] saved:", data);

        } catch (e) {
          console.error("[pick] error:", e);
          if (e && e.status) console.error("[pick] status/body:", e.status, e.body);
          hardError("Pick: błąd serwera/CSRF — sprawdź konsolę (Network).");
        } finally {
          btnPick.disabled = false;
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRafflePlugin);
  } else {
    initRafflePlugin();
  }
})();
