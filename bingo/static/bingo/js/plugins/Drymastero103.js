(() => {
  const CFG = {
    // grafiki
    IMG_LEFT:  "/static/bingo/images/Drymastero103/dziecko.jpg",
    IMG_RIGHT: "/static/bingo/images/Drymastero103/mlotek.jpg",
    IMG_THIRD: "/static/bingo/images/Drymastero103/tung.png",

    // fallback audio (jeśli api.sfx nie poda)
    BG_LOOP_URL: "/static/bingo/sfx/Drymastero103/gag.mp3",
    SFX_UNLOCK_URL: "/static/bingo/sfx/Drymastero103/tung.mp3",

    BG_VOLUME: 0.35,
    SFX_VOLUME: 0.50,

    GAP_PX: 14,
    EGG_W: 367,
    EGG_H: 367,

    HIDE_AFTER_MS: 5000,

    // NOWE: animacja prawego (flip)
    RIGHT_FLIP_MS: 180,  // szybko
  };

  function clamp01(x) {
    const n = Number(x);
    if (!isFinite(n)) return 1;
    return Math.max(0, Math.min(1, n));
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

  function getCenter4Textareas() {
    const cells = Array.from(document.querySelectorAll("textarea.grid-cell"));
    const n = Math.sqrt(cells.length);

    if (!Number.isInteger(n) || n < 3) return [];

    const mid = Math.floor(n / 2);
    const r0 = mid - 1;
    const c0 = mid - 1;

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
      const wrap = ta.closest(".cell-wrapper");
      if (!wrap) return;

      if (locked) {
        ta.disabled = true;
        wrap.classList.add("dry-hidden");
      } else {
        ta.disabled = false;
        wrap.classList.remove("dry-hidden");
        ta.classList.remove("dry-locked");
        wrap.classList.remove("dry-locked");
      }
    });
  }

  whenRuntime(() => {
    window.BingoUserPlugin = {
      init(api) {
        const { ctx, sfx } = api;

        // overlay na body żeby nic nie przykrywało klików
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.left = "0";
        overlay.style.top = "0";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.zIndex = "2147483647";
        overlay.style.pointerEvents = "none"; // overlay nie blokuje strony
        document.body.appendChild(overlay);

        // audio z user_plugins.py jeśli jest
        const bgUrl  = (sfx?.gag && sfx.gag[0]) ? sfx.gag[0] : CFG.BG_LOOP_URL;
        const sfxUrl = (sfx?.tung && sfx.tung[0]) ? sfx.tung[0] : CFG.SFX_UNLOCK_URL;

        const style = document.createElement("style");
        style.textContent = `
.dry-egg {
  position: fixed;
  width: ${CFG.EGG_W}px;
  height: ${CFG.EGG_H}px;
  z-index: 2147483647;
  user-select: none;
  cursor: pointer;
  filter: drop-shadow(0 10px 24px rgba(0,0,0,.35));
  pointer-events: auto; /* klikalne mimo overlay pointer-events:none */
  transform-origin: center center;
  will-change: transform;
}

.dry-egg.dry-disabled {
  pointer-events: none;
  opacity: .6;
  cursor: not-allowed;
}

.cell-wrapper.dry-hidden {
  visibility: hidden;
  pointer-events: none;
}

.dry-msg {
  position: fixed;
  z-index: 2147483647;
  padding: 10px 14px;
  max-width: 360px;
  border-radius: 12px;
  background: rgba(0,0,0,.72);
  color: #fff;
  font-size: 14px;
  line-height: 1.25;
  box-shadow: 0 14px 30px rgba(0,0,0,.35);
  user-select: none;
  pointer-events: none;
}

/* NOWE: obrót prawego w lewo ~67deg i powrót */
@keyframes dryFlipLeft67 {
  0%   { transform: perspective(900px) rotateY(0deg); }
  45%  { transform: perspective(900px) rotateY(-67deg); }
  100% { transform: perspective(900px) rotateY(0deg); }
}

.dry-egg.is-flipping {
  animation: dryFlipLeft67 ${CFG.RIGHT_FLIP_MS}ms ease-out;
}

/* NOWE: celownik (nowy kursor) */
body.dry-aiming,
body.dry-aiming * {
  cursor: crosshair !important;
}
        `;
        document.head.appendChild(style);

        // ===== audio =====
        let bg = null;
        let audioUnlocked = false;

        function startBgLoop() {
          if (bg && !bg.paused) return true;
          if (!bgUrl) return false;

          try { if (bg) { bg.pause(); bg.currentTime = 0; } } catch {}
          bg = new Audio(bgUrl);
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

        // odblokuj audio na 1. interakcję
        ctx.on(document, "pointerdown", unlockAudioOnce, { once: true, capture: true });
        ctx.on(document, "keydown", unlockAudioOnce, { once: true, capture: true });

        function playOneShot() {
          if (!sfxUrl) return;
          const a = new Audio(sfxUrl);
          a.volume = clamp01(CFG.SFX_VOLUME);
          a.currentTime = 0;
          a.play().catch(() => {});
        }

        // ===== state: zawsze od zera (za każdym wejściem) =====
        const st = {
          rightClicked: false,
          unlocked: false,
          aiming: false,   // NOWE: czy włączony celownik
          flipping: false, // NOWE: czy prawy jest w animacji
        };

        function setAiming(on) {
          st.aiming = !!on;
          document.body.classList.toggle("dry-aiming", st.aiming);
        }

        // startowo: środek niewidoczny
        lockCenter4(true);

        // ===== UI eggs =====
        const eggLeft = document.createElement("img");
        eggLeft.className = "dry-egg dry-disabled"; // na start zablokowany
        eggLeft.src = CFG.IMG_LEFT;
        eggLeft.alt = "egg-left";
        eggLeft.draggable = false;

        const eggRight = document.createElement("img");
        eggRight.className = "dry-egg";
        eggRight.src = CFG.IMG_RIGHT;
        eggRight.alt = "egg-right";
        eggRight.draggable = false;

        let msgEl = null;
        let msgTimer = null;

        function showMsg(text) {
          if (!msgEl) {
            msgEl = document.createElement("div");
            msgEl.className = "dry-msg";
            overlay.appendChild(msgEl);
          }
          msgEl.textContent = text;
          positionMsg();
        }

        function positionMsg() {
          if (!msgEl) return;
          const r = eggLeft.getBoundingClientRect();
          msgEl.style.left = `${Math.min(window.innerWidth - 380, Math.max(8, r.left))}px`;
          msgEl.style.top  = `${Math.max(8, r.top + CFG.EGG_H + 10)}px`;
        }

        function positionEggs() {
          const r = getPanelRect();

          eggLeft.style.left = `${Math.max(8, r.left - CFG.EGG_W - CFG.GAP_PX)}px`;
          eggLeft.style.top  = `${Math.max(8, r.top + 30)}px`;

          eggRight.style.left = `${Math.min(window.innerWidth - CFG.EGG_W - 8, r.right + CFG.GAP_PX)}px`;
          eggRight.style.top  = `${Math.max(8, r.top + 30)}px`;

          positionMsg();
        }

        function setLeftEnabled(enabled) {
          eggLeft.classList.toggle("dry-disabled", !enabled);
        }

        // pokaż oba obrazki zawsze na wejściu
        overlay.appendChild(eggRight);
        overlay.appendChild(eggLeft);
        positionEggs();

        ctx.on(window, "resize", positionEggs);
        ctx.on(window, "scroll", positionEggs, { passive: true });

        // ===== NOWE: animacja obrotu prawego + callback po animacji =====
        function flipRightThen(fnAfter) {
          if (st.flipping) return;

          st.flipping = true;
          eggRight.classList.remove("is-flipping");
          // wymuś reflow, żeby animacja zawsze odpalała
          void eggRight.offsetWidth;
          eggRight.classList.add("is-flipping");

          const done = () => {
            eggRight.classList.remove("is-flipping");
            st.flipping = false;
            fnAfter?.();
          };

          // animationend bywa różne, więc mamy fallback timeout
          let called = false;
          const safeDone = () => {
            if (called) return;
            called = true;
            done();
          };

          const onEnd = () => safeDone();
          eggRight.addEventListener("animationend", onEnd, { once: true });

          setTimeout(safeDone, CFG.RIGHT_FLIP_MS + 60);
        }

        // ===== kolejność: right -> left -> unlock =====
        function onRightClick(e) {
          e.preventDefault();
          e.stopPropagation();

          unlockAudioOnce();

          // animacja i dopiero potem Twoja stara logika
          flipRightThen(() => {
            st.rightClicked = true;

            // znika prawy + odblokuj lewy
            try { eggRight.remove(); } catch {}
            setLeftEnabled(true);
          });
        }

        function onLeftClick(e) {
          e.preventDefault();
          e.stopPropagation();

          unlockAudioOnce();

          if (!st.rightClicked) return;
          if (st.unlocked) return;

          // NOWE: pierwszy klik na lewy włącza celownik,
          // dopiero drugi (z aktywnym celownikiem) robi "akcję"
          if (!st.aiming) {
            setAiming(true);
            showMsg("Masz celownik. Kliknij jeszcze raz w lewy obrazek.");
            return;
          }

          // tu już "nowym kursorem" -> robimy stary unlock
          setAiming(false);
          st.unlocked = true;

          // lewy staje się 3. obrazkiem
          eggLeft.src = CFG.IMG_THIRD;

          // dźwięk
          playOneShot();

          // odblokuj środek
          lockCenter4(false);

          showMsg("Widziałem jak coś ci ukradł - trzymaj !");

          if (msgTimer) clearTimeout(msgTimer);
          msgTimer = ctx.setTimeoutSafe(() => {
            try { eggLeft.remove(); } catch {}
            try { if (msgEl) msgEl.remove(); } catch {}
            msgEl = null;
            msgTimer = null;
          }, CFG.HIDE_AFTER_MS);
        }

        ctx.on(eggRight, "click", onRightClick);
        ctx.on(eggLeft, "click", onLeftClick);

        return () => {
          try { setAiming(false); } catch {}
          try { eggLeft.remove(); } catch {}
          try { eggRight.remove(); } catch {}
          try { if (msgTimer) clearTimeout(msgTimer); } catch {}
          try { if (msgEl) msgEl.remove(); } catch {}
          try { style.remove(); } catch {}
          try { if (bg) { bg.pause(); bg.currentTime = 0; } } catch {}
          try { overlay.remove(); } catch {}
        };
      }
    };
  });
})();
