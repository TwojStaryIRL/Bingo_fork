(() => {
  // ===== DRYMASTERO103 - Egg Gate (right -> left -> unlock center 4) =====

  // Konfiguracja: podmień ścieżki pod swoje static
  const CFG = {
    STORAGE_KEY: "bingo_drymastero103_egg_gate_v1",

    // grafiki
    IMG_LEFT:  "/static/bingo/images/Drymastero103/dziecko.jpg",
    IMG_RIGHT: "/static/bingo/images/Drymastero103/mlotek.jpg",
    IMG_THIRD: "/static/bingo/images/Drymastero103/tung.png",

    // audio
    BG_LOOP_URL: "/static/bingo/sfx/Drymastero103/gag.mp3",
    SFX_UNLOCK_URL: "/static/bingo/sfx/Drymastero103/tung.mp3",

    BG_VOLUME: 0.35,
    SFX_VOLUME: 0.85,

    // pozycjonowanie jajek względem panelu
    GAP_PX: 14,
    EGG_W: 120,
    EGG_H: 120,
  };

  function clamp01(x) {
    const n = Number(x);
    if (!isFinite(n)) return 1;
    return Math.max(0, Math.min(1, n));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(CFG.STORAGE_KEY);
      return raw ? JSON.parse(raw) : { rightClicked: false, unlocked: false };
    } catch {
      return { rightClicked: false, unlocked: false };
    }
  }

  function saveState(st) {
    try { localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(st)); } catch {}
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

  function getPanelRect() {
    const panel = document.querySelector(".panel") || document.querySelector(".panel--wide") || document.body;
    return panel.getBoundingClientRect();
  }

  // Ustal “środkowe 4” komórki:
  // - bierzemy wszystkie textarea.grid-cell
  // - zakładamy kwadrat NxN (np. 5x5)
  // - bierzemy środkowy blok 2x2 dla N nieparzystego (typowo 5 -> indeksy [1..2] wokół środka)
  function getCenter4Textareas() {
    const cells = Array.from(document.querySelectorAll("textarea.grid-cell"));
    const n = Math.sqrt(cells.length);

    if (!Number.isInteger(n) || n < 3) return [];

    // jeśli N parzyste (rzadziej), też wybierzemy “centralne 2x2”
    const mid = Math.floor(n / 2);
    const r0 = n % 2 === 0 ? (mid - 1) : (mid - 1);
    const c0 = n % 2 === 0 ? (mid - 1) : (mid - 1);

    const idx = (r, c) => r * n + c;

    const picks = [
      idx(r0, c0),
      idx(r0, c0 + 1),
      idx(r0 + 1, c0),
      idx(r0 + 1, c0 + 1),
    ].filter(i => i >= 0 && i < cells.length);

    return picks.map(i => cells[i]).filter(Boolean);
  }

  function lockCenter4(locked) {
    const center = getCenter4Textareas();

    center.forEach((ta) => {
      // blokada edycji
      ta.disabled = !!locked;

      // dodatkowo UX: wizualny “lock”
      ta.classList.toggle("dry-locked", !!locked);

      // gdyby disabled nie wystarczał w Twoich stylach:
      const wrap = ta.closest(".cell-wrapper");
      if (wrap) wrap.classList.toggle("dry-locked", !!locked);
    });
  }

  whenRuntime(() => {
    window.BingoUserPlugin = {
      init(api) {
        const { ctx } = api;
        const root = document.getElementById("plugin-root");
        if (!root) return;

        const style = document.createElement("style");
        style.textContent = `
#plugin-root { position: relative; z-index: 2147483000; }
.dry-egg {
  position: fixed;
  width: ${CFG.EGG_W}px;
  height: ${CFG.EGG_H}px;
  z-index: 2147483645;
  user-select: none;
  cursor: pointer;
  filter: drop-shadow(0 10px 24px rgba(0,0,0,.35));
}
.dry-egg[aria-disabled="true"] { cursor: not-allowed; opacity: .6; }

textarea.grid-cell.dry-locked,
.cell-wrapper.dry-locked textarea.grid-cell {
  opacity: .55;
  filter: grayscale(1);
.dry-msg {
  position: fixed;
  z-index: 2147483646;
  padding: 10px 14px;
  max-width: 320px;
  border-radius: 12px;
  background: rgba(0,0,0,.72);
  color: #fff;
  font-size: 14px;
  line-height: 1.25;
  box-shadow: 0 14px 30px rgba(0,0,0,.35);
  user-select: none;
  pointer-events: none;
}
  }
        `;
        document.head.appendChild(style);

        // ===== audio =====
        let bg = null;
        let audioUnlocked = false;

        function startBgLoop() {
          if (bg && !bg.paused) return true;
          if (!CFG.BG_LOOP_URL) return false;

          try { if (bg) { bg.pause(); bg.currentTime = 0; } } catch {}
          bg = new Audio(CFG.BG_LOOP_URL);
          bg.loop = true;
          bg.volume = clamp01(CFG.BG_VOLUME);
          bg.preload = "auto";

          const p = bg.play();
          if (p && typeof p.then === "function") {
            p.then(() => { audioUnlocked = true; }).catch(() => {});
          }
          return true;
        }

        function unlockAudioOnce() {
          if (audioUnlocked) return;
          startBgLoop();
        }

        // Odblokuj audio na pierwszą interakcję (capture, żeby nie kolidowało z UI)
        ctx.on(document, "pointerdown", unlockAudioOnce, { once: true, capture: true });
        ctx.on(document, "keydown", unlockAudioOnce, { once: true, capture: true });

        function playOneShot() {
          if (!CFG.SFX_UNLOCK_URL) return;
          const a = new Audio(CFG.SFX_UNLOCK_URL);
          a.volume = clamp01(CFG.SFX_VOLUME);
          a.currentTime = 0;
          a.play().catch(() => {});
        }

        // ===== state =====
        const st = loadState();

        // Startowo: jeśli jeszcze nie unlocked -> blokujemy środek
        if (!st.unlocked) lockCenter4(true);

        // ===== UI eggs =====
        const eggLeft = document.createElement("img");
        eggLeft.className = "dry-egg";
        eggLeft.src = CFG.IMG_LEFT;
        eggLeft.alt = "egg-left";
        eggLeft.draggable = false;

        const eggRight = document.createElement("img");
        eggRight.className = "dry-egg";
        eggRight.src = CFG.IMG_RIGHT;
        eggRight.alt = "egg-right";
        eggRight.draggable = false;

        function positionEggs() {
          const r = getPanelRect();

          // Lewy: po lewej stronie panelu
          eggLeft.style.left = `${Math.max(8, r.left - CFG.EGG_W - CFG.GAP_PX)}px`;
          eggLeft.style.top  = `${Math.max(8, r.top + 30)}px`;

          // Prawy: po prawej stronie panelu
          eggRight.style.left = `${Math.min(window.innerWidth - CFG.EGG_W - 8, r.right + CFG.GAP_PX)}px`;
          eggRight.style.top  = `${Math.max(8, r.top + 30)}px`;
          if (msgEl) {
         const r2 = eggLeft.getBoundingClientRect();
         msgEl.style.left = `${Math.min(window.innerWidth - 340, r2.left)}px`;
        msgEl.style.top  = `${Math.max(8, r2.top + CFG.EGG_H + 10)}px`;
}
        }
        let msgEl = null;
let msgTimer = null;

function showMsg(text) {
  if (!msgEl) {
    msgEl = document.createElement("div");
    msgEl.className = "dry-msg";
    root.appendChild(msgEl);
  }
  msgEl.textContent = text;

  // ustaw przy lewym jajku
  const r = eggLeft.getBoundingClientRect();
  msgEl.style.left = `${Math.min(window.innerWidth - 340, r.left)}px`;
  msgEl.style.top  = `${Math.max(8, r.top + CFG.EGG_H + 10)}px`;

  if (msgTimer) clearTimeout(msgTimer);
}

        // Dodaj do DOM tylko jeśli jeszcze nie “przeszło”
        if (!st.unlocked) {
          // jeśli prawy już kliknięty wcześniej -> nie pokazuj prawego
          if (!st.rightClicked) root.appendChild(eggRight);
          root.appendChild(eggLeft);
          positionEggs();
          ctx.on(window, "resize", positionEggs);
          ctx.on(window, "scroll", positionEggs, { passive: true });
        }

        function setLeftEnabled(enabled) {
          eggLeft.setAttribute("aria-disabled", enabled ? "false" : "true");
        }

        // Start: lewy jest “zablokowany” dopóki nie klikniesz prawego
        if (!st.unlocked) setLeftEnabled(!!st.rightClicked);

        // Klik prawy -> znika, unlock lewego
        function onRightClick(e) {
          e.preventDefault();
          e.stopPropagation();

          unlockAudioOnce();

          st.rightClicked = true;
          saveState(st);

          try { eggRight.remove(); } catch {}
          setLeftEnabled(true);
        }

        // Klik lewy -> tylko jeśli prawy był kliknięty; zamiana na 3 obrazek; one-shot; unlock center 4
        function onLeftClick(e) {
          e.preventDefault();
          e.stopPropagation();

          unlockAudioOnce();

          if (!st.rightClicked) return; // twarda kolejność

          if (st.unlocked) return;

          st.unlocked = true;
          saveState(st);

          // swap obrazka na trzeci
          eggLeft.src = CFG.IMG_THIRD;

          // dźwięk
          playOneShot();

          // unlock środkowych 4
          lockCenter4(false);
          showMsg("Odblokowano środek. Masz 5 sekund zanim jajko zniknie.");

        setTimeout(() => {
        try { eggLeft.remove(); } catch {}
        try { if (msgEl) msgEl.remove(); } catch {}
        msgEl = null;
        }, 5000);

          // opcjonalnie: po odblokowaniu możesz usunąć też lewego, jeśli chcesz.
          // Jeśli chcesz zostawić 3 obrazek jako “trofeum” to zostawiamy.
        }

        ctx.on(eggRight, "click", onRightClick);
        ctx.on(eggLeft, "click", onLeftClick);

        return () => {
          try { eggLeft.remove(); } catch {}
          try { eggRight.remove(); } catch {}
          try { style.remove(); } catch {}
          try { if (bg) { bg.pause(); bg.currentTime = 0; } } catch {}
          try { if (msgTimer) clearTimeout(msgTimer); } catch {}
          try { if (msgEl) msgEl.remove(); } catch {}
        };
      }
    };
  });
})();
