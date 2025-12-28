(() => {
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

  // Managed audio (żeby dało się wyciszyć podczas takeover)
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

        // ===== KONFIG =====
        const CFG = {
          BG_VOLUME: 0.22,
          SFX_VOLUME: 0.60,

          TRANSFORM_MS: 1200,

          // START: cztery obrazki wjeżdżają i siedzą
          ENTER_MS: 520,

          // 4 sloty (GIFy)
          SLOTS: [
            { id: "L1", side: "left", pos: "top",
              a: "/static/bingo/images/SabrinaSitOnMe/lala.gif",
              b: "/static/bingo/images/SabrinaSitOnMe/nga.gif" },
            { id: "L2", side: "left", pos: "bottom",
              a: "/static/bingo/images/SabrinaSitOnMe/lala2.gif",
              b: "/static/bingo/images/SabrinaSitOnMe/nga2.gif" },
            { id: "R1", side: "right", pos: "top",
              a: "/static/bingo/images/SabrinaSitOnMe/lala3.gif",
              b: "/static/bingo/images/SabrinaSitOnMe/nga3.gif" },
            { id: "R2", side: "right", pos: "bottom",
              a: "/static/bingo/images/SabrinaSitOnMe/lala4.gif",
              b: "/static/bingo/images/SabrinaSitOnMe/nga4.gif" },
          ],

          // TAKEOVER (czas losowy)
          TAKEOVER_EVERY_MIN_MS: 55_000,
          TAKEOVER_EVERY_MAX_MS: 95_000,
          TAKEOVER_FADE_MS: 650,
          TAKEOVER_SLIDE_MS: 520,

          // takeover obrazek + tekst
          TAKEOVER_HERO_IMG: "/static/bingo/images/SabrinaSitOnMe/sabrina.png",
          TAKEOVER_TEXT: "Cześć… o mój Boże. Potrzebuję pomocy ze wskazaniem dobrego miejsca, w którym mogę usiąść.",

          // popup 3x3
          GRID_TITLE: "Gdzie Sabrina ma usiąść?",

          // 8 takie same (wabik) + 1 inny w środku (poprawny)
          GRID_DECOY: "/static/bingo/images/SabrinaSitOnMe/krzeslo.png",
          GRID_CORRECT: "/static/bingo/images/SabrinaSitOnMe/miejsce.png",

          // po poprawnym wyborze: zdjęcie, które wjedzie i zakryje
          COVER_IMG: "/static/bingo/images/SabrinaSitOnMe/sabrina.png",

          // gdzie ma dolecieć poprawne zdjęcie (prawa „wolna” strona obok bingo)
          TARGET_PAD_RIGHT: 18,
          TARGET_Y_RATIO: 0.52,   // ~ środek ekranu
          TARGET_W: 210,
          TARGET_H: 210,

          // czasy animacji końcowej
          CORRECT_FLY_MS: 900,
          COVER_SLIDE_MS: 520,
        };

        // ===== AUDIO: tło (loop) =====
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

.sabrina-col {
  position: absolute;
  top: 50%;
  width: 220px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  opacity: 1;
  transition: transform .52s ease, opacity .52s ease;
  transform: translateY(-50%);
}

.sabrina-col.left  { left: 12px;  align-items: flex-start; }
.sabrina-col.right { right: 12px; align-items: flex-end; }

/* start-in */
.sabrina-col.is-pre.left  { transform: translate(-130%, -50%); opacity: 0; }
.sabrina-col.is-pre.right { transform: translate(130%, -50%); opacity: 0; }
.sabrina-col.is-hidden.left  { transform: translate(-130%, -50%); opacity: 0; }
.sabrina-col.is-hidden.right { transform: translate(130%, -50%); opacity: 0; }

.sabrina-slot {
  width: 210px;
  pointer-events: auto;
  display: grid;
  gap: 8px;
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

/* TAKEOVER hero (jedno zdjęcie + tekst) */
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
  height: 240px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
}

.sabrina-hero-img{
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: translateX(120%);
  transition: transform .52s ease;
}
.sabrina-hero-img.is-in{ transform: translateX(0); }

/* POPUP 3x3 */
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

/* flying selected */
.sabrina-fly{
  position: fixed;
  z-index: 2147483647;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.14);
  box-shadow: 0 24px 90px rgba(0,0,0,.55);
  background: rgba(255,255,255,.06);
}
.sabrina-fly img{
  width: 100%;
  height: 100%;
  object-fit: cover;
  display:block;
}

/* cover slide */
.sabrina-cover{
  position: fixed;
  z-index: 2147483647;
  width: ${CFG.TARGET_W}px;
  height: ${CFG.TARGET_H}px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.14);
  box-shadow: 0 24px 90px rgba(0,0,0,.55);
  transform: translateX(120%);
  transition: transform .52s ease;
}
.sabrina-cover.is-in{ transform: translateX(0); }
.sabrina-cover img{ width: 100%; height: 100%; object-fit: cover; display:block; }
        `;
        document.head.appendChild(style);

        // ===== UI budowa =====
        const overlay = document.createElement("div");
        overlay.className = "sabrina-overlay";

        const colL = document.createElement("div");
        colL.className = "sabrina-col left is-pre";

        const colR = document.createElement("div");
        colR.className = "sabrina-col right is-pre";

        overlay.appendChild(colL);
        overlay.appendChild(colR);
        root.appendChild(overlay);

        // start-in anim
        ctx.setTimeoutSafe(() => {
          colL.classList.remove("is-pre");
          colR.classList.remove("is-pre");
        }, 40);

        // ===== STATE =====
        const slotStates = [];
        const takeover = { active: false, timer: null, hero: null, modal: null };

        function scheduleTakeover() {
          const ms = CFG.TAKEOVER_EVERY_MIN_MS +
            Math.random() * (CFG.TAKEOVER_EVERY_MAX_MS - CFG.TAKEOVER_EVERY_MIN_MS);
          takeover.timer = ctx.setTimeoutSafe(() => beginTakeover(), ms | 0);
        }

        function stopAllSlotAudioAndAnimations() {
          slotStates.forEach(st => {
            st.animToken++; // cancel RAF
            st.busy = false;
            fadeOutAudio(st.currentSfx, CFG.TAKEOVER_FADE_MS);
            st.currentSfx = null;
            try { st.img.style.transform = ""; st.img.style.filter = ""; } catch {}
          });
        }

        async function beginTakeover() {
          if (takeover.active) return;
          takeover.active = true;

          // zjazd slotów
          colL.classList.add("is-hidden");
          colR.classList.add("is-hidden");

          // przerwij animacje + wycisz dźwięki slotów
          stopAllSlotAudioAndAnimations();

          await sleep(ctx, CFG.TAKEOVER_SLIDE_MS);

          // wjedź hero (jedno zdjęcie + tekst)
          openHero();
          await sleep(ctx, 1150);

          // hero ma zniknąć w momencie pojawienia się popupa
          closeHero();

          // popup 3x3
          openGridModal();
        }

        function openHero() {
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
          inner.appendChild(title);
          inner.appendChild(wrap);
          hero.appendChild(inner);

          root.appendChild(hero);
          takeover.hero = hero;

          // wjazd
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

          // Układ 3x3: poprawny ZAWSZE w środku (index 4)
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

  const ok = (idx === 4); // środek = poprawne

  if (!ok) {
    msg.textContent = "Nie będę tu siadała głuptasku";
    // opcjonalnie: mały „shake” błędnego kafelka
    cell.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
      { duration: 220 }
    );
    return; // <— KLUCZ: nie zamykamy, nie kończymy takeover
  }

  msg.textContent = "Lepiej weź głęboki oddech :*";
  const centerImg = card.querySelector('.sabrina-gcell[data-idx="4"] img');
  await handleCorrectPick(centerImg);

  closeGridModal();
  await endTakeover();
});


            grid.appendChild(cell);
          });

          card.appendChild(title);
          card.appendChild(grid);
          card.appendChild(msg);
          modal.appendChild(card);

          // blokuj klik na tło strony
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

        async function handleCorrectPick(centerImgEl) {
          if (!centerImgEl) return;

          // bierz pozycję startową (z modala) i twórz "latający" element
          const r = centerImgEl.getBoundingClientRect();

          const fly = document.createElement("div");
          fly.className = "sabrina-fly";
          fly.style.left = `${r.left}px`;
          fly.style.top = `${r.top}px`;
          fly.style.width = `${r.width}px`;
          fly.style.height = `${r.height}px`;

          const im = document.createElement("img");
          im.src = centerImgEl.src;
          fly.appendChild(im);
          root.appendChild(fly);

          // docelowe miejsce: prawa „wolna” strona obok bingo (uogólnienie)
          const targetW = CFG.TARGET_W;
          const targetH = CFG.TARGET_H;
          const targetX = window.innerWidth - targetW - CFG.TARGET_PAD_RIGHT;
          const targetY = window.innerHeight * CFG.TARGET_Y_RATIO - targetH / 2;

          // animacja: płynne przejście
          fly.style.transition = `left ${CFG.CORRECT_FLY_MS}ms ease, top ${CFG.CORRECT_FLY_MS}ms ease, width ${CFG.CORRECT_FLY_MS}ms ease, height ${CFG.CORRECT_FLY_MS}ms ease`;
          await sleep(ctx, 30);
          fly.style.left = `${Math.max(0, targetX)}px`;
          fly.style.top = `${Math.max(0, targetY)}px`;
          fly.style.width = `${targetW}px`;
          fly.style.height = `${targetH}px`;

          await sleep(ctx, CFG.CORRECT_FLY_MS + 60);

          // cover wjeżdża z prawej i zakrywa
          const cover = document.createElement("div");
          cover.className = "sabrina-cover";
          cover.style.left = `${Math.max(0, targetX)}px`;
          cover.style.top = `${Math.max(0, targetY)}px`;

          const coverImg = document.createElement("img");
          coverImg.src = CFG.COVER_IMG;
          cover.appendChild(coverImg);

          root.appendChild(cover);
          await sleep(ctx, 30);
          cover.classList.add("is-in");

          await sleep(ctx, CFG.COVER_SLIDE_MS + 120);

          // sprzątanie: zostawiamy cover chwilę i usuwamy oba (albo możesz cover zostawić – jak chcesz)
          try { fly.remove(); } catch {}
          try { cover.remove(); } catch {}
        }

        async function endTakeover() {
          // wróć sloty
          colL.classList.remove("is-hidden");
          colR.classList.remove("is-hidden");

          takeover.active = false;

          // planuj kolejny takeover
          scheduleTakeover();
        }

        // ===== SLOTY (klik = swap) =====
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
            const url = pickOne(sfx?.hs);
            if (url) playManaged(url, CFG.SFX_VOLUME);
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

              // rozjaśnianie do bieli
              img.style.transform = `rotateY(${angle}deg) rotateZ(${Math.min(22, p * 22)}deg)`;
              img.style.filter = `brightness(${1 + p * 2.2}) saturate(${1 - p}) contrast(${1 + p * 0.2})`;

              if (p < 1) {
                requestAnimationFrame(step);
                return;
              }

              // 100% biało -> swap + sfx
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

          return { wrap };
        }

        // render slotów
        const slots = CFG.SLOTS.map(cfg => createSlot(cfg));
        slots.forEach(s => {
          const id = s.wrap.querySelector("img")?.alt || "";
          const isLeft = id.startsWith("L");
          (isLeft ? colL : colR).appendChild(s.wrap);
        });

        // start bg + takeover
        startLoop();
        scheduleTakeover();

        return () => {
          try { if (takeover.timer) clearTimeout(takeover.timer); } catch {}
          closeHero();
          closeGridModal();

          try { overlay.remove(); } catch {}
          try { style.remove(); } catch {}
          try { if (bg) { bg.pause(); bg.currentTime = 0; } } catch {}

          slotStates.forEach(st => fadeOutAudio(st.currentSfx, 120));
        };
      }
    };
  });
})();
