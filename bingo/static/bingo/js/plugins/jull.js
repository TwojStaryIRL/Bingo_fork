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
      "/static/bingo/images/jull/bdkotek12.gif",
    ],
    HAPPY_CAT: "/static/bingo/images/jull/happycat.jpg",
    SAD_CAT: "/static/bingo/images/jull/sadcat.jpg",

    ROWS: 6,
    TILE_H: 160,
    TILE_GAP: 14,
    SPEED_MIN: 36,
    SPEED_MAX: 72,
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

    // AUDIO (jak Pesos)
    DEFAULT_AMBIENT_VOLUME: 0.18,
    DEFAULT_MEOW_VOLUME: 0.14,
    MEOW_COOLDOWN_MS: 2500, // żeby nie spamować próbki co klatkę
  };

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
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

  // === jak u Pesos ===
  function getJSONScript(id, fallback = null) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    try { return JSON.parse(el.textContent || "null"); } catch { return fallback; }
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function shuffledPool(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  let globalBag = [];
  let globalK = 0;

  function nextCatSrc(CFG) {
    if (!CFG.BG_IMGS.length) return "";
    if (globalBag.length === 0 || globalK >= globalBag.length) {
      globalBag = shuffledPool(CFG.BG_IMGS);
      globalK = 0;
    }
    return globalBag[globalK++];
  }

  function fillRowNoDup(track, rowW, tileW, CFG) {
    const need = Math.ceil((rowW * 2) / Math.max(1, tileW)) + 2;
    for (let i = 0; i < need; i++) {
      const img = document.createElement("img");
      img.src = nextCatSrc(CFG);
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

        // === SFX jak w Pesos ===
        const pluginSfx = getJSONScript("plugin-sfx", {}) || {};
        const ambientList = Array.isArray(pluginSfx?.ambient) ? pluginSfx.ambient.filter(Boolean) : [];
        const meowList = Array.isArray(pluginSfx?.meows) ? pluginSfx.meows.filter(Boolean) : [];

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

  -webkit-mask-image: linear-gradient(
    to right,
    rgba(0,0,0,1) 0%,
    rgba(0,0,0,1) 16%,
    rgba(0,0,0,0.10) 42%,
    rgba(0,0,0,0.10) 58%,
    rgba(0,0,0,1) 84%,
    rgba(0,0,0,1) 100%
  );
  mask-image: linear-gradient(
    to right,
    rgba(0,0,0,1) 0%,
    rgba(0,0,0,1) 16%,
    rgba(0,0,0,0.10) 42%,
    rgba(0,0,0,0.10) 58%,
    rgba(0,0,0,1) 84%,
    rgba(0,0,0,1) 100%
  );
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

.page, .hero, .panel{
  position: relative;
  z-index: 50;
}

.panel.panel--wide{
  background: rgba(0,0,0,.68);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,.10);
  box-shadow: 0 18px 55px rgba(0,0,0,.55);
}

.grid-table textarea.grid-cell{
  background: rgba(255,255,255,.08);
  color: rgba(255,255,255,.92);
  border-color: rgba(255,255,255,.18);
}
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
        hint.innerHTML = `Pomóż mu!!!: <strong>klikaj w panel</strong> / <strong>SPACJA</strong> / <strong>ENTER</strong>`;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "jull-pumpbtn";
        btn.textContent = "RATUJ KOTKA";

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
            fillRowNoDup(track, rowW, tileW, CFG);
            const imgs = Array.from(track.querySelectorAll("img"));
            imgs.forEach(img => track.appendChild(img.cloneNode(true)));
            track.__filled = true;
          });
        }
        layoutFill();
        ctx.on(window, "resize", () => layoutFill());

        // ===== AUDIO (ambient jak Pesos) =====
        let playlist = shuffle(ambientList);
        let idx = 0;

        const audio = document.createElement("audio");
        audio.preload = "auto";
        audio.loop = false;
        audio.volume = CFG.DEFAULT_AMBIENT_VOLUME;

        function setTrack(i) {
          if (!playlist.length) return;
          idx = (i + playlist.length) % playlist.length;
          audio.src = playlist[idx];
        }
        function playStart() {
          if (!playlist.length) return;
          if (!audio.src) setTrack(0);
          audio.play().catch(() => {});
        }
        function playNext() {
          if (!playlist.length) return;
          setTrack(idx + 1);
          audio.play().catch(() => {});
        }
        audio.addEventListener("ended", () => {
          if (!playlist.length) return;
          playNext();
        });

        // ===== AUDIO (meows) =====
        const meow = document.createElement("audio");
        meow.preload = "auto";
        meow.loop = false;
        meow.volume = CFG.DEFAULT_MEOW_VOLUME;

        function pickMeow(urgent = false) {
          if (!meowList.length) return "";
          if (!urgent) return meowList[(Math.random() * meowList.length) | 0];

          // urgent: lekkie uprzywilejowanie pierwszych próbek (jeśli jest >1)
          const cap = Math.max(1, Math.min(meowList.length, 3));
          return meowList[(Math.random() * cap) | 0];
        }

        function playMeow(urgent = false) {
          const src = pickMeow(urgent);
          if (!src) return;

          try {
            meow.pause();
            meow.currentTime = 0;
          } catch {}

          meow.src = src;
          meow.play().catch(() => {});
        }

        // start audio po pierwszej interakcji (jak Pesos)
        let started = false;
        const startOnFirstUserInput = () => {
          if (started) return;
          started = true;

          document.removeEventListener("pointerdown", startOnFirstUserInput, true);
          document.removeEventListener("keydown", startOnFirstUserInput, true);
          document.removeEventListener("input", startOnFirstUserInput, true);

          playStart();
        };
        document.addEventListener("pointerdown", startOnFirstUserInput, true);
        document.addEventListener("keydown", startOnFirstUserInput, true);
        document.addEventListener("input", startOnFirstUserInput, true);

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

        // anty-spam meowów: tylko gdy tekst się zmieni + cooldown
        let lastBubbleText = "";
        let lastMeowAt = 0;

        function setBubble(text, { on = true, dead = false } = {}) {
          const nextText = text || "";
          bubble.textContent = nextText;
          bubble.classList.toggle("is-on", !!on && !!nextText);
          bubble.classList.toggle("is-dead", !!dead);

          // MEOW sync (tylko po starcie audio i nie w dead)
          const now = performance.now();
          const changed = nextText && nextText !== lastBubbleText;

          if (started && changed && !dead && (now - lastMeowAt) >= CFG.MEOW_COOLDOWN_MS) {
            lastMeowAt = now;
            const urgent = oxyVal <= (CFG.TALK_START_THRESHOLD * 0.65);
            playMeow(urgent);
          }

          lastBubbleText = nextText;
        }

        function maybeTalk() {
          if (isDead) return;

          if (oxyVal > CFG.TALK_START_THRESHOLD) {
            setBubble("", { on: false });
            return;
          }

          const t = performance.now();
          if (t - lastTalkAt < CFG.TALK_COOLDOWN_MS) return;
          lastTalkAt = t;

          const p = clamp01((CFG.TALK_START_THRESHOLD - oxyVal) / Math.max(0.0001, CFG.TALK_START_THRESHOLD));
          const i = Math.min(TALK_LINES.length - 1, (Math.random() * TALK_LINES.length * (0.55 + 0.9 * p)) | 0);

          setBubble(TALK_LINES[i], { on: true, dead: false });
        }

        function die() {
          isDead = true;
          setBubble("HAHAHA JESTEM GEORGE DROYD NIGDY MNIE NIE POKONASZ", { on: true, dead: true });
        }

        function moodMix01() {
          const a = Number(CFG.FADE_START_THRESHOLD);
          const b = Number(CFG.FADE_COMPLETE_THRESHOLD);
          if (!(a > b)) return oxyVal <= b ? 1 : 0;
          return clamp01((a - oxyVal) / (a - b));
        }

        function setMood() {
          const p = moodMix01();
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
          try { audio.pause(); } catch {}
          try { meow.pause(); } catch {}
          try { panel.remove(); } catch {}
          try { bgwrap.remove(); } catch {}
          try { style.remove(); } catch {}
        };
      }
    };

    window.BingoPluginRuntime?.initUserPlugin?.();
  });
})();
