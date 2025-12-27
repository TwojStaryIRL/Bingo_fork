(() => {
  const CFG = {
    BG_IMGS: [
      "/static/bingo/images/jull/bgkotek1.jpg",
      "/static/bingo/images/jull/bgkotek2.jpg",
      "/static/bingo/images/jull/bgkotek3.jpg",
      "/static/bingo/images/jull/bdkotek4.jpg",
      "/static/bingo/images/jull/bdkotek5.jpg",
      "/static/bingo/images/jull/bdkotek6.jpg",
      "/static/bingo/images/jull/bdkotek7.jpg",
      "/static/bingo/images/jull/bdkotek8.jpg",
      "/static/bingo/images/jull/bdkotek9.jpg",
      "/static/bingo/images/jull/bdkotek10.jpg",
      "/static/bingo/images/jull/bdkotek11.jpg",
    ],
    HAPPY_CAT: "/static/bingo/images/jull/happycat.jpg",
    SAD_CAT: "/static/bingo/images/jull/sadcat.jpg",

    ROWS: 6,
    TILE_H: 160,
    TILE_GAP: 14,
    SPEED_MIN: 18,
    SPEED_MAX: 36,
    BG_OPACITY: 0.22,

    OXY_START: 0.75,
    OXY_DECAY_PER_SEC: 0.013,
    OXY_PUMP_ADD: 0.025,
    OXY_PUMP_CD_MS: 200,

    // PRZEJŚCIE
    FADE_START_THRESHOLD: 0.45,     
    FADE_COMPLETE_THRESHOLD: 0.10,  
    FADE_MS: 1000,                  

    // DYMEK
    TALK_START_THRESHOLD: 0.40,   
    TALK_COOLDOWN_MS: 1400,       
    DEAD_THRESHOLD: 0.07,          


    PANEL_W: 320,
    PANEL_H: 360,
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

    function shuffledPool(arr) {
          const a = arr.slice();
          for (let i = a.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            [a[i], a[j]] = [a[j], a[i]];
          }
          return a;
        }

    function fillRowNoDup(track, rowW, tileW) {
    const need = Math.ceil((rowW * 2) / Math.max(1, tileW)) + 2;
    let bag = shuffledPool(CFG.BG_IMGS);
    let k = 0;

    for (let i = 0; i < need; i++) {
      if (k >= bag.length) { bag = shuffledPool(CFG.BG_IMGS); k = 0; } // reset po wyczerpaniu
      const img = document.createElement("img");
      img.src = bag[k++];
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

.jull-bubble{
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%) translateY(-100%) translateY(-10px) scale(.98);
  width: max-content;
  max-width: calc(100% - 24px);
  text-align: center;

  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255,255,255,.92);
  color: #111;
  font-weight: 950;
  font-size: 13px;
  line-height: 1.15;
  letter-spacing: .2px;
  box-shadow: 0 14px 35px rgba(0,0,0,.35);
  opacity: 0;
  transition: opacity 220ms ease, transform 220ms ease;
  pointer-events: none;
  z-index: 5;
}

.jull-bubble.is-on{
  opacity: 1;
  transform: translateX(-50%) translateY(-100%) translateY(-10px) scale(1);
}

.jull-bubble::after{
  content: "";
  position: absolute;
  left: 50%;
  top: 100%;
  border: 10px solid transparent;
  border-top-color: rgba(255,255,255,.92);
  transform: translateX(-50%) translateY(-1px);
}


/* gdy dead – bardziej “ciężki” komunikat */
.jull-bubble.is-dead{
  background: rgba(255, 90, 90, .95);
  color: #fff;
}
.jull-bubble.is-dead::after{
  border-top-color: rgba(255, 90, 90, .95);
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
  grid-template-rows: 1.45fr auto auto;
  gap: 12px;
  backdrop-filter: blur(6px);
}

.jull-catbox{
  position: relative;
  border-radius: 14px;
  overflow: visible; 
  background: rgba(255,255,255,.04);
  outline: 1px solid rgba(255,255,255,.10);
}


.jull-catbox img{
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity ${CFG.FADE_MS}ms linear;
  user-select: none;
  pointer-events: none;
}

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
  padding: 14px 12px;
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
        happy.src = CFG.HAPPY_CAT;
        happy.alt = "happy cat";
        happy.draggable = false;

        const sad = document.createElement("img");
        sad.src = CFG.SAD_CAT;
        sad.alt = "sad cat";
        sad.draggable = false;

        catbox.appendChild(happy);
        catbox.appendChild(sad);

        const bubble = document.createElement("div");
        bubble.className = "jull-bubble";
        bubble.textContent = "";
        catbox.appendChild(bubble);


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
            fillRowNoDup(track, rowW, tileW);
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
        let isDead = false;
        let lastTalkAt = 0;

        const TALK_LINES = [
          "Pomóż mi… MEOWWWWWW!",
          "Miau?",
          "MEOW! MEOW! MEOWWWWWWW! MEOW!",
          "Błagam…",
        ];

        function setBubble(text, { on = true, dead = false } = {}) {
          bubble.textContent = text || "";
          bubble.classList.toggle("is-on", !!on && !!text);
          bubble.classList.toggle("is-dead", !!dead);
        }

        function maybeTalk() {
          if (isDead) return;

          // jeśli tlen > TALK_START -> chowamy dymek
          if (oxyVal > CFG.TALK_START_THRESHOLD) {
            setBubble("", { on: false });
            return;
          }

          // cooldown, żeby nie “migało” co klatkę
          const t = performance.now();
          if (t - lastTalkAt < CFG.TALK_COOLDOWN_MS) return;
          lastTalkAt = t;

          // im mniej tlenu, tym częściej agresywne linie (prosty bias)
          const p = clamp01((CFG.TALK_START_THRESHOLD - oxyVal) / Math.max(0.0001, CFG.TALK_START_THRESHOLD));
          const idx = Math.min(TALK_LINES.length - 1, (Math.random() * TALK_LINES.length * (0.55 + 0.9 * p)) | 0);

          setBubble(TALK_LINES[idx], { on: true, dead: false });
        }

        function die() {
          isDead = true;
          // na stałe komunikat końcowy
          setBubble("HAHAHA JESTEM GEORGE DROYD NIGDY MNIE NIE POKONASZ", { on: true, dead: true });
          // opcjonalnie: zatrzymaj spadek / animację (zostawiamy jako “freeze”)
        }


        function moodMix01() {
          const a = Number(CFG.FADE_START_THRESHOLD);
          const b = Number(CFG.FADE_COMPLETE_THRESHOLD);
          if (!(a > b)) {
            // fail-safe: jeśli ktoś źle ustawi progi, fallback do “skoku”
            return oxyVal <= b ? 1 : 0;
          }
          // p=0 przy a, p=1 przy b
          return clamp01((a - oxyVal) / (a - b));
        }

        function setMood() {
          const p = moodMix01();       // 0..1
          happy.style.opacity = String(1 - p);
          sad.style.opacity = String(p);
        }

        function setOxyUI() {
          oxyFill.style.width = `${(oxyVal * 100).toFixed(1)}%`;
          const k = 1 - oxyVal;
          oxyFill.style.opacity = String(0.65 + (1 - k) * 0.35);
          oxyFill.style.filter = `saturate(${0.6 + oxyVal * 0.7})`;
        }

        function pump() {
          if (isDead) return;
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

        
        if (!isDead) {
          if (oxyVal <= CFG.DEAD_THRESHOLD) {
            die();
          } else {
            maybeTalk();
          }
        }

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
