(() => {
  // ===== config =====
  const CFG = {

    MUSIC_STATE_KEY: "bingo_kyspro_music_state_v1",
    MUSIC_SAVE_EVERY_MS: 5000,  // 

    STORAGE_KEY: "bingo_kyspro_captcha_v1",

    // paywall odstęp
    PERIOD_MS: 1 * 60 * 1000,
    // 
    MIN_COOLDOWN_MS: 15 * 1000,
    // UI
    TITLE: "Weryfikacja dostępu",
    SUBTITLE: "",
    OK: "OK",
    ERROR: "No chyba sobie żartujesz",

    
    SFX_KEY: "ambient",
    BG_VOL: 0.10,          
    BG_FADE_MS: 100,       
    BG_SHUFFLE: true,      

    // losowanie trybu: 0..1 (np. 0.5 = pół na pół)
    MODE_SUDOKU_CHANCE: 0.5,

    // Sudoku: ilość pustych pól (0..16) – im więcej tym trudniej
    SUDOKU_EMPTY: 8,

    // obrazki 
    GOOD_IMGS: [
      "/static/bingo/images/kamiqxx/goodboy1.jpg",
      "/static/bingo/images/kamiqxx/goodboy2.jpg",
      "/static/bingo/images/kamiqxx/goodboy3.jpg",
      "/static/bingo/images/kamiqxx/goodboy4.jpg",
      "/static/bingo/images/kamiqxx/goodboy5.jpg",
    ],

    BAD_IMGS: [
      "/static/bingo/images/kamiqxx/badboy1.jpg",
      "/static/bingo/images/kamiqxx/badboy2.jpg",
      "/static/bingo/images/kamiqxx/badboy3.jpg",
      "/static/bingo/images/kamiqxx/badboy4.jpg",
      "/static/bingo/images/kamiqxx/badboy5.jpg",
      "/static/bingo/images/kamiqxx/badboy6.jpg",
      "/static/bingo/images/kamiqxx/badboy7.jpg",
      "/static/bingo/images/kamiqxx/badboy8.jpg",
      "/static/bingo/images/kamiqxx/badboy9.jpg",
      "/static/bingo/images/kamiqxx/badboy10.jpg",
      "/static/bingo/images/kamiqxx/badboy11.jpg",
      "/static/bingo/images/kamiqxx/badboy12.jpg",
      "/static/bingo/images/kamiqxx/badboy13.jpg",
    ],


    TILE_SIZE: 220,     
    SUDOKU_CELL: 100,    
    MODAL_MAX_W: 1300,   


    MODE_KEY: "bingo_kyspro_mode_v1",
    DEFAULT_MODE: "findBoy",  

  };

  // ===== helpers =====
  function now() { return Date.now(); }

  function loadMusicState() {
    try {
      const raw = localStorage.getItem(CFG.MUSIC_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveMusicState(obj) {
    try { localStorage.setItem(CFG.MUSIC_STATE_KEY, JSON.stringify(obj)); } catch {}
  }


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

  function loadMode() {
    try { return localStorage.getItem(CFG.MODE_KEY) || CFG.DEFAULT_MODE; }
    catch { return CFG.DEFAULT_MODE; }
  }

  function saveMode(mode) {
    try { localStorage.setItem(CFG.MODE_KEY, mode); } catch {}
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

  function shuffleInPlace(a){
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }


  function permuteSudoku4(solution) {
    // 
    const map = shuffle([1,2,3,4]);
    const digitMap = (v) => map[v - 1];

    // permutacja wierszy
    const rBand0 = shuffle([0,1]);
    const rBand1 = shuffle([2,3]);
    const rowOrder = rBand0.concat(rBand1);

    // permutacja kolumn
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



    function setImgWithFallback(img, tile, primarySrc, fallbackPool) {
    const fallbacks = Array.isArray(fallbackPool) ? fallbackPool.slice() : [];
    let triedPrimary = false;

    function apply(src) {
      img.src = src;
      tile.style.setProperty("--kys-img", `url("${src}")`);
    }

    img.addEventListener("error", () => {
      // fallback
      if (!triedPrimary) {
        triedPrimary = true;
      }

      // zdejmij bieżący src
      const cur = img.currentSrc || img.src;
      const idx = fallbacks.indexOf(cur);
      if (idx >= 0) fallbacks.splice(idx, 1);

      const next = fallbacks.length ? fallbacks[(Math.random() * fallbacks.length) | 0] : "";
      if (next && next !== cur) apply(next);
    });

    apply(primarySrc);
  }

  // ===== renderers =====
  function renderFindBoy(modal, { onSuccess, setMsg }) {
    
    const title = document.createElement("div");
    title.className = "kys-mode-title";
    title.textContent = "ZNAJDŹ GRZECZNEGO CHŁOPCA";
    modal.appendChild(title);

    const fine = document.createElement("div");
    fine.className = "kys-fine";
    fine.textContent = "(jest tylko jeden grzeczny chłopiec)";
    modal.appendChild(fine);


    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `repeat(3, ${CFG.TILE_SIZE}px)`;
    grid.style.gap = "14px";
    grid.style.maxWidth = "95vw";

    grid.style.justifyContent = "center";
    grid.style.marginTop = "14px";

    const goodIndex = (Math.random() * 9) | 0;

    const pickOne = (arr) => arr[(Math.random() * arr.length) | 0];
    
    const goodImg = pickOne(CFG.GOOD_IMGS);

    let badPool = CFG.BAD_IMGS.slice();
    let badImgsForTiles = [];
    if (badPool.length >= 8) {
      shuffleInPlace(badPool);
      badImgsForTiles = badPool.slice(0, 8);
    } else {
      badImgsForTiles = badPool.slice();
      while (badImgsForTiles.length < 8) {
        badImgsForTiles.push(pickOne(badPool)); // dobierz losowo, mogą być powtórki
      }
      shuffleInPlace(badImgsForTiles);
    }


    for (let i = 0; i < 9; i++) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "kys-tile";
      tile.textContent = "";

      const img = document.createElement("img");

      if (i === goodIndex) {
        // GOOD
        setImgWithFallback(img, tile, goodImg, CFG.GOOD_IMGS);
      } else {
        // BAD
        const badSrc = badImgsForTiles.pop();
        setImgWithFallback(img, tile, badSrc, CFG.BAD_IMGS);
      }




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
    const title = document.createElement("div");
    title.className = "kys-mode-title";
    title.textContent = "WYKAŻ SIĘ INTELEKTEM";
    modal.appendChild(title);

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
            
            const m = (cell.value || "").replace(/[^1-4]/g, "");
            cell.value = m.slice(0, 1);
          });
        }

        // 
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

    // ===== AUDIO =====
    let bg = null;
    let audioUnlocked = false;

    let playlist = [];
    let playlistIdx = 0;

    let resume = loadMusicState();   
    let saveTimer = null;

    function startSavingPosition() {
      if (saveTimer) return;
      saveTimer = setInterval(() => {
        if (!bg || bg.paused || !playlist.length) return;
        saveMusicState({
          idx: Math.max(0, playlistIdx - 1),         
          t: Number(bg.currentTime || 0),
          order: playlist.slice(),                   
          at: Date.now()
        });
      }, CFG.MUSIC_SAVE_EVERY_MS || 3000);
    }

    function stopSavingPosition() {
      if (saveTimer) { clearInterval(saveTimer); saveTimer = null; }
    }



    function getAudioList() {
      const v = sfx?.[CFG.SFX_KEY];
      if (Array.isArray(v)) return v.map(String).filter(Boolean);
      if (typeof v === "string" && v) return [String(v)];
      return [];
    }

    function shuffleInPlace(a){
      for (let i = a.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function ensurePlaylist() {
      const list = getAudioList();
      if (!list.length) return false;

      if (!playlist.length) {
        // jeżeli mamy zapisany stan z poprzedniej sesji i pasuje do listy plików
        if (resume && Array.isArray(resume.order) && resume.order.length) {
          // walidacja
          const a = resume.order.slice().sort().join("||");
          const b = list.slice().map(String).sort().join("||");
          if (a === b) {
            playlist = resume.order.slice();
            playlistIdx = Number.isFinite(+resume.idx) ? (+resume.idx) : 0;

            return true;
          }
        }

        // fallback
        playlist = list.slice();
        if (CFG.BG_SHUFFLE) shuffleInPlace(playlist);
        playlistIdx = 0;
      }
      return true;
    }


    function fadeTo(target, ms = 600) {
      if (!bg) return;
      const start = bg.volume || 0;
      const t0 = performance.now();
      const step = (t) => {
        if (!bg) return;
        const k = Math.min(1, (t - t0) / Math.max(1, ms));
        bg.volume = start + (target - start) * k;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    function playNextTrack() {
      if (!ensurePlaylist()) return false;

      const n = playlist.length;
      const pos = (n > 0) ? (playlistIdx % n) : 0;
      const isResume = !!resume;


      // roll tylko na granicy 
      if (!isResume && CFG.BG_SHUFFLE && n > 1 && pos === 0) {
        shuffleInPlace(playlist);
      }


      const src = playlist[pos];
      const shouldSeek = isResume && (Number(resume?.t) > 0) && (Number(resume?.idx) === pos);
      const seekTo = shouldSeek ? Number(resume.t) : 0;

      playlistIdx++;


      try {
        if (!bg) bg = new Audio();
        bg.pause();
        bg.currentTime = 0;
      } catch {}

      bg.src = src;
      bg.preload = "auto";
      bg.loop = false;              // playlista zamiast loop jednego
      bg.volume = 0.13;                // start od zera -> fade-in

      bg.onended = () => {
        // następny utwór
        playNextTrack();
      };

      bg.onloadedmetadata = () => {
        if (shouldSeek && isFinite(seekTo) && seekTo > 0 && seekTo < (bg.duration || Infinity)) {
          try { bg.currentTime = seekTo; } catch {}
        }
      };


      const p = bg.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          audioUnlocked = true;
          fadeTo(Number(CFG.BG_VOL ?? 0.07), Number(CFG.BG_FADE_MS ?? 500));
          startSavingPosition();
          resume = null;
        }).catch(() => {});
      }
      return true;
      }



    function startAmbientAudio() {
      // jeżeli już gra – stop
      if (bg && !bg.paused) return true;
      return playNextTrack();
    }

    function stopAmbientAudio() {
      if (!bg) return;
      // krótki fade-out i pauza
      const ms = 300;
      const prev = bg.volume || 0;
      fadeTo(0, ms);
      setTimeout(() => {
        try { bg.pause(); } catch {}
        try { bg.currentTime = 0; } catch {}
        try { bg.volume = prev; } catch {}
      }, ms + 30);
    }

    function unlockAudioOnce() {
      if (audioUnlocked) return;
      startAmbientAudio();
    }

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

.kys-title{ font-size: 22px; font-weight: 800; margin: 0 0 8px; text-align:center; }
.kys-sub{ font-size: 7px; opacity: .88; margin: 0 0 10px; line-height: 1.35; font-style: italic; }

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

  position: relative;        /* <<< dodane */
  overflow: hidden;
  padding: 10px;
  box-sizing: border-box;
}

.kys-tile:hover{ outline: 2px solid rgba(255,255,255,.16); }
.kys-tile--bad{ background: #441111; }

.kys-tile::before{
  content: "";
  position: absolute;
  inset: 0;
  background-image: var(--kys-img);
  background-size: cover;
  background-position: center;
  filter: blur(12px);
  transform: scale(1.15);
  opacity: .55;
}

/* obrazki w kafelkach — CAŁE widoczne */
.kys-tile img{
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;       /* całe widoczne */
  object-position: center;
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

.kys-picker{
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.kys-picker-btn{
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.08);
  color: #fff;
  border-radius: 14px;
  padding: 10px 16px;
  font-weight: 900;
  cursor: pointer;
  font-size: 18px;
}

.kys-picker-label{
  min-width: 160px;
  text-align: center;
  font-weight: 900;
  opacity: .95;
  font-size: 16px;
}

/* drugi tytuł (tryb) pod "Weryfikacja dostępu" */
.kys-mode-title{
  margin-top: 4px;
  text-align: center;
  font-size: 26px;
  font-weight: 950;
  letter-spacing: .8px;
}

/* subtitle pod drugim tytułem (tylko zdjęcia) */
.kys-fine{
  margin-top: 6px;
  text-align: center;
  font-size: 13px;
  opacity: .75;
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
          // spróbuj odpalić audio 
          startAmbientAudio();

          // guard: nie duplikuj
          if (document.getElementById("kys-overlay")) return;

          overlay = document.createElement("div");
          overlay.className = "kys-overlay";
          overlay.id = "kys-overlay";
          overlay.setAttribute("role", "dialog");
          overlay.setAttribute("aria-modal", "true");

          const modal = document.createElement("div");
          modal.className = "kys-modal";

          msg = document.createElement("div");
          msg.className = "kys-msg";


          // PASS handler
          function passGate() {
            const st = loadState();
            st.last_passed_at = now();
            saveState(st);
            closeGate();
          }

          
          // kontener na treść trybu
      const body = document.createElement("div");
      modal.appendChild(body);

      // pasek wyboru trybu
      let mode = loadMode(); // "findBoy" albo "sudoku4"

      const picker = document.createElement("div");
      picker.className = "kys-picker";

      const left = document.createElement("button");
      left.type = "button";
      left.className = "kys-picker-btn";
      left.textContent = "←";

      const label = document.createElement("div");
      label.className = "kys-picker-label";

      const right = document.createElement("button");
      right.type = "button";
      right.className = "kys-picker-btn";
      right.textContent = "→";

      picker.appendChild(left);
      picker.appendChild(label);
      picker.appendChild(right);

      // wstaw picker pod subtitle
      modal.appendChild(picker);

      function modeLabel(m) {
        return m === "sudoku4" ? "Sudoku" : "Zdjęcia";
      }

      function renderMode() {
        body.innerHTML = "";
        setMsg("");
        label.textContent = modeLabel(mode);

        if (mode === "findBoy") {
          renderFindBoy(body, { onSuccess: passGate, setMsg });
        } else {
          renderSudoku4(body, { onSuccess: passGate, setMsg });
        }
      }

      function toggleMode() {
        mode = (mode === "findBoy") ? "sudoku4" : "findBoy";
        saveMode(mode);
        renderMode();
      }

      left.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); toggleMode(); });
      right.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); toggleMode(); });

      // start render
      renderMode();


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




        return () => {
          try { closeGate(); } catch {}
          try { style.remove(); } catch {}
          try { if (bg) { bg.pause(); bg.currentTime = 0; } } catch {}
        };
      }
    };

    window.BingoPluginRuntime?.initUserPlugin?.();
  });
})();
