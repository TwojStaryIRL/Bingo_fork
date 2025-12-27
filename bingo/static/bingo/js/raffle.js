(() => {
  // ===== Helpers (w stylu game.js) =====
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

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function playAudioById(id) {
    const audio = document.getElementById(id);
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // bezpieczny fetch json (żeby nie wywaliło się na HTML/500)
  async function fetchJsonSafe(url, opts) {
    const res = await fetch(url, opts);
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      const text = await res.text().catch(() => "");
      const err = new Error("NON_JSON_RESPONSE");
      err.status = res.status;
      err.body = text.slice(0, 400);
      throw err;
    }
    const data = await res.json();
    return { res, data };
  }

  function readInt(el, fallback = 0) {
    const n = Number((el?.textContent || "").trim());
    return Number.isFinite(n) ? n : fallback;
  }

  // ===== Główna logika =====
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

    const boards = Array.from(document.querySelectorAll(".raffle-board--set"));
    const left = document.querySelector(".raffle-nav--left");
    const right = document.querySelector(".raffle-nav--right");

    const btnReroll = document.getElementById("btnReroll");
    const btnShuffle = document.getElementById("btnShuffle");
    const btnPick = document.getElementById("btnPick");

    const badgeReroll = document.getElementById("badgeReroll");
    const badgeShuffle = document.getElementById("badgeShuffle");

    const audioRerollId = (cfg.audio && cfg.audio.rerollId) || "rerollSound";

    // >>> START: liczby bierzemy z HTML (czyli z DB przez render)
    let rerollsLeft = readInt(badgeReroll, 3);
    let shufflesLeft = readInt(badgeShuffle, 3);

    let active = 0;

    function applyClasses() {
      if (!boards.length) return;
      boards.forEach((b, i) => {
        b.classList.remove(
          "raffle-board--active",
          "raffle-board--prev",
          "raffle-board--next",
          "raffle-board--hidden"
        );
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
      if (btnReroll) btnReroll.disabled = (rerollsLeft <= 0);
      if (btnShuffle) btnShuffle.disabled = (shufflesLeft <= 0);
    }

    function syncCountersFromServer(data) {
      // backend ma być źródłem prawdy
      if (data && typeof data.rerolls_left === "number") rerollsLeft = data.rerolls_left;
      if (data && typeof data.shuffles_left === "number") shufflesLeft = data.shuffles_left;
      paintBadges();
    }

    function show(n) {
      if (!boards.length) return;
      active = (n + boards.length) % boards.length;
      applyClasses();
    }

    // NAV
    if (left) left.addEventListener("click", () => show(active - 1));
    if (right) right.addEventListener("click", () => show(active + 1));

    // INIT
    applyClasses();
    paintBadges();

    // ======================
    // SHUFFLE
    // ======================
    if (btnShuffle) {
      btnShuffle.addEventListener("click", async () => {
        if (btnShuffle.disabled) return;

        const board = boards[active];
        const gridEl = board?.querySelector(".raffle-grid");
        const tiles = Array.from(board?.querySelectorAll(".raffle-tile") || []);
        const textsEls = Array.from(board?.querySelectorAll(".raffle-text") || []);

        if (!gridEl || tiles.length !== targetTiles) return;

        btnShuffle.disabled = true;

        try {
          const { data } = await fetchJsonSafe(endpoints.shuffle, {
            method: "POST",
            credentials: "same-origin",
            headers: { "X-CSRFToken": csrftoken },
          });

          if (!data.ok) {
            syncCountersFromServer(data);
            showToast?.(data.error || "Shuffle blocked", "error", 2200);
            return;
          }

          // backend zwraca nowe liczniki
          syncCountersFromServer(data);

          // animacja + shuffle tekstów lokalnie
          const first = tiles.map(t => t.getBoundingClientRect());
          const centerRect = gridEl.getBoundingClientRect();
          const cx = centerRect.left + centerRect.width / 2;
          const cy = centerRect.top + centerRect.height / 2;

          gridEl.classList.add("is-shuffling");

          const toCenterAnims = tiles.map((tile, i) => {
            const r = first[i];
            const tx = cx - (r.left + r.width / 2);
            const ty = cy - (r.top + r.height / 2);
            return tile.animate(
              [
                { transform: "translate(0px, 0px) scale(1)" },
                { transform: `translate(${tx}px, ${ty}px) scale(0.92)` }
              ],
              { duration: 180, easing: "cubic-bezier(.2,.9,.2,1)", fill: "forwards" }
            );
          });

          await Promise.allSettled(toCenterAnims.map(a => a.finished));

          const texts = textsEls.map(t => t.textContent);
          const shuffledTexts = shuffleArray(texts);
          textsEls.forEach((t, i) => { t.textContent = shuffledTexts[i]; });

          toCenterAnims.forEach(a => a.cancel());

          const last = tiles.map(t => t.getBoundingClientRect());
          const fromCenterToCellAnims = tiles.map((tile, i) => {
            const r = last[i];
            const tx = cx - (r.left + r.width / 2);
            const ty = cy - (r.top + r.height / 2);
            return tile.animate(
              [
                { transform: `translate(${tx}px, ${ty}px) scale(0.92)` },
                { transform: "translate(0px, 0px) scale(1)" }
              ],
              { duration: 260, easing: "cubic-bezier(.2,.9,.2,1)", fill: "forwards" }
            );
          });

          await Promise.allSettled(fromCenterToCellAnims.map(a => a.finished));
          fromCenterToCellAnims.forEach(a => a.cancel());
          gridEl.classList.remove("is-shuffling");

        } catch (e) {
          console.error("[shuffle] error:", e);
          showToast?.("Shuffle: błąd serwera (sprawdź Network)", "error", 2400);
          gridEl?.classList.remove("is-shuffling");
        } finally {
          paintBadges();
          btnShuffle.disabled = (shufflesLeft <= 0);
        }
      });
    }

    // ======================
    // REROLL
    // ======================
    if (btnReroll) {
      btnReroll.addEventListener("click", async () => {
        if (btnReroll.disabled) return;

        playAudioById(audioRerollId);

        const board = boards[active];
        const gridEl = board ? board.querySelector(".raffle-grid") : null;
        const tiles = Array.from(board?.querySelectorAll(".raffle-text") || []);

        if (!board || tiles.length !== targetTiles) return;

        const form = new FormData();
        form.append("grid", String(active));

        if (gridEl) gridEl.classList.add("is-rerolling");
        btnReroll.disabled = true;

        try {
          const { data } = await fetchJsonSafe(endpoints.reroll, {
            method: "POST",
            credentials: "same-origin",   // ⬅⬅⬅ TO JEST BRAKUJĄCE
            headers: { "X-CSRFToken": csrftoken },
            body: form
          });

          if (!data.ok) {
            syncCountersFromServer(data);
            showToast?.(data.error || "Reroll blocked", "error", 2200);
            return;
          }

          // MUSI być cells[16]
          if (!Array.isArray(data.cells) || data.cells.length !== targetTiles) {
            console.warn("[reroll] invalid cells:", data.cells);
            showToast?.("Reroll: serwer nie zwrócił poprawnych danych", "error", 2400);
            syncCountersFromServer(data);
            return;
          }

          // opcjonalne opóźnienie pod animację
          await sleep(250);

          data.cells.forEach((txt, i) => {
            if (tiles[i]) tiles[i].textContent = (txt || "—");
          });

          // backend zwraca nowe liczniki (to jest najważniejsze!)
          syncCountersFromServer(data);

        } catch (e) {
          console.error("[reroll] error:", e);
          showToast?.("Reroll: błąd serwera (sprawdź Network)", "error", 2400);
        } finally {
          setTimeout(() => {
            if (gridEl) gridEl.classList.remove("is-rerolling");
          }, 260);

          paintBadges();
          btnReroll.disabled = (rerollsLeft <= 0);
        }
      });
    }

    // ======================
    // PICK (JSON aktualnego grida)
    // ======================
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

        const payload = {
          active_grid_index: active,
          size,
          generated_at: new Date().toISOString(),
          grid: grid2d,
          flat: texts
        };

        console.log(JSON.stringify(payload, null, 2));
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
