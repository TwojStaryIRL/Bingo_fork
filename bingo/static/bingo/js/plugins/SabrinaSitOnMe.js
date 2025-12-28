(() => {
  // Wait for runtime
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
    if (!isFinite(n)) return 1;
    return Math.max(0, Math.min(1, n));
  }

  function pickOne(v) {
    if (Array.isArray(v)) return v.length ? String(v[(Math.random() * v.length) | 0]) : "";
    if (typeof v === "string") return v;
    return "";
  }

  function playManaged(url, volume = 0.55) {
    if (!url) return null;
    const a = new Audio(url);
    a.volume = clamp01(volume);
    a.currentTime = 0;
    a.play().catch(() => {});
    return a;
  }

  function fadeOutAudio(a, ms = 500) {
    if (!a) return;
    const start = performance.now();
    const v0 = Number(a.volume || 0);
    function step(now) {
      const p = Math.min(1, (now - start) / Math.max(1, ms));
      a.volume = clamp01(v0 * (1 - p));
      if (p < 1) requestAnimationFrame(step);
      else {
        try { a.pause(); } catch {}
      }
    }
    requestAnimationFrame(step);
  }

  function sleep(ctx, ms) {
    return new Promise((resolve) => ctx.setTimeoutSafe(resolve, ms));
  }

  whenRuntime(() => {
    window.BingoUserPlugin = {
      init(api) {
        const { ctx, sfx } = api;
        const root = document.getElementById("plugin-root");
        if (!root) return;

        const CFG = {
          BG_VOLUME: 0.22,
          SFX_VOLUME: 0.60,

          TRANSFORM_MS: 1200,

          // 4 corner slots
          SLOTS: [
            { id: "L1", corner: "LT", a: "/static/bingo/images/SabrinaSitOnMe/lala.gif",  b: "/static/bingo/images/SabrinaSitOnMe/nga.gif"  },
            { id: "L2", corner: "LB", a: "/static/bingo/images/SabrinaSitOnMe/lala2.gif", b: "/static/bingo/images/SabrinaSitOnMe/nga2.gif" },
            { id: "R1", corner: "RT", a: "/static/bingo/images/SabrinaSitOnMe/lala3.gif", b: "/static/bingo/images/SabrinaSitOnMe/nga3.gif" },
            { id: "R2", corner: "RB", a: "/static/bingo/images/SabrinaSitOnMe/lala4.gif", b: "/static/bingo/images/SabrinaSitOnMe/nga4.gif" },
          ],

          // Takeover timing
          TAKEOVER_EVERY_MIN_MS: 55_000,
          TAKEOVER_EVERY_MAX_MS: 95_000,
          TAKEOVER_FADE_MS: 650,
          TAKEOVER_SLIDE_MS: 520,

          // Sabrina hero (right)
          TAKEOVER_HERO_IMG: "/static/bingo/images/SabrinaSitOnMe/sabrina.png",
          TAKEOVER_TEXT: "Cześć… o mój Boże. Potrzebuję pomocy ze wskazaniem dobrego miejsca, w którym mogę usiąść.",
          TAKEOVER_BTN_TEXT: "Tak, tak, tak, proszę mamusiu, pokażę Ci gdzie możesz usiąść.",

          // Sabrina hero (left, after success)
          TAKEOVER_HERO_LEFT_TEXT: "Lepiej weź głęboki oddech",
          TAKEOVER_HERO_LEFT_BTN_TEXT: "Dobra, wracamy do gry.",

          // Grid 3x3
          GRID_TITLE: "Gdzie Sabrina ma usiąść?",
          GRID_DECOY: "/static/bingo/images/SabrinaSitOnMe/krzeslo.png",
          GRID_CORRECT: "/static/bingo/images/SabrinaSitOnMe/miejsce.png",

          // “background” sequence after correct pick
          PLACE_W: 280,
          PLACE_H: 280,
          PLACE_START_Y_RATIO: 0.52, // start from center-ish
          PLACE_TARGET_PAD_RIGHT: 18,
          PLACE_TARGET_Y_RATIO: 0.52,
          PLACE_FLY_MS: 950,

          // seating cover slides in AFTER the place arrives
          SEATING_IMG: "/static/bingo/images/SabrinaSitOnMe/sitting.png",
          SEATING_SLIDE_MS: 520,

          // keep seating visible afterwards
          KEEP_SEATING: true,
        };

        // ===== BG LOOP =====
        let bg = null;
        let audioUnlocked = false;

        function startLoop() {
          const url = pickOne(sfx?.sabrina);
          if (!url) return false;

          if (bg && !bg.paused) return true;

          try { if (bg) { bg.pause(); bg.currentTime = 0; } } catch {}

          bg = new Audio(url);
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
          startLoop();
        }

        ctx.on(document, "pointerdown", unlockAudioOnce, { once: true, capture: true });
        ctx.on(document, "keydown", unlockAudioOnce, { once: true, capture: true });

        // ===== CSS =====
        const style = document.createElement("style");
        style.textContent = `
#plugin-root { position: relative; z-index: 2147483000; }

.sabrina-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483645;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
}

/* 4 corner columns (each holds 1 slot) */
.sabrina-corner {
  position: fixed;
  width: 230px;
  pointer-events: none;
  z-index: 2147483645;
  transition: transform .52s ease, opacity .52s ease;
  opacity: 1;
}

.sabrina-corner.is-pre { opacity: 0; }
.sabrina-corner.is-hidden { opacity: 0; }

.sabrina-corner.lt { left: 14px; top: 14px; }
.sabrina-corner.lb { left: 14px; bottom: 14px; }
.sabrina-corner.rt { right: 14px; top: 14px; }
.sabrina-corner.rb { right: 14px; bottom: 14px; }

.sabrina-corner.lt.is-pre, .sabrina-corner.lb.is-pre,
.sabrina-corner.lt.is-hidden, .sabrina-corner.lb.is-hidden { transform: translateX(-130%); }

.sabrina-corner.rt.is-pre, .sabrina-corner.rb.is-pre,
.sabrina-corner.rt.is-hidden, .sabrina-corner.rb.is-hidden { transform: translateX(130%); }

.sabrina-slot {
  width: 210px;
  pointer-events: auto;
  display: grid;
}

.sabrina-card {
  width: 210px;
  height: 150px;
  border-radius: 18px;
  overflow: hidden;
  background: rgba(0,0,0,.22);
  border: 1px solid rgba(255,255,255,.14);
  box-shadow: 0 18px 60px rgba(0,0,0,.35);
  position: relative;
  perspective: 900px;
}

.sabrina-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  will-change: transform, filter;
}

/* HERO (Sabrina) */
.sabrina-hero {
  position: fixed;
  top: 16px;
  right: 16px;
  width: min(420px, 86vw);
  z-index: 2147483647;
  pointer-events: auto;
  border-radius: 18px;
  overflow: hidden;
  background: rgba(15,15,15,.75);
  border: 1px solid rgba(255,255,255,.14);
  box-shadow: 0 24px 90px rgba(0,0,0,.55);
}
.sabrina-hero.left {
  right: auto;
  left: 16px;
}

.sabrina-hero-inner{
  display: grid;
  gap: 10px;
  padding: 12px;
}

.sabrina-hero-title{
  font-weight: 900;
  font-size: 13px;
  letter-spacing: .2px;
  color: rgba(255,255,255,.92);
  text-shadow: 0 10px 22px rgba(0,0,0,.55);
}

.sabrina-hero-imgwrap{
  width: 100%;
  aspect-ratio: 16 / 9;
  height: auto;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
}

.sabrina-hero-img{
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transform: translateX(120%);
  transition: transform .52s ease;
}
.sabrina-hero.left .sabrina-hero-img { transform: translateX(-120%); }
.sabrina-hero-img.is-in{ transform: translateX(0); }

.sabrina-hero-btn{
  width: 100%;
  border: 0;
  border-radius: 14px;
  padding: 11px 12px;
  font-weight: 900;
  cursor: pointer;
}

/* MODAL 3x3 */
.sabrina-modal {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: grid;
  place-items: center;
  pointer-events: auto;
  background: rgba(0,0,0,.35);
  backdrop-filter: blur(6px);
}

.sabrina-modal-card{
  width: min(520px, 92vw);
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(15,15,15,.75);
  box-shadow: 0 24px 90px rgba(0,0,0,.55);
  padding: 14px;
}

.sabrina-modal-title{
  color: rgba(255,255,255,.92);
  font-weight: 900;
  letter-spacing: .2px;
  font-size: 14px;
  margin: 0 0 10px;
}

.sabrina-grid{
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.sabrina-gcell{
  aspect-ratio: 1 / 1;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
  cursor: pointer;
  padding: 0;
}

.sabrina-gcell img{
  width: 100%;
  height: 100%;
  object-fit: cover;
  display:block;
}

.sabrina-msg{
  margin-top: 10px;
  font-size: 13px;
  color: rgba(255,255,255,.9);
  min-height: 18px;
}

/* Background animation layer: place + seating */
.sabrina-stage {
  position: fixed;
  inset: 0;
  z-index: 2147483646; /* above corners, below hero/modal */
  pointer-events: none;
}

.sabrina-place, .sabrina-seating {
  position: fixed;
  z-index: 2147483646;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.14);
  box-shadow: 0 24px 90px rgba(0,0,0,.55);
  background: rgba(255,255,255,.06);
}
.sabrina-place img, .sabrina-seating img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* seating slides from right */
.sabrina-seating {
  transform: translateX(120%);
  transition: transform .52s ease;
}
.sabrina-seating.is-in { transform: translateX(0); }
        `;
        document.head.appendChild(style);

        // ===== Overlay root =====
        const overlay = document.createElement("div");
        overlay.className = "sabrina-overlay";
        root.appendChild(overlay);

        // Stage (background animation layer)
        const stage = document.createElement("div");
        stage.className = "sabrina-stage";
        root.appendChild(stage);

        // 4 corner containers
        const cLT = document.createElement("div");
        cLT.className = "sabrina-corner lt is-pre";
        const cLB = document.createElement("div");
        cLB.className = "sabrina-corner lb is-pre";
        const cRT = document.createElement("div");
        cRT.className = "sabrina-corner rt is-pre";
        const cRB = document.createElement("div");
        cRB.className = "sabrina-corner rb is-pre";

        overlay.appendChild(cLT);
        overlay.appendChild(cLB);
        overlay.appendChild(cRT);
        overlay.appendChild(cRB);

        ctx.setTimeoutSafe(() => {
          cLT.classList.remove("is-pre");
          cLB.classList.remove("is-pre");
          cRT.classList.remove("is-pre");
          cRB.classList.remove("is-pre");
        }, 40);

        // ===== State =====
        const slotStates = [];
        const takeover = {
          active: false,
          timer: null,
          hero: null,
          modal: null,
          seating: null,
          lock: false, // prevent double-trigger
        };

        function scheduleTakeover() {
          const ms = CFG.TAKEOVER_EVERY_MIN_MS +
            Math.random() * (CFG.TAKEOVER_EVERY_MAX_MS - CFG.TAKEOVER_EVERY_MIN_MS);
          takeover.timer = ctx.setTimeoutSafe(() => beginTakeover(), ms | 0);
        }

        function stopAllSlotAudioAndAnimations() {
          slotStates.forEach(st => {
            st.animToken++;
            st.busy = false;
            fadeOutAudio(st.currentSfx, CFG.TAKEOVER_FADE_MS);
            st.currentSfx = null;
            try { st.img.style.transform = ""; st.img.style.filter = ""; } catch {}
          });
        }

        async function beginTakeover() {
          if (takeover.active || takeover.lock) return;
          takeover.active = true;

          // slide away corners
          cLT.classList.add("is-hidden");
          cLB.classList.add("is-hidden");
          cRT.classList.add("is-hidden");
          cRB.classList.add("is-hidden");

          stopAllSlotAudioAndAnimations();

          await sleep(ctx, CFG.TAKEOVER_SLIDE_MS);
          openHeroRight(); // waits for button click
        }

        async function endTakeover() {
          // bring back corners
          cLT.classList.remove("is-hidden");
          cLB.classList.remove("is-hidden");
          cRT.classList.remove("is-hidden");
          cRB.classList.remove("is-hidden");

          takeover.active = false;
          scheduleTakeover();
        }

        function openHeroRight() {
          closeHero();

          const hero = document.createElement("div");
          hero.className = "sabrina-hero";

          const inner = document.createElement("div");
          inner.className = "sabrina-hero-inner";

          const title = document.createElement("div");
          title.className = "sabrina-hero-title";
          title.textContent = CFG.TAKEOVER_TEXT;

          const wrap = document.createElement("div");
          wrap.className = "sabrina-hero-imgwrap";

          const img = document.createElement("img");
          img.className = "sabrina-hero-img";
          img.src = CFG.TAKEOVER_HERO_IMG;
          wrap.appendChild(img);

          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "sabrina-hero-btn";
          btn.textContent = CFG.TAKEOVER_BTN_TEXT;

          ctx.on(btn, "click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (takeover.lock) return;
            closeHero();
            openGridModal();
          });

          inner.appendChild(title);
          inner.appendChild(wrap);
          inner.appendChild(btn);
          hero.appendChild(inner);

          root.appendChild(hero);
          takeover.hero = hero;

          requestAnimationFrame(() => img.classList.add("is-in"));
        }

        function openHeroLeftAfterSuccess() {
          closeHero();

          const hero = document.createElement("div");
          hero.className = "sabrina-hero left";

          const inner = document.createElement("div");
          inner.className = "sabrina-hero-inner";

          const title = document.createElement("div");
          title.className = "sabrina-hero-title";
          title.textContent = CFG.TAKEOVER_HERO_LEFT_TEXT;

          const wrap = document.createElement("div");
          wrap.className = "sabrina-hero-imgwrap";

          const img = document.createElement("img");
          img.className = "sabrina-hero-img";
          img.src = CFG.TAKEOVER_HERO_IMG;
          wrap.appendChild(img);

          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "sabrina-hero-btn";
          btn.textContent = CFG.TAKEOVER_HERO_LEFT_BTN_TEXT;

          ctx.on(btn, "click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeHero();
            await endTakeover();
            takeover.lock = false;
          });

          inner.appendChild(title);
          inner.appendChild(wrap);
          inner.appendChild(btn);
          hero.appendChild(inner);

          root.appendChild(hero);
          takeover.hero = hero;

          requestAnimationFrame(() => img.classList.add("is-in"));
        }

        function closeHero() {
          if (takeover.hero) {
            try { takeover.hero.remove(); } catch {}
            takeover.hero = null;
          }
        }

        function openGridModal() {
          closeGridModal();

          const modal = document.createElement("div");
          modal.className = "sabrina-modal";

          const card = document.createElement("div");
          card.className = "sabrina-modal-card";

          const title = document.createElement("div");
          title.className = "sabrina-modal-title";
          title.textContent = CFG.GRID_TITLE;

          const grid = document.createElement("div");
          grid.className = "sabrina-grid";

          const msg = document.createElement("div");
          msg.className = "sabrina-msg";
          msg.textContent = "";

          // fixed layout: correct always center
          const tiles = [
            CFG.GRID_DECOY, CFG.GRID_DECOY, CFG.GRID_DECOY,
            CFG.GRID_DECOY, CFG.GRID_CORRECT, CFG.GRID_DECOY,
            CFG.GRID_DECOY, CFG.GRID_DECOY, CFG.GRID_DECOY,
          ];

          tiles.forEach((src, idx) => {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "sabrina-gcell";
            cell.dataset.idx = String(idx);

            const im = document.createElement("img");
            im.src = src;
            im.alt = "pick";
            cell.appendChild(im);

            ctx.on(cell, "click", async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (takeover.lock) return;

              const ok = (idx === 4);
              if (!ok) {
                msg.textContent = "Nie będę tu siadała, głuptasku.";
                cell.animate(
                  [
                    { transform: "translateX(0)" },
                    { transform: "translateX(-6px)" },
                    { transform: "translateX(6px)" },
                    { transform: "translateX(0)" }
                  ],
                  { duration: 220 }
                );
                return; // must choose correct
              }

              msg.textContent = "Lepiej weź głęboki oddech :*";
              takeover.lock = true;

              // Zamknij modal od razu -> animacja NA TLE
              closeGridModal();

              // Sekwencja: miejsce z centrum -> prawa strona, potem seating z prawej
              await runBackgroundSeatSequence();

              // Na końcu pokaż Sabrinę z lewej strony
              openHeroLeftAfterSuccess();
            });

            grid.appendChild(cell);
          });

          card.appendChild(title);
          card.appendChild(grid);
          card.appendChild(msg);
          modal.appendChild(card);

          ctx.on(modal, "pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); });
          ctx.on(modal, "click", (e) => { e.preventDefault(); e.stopPropagation(); });

          root.appendChild(modal);
          takeover.modal = modal;
        }

        function closeGridModal() {
          if (takeover.modal) {
            try { takeover.modal.remove(); } catch {}
            takeover.modal = null;
          }
        }

        async function runBackgroundSeatSequence() {
          // remove previous seating if exists and we DON'T want to keep it
          if (takeover.seating && !CFG.KEEP_SEATING) {
            try { takeover.seating.remove(); } catch {}
            takeover.seating = null;
          }

          // 1) "miejsce.png" appears at CENTER of screen (background)
          const place = document.createElement("div");
          place.className = "sabrina-place";
          place.style.width = `${CFG.PLACE_W}px`;
          place.style.height = `${CFG.PLACE_H}px`;

          const startX = Math.round(window.innerWidth / 2 - CFG.PLACE_W / 2);
          const startY = Math.round(window.innerHeight * CFG.PLACE_START_Y_RATIO - CFG.PLACE_H / 2);

          place.style.left = `${Math.max(0, startX)}px`;
          place.style.top = `${Math.max(0, startY)}px`;

          const placeImg = document.createElement("img");
          placeImg.src = CFG.GRID_CORRECT;
          place.appendChild(placeImg);
          stage.appendChild(place);

          // 2) Fly it to the RIGHT side (background)
          const targetX = Math.round(window.innerWidth - CFG.PLACE_W - CFG.PLACE_TARGET_PAD_RIGHT);
          const targetY = Math.round(window.innerHeight * CFG.PLACE_TARGET_Y_RATIO - CFG.PLACE_H / 2);

          place.style.transition = `left ${CFG.PLACE_FLY_MS}ms ease, top ${CFG.PLACE_FLY_MS}ms ease`;

          await sleep(ctx, 30);
          place.style.left = `${Math.max(0, targetX)}px`;
          place.style.top = `${Math.max(0, targetY)}px`;

          await sleep(ctx, CFG.PLACE_FLY_MS + 60);

          // 3) THEN seating slides in from RIGHT and covers the place (background)
          // (seating is same size and positioned same as place)
          if (takeover.seating) {
            try { takeover.seating.remove(); } catch {}
            takeover.seating = null;
          }

          const seating = document.createElement("div");
          seating.className = "sabrina-seating";
          seating.style.left = `${Math.max(0, targetX)}px`;
          seating.style.top = `${Math.max(0, targetY)}px`;
          seating.style.width = `${CFG.PLACE_W}px`;
          seating.style.height = `${CFG.PLACE_H}px`;

          const seatingImg = document.createElement("img");
          seatingImg.src = CFG.SEATING_IMG;
          seating.appendChild(seatingImg);
          stage.appendChild(seating);
          takeover.seating = seating;

          await sleep(ctx, 30);
          seating.classList.add("is-in");

          await sleep(ctx, CFG.SEATING_SLIDE_MS + 60);

          // place can disappear (covered anyway)
          try { place.remove(); } catch {}

          // optional SFX on "swap/lock-in"
          const swapUrl = pickOne(sfx?.hs);
          if (swapUrl) playManaged(swapUrl, CFG.SFX_VOLUME);
        }

        // ===== Slots =====
        function createSlot(slotCfg) {
          const wrap = document.createElement("div");
          wrap.className = "sabrina-slot";

          const card = document.createElement("div");
          card.className = "sabrina-card";

          const img = document.createElement("img");
          img.className = "sabrina-img";
          img.alt = slotCfg.id;
          img.src = slotCfg.a;

          card.appendChild(img);
          wrap.appendChild(card);

          const st = {
            wrap,
            card,
            img,
            isAlt: false,
            busy: false,
            currentSfx: null,
            animToken: 0,
          };
          slotStates.push(st);

          function playSwapSfx() {
            const url = pickOne(sfx?.swap);
            if (url) {
              fadeOutAudio(st.currentSfx, 120);
              st.currentSfx = playManaged(url, CFG.SFX_VOLUME);
            }
          }

          function runTransformSwap() {
            if (takeover.active) return;
            if (st.busy) return;
            st.busy = true;

            const token = ++st.animToken;

            const t0 = performance.now();
            let last = t0;
            let angle = 0;
            let vel = 0.012;

            function step(now) {
              if (token !== st.animToken || takeover.active) {
                st.busy = false;
                try { img.style.transform = ""; img.style.filter = ""; } catch {}
                return;
              }

              const dt = Math.max(0, now - last);
              last = now;

              vel *= 1.055;
              angle += vel * dt;

              const p = Math.min(1, (now - t0) / CFG.TRANSFORM_MS);

              img.style.transform = `rotateY(${angle}deg) rotateZ(${Math.min(22, p * 22)}deg)`;
              img.style.filter = `brightness(${1 + p * 2.2}) saturate(${1 - p}) contrast(${1 + p * 0.2})`;

              if (p < 1) {
                requestAnimationFrame(step);
                return;
              }

              playSwapSfx();
              st.isAlt = !st.isAlt;
              img.src = st.isAlt ? slotCfg.b : slotCfg.a;

              img.style.transform = "";
              img.style.filter = "";
              st.busy = false;
            }

            requestAnimationFrame(step);
          }

          ctx.on(card, "click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            startLoop();
            runTransformSwap();
          });

          return { wrap, corner: slotCfg.corner };
        }

        const slotViews = CFG.SLOTS.map(cfg => createSlot(cfg));
        slotViews.forEach(v => {
          if (v.corner === "LT") cLT.appendChild(v.wrap);
          if (v.corner === "LB") cLB.appendChild(v.wrap);
          if (v.corner === "RT") cRT.appendChild(v.wrap);
          if (v.corner === "RB") cRB.appendChild(v.wrap);
        });

        // Start bg & schedule takeover
        startLoop();
        scheduleTakeover();

        return () => {
          try { if (takeover.timer) clearTimeout(takeover.timer); } catch {}
          closeHero();
          closeGridModal();
          try { if (takeover.seating && !CFG.KEEP_SEATING) takeover.seating.remove(); } catch {}

          try { overlay.remove(); } catch {}
          try { stage.remove(); } catch {}
          try { style.remove(); } catch {}
          try { if (bg) { bg.pause(); bg.currentTime = 0; } } catch {}

          slotStates.forEach(st => fadeOutAudio(st.currentSfx, 120));
        };
      }
    };
  });
})();
