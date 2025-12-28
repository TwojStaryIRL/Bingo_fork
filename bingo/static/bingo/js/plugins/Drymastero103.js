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

    // młotek-kursor
    HAMMER_W: 220,          // możesz dopasować
    HAMMER_H: 220,
    HAMMER_OFFSET_X: 8,     // przesunięcie względem kursora
    HAMMER_OFFSET_Y: 8,

    // animacja obrotu
    HAMMER_FLIP_MS: 160,
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

/* młotek jako kursor */
.dry-hammer {
  position: fixed;
  left: 0; top: 0;
  width: ${CFG.HAMMER_W}px;
  height: ${CFG.HAMMER_H}px;
  z-index: 2147483647;
  pointer-events: none; /* NIE blokuje klików */
  user-select: none;
  -webkit-user-drag: none;
  transform-origin: 45% 55%;
  filter: drop-shadow(0 14px 28px rgba(0,0,0,.45));
  will-change: transform, left, top;
}

/* obrót -67deg w lewo i powrót */
@keyframes dryHammerFlipLeft67 {
  0%   { transform: rotate(0deg); }
  45%  { transform: rotate(-67deg); }
  100% { transform: rotate(0deg); }
}
.dry-hammer.is-flipping {
  animation: dryHammerFlipLeft67 ${CFG.HAMMER_FLIP_MS}ms ease-out;
}

/* opcjonalnie: ukryj systemowy kursor gdy młotek aktywny */
body.dry-hammer-active,
body.dry-hammer-active * {
  cursor: none !important;
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

        // ===== state =====
        const st = {
          hammerActive: false,
          unlocked: false,
          flipping: false,
        };

        // startowo: środek niewidoczny
        lockCenter4(true);

        // ===== UI: lewy i prawy obrazek =====
        const eggLeft = document.createElement("img");
        eggLeft.className = "dry-egg dry-disabled"; // zablokowany do czasu aktywacji młotka
        eggLeft.src = CFG.IMG_LEFT;
        eggLeft.alt = "egg-left";
        eggLeft.draggable = false;

        const eggRight = document.createElement("img");
        eggRight.className = "dry-egg";
        eggRight.src = CFG.IMG_RIGHT;
        eggRight.alt = "egg-right";
        eggRight.draggable = false;

        // młotek-kursor (osobny element)
        const hammer = document.createElement("img");
        hammer.className = "dry-hammer";
        hammer.src = CFG.IMG_RIGHT;
        hammer.alt = "hammer-cursor";
        hammer.draggable = false;
        hammer.style.display = "none"; // startowo niewidoczny
        overlay.appendChild(hammer);

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

        // ===== młotek podąża za kursorem =====
        function updateHammerPos(clientX, clientY) {
          hammer.style.left = `${Math.round(clientX + CFG.HAMMER_OFFSET_X)}px`;
          hammer.style.top  = `${Math.round(clientY + CFG.HAMMER_OFFSET_Y)}px`;
        }

        function setHammerActive(on) {
          st.hammerActive = !!on;
          document.body.classList.toggle("dry-hammer-active", st.hammerActive);

          if (st.hammerActive) {
            hammer.style.display = "block";
            // lewy aktywny (można trafić)
            setLeftEnabled(true);
          } else {
            hammer.style.display = "none";
            setLeftEnabled(false);
          }
        }

        function doHammerFlip() {
          if (!st.hammerActive) return;
          if (st.flipping) return;

          st.flipping = true;
          hammer.classList.remove("is-flipping");
          void hammer.offsetWidth;
          hammer.classList.add("is-flipping");

          // dźwięk na każdy "hit"
          playOneShot();

          setTimeout(() => {
            hammer.classList.remove("is-flipping");
            st.flipping = false;
          }, CFG.HAMMER_FLIP_MS + 40);
        }

        // pointermove do aktualizacji pozycji młotka
        function onPointerMove(e) {
          if (!st.hammerActive) return;
          updateHammerPos(e.clientX, e.clientY);
        }
        ctx.on(document, "pointermove", onPointerMove, { passive: true });

        // globalny klik: jeśli młotek aktywny => flip + dźwięk
        function onGlobalClick(e) {
          if (!st.hammerActive) return;
          // flip na klik gdziekolwiek
          doHammerFlip();
        }
        ctx.on(document, "click", onGlobalClick, { capture: true });

        // ===== Aktywacja młotka: klik w prawy obrazek =====
        function onRightClick(e) {
          e.preventDefault();
          e.stopPropagation();

          unlockAudioOnce();

          // aktywuj młotek jako kursor
          setHammerActive(true);

          // ustaw pozycję młotka na aktualnym kliknięciu
          const x = e.clientX ?? (window.innerWidth / 2);
          const y = e.clientY ?? (window.innerHeight / 2);
          updateHammerPos(x, y);

          // usuń prawy obrazek z boku (żeby był tylko "kursor")
          try { eggRight.remove(); } catch {}

          showMsg("Masz młotek. Klikaj gdziekolwiek, a żeby zakończyć – traf w lewy obrazek.");
        }

        // ===== Trafienie lewego obrazka młotkiem =====
        function onLeftClick(e) {
          e.preventDefault();
          e.stopPropagation();

          unlockAudioOnce();

          // lewy ma reagować TYLKO gdy młotek jest aktywny
          if (!st.hammerActive) return;
          if (st.unlocked) return;

          st.unlocked = true;

          // flip + dźwięk przy trafieniu
          doHammerFlip();

          // lewy staje się 3. obrazkiem (Twoja poprzednia funkcja)
          eggLeft.src = CFG.IMG_THIRD;

          // odblokuj środek
          lockCenter4(false);

          showMsg("Widziałem jak coś ci ukradł - trzymaj !");

          // młotek znika dopiero po trafieniu w lewy
          setHammerActive(false);

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
          try { document.body.classList.remove("dry-hammer-active"); } catch {}
          try { eggLeft.remove(); } catch {}
          try { eggRight.remove(); } catch {}
          try { hammer.remove(); } catch {}
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
