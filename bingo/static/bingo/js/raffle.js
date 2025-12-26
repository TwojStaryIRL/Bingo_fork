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

  // Fisher–Yates
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

  function toInt(x, fallback = 0) {
    const n = Number(x);
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

    let active = 0;

    // START: bierzemy "left" z DOM (czyli z DB przez template)
    let rerollsLeft = toInt(badgeReroll?.textContent, 0);
    let shufflesLeft = toInt(badgeShuffle?.textContent, 0);

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

    function updateBadges() {
      const rl = Math.max(0, toInt(rerollsLeft, 0));
      const sl = Math.max(0, toInt(shufflesLeft, 0));

      if (badgeReroll) {
        badgeReroll.textContent = String(rl);
        badgeReroll.classList.toggle("btn-badge--disabled", rl === 0);
      }
      if (badgeShuffle) {
        badgeShuffle.textContent = String(sl);
        badgeShuffle.classList.toggle("btn-badge--disabled", sl === 0);
      }

      if (btnReroll) btnReroll.disabled = (rl === 0);
      if (btnShuffle) btnShuffle.disabled = (sl === 0);
    }

    function applyLeftFromResponse(data) {
      if (data && typeof data.rerolls_left === "number") rerollsLeft = data.rerolls_left;
      if (data && typeof data.shuffles_left === "number") shufflesLeft = data.shuffles_left;
      updateBadges();
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
    updateBadges();

    // SHUFFLE (backend limit + animacja)
    if (btnShuffle) {
      btnShuffle.addEventListener("click", async () => {
        if (btnShuffle.disabled) return;

        const board = boards[active];
        const gridEl = board?.querySelector(".raffle-grid");
        const tiles = Array.from(board?.querySelectorAll(".raffle-tile") || []);
        const textsEls = Array.from(board?.querySelectorAll(".raffle-text") || []);

        if (!gridEl || tiles.length !== targetTiles) return;

        // UI lock (żeby nie spamować klikami)
        btnShuffle.disabled = true;

        try {
          const res = await fetch(endpoints.shuffle, {
            method: "POST",
            headers: { "X-CSRFToken": csrftoken },
          });

          const data = await res.json();

          if (!data.ok) {
            showToast?.(data.error || "Shuffle blocked", "error", 2200);
            // nawet na błędzie spróbuj zaciągnąć left jeśli backend zwrócił
            applyLeftFromResponse(data);
            return;
          }

          // Ustaw left z backendu
          applyLeftFromResponse(data);

          const first = tiles.map(t => t.getBoundingClientRect());
          const centerRect = gridEl.getBoundingClientRect();
          const cx = centerRect.left + centerRect.width / 2;
          const cy = centerRect.top + centerRect.height / 2;

          gridEl.classList.add("is-shuffling");

          // Faza 1: do środka
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

          // Faza 2: przetasuj teksty (frontend)
          const texts = textsEls.map(t => t.textContent);
          const shuffledTexts = shuffleArray(texts);
          textsEls.forEach((t, i) => { t.textContent = shuffledTexts[i]; });

          toCenterAnims.forEach(a => a.cancel());

          // Faza 3: z centrum na pola
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
          console.error(e);
          gridEl?.classList.remove("is-shuffling");
          showToast?.("Błąd shuffle (network)", "error", 2200);
        } finally {
          updateBadges(); // odblokuje wg aktualnych left
        }
      });
    }

    // REROLL (backend limit + podmiana tekstów)
    if (btnReroll) {
      btnReroll.addEventListener("click", async () => {
        if (btnReroll.disabled) return;

        playAudioById(audioRerollId);

        const form = new FormData();
        form.append("grid", String(active));

        const board = boards[active];
        const gridEl = board ? board.querySelector(".raffle-grid") : null;

        if (gridEl) gridEl.classList.add("is-rerolling");
        btnReroll.disabled = true;

        try {
          const res = await fetch(endpoints.reroll, {
            method: "POST",
            headers: { "X-CSRFToken": csrftoken },
            body: form
          });

          const data = await res.json();

          if (!data.ok) {
            showToast?.(data.error || "Reroll blocked", "error", 2200);
            applyLeftFromResponse(data);
            return;
          }

          // Ustaw left z backendu
          applyLeftFromResponse(data);

          const tiles = Array.from(board.querySelectorAll(".raffle-text"));

          await sleep(1367); // do dostosowania

          // backend powinien zwracać data.cells (lista 16)
          if (Array.isArray(data.cells)) {
            data.cells.forEach((txt, i) => {
              if (tiles[i]) tiles[i].textContent = txt;
            });
          }

        } catch (e) {
          console.error(e);
          showToast?.("Błąd reroll (network)", "error", 2200);
        } finally {
          setTimeout(() => {
            if (gridEl) gridEl.classList.remove("is-rerolling");
          }, 260);

          updateBadges();
        }
      });
    }

    // WYBIERAM CIEBIE: JSON aktualnego grida z DOM
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
