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
    SPEED_MIN: 18,
    SPEED_MAX: 36,
    BG_OPACITY: 0.22,

    OXY_START: 0.75,
    OXY_DECAY_PER_SEC: 0.013,
    OXY_PUMP_ADD: 0.025,
    OXY_PUMP_CD_MS: 200,

    FADE_START_THRESHOLD: 0.45,
    FADE_COMPLETE_THRESHOLD: 0.10,
    FADE_MS: 1000,

    TALK_START_THRESHOLD: 0.40,
    TALK_COOLDOWN_MS: 1400,
    DEAD_THRESHOLD: 0.07,

    PANEL_W: 320,
    PANEL_H: 360,
    PANEL_MARGIN: 18,

    // ===== AUDIO (NOWE) =====
    DEFAULT_AMBIENT_VOL: 0.18,
    DEFAULT_MEOW_VOL: 0.25,

    // jeśli nie masz JSON-a w HTML, użyj naming bg1..bgN i meow1..meowN:
    AMBIENT_BG_N: 6,  // bg1.mp3..bg6.mp3
    MEOW_N: 4,        // meow1.mp3..meow4.mp3

    // ścieżki bazowe (dopasuj katalog)
    AMBIENT_BASE: "/static/bingo/audio/jull/bg",     // + "1.mp3"
    MEOW_BASE: "/static/bingo/audio/jull/meow",      // + "1.mp3"
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
  function nextCatSrc() {
    if (globalBag.length === 0 || globalK >= globalBag.length) {
      globalBag = shuffledPool(CFG.BG_IMGS);
      globalK = 0;
    }
    return globalBag[globalK++];
  }

  function fillRowNoDup(track, rowW, tileW) {
    const need = Math.ceil((rowW * 2) / Math.max(1, tileW)) + 2;
    for (let i = 0; i < need; i++) {
      const img = document.createElement("img");
      img.src = nextCatSrc();
      img.alt = "kotek";
      img.draggable = false;
      img.loading = "lazy";
      track.appendChild(img);
    }
  }

  // ===== AUDIO helpers (NOWE) =====
  function makeNumberedList(base, n) {
    const out = [];
    for (let i = 1; i <= (n | 0); i++) out.push(`${base}${i}.mp3`);
    return out;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  whenRuntime(() => {
    window.BingoUserPlugin = {
      init(api) {
        if (window.__bingo_jull_cat_minigame_started) return;
        window.__bingo_jull_cat_minigame_started = true;

        const { ctx } = api;
        const root = document.getElementById("plugin-root");
        if (!root) return;

        // ===== STYLE =====
        const style = document.createElement("style");
        style.textContent = `
/* ... TU ZOSTAWIASZ SWÓJ CSS BEZ ZMIAN ... */
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
            fillRowNoDup(track, rowW, tileW);
            const imgs = Array.from(track.querySelectorAll("img"));
            imgs.forEach(img => track.appendChild(img.cloneNode(true)));
            track.__filled = true;
          });
        }
        layoutFill();
        ctx.on(window, "resize", () => layoutFill());

        // ===== AUDIO init (NOWE) =====
        const ambientList = makeNumberedList(CFG.AMBIENT_BASE, CFG.AMBIENT_BG_N);
        const meowList = makeNumberedList(CFG.MEOW_BASE, CFG.MEOW_N);

        // ambient – playlist (jak w Pesos)
        let ambientPlaylist = shuffle(ambientList);
        let ambientIdx = 0;

        const ambient = document.createElement("audio");
        ambient.preload = "auto";
        ambient.loop = false;
        ambient.volume = CFG.DEFAULT_AMBIENT_VOL;

        function ambientSetTrack(i) {
          if (!ambientPlaylist.length) return;
          ambientIdx = (i + ambientPlaylist.length) % ambientPlaylist.length;
          ambient.src = ambientPlaylist[ambientIdx];
        }
        function ambientStart() {
          if (!ambientPlaylist.length) return;
          if (!ambient.src) ambientSetTrack(0);
          ambient.play().catch(() => {});
        }
        function ambientNext() {
          if (!ambientPlaylist.length) return;
          ambientSetTrack(ambientIdx + 1);
          ambient.play().catch(() => {});
        }
        ambient.addEventListener("ended", ambientNext);

        // meow – “one-shot” pod dymki
        const meow = document.createElement("audio");
        meow.preload = "auto";
        meow.loop = false;
        meow.volume = CFG.DEFAULT_MEOW_VOL;

        function playMeow({ urgent = false } = {}) {
          if (!meowList.length) return;
          const src = urgent && meowList.length >= 2
            ? meowList[(Math.random() * Math.min(meowList.length, 3)) | 0] // lekkie uprzywilejowanie “pierwszych” próbek
            : pick(meowList);

          // restart natychmiast (żeby sync był ciasny)
          try {
            meow.pause();
            meow.currentTime = 0;
          } catch {}
          meow.src = src;
          meow.play().catch(() => {});
        }

        // start ambient po pierwszej interakcji (autoplay policy)
        let startedAudio = false;
        const startOnFirstUserInput = () => {
          if (startedAudio) return;
          startedAudio = true;

          document.removeEventListener("pointerdown", startOnFirstUserInput, true);
          document.removeEventListener("keydown", startOnFirstUserInput, true);
          document.removeEventListener("input", startOnFirstUserInput, true);

          ambientStart();
        };
        document.addEventListener("pointerdown", startOnFirstUserInput, true);
        document.addEventListener("keydown", startOnFirstUserInput, true);
        document.addEventListener("input", startOnFirstUserInput, true);

        // NIE PAUZUJEMY na blur/visibilitychange – nic tu nie dodajemy.

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

        // (NOWE) unikaj meow-spamu przy tym samym tekście
        let lastBubbleText = "";
        let lastMeowAt = 0;
        const MEOW_COOLDOWN_MS = 420;

        function setBubble(text, { on = true, dead = false } = {}) {
          const nextText = text || "";
          bubble.textContent = nextText;
          bubble.classList.toggle("is-on", !!on && !!nextText);
          bubble.classList.toggle("is-dead", !!dead);

          // ===== SYNC MEOW Z DYMKAMI (NOWE) =====
          // graj tylko jeśli faktycznie pokazaliśmy nową treść i nie jesteśmy w “dead freeze”
          const now = performance.now();
          const changed = nextText && nextText !== lastBubbleText;
          if (changed && !dead && (now - lastMeowAt) >= MEOW_COOLDOWN_MS) {
            lastMeowAt = now;

            // urgent: im mniej tlenu, tym bardziej “panic”
            const urgent = oxyVal <= (CFG.TALK_START_THRESHOLD * 0.65);
            playMeow({ urgent });
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
          const idx = Math.min(TALK_LINES.length - 1, (Math.random() * TALK_LINES.length * (0.55 + 0.9 * p)) | 0);

          setBubble(TALK_LINES[idx], { on: true, dead: false });
        }

        function die() {
          isDead = true;
          setBubble("HAHAHA JESTEM GEORGE DROYD NIGDY MNIE NIE POKONASZ", { on: true, dead: true });

          // opcjonalnie: pojedynczy “meow” przed śmiercią? zostawiam wyłączone, bo dead=true blokuje meow.
          // playMeow({ urgent: true });
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
          try { ambient.pause(); } catch {}
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
