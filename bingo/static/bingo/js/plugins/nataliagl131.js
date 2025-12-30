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

  const CFG = {
    IDLE_MS: 500,
    MAX_ON_SCREEN: 10,
    SCALE_MIN: 0.42,
    SCALE_MAX: 0.77,
    OPACITY: 0.6,

    // === audio (jak u Pesosa) ===
    DEFAULT_VOLUME: 0.18,

    // === "Pesos vibe" – przyciemnij UI ===
    DIM_BODY_SIGMAS: true,
    PANEL_BG: "rgba(0,0,0,.68)",
    PANEL_BORDER: "rgba(255,255,255,.10)",
    PANEL_SHADOW: "0 18px 55px rgba(0,0,0,.55)",

    // === puppies in bottom half (STATIC per page load) ===
    PUPPY_COUNT: 10,            // ile piesków renderować na dole
    PUPPY_SCALE_MIN: 0.22,      // skala pojedynczego pieska
    PUPPY_SCALE_MAX: 0.48,
    PUPPY_OPACITY: 0.18,
    PUPPY_ROT_MIN: -10,
    PUPPY_ROT_MAX: 10,
    PUPPY_PAD: 18,              // margines od krawędzi
  };

  const ASSETS = {
    images: [
      "/static/bingo/images/nataliagl131/astarion1.gif",
      "/static/bingo/images/nataliagl131/astarion2.gif",
      "/static/bingo/images/nataliagl131/astarion3.gif",
      "/static/bingo/images/nataliogl131/astarion5.gif",
      "/static/bingo/images/nataliagl131/astarion6.gif",
      "/static/bingo/images/nataliagl131/happy_puppy2.gif",
      "/static/bingo/images/nataliagl131/happy_puppy2.jpg",
      "/static/bingo/images/nataliagl131/puppy2.jpg",
      "/static/bingo/images/nataliagl131/puppy3.jpg",
    ],
  };

  // tło: góra = Astarion, dół = losowo poustawiane pieski (raz na load)
  const BG = {
    TOP: "/static/bingo/images/nataliagl131/astarionbg.gif",
    BOTTOM_POOL: ASSETS.images.filter(x => /puppy/i.test(x)),
  };

  function getJSONScript(id, fallback = null) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    try { return JSON.parse(el.textContent || "null"); } catch { return fallback; }
  }

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pickOne(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "TEXTAREA" ||
      (tag === "INPUT" && ["text", "search", "email", "password"].includes(el.type));
  }

  whenRuntime(() => {
    window.BingoUserPlugin = {
      init(api) {
        const { ctx } = api;
        const root = document.getElementById("plugin-root");
        if (!root) return;

        // === ambient playlist z <script id="plugin-sfx"> ===
        const pluginSfx = getJSONScript("plugin-sfx", {}) || {};
        const ambientList = Array.isArray(pluginSfx?.ambient)
          ? pluginSfx.ambient.filter(Boolean)
          : [];

        const style = document.createElement("style");
        style.textContent = `
#plugin-root { position: relative; z-index: 2147483000; }

/* (opcjonalnie) wyłącz "2 sigmy" z body */
${CFG.DIM_BODY_SIGMAS ? `
body::before,
body::after{
  background-image: none !important;
  opacity: 0 !important;
  content: "" !important;
}
` : ""}

/* przyciemnij UI jak u Pesosa */
.page, .hero, .panel{
  position: relative;
  z-index: 50;
}
.panel{
  background: ${CFG.PANEL_BG} !important;
  border: 1px solid ${CFG.PANEL_BORDER} !important;
  box-shadow: ${CFG.PANEL_SHADOW} !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.grid-cell, .cell-wrapper, .raffle-tile{
  background: rgba(0,0,0,.28) !important;
  border-color: rgba(255,255,255,.10) !important;
}

/* ===== background split ===== */
.ast-bg{
  position: fixed;
  inset: 0;
  z-index: 2147483644;
  pointer-events: none;
}
.ast-bg::before{
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 50vh;

  background-image: var(--top-bg);
  background-repeat: no-repeat;
  background-position: center top;

  /* rozciąga na całą górną połówkę, nie ucina */
  background-size: 100% 100%;
  opacity: 0.35;
}

/* dolna połówka – kontener na "statyczne pieski" */
.ast-puppyfield{
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 50vh;
  overflow: hidden;
  pointer-events: none;
}

/* pojedynczy piesek */
.ast-puppy{
  position: absolute;
  left: 0; top: 0;
  opacity: var(--po);
  transform: translate(var(--px), var(--py)) scale(var(--ps)) rotate(var(--pr));
  will-change: transform;
  filter: drop-shadow(0 12px 26px rgba(0,0,0,.35));
  user-select: none;
}

/* ===== floating images (typing wave) ===== */
.ast-layer{
  position: fixed; inset: 0;
  pointer-events: none;
  z-index: 2147483646;
  overflow: hidden;
}
.ast-img{
  position: fixed;
  left: 0; top: 0;
  will-change: transform, opacity;
  filter: drop-shadow(0 16px 30px rgba(0,0,0,.45));
  user-select: none;

  opacity: 0;
  transform: translate(var(--x), var(--y)) scale(var(--s)) rotate(var(--r));
  transition: opacity 140ms ease;
}
.ast-img.is-on { opacity: var(--o); }
        `;
        document.head.appendChild(style);

        // background layer
        const bg = document.createElement("div");
        bg.className = "ast-bg";
        root.appendChild(bg);

        // górny gif
        bg.style.setProperty("--top-bg", `url("${BG.TOP}")`);

        // dolny "field" na pieski
        const puppyField = document.createElement("div");
        puppyField.className = "ast-puppyfield";
        bg.appendChild(puppyField);

        // floating layer (gify podczas typing)
        const layer = document.createElement("div");
        layer.className = "ast-layer";
        root.appendChild(layer);

        // === statyczne losowanie piesków (RAZ na load) ===
        const puppyEls = [];

        function placePuppy(el) {
          const pad = CFG.PUPPY_PAD;
          const w = Math.max(1, window.innerWidth);
          const h = Math.max(1, Math.floor(window.innerHeight * 0.5)); // dolna połówka

          // rozkład: x pełna szerokość, y tylko w dolnej połówce (field ma własne 0..50vh)
          const x = Math.floor(rand(pad, Math.max(pad + 1, w - pad)));
          const y = Math.floor(rand(pad, Math.max(pad + 1, h - pad)));

          const s = rand(CFG.PUPPY_SCALE_MIN, CFG.PUPPY_SCALE_MAX);
          const r = Math.floor(rand(CFG.PUPPY_ROT_MIN, CFG.PUPPY_ROT_MAX)) + "deg";

          el.style.setProperty("--px", `${x}px`);
          el.style.setProperty("--py", `${y}px`);
          el.style.setProperty("--ps", `${s}`);
          el.style.setProperty("--pr", r);
          el.style.setProperty("--po", `${CFG.PUPPY_OPACITY}`);
        }

        function buildStaticPuppies() {
          // wyczyść stare
          puppyField.textContent = "";
          puppyEls.length = 0;

          if (!BG.BOTTOM_POOL.length) return;

          const n = Math.max(1, CFG.PUPPY_COUNT);
          for (let i = 0; i < n; i++) {
            const img = document.createElement("img");
            img.className = "ast-puppy";
            img.alt = "";
            img.draggable = false;
            img.loading = "lazy";
            img.src = pickOne(BG.BOTTOM_POOL);
            placePuppy(img);

            puppyEls.push(img);
            puppyField.appendChild(img);
          }
        }

        buildStaticPuppies();

        // na resize tylko PRZEUSTAW — bez zmiany src (zero migania)
        ctx.on(window, "resize", () => {
          for (const el of puppyEls) placePuppy(el);
        });

        // ===== AUDIO: mechanika jak u Pesosa (start po pierwszym klik/klawisz/input) =====
        let playlist = shuffle(ambientList);
        let idx = 0;

        const audio = document.createElement("audio");
        audio.preload = "auto";
        audio.loop = false;
        audio.volume = CFG.DEFAULT_VOLUME;

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

        // ===== state dla gifów latających =====
        let idleTimer = null;
        let iter = 0;
        let isOn = false;

        const imgs = [];
        let chosenPool = [];

        function countForIter(it) {
          return Math.min(CFG.MAX_ON_SCREEN, Math.max(1, it + 1));
        }

        function rebuildIfAssetsChanged() {
          const set = new Set(ASSETS.images);
          chosenPool = chosenPool.filter(x => set.has(x));
        }

        function growChosenPoolTo(count) {
          rebuildIfAssetsChanged();

          if (count >= ASSETS.images.length) {
            chosenPool = ASSETS.images.slice();
            return;
          }

          while (chosenPool.length < count) {
            const chosenSet = new Set(chosenPool);
            const remaining = ASSETS.images.filter(x => !chosenSet.has(x));
            if (!remaining.length) break;
            chosenPool.push(pickOne(remaining));
          }

          if (chosenPool.length > count) chosenPool = chosenPool.slice(0, count);
        }

        function placeRandomly(el) {
          const pad = 18;
          const x = Math.floor(rand(pad, Math.max(pad + 1, window.innerWidth - pad)));
          const y = Math.floor(rand(pad, Math.max(pad + 1, window.innerHeight - pad)));
          const s = rand(CFG.SCALE_MIN, CFG.SCALE_MAX);
          const r = Math.floor(rand(-18, 18)) + "deg";

          el.style.setProperty("--x", `${x}px`);
          el.style.setProperty("--y", `${y}px`);
          el.style.setProperty("--s", `${s}`);
          el.style.setProperty("--r", r);
          el.style.setProperty("--o", `${CFG.OPACITY}`);
        }

        function ensurePoolSize(n) {
          while (imgs.length < n) {
            const img = document.createElement("img");
            img.className = "ast-img";
            img.alt = "";
            img.onerror = () => img.classList.remove("is-on");
            imgs.push(img);
            layer.appendChild(img);
          }
        }

        function showWave() {
          if (!ASSETS.images.length) return;

          const count = countForIter(iter);
          ensurePoolSize(count);

          growChosenPoolTo(count);

          if (!isOn) {
            for (let i = 0; i < count; i++) {
              const img = imgs[i];
              img.src = chosenPool[i];
              placeRandomly(img);
            }
          }

          for (let i = 0; i < count; i++) imgs[i].classList.add("is-on");
          for (let i = count; i < imgs.length; i++) imgs[i].classList.remove("is-on");

          isOn = true;
        }

        function hideAllAndCountBreak() {
          if (!isOn) return;

          for (const img of imgs) img.classList.remove("is-on");
          isOn = false;

          iter = Math.min(CFG.MAX_ON_SCREEN - 1, iter + 1);
          growChosenPoolTo(countForIter(iter));
        }

        function scheduleHide() {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = ctx.setTimeoutSafe(() => {
            idleTimer = null;
            hideAllAndCountBreak();
          }, CFG.IDLE_MS);
        }

        // start: iter=0 → dobierz 1
        growChosenPoolTo(countForIter(iter));

        ctx.on(document, "keydown", (e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          const ae = document.activeElement;
          if (!isTypingTarget(ae)) return;

          showWave();
          scheduleHide();
        });

        ctx.on(document, "input", () => {
          const ae = document.activeElement;
          if (!isTypingTarget(ae)) return;

          showWave();
          scheduleHide();
        });

        ctx.on(document, "pointerdown", () => {
          const ae = document.activeElement;
          if (!isTypingTarget(ae)) {
            for (const img of imgs) img.classList.remove("is-on");
            isOn = false;
          }
          if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
        });

        ctx.on(document, "visibilitychange", () => {
          if (document.hidden) {
            for (const img of imgs) img.classList.remove("is-on");
            isOn = false;
            try { audio.pause(); } catch {}
          } else {
            if (started && playlist.length) audio.play().catch(() => {});
          }
        });

        return () => {
          try { if (idleTimer) clearTimeout(idleTimer); } catch {}

          // audio cleanup
          try {
            document.removeEventListener("pointerdown", startOnFirstUserInput, true);
            document.removeEventListener("keydown", startOnFirstUserInput, true);
            document.removeEventListener("input", startOnFirstUserInput, true);
          } catch {}
          try { audio.pause(); } catch {}

          try { layer.remove(); } catch {}
          try { bg.remove(); } catch {}
          try { style.remove(); } catch {}
        };
      }
    };
  });
})();
