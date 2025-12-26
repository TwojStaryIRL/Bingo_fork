(() => {
  // ===== config =====
  const CFG = {
    STORAGE_KEY: "bingo_kyspro_captcha_v1",

    // co ile ma wracać paywall (ms)
    PERIOD_MS: 1 * 60 * 1000,

    // minimalny odstęp od ostatniego zdjęcia paywalla (ms)
    MIN_COOLDOWN_MS: 15 * 1000,

    // UI
    TITLE: "Weryfikacja dostępu",
    SUBTITLE: "Rozwiąż szybkie zadanie, żeby wrócić na stronę",
    OK: "OK",
    ERROR: "Spróbuj jeszcze raz",

    // AUDIO (placeholder – podepniesz w sfx)
    // w python config: sfx={ "bg_music": [static("...mp3")] }
    SFX_KEY: "bg_music",

    // losowanie trybu: 0..1 (np. 0.5 = pół na pół)
    MODE_SUDOKU_CHANCE: 0.5,

    // Sudoku: ilość pustych pól (0..16) – im więcej tym trudniej
    SUDOKU_EMPTY: 8,

    // obrazki 
    GOOD_IMG: "/static/bingo/images/kamiqxx/goodboy1.gif",
    BAD_IMGS: [
      "/static/bingo/images/kamiqxx/badboy.gif",
      "/static/bingo/images/kamiqxx/badboy2.jpg",
      "/static/bingo/images/kamiqxx/badboy3.jpg",
      "/static/bingo/images/kamiqxx/badboy4.jpg",
    ],


    TILE_SIZE: 150,     // było 92
    SUDOKU_CELL: 78,    // było 50
    MODAL_MAX_W: 980,   // większy modal

  };

  // ===== helpers =====
  function now() { return Date.now(); }

  function loadState() {
    try {
      const raw = localStorage.getItem(CFG.STORAGE_KEY);
      return raw ? JSON.parse(raw) : { last_passed_at: 0 };
    } catch {
      return { last_passed_at: 0 };
    }
  }

  function saveState(state) {
    try { localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function whenRuntime(fn) {
    if (window.BingoPluginRuntime?.initUserPlugin) return fn();
    const t = setInterval(() => {
      if (window.BingoPluginRuntime?.initUserPlugin) {
        clearInterval(t);
        fn();
      }
    }, 40);
  }

  function clamp01(x) {
    const n = Number(x);
    if (!isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  // ===== mode picker =====
  function pickMode() {
    return Math.random() < clamp01(CFG.MODE_SUDOKU_CHANCE) ? "sudoku4" : "findBoy";
  }

  // ===== sudoku helpers =====
  function baseSudoku4Solution() {
    // poprawne 4x4 (2x2 subgrid)
    return [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ];
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function permuteSudoku4(solution) {
    // prosta permutacja cyfr 1..4 + swap wierszy w obrębie bandów + swap kolumn w obrębie stacków
    const map = shuffle([1,2,3,4]);
    const digitMap = (v) => map[v - 1];

    // permutacja wierszy: (0,1) w bandzie 0 i (2,3) w bandzie 1
    const rBand0 = shuffle([0,1]);
    const rBand1 = shuffle([2,3]);
    const rowOrder = rBand0.concat(rBand1);

    // permutacja kolumn: (0,1) w stacku 0 i (2,3) w stacku 1
    const cStack0 = shuffle([0,1]);
    const cStack1 = shuffle([2,3]);
    const colOrder = cStack0.concat(cStack1);

    const tmp = rowOrder.map(r =>
      colOrder.map(c => digitMap(solution[r][c]))
    );
    return tmp;
  }

  function makeSudoku4Puzzle(solution, emptyCount = 8) {
    const puzzle = solution.map(r => r.slice());
    const cells = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) cells.push({x,y});
    const pick = shuffle(cells).slice(0, Math.max(0, Math.min(16, emptyCount)));

    pick.forEach(({x,y}) => { puzzle[y][x] = ""; });
    return puzzle;
  }

  // ===== renderers =====
  function renderFindBoy(modal, { onSuccess, setMsg }) {
    const hint = document.createElement("div");
    hint.style.marginTop = "6px";
    hint.style.fontSize = "13px";
    hint.style.opacity = "0.85";
    hint.textContent = "Znajdź grzecznego chłopca (tylko 1 kafelek jest poprawny).";
    modal.appendChild(hint);

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `repeat(3, ${CFG.TILE_SIZE}px)`;
    grid.style.gap = "14px";
    grid.style.maxWidth = "95vw";

    grid.style.justifyContent = "center";
    grid.style.marginTop = "14px";

    const goodIndex = (Math.random() * 9) | 0;

    for (let i = 0; i < 9; i++) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "kys-tile";
      tile.textContent = "";

      const img = document.createElement("img");
      img.src = (i === goodIndex)
        ? CFG.GOOD_IMG
        : CFG.BAD_IMGS[(Math.random() * CFG.BAD_IMGS.length) | 0];

      img.alt = (i === goodIndex) ? "good boy" : "bad boy";
      img.draggable = false;
      tile.appendChild(img);


      tile.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (i === goodIndex) {
          setMsg(CFG.OK, "ok");
          onSuccess();
        } else {
          setMsg(CFG.ERROR, "error");
          tile.classList.add("kys-tile--bad");
        }
      });

      grid.appendChild(tile);
    }

    modal.appendChild(grid);
  }

  function renderSudoku4(modal, { onSuccess, setMsg }) {
    const hint = document.createElement("div");
    hint.style.marginTop = "6px";
    hint.style.fontSize = "13px";
    hint.style.opacity = "0.85";
    hint.textContent = "Sudoku 4×4: wpisz cyfry 1–4 tak, żeby w każdym wierszu i kolumnie były bez powtórek.";
    modal.appendChild(hint);

    const solution = permuteSudoku4(baseSudoku4Solution());
    const puzzle = makeSudoku4Puzzle(solution, CFG.SUDOKU_EMPTY);

    const inputs = [];

    const grid = document.createElement("div");
    grid.className = "kys-sudoku";
    grid.style.marginTop = "14px";

    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const cell = document.createElement("input");
        cell.inputMode = "numeric";
        cell.maxLength = 1;
        cell.className = "kys-cell";

        const v = puzzle[y][x];
        if (v !== "") {
          cell.value = String(v);
          cell.disabled = true;
          cell.classList.add("kys-cell--fixed");
        } else {
          inputs.push({ cell, x, y });
          cell.addEventListener("input", () => {
            // zostaw tylko 1-4
            const m = (cell.value || "").replace(/[^1-4]/g, "");
            cell.value = m.slice(0, 1);
          });
        }

        // wizualne subgrid 2x2
        const rightBorder = (x === 1) ? "2px solid rgba(255,255,255,.18)" : "1px solid rgba(255,255,255,.12)";
        const bottomBorder = (y === 1) ? "2px solid rgba(255,255,255,.18)" : "1px solid rgba(255,255,255,.12)";
        cell.style.borderRight = rightBorder;
        cell.style.borderBottom = bottomBorder;

        grid.appendChild(cell);
      }
    }

    const row = document.createElement("div");
    row.className = "kys-row";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kys-btn";
    btn.textContent = "Sprawdź";

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const ok = inputs.every(({ cell, x, y }) => Number(cell.value) === solution[y][x]);
      if (ok) {
        setMsg(CFG.OK, "ok");
        onSuccess();
      } else {
        setMsg(CFG.ERROR, "error");
      }
    });

    row.appendChild(btn);
    modal.appendChild(grid);
    modal.appendChild(row);

    // fokus na pierwsze puste
    const first = inputs[0]?.cell;
    if (first) setTimeout(() => { try { first.focus(); } catch {} }, 60);
  }

  // ===== plugin =====
  whenRuntime(() => {
    window.BingoUserPlugin = {
      init(api) {

        if (window.__bingo_kyspro_captcha_v1_started) return;
        window.__bingo_kyspro_captcha_v1_started = true;

        const { ctx, sfx } = api;
        const root = document.getElementById("plugin-root");
        if (!root) return;

        // ===== AUDIO (loop) =====
        let bg = null;
        let audioUnlocked = false;

        function getAudioUrl() {
          const v = sfx?.[CFG.SFX_KEY];
          if (Array.isArray(v)) return v[0] ? String(v[0]) : "";
          if (typeof v === "string") return v;
          return "";
        }

        function startLoopAudio() {
          const url = getAudioUrl();
          if (!url) return false;

          if (bg && !bg.paused) return true;

          try { if (bg) { bg.pause(); bg.currentTime = 0; } } catch {}

          bg = new Audio(url);
          bg.loop = true;
          bg.volume = 0.55;
          bg.preload = "auto";

          const p = bg.play();
          if (p && typeof p.then === "function") {
            p.then(() => { audioUnlocked = true; }).catch(() => {});
          }
          return true;
        }

        function unlockAudioOnce() {
          if (audioUnlocked) return;
          startLoopAudio();
        }

        // łap interakcję wcześnie (capture), żeby audio działało nawet gdy overlay blokuje klik
        ctx.on(document, "pointerdown", unlockAudioOnce, { once: true, capture: true });
        ctx.on(document, "keydown", unlockAudioOnce, { once: true, capture: true });

        // ===== UI =====
        const style = document.createElement("style");
        style.textContent = `
#plugin-root { position: relative; z-index: 2147483000; }

.kys-overlay{
  position: fixed; inset: 0;
  z-index: 2147483646;
  pointer-events: auto;
  background: rgba(0,0,0,.82);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  padding: 16px;
}

/* większy modal */
.kys-modal{
  width: min(${CFG.MODAL_MAX_W}px, 96vw);
  max-height: 92vh;
  overflow: auto;
  border-radius: 22px;
  background: rgba(18,18,18,.96);
  border: 1px solid rgba(255,255,255,.10);
  box-shadow: 0 28px 90px rgba(0,0,0,.6);
  padding: 22px 22px 18px;
  color: #fff;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
}

.kys-title{ font-size: 22px; font-weight: 800; margin: 0 0 8px; }
.kys-sub{ font-size: 15px; opacity: .88; margin: 0 0 10px; line-height: 1.35; }

.kys-row{ display:flex; gap:12px; margin-top:14px; align-items:center; justify-content:center; }

.kys-btn{
  border: 0;
  border-radius: 14px;
  padding: 14px 18px;
  font-weight: 900;
  cursor: pointer;
  background: #ffffff;
  color: #111;
  font-size: 16px;
}

.kys-msg{ font-size: 14px; opacity: .95; margin-top: 14px; min-height: 18px; text-align:center; }
.kys-msg.error{ color: #ffb4b4; }
.kys-msg.ok{ color: #b9ffd4; }

/* find-boy tiles — WIĘKSZE */
.kys-tile{
  width: ${CFG.TILE_SIZE}px;
  height: ${CFG.TILE_SIZE}px;
  border-radius: 18px;
  border: 0;
  background: #222;
  cursor: pointer;
  color: #fff;

  overflow: hidden;
  padding: 10px;             /* odstęp = obraz nie dotyka krawędzi */
  box-sizing: border-box;
}
.kys-tile:hover{ outline: 2px solid rgba(255,255,255,.16); }
.kys-tile--bad{ background: #441111; }

/* obrazki w kafelkach — CAŁE widoczne */
.kys-tile img{
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  pointer-events: none;
}

/* sudoku — WIĘKSZE komórki */
.kys-sudoku{
  display: grid;
  grid-template-columns: repeat(4, ${CFG.SUDOKU_CELL}px);
  justify-content: center;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 16px;
  overflow: hidden;
}

.kys-cell{
  width: ${CFG.SUDOKU_CELL}px;
  height: ${CFG.SUDOKU_CELL}px;
  text-align: center;
  font-size: 28px;
  font-weight: 800;
  color: #fff;
  background: rgba(255,255,255,.06);
  border: 0;
  outline: none;
}

.kys-cell--fixed{
  background: rgba(255,255,255,.12);
  opacity: .95;
}


}
        `;
        document.head.appendChild(style);

        // ===== overlay state =====
        let overlay = null;
        let msg = null;

        function setMsg(text, kind = "") {
          if (!msg) return;
          msg.textContent = text || "";
          msg.classList.toggle("error", kind === "error");
          msg.classList.toggle("ok", kind === "ok");
        }

        function closeGate() {
          const el = document.getElementById("kys-overlay");
          if (el) { try { el.remove(); } catch {} }
          overlay = null;
          msg = null;
        }

        function openGate() {
          // spróbuj odpalić audio (jak już odblokowane interakcją – zadziała)
          startLoopAudio();

          // guard: nie duplikuj
          if (document.getElementById("kys-overlay")) return;

          overlay = document.createElement("div");
          overlay.className = "kys-overlay";
          overlay.id = "kys-overlay";
          overlay.setAttribute("role", "dialog");
          overlay.setAttribute("aria-modal", "true");

          const modal = document.createElement("div");
          modal.className = "kys-modal";

          const h = document.createElement("h2");
          h.className = "kys-title";
          h.textContent = CFG.TITLE;

          const s = document.createElement("p");
          s.className = "kys-sub";
          s.textContent = CFG.SUBTITLE;

          msg = document.createElement("div");
          msg.className = "kys-msg";

          modal.appendChild(h);
          modal.appendChild(s);

          // PASS handler
          function passGate() {
            const st = loadState();
            st.last_passed_at = now();
            saveState(st);
            closeGate();
          }

          // losuj tryb
          const mode = pickMode();
          if (mode === "findBoy") {
            renderFindBoy(modal, { onSuccess: passGate, setMsg });
          } else {
            renderSudoku4(modal, { onSuccess: passGate, setMsg });
          }

          modal.appendChild(msg);
          overlay.appendChild(modal);
          root.appendChild(overlay);

          // blokuj klik tylko w tło overlay (nie w modal / inputy)
            ctx.on(overlay, "pointerdown", (e) => {
              if (e.target === overlay) {          // klik w tło
                e.preventDefault();
                e.stopPropagation();
              }
            }, { capture: true });

            ctx.on(overlay, "click", (e) => {
              if (e.target === overlay) {          // klik w tło
                e.preventDefault();
                e.stopPropagation();
              }
            }, { capture: true });


          setMsg("");
        }

        function shouldShowNow() {
          const st = loadState();
          const last = Number(st.last_passed_at || 0);
          const since = now() - last;

          if (!last) return true;                 // <- jak gate_v2
          if (since < CFG.MIN_COOLDOWN_MS) return false;
          return since >= CFG.PERIOD_MS;
        }

        function tick() {
          if (shouldShowNow()) openGate();
        }

        ctx.setTimeoutSafe(() => tick(), 250);
        ctx.setIntervalSafe(() => tick(), 2000);
        ctx.on(window, "focus", () => tick());


        function tick() {
          if (shouldShowNow()) openGate();
        }

        // start bez pierwszego popupa (zaskoczenie)
        ctx.setTimeoutSafe(() => tick(), 250);

        // polling
        ctx.setIntervalSafe(() => tick(), 2000);

        // focus check
        ctx.on(window, "focus", () => tick());

        return () => {
          try { closeGate(); } catch {}
          try { style.remove(); } catch {}
          try { if (bg) { bg.pause(); bg.currentTime = 0; } } catch {}
        };
      }
    };

    // UWAGA: init wywołuje runtime (tak jak w innych pluginach)
    window.BingoPluginRuntime?.initUserPlugin?.();
  });
})();
