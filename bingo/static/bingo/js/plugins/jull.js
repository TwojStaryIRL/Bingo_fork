(() => {
  const CFG = {
    BG_IMGS: [
      "/static/bingo/images/jull/bgkotek1.jpg",
      "/static/bingo/images/jull/bgkotek2.jpg",
      "/static/bingo/images/jull/bgkotek3.jpg",
    ],
    HAPPY_CAT: "/static/bingo/images/jull/happycat.jpg",
    SAD_CAT: "/static/bingo/images/jull/sadcat.jpg",

    ROWS: 6,
    TILE_H: 160,
    TILE_GAP: 14,
    SPEED_MIN: 18,
    SPEED_MAX: 36,
    BG_OPACITY: 0.22,

    OXY_START: 0.65,
    OXY_DECAY_PER_SEC: 0.055,
    OXY_PUMP_ADD: 0.22,
    OXY_PUMP_CD_MS: 180,

    SAD_THRESHOLD: 0.30,
    FADE_MS: 280,

    PANEL_W: 360,     // szerokość git
    PANEL_H: 320,     // <<< WYŻSZE
    PANEL_MARGIN: 18,
  };

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function rand(min, max) { return min + Math.random() * (max - min); }

  function whenRuntime(fn) {
    if (window.BingoPluginRuntime?.initUserPlugin) return fn();
    const t = setInterval(() => {
      if (window.BingoPluginRuntime?.initUserPlugin) {
        clearInterval(t);
        fn();
      }
    }, 40);
  }

  function fillRow(track, rowW, tileW) {
    const need = Math.ceil((rowW * 2) / Math.max(1, tileW)) + 2;
    for (let i = 0; i < need; i++) {
      const img = document.createElement("img");
      img.src = pick(CFG.BG_IMGS);
      img.alt = "kotek";
      img.draggable = false;
      img.loading = "lazy";
      track.appendChild(img);
    }
  }

  whenRuntime(() => {
    window.BingoUserPlugin = {
      init(api) {
        if (window.__bingo_jull_cat_minigame_started) return;
        window.__bingo_jull_cat_minigame_started = true;

        const { ctx } = api;
        const root = document.getElementById("plugin-root");
        if (!root) return;

        const style = document.createElement("style");
        style.textContent = `
body::before,
body::after{
  background-image: none !important;
  opacity: 0 !important;
  content: "" !important;
}

.jull-bgwrap{
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
}

.jull-bg{
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: repeat(${CFG.ROWS}, ${CFG.TILE_H}px);
  gap: ${CFG.TILE_GAP}px;
  padding: ${CFG.TILE_GAP}px;
  box-sizing: border-box;
  opacity: ${CFG.BG_OPACITY};
  pointer-events: none;
  filter: saturate(1.05) contrast(1.03);
}

.jull-row{
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  background: rgba(255,255,255,.02);
  outline: 1px solid rgba(255,255,255,.06);
}

.jull-track{
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  display: flex;
  gap: ${CFG.TILE_GAP}px;
  align-items: center;
  will-change: transform;
}

.jull-track img{
  height: 100%;
  width: auto;
  border-radius: 18px;
  object-fit: cover;
  user-select: none;
  pointer-events: none;
  box-shadow: 0 10px 30px rgba(0,0,0,.25);
}

@keyframes jull-marquee {
  0%   { transform: translateX(0); }
  100% { transform: translateX(calc(-50% - (${CFG.TILE_GAP}px / 2))); }
}

.jull-track.anim{ animation: jull-marquee var(--jullDur, 26s) linear infinite; }
.jull-track.reverse{ animation-direction: reverse; }

/* PANEL: większy, ale nadal przepuszcza klik poza card */
.jull-panel{
  position: fixed;
  right: ${CFG.PANEL_MARGIN}px;
  bottom: ${CFG.PANEL_MARGIN}px;
  width: ${CFG.PANEL_W}px;
  height: ${CFG.PANEL_H}px;
  z-index: 10000;
  pointer-events: none;
  display: grid;
  place-items: stretch;
}

.jull-card{
  pointer-events: auto;
  width: 100%;
  height: 100%;
  border-radius: 18px;
  background: rgba(0,0,0,.68);
  outline: 1px solid rgba(255,255,255,.14);
  box-shadow: 0 20px 60px rgba(0,0,0,.45);
  padding: 14px;
  box-sizing: border-box;
  display: grid;

  /* <<< więcej miejsca na kotka */
  grid-template-rows: 1.45fr auto auto;
  gap: 12px;

  backdrop-filter: blur(6px);
}

.jull-catbox{
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255,255,255,.04);
  outline: 1px solid rgba(255,255,255,.10);
}

/* kotek bardziej “duży” w boxie */
.jull-catbox img{
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity ${CFG.FADE_MS}ms ease;
  user-select: none;
  pointer-events: none;
}

.jull-happy{ opacity: 1; }
.jull-sad{ opacity: 0; }

/* pasek tlenu minimalnie większy */
.jull-oxy{
  height: 18px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255,255,255,.12);
  outline: 1px solid rgba(255,255,255,.10);
}

.jull-oxy > div{
  height: 100%;
  width: 50%;
  border-radius: 999px;
  background: rgba(160, 255, 200, .92);
  transition: width 120ms linear, filter 120ms linear, opacity 120ms linear;
}

.jull-bottom{
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.jull-hint{
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
  font-size: 12px;
  color: rgba(255,255,255,.82);
  text-align: center;
  letter-spacing: .2px;
  user-select: none;
}

.jull-hint strong{ color: #fff; }

.jull-pumpbtn{
  border: 0;
  border-radius: 14px;
  padding: 14px 12px;     /* <<< większy “hitbox” */
  font-weight: 950;
  cursor: pointer;
  background: rgba(255,255,255,.92);
  color: #111;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
}
.jull-pumpbtn:active{ transform: translateY(1px); }
`;
        document.head.appendChild(style);

        // ===== BG =====
        const bgwrap = document.createElement("div");
        bgwrap.className = "jull-bgwrap";

        const bg = document.createElement("div");
        bg.className = "jull-bg";

        const rowEls = [];
        for (let r = 0; r < CFG.ROWS; r++) {
          const row = document.createElement("div");
          row.className = "jull-row";

          const track = document.createElement("div");
          track.className = "jull-track anim";
          if (r % 2 === 1) track.classList.add("reverse");
          track.style.setProperty("--jullDur", `${rand(CFG.SPEED_MIN, CFG.SPEED_MAX).toFixed(2)}s`);

          row.appendChild(track);
          bg.appendChild(row);
          rowEls.push({ track });
        }

        bgwrap.appendChild(bg);
        root.appendChild(bgwrap);

        // ===== PANEL =====
        const panel = document.createElement("div");
        panel.className = "jull-panel";

        const card = document.createElement("div");
        card.className = "jull-card";

        const catbox = document.createElement("div");
        catbox.className = "jull-catbox";

        const happy = document.createElement("img");
        happy.className = "jull-happy";
        happy.src = CFG.HAPPY_CAT;
        happy.alt = "happy cat";
        happy.draggable = false;

        const sad = document.createElement("img");
        sad.className = "jull-sad";
        sad.src = CFG.SAD_CAT;
        sad.alt = "sad cat";
        sad.draggable = false;

        catbox.appendChild(happy);
        catbox.appendChild(sad);

        const oxy = document.createElement("div");
        oxy.className = "jull-oxy";
        const oxyFill = document.createElement("div");
        oxy.appendChild(oxyFill);

        const bottom = document.createElement("div");
        bottom.className = "jull-bottom";

        const hint = document.createElement("div");
        hint.className = "jull-hint";
        hint.innerHTML = `Pompkuj tlen: <strong>klik w panel</strong> / <strong>SPACJA</strong> / <strong>ENTER</strong>`;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "jull-pumpbtn";
        btn.textContent = "POMPUJ";

        bottom.appendChild(hint);
        bottom.appendChild(btn);

        card.appendChild(catbox);
        card.appendChild(oxy);
        card.appendChild(bottom);

        panel.appendChild(card);
        root.appendChild(panel);

        // ===== fill marquee =====
        function layoutFill() {
          const rowW = (window.innerWidth || 1200);
          const tileW = (CFG.TILE_H * 1.35) + CFG.TILE_GAP;

          rowEls.forEach(({ track }) => {
            if (track.__filled) return;

            fillRow(track, rowW, tileW);

            const imgs = Array.from(track.querySelectorAll("img"));
            imgs.forEach(img => track.appendChild(img.cloneNode(true)));

            track.__filled = true;
          });
        }
        layoutFill();
        ctx.on(window, "resize", () => layoutFill());

        // ===== logic =====
        let oxyVal = clamp01(CFG.OXY_START);
        let lastPumpAt = 0;
        let lastTick = performance.now();
        let raf = null;

        function setMood() {
          const sadMode = oxyVal <= CFG.SAD_THRESHOLD;
          happy.style.opacity = sadMode ? "0" : "1";
          sad.style.opacity = sadMode ? "1" : "0";
        }

        function setOxyUI() {
          oxyFill.style.width = `${(oxyVal * 100).toFixed(1)}%`;
          const k = 1 - oxyVal;
          oxyFill.style.opacity = String(0.65 + (1 - k) * 0.35);
          oxyFill.style.filter = `saturate(${0.6 + oxyVal * 0.7})`;
        }

        function pump() {
          const t = performance.now();
          if (t - lastPumpAt < CFG.OXY_PUMP_CD_MS) return;
          lastPumpAt = t;

          oxyVal = clamp01(oxyVal + CFG.OXY_PUMP_ADD);
          setOxyUI();
          setMood();
        }

        function tick(t) {
          const dt = Math.max(0, (t - lastTick) / 1000);
          lastTick = t;

          oxyVal = clamp01(oxyVal - CFG.OXY_DECAY_PER_SEC * dt);
          setOxyUI();
          setMood();

          raf = requestAnimationFrame(tick);
        }

        setOxyUI();
        setMood();
        raf = requestAnimationFrame(tick);

        // input
        ctx.on(card, "pointerdown", (e) => { e.preventDefault(); pump(); }, { passive: false });
        btn.addEventListener("click", (e) => { e.preventDefault(); pump(); });

        let armed = false;
        ctx.on(card, "mouseenter", () => { armed = true; });
        ctx.on(card, "mouseleave", () => { armed = false; });
        ctx.on(card, "focusin", () => { armed = true; });
        ctx.on(card, "focusout", () => { armed = false; });

        ctx.on(document, "keydown", (e) => {
          if (!armed) return;
          const k = e.key;
          if (k === " " || k === "Enter") {
            e.preventDefault();
            pump();
          }
        }, { capture: true });

        return () => {
          try { if (raf) cancelAnimationFrame(raf); } catch {}
          try { panel.remove(); } catch {}
          try { bgwrap.remove(); } catch {}
          try { style.remove(); } catch {}
        };
      }
    };

    window.BingoPluginRuntime?.initUserPlugin?.();
  });
})();
