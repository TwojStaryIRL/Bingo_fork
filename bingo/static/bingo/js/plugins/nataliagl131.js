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

    // audio
    DEFAULT_VOLUME: 0.18,

    // ===== BACKGROUND MODE TOGGLE =====
    // "PUPPIES" => góra Astarion + dół kafelki piesków
    // "BASIC"  => tylko góra Astarion (dół bez piesków)
    BG_MODE: "PUPPIES",

    // reset 2sigmy body::before/after jak u Pesosa
    RESET_2SIGMY: true,

    // Astarion top styling
    TOP_OPACITY: 0.22,

    // puppies grid (bottom half)
    PUPPY_TILE_H: 120,       // wysokość kafla
    PUPPY_TILE_W: 210,       // docelowa szerokość kafla (grid min)
    PUPPY_GAP: 10,
    PUPPY_PAD: 14,
    PUPPY_OPACITY: 0.22,
    PUPPY_RADIUS: 14,

    // “Pesos vibe” — delikatne przyciemnienie, bez rozwalania layoutu
    DIM_UI: false, // jak chcesz, ustaw true
    DIM_PANEL_BG: "rgba(0,0,0,.55)",
    DIM_TILE_BG: "rgba(0,0,0,.22)",
  };

  const ASSETS = {
    images: [
      "/static/bingo/images/nataliagl131/astarion1.gif",
      "/static/bingo/images/nataliagl131/astarion2.gif",
      "/static/bingo/images/nataliagl131/astarion3.gif",
      "/static/bingo/images/nataliagl131/astarion5.gif",
      "/static/bingo/images/nataliagl131/astarion6.gif",
      "/static/bingo/images/nataliagl131/happy_puppy2.gif",
      "/static/bingo/images/nataliagl131/happy_puppy2.jpg",
      "/static/bingo/images/nataliagl131/puppy2.jpg",
      "/static/bingo/images/nataliagl131/puppy3.jpg",
    ],
  };

  const BG = {
    TOP: "/static/bingo/images/nataliagl131/bgtop.jpg",
    BOTTOM_POOL: ASSETS.images.filter((x) => /puppy/i.test(x)),
  };

  function getJSONScript(id, fallback = null) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    try {
      return JSON.parse(el.textContent || "null");
    } catch {
      return fallback;
    }
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }
  function pickOne(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }
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
    return (
      tag === "TEXTAREA" ||
      (tag === "INPUT" &&
        ["text", "search", "email", "password"].includes(el.type))
    );
  }

  whenRuntime(() => {
    window.BingoUserPlugin = {
      init(api) {
        const { ctx } = api;
        const root = document.getElementById("plugin-root");
        if (!root) return;

        // ambient playlist (jak u Pesosa)
        const pluginSfx = getJSONScript("plugin-sfx", {}) || {};
        const ambientList = Array.isArray(pluginSfx?.ambient)
          ? pluginSfx.ambient.filter(Boolean)
          : [];

        const style = document.createElement("style");
style.textContent = `
${CFG.RESET_2SIGMY ? `
/* reset "2sigmy" jak u Pesosa */
body::before,
body::after{
  background-image: none !important;
  opacity: 0 !important;
  content: "" !important;
}
` : ""}

${CFG.DIM_UI ? `
/* (opcjonalnie) delikatne przyciemnienie UI */
.panel{
  background: ${CFG.DIM_PANEL_BG} !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.grid-cell, .cell-wrapper, .raffle-tile{
  background: ${CFG.DIM_TILE_BG} !important;
}
` : ""}

/* === tło pluginu: pod UI, nad body === */
.ast-bg{
  position: fixed;
  inset: 0;
  z-index: 0;            /* NISKO: pod UI */
  pointer-events: none;
}

/* góra: Astarion – bardziej “obecny”, lekko wyciągnięty w pionie */
.ast-top{
  position: absolute;
  top: 0; left: 0; right: 0;

  /* jak chcesz +1 rząd piesków: daj 44/56 */
  height: 44vh;

  background-image: url("${BG.TOP}");
  background-repeat: no-repeat;

  /* klucz: nie “topi się” i nie wygląda jak daleko w tle */
  background-position: center 15%;
  background-size: cover;

  opacity: 0.42;
  filter: contrast(1.14) saturate(1.10);

  transform: scaleY(1.10);
  transform-origin: top center;

  /* maska mniej agresywna (Twoja poprzednia 55% zjadała go w pół) */
  -webkit-mask-image: linear-gradient(
    to bottom,
    rgba(0,0,0,1) 0%,
    rgba(0,0,0,1) 82%,
    rgba(0,0,0,0) 100%
  );
  mask-image: linear-gradient(
    to bottom,
    rgba(0,0,0,1) 0%,
    rgba(0,0,0,1) 82%,
    rgba(0,0,0,0) 100%
  );
}

/* dół: grid piesków */
.ast-bottom{
  position: absolute;
  left: 0; right: 0; bottom: 0;

  /* para do góry: 56vh = zwykle wchodzi dodatkowy rząd */
  height: 56vh;

  pointer-events: none;
  overflow: hidden;

  padding: ${CFG.PUPPY_PAD}px;
  box-sizing: border-box;

  opacity: ${CFG.PUPPY_OPACITY};

  /* żeby dół nie wyglądał jak “twardo ucięty” */
  -webkit-mask-image: linear-gradient(
    to bottom,
    rgba(0,0,0,1) 0%,
    rgba(0,0,0,1) 88%,
    rgba(0,0,0,0) 100%
  );
  mask-image: linear-gradient(
    to bottom,
    rgba(0,0,0,1) 0%,
    rgba(0,0,0,1) 88%,
    rgba(0,0,0,0) 100%
  );
}

/* grid layout */
.ast-puppygrid{
  width: 100%;
  height: 100%;
  display: grid;
  gap: ${CFG.PUPPY_GAP}px;

  grid-template-columns: repeat(auto-fill, minmax(${CFG.PUPPY_TILE_W}px, 1fr));
  grid-auto-rows: ${CFG.PUPPY_TILE_H}px;

  align-content: start;
}

.ast-puppytile{
  width: 100%;
  height: 100%;
  border-radius: ${CFG.PUPPY_RADIUS}px;
  overflow: hidden;

  background: rgba(255,255,255,.04);
  outline: 1px solid rgba(255,255,255,.08);
  box-shadow: 0 10px 28px rgba(0,0,0,.35);
}

.ast-puppytile img{
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* ===== typing wave (NAD WSZYSTKIM) ===== */
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

        // ===== BG wrapper (pod UI) =====
        const bgWrap = document.createElement("div");
        bgWrap.className = "ast-bg";
        root.appendChild(bgWrap);

        const top = document.createElement("div");
        top.className = "ast-top";
        bgWrap.appendChild(top);

        const bottom = document.createElement("div");
        bottom.className = "ast-bottom";
        bgWrap.appendChild(bottom);

        // toggle: basic bg => usuń dół
        if (CFG.BG_MODE !== "PUPPIES") {
          bottom.style.display = "none";
        }

        // puppies grid (tylko jeśli włączone)
        const puppyGrid = document.createElement("div");
        puppyGrid.className = "ast-puppygrid";
        bottom.appendChild(puppyGrid);

        function computePuppyTileCount() {
          const w = Math.max(320, window.innerWidth || 1200);
          const h = Math.max(240, Math.floor((window.innerHeight || 800) * 0.5));

          const pad2 = CFG.PUPPY_PAD * 2;
          const usableW = Math.max(1, w - pad2);
          const usableH = Math.max(1, h - pad2);

          // kolumny wynikają z min szerokości tile, ale tu liczymy “ile sensownie wypełnić”
          const colGuess = Math.max(1, Math.floor((usableW + CFG.PUPPY_GAP) / (CFG.PUPPY_TILE_W + CFG.PUPPY_GAP)));
          const rowGuess = Math.max(1, Math.floor((usableH + CFG.PUPPY_GAP) / (CFG.PUPPY_TILE_H + CFG.PUPPY_GAP)));

          // wypełnij 100% siatki
          return colGuess * rowGuess;
        }

        function buildPuppyStripsOnce() {
          if (CFG.BG_MODE !== "PUPPIES") return;
          puppyGrid.textContent = "";

          if (!BG.BOTTOM_POOL.length) return;

          const n = computePuppyTileCount();

          // “worek” wymieszany — powtórki dozwolone, ale nie “ten sam obok siebie non stop”
          let bag = [];
          while (bag.length < n) bag = bag.concat(shuffle(BG.BOTTOM_POOL));

          // proste zabezpieczenie: unikaj identycznych sąsiadów w kolejności
          for (let i = 1; i < bag.length; i++) {
            if (bag[i] === bag[i - 1] && BG.BOTTOM_POOL.length > 1) {
              // swap z kimś dalej
              for (let j = i + 1; j < bag.length; j++) {
                if (bag[j] !== bag[i - 1]) {
                  const tmp = bag[i];
                  bag[i] = bag[j];
                  bag[j] = tmp;
                  break;
                }
              }
            }
          }

          for (let i = 0; i < n; i++) {
            const tile = document.createElement("div");
            tile.className = "ast-puppytile";

            const img = document.createElement("img");
            img.alt = "";
            img.draggable = false;
            img.loading = "lazy";
            img.src = bag[i];

            tile.appendChild(img);
            puppyGrid.appendChild(tile);
          }
        }

        buildPuppyStripsOnce();
        ctx.on(window, "resize", () => {
          // przebuduj siatkę, bo zmienia się liczba tile w widoku (bez migania w trakcie pisania)
          buildPuppyStripsOnce();
        });

        // ===== overlay layer (NAD UI) =====
        const layer = document.createElement("div");
        layer.className = "ast-layer";
        root.appendChild(layer);

        // ===== AUDIO: start po pierwszym klik/klawisz/input, NIE pauzujemy na focus/visibility =====
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

        // ===== typing wave =====
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
          chosenPool = chosenPool.filter((x) => set.has(x));
        }

        function growChosenPoolTo(count) {
          rebuildIfAssetsChanged();

          if (count >= ASSETS.images.length) {
            chosenPool = ASSETS.images.slice();
            return;
          }

          while (chosenPool.length < count) {
            const chosenSet = new Set(chosenPool);
            const remaining = ASSETS.images.filter((x) => !chosenSet.has(x));
            if (!remaining.length) break;
            chosenPool.push(pickOne(remaining));
          }

          if (chosenPool.length > count) chosenPool = chosenPool.slice(0, count);
        }

        function placeRandomly(el) {
          const pad = 18;
          const x = Math.floor(
            rand(pad, Math.max(pad + 1, window.innerWidth - pad))
          );
          const y = Math.floor(
            rand(pad, Math.max(pad + 1, window.innerHeight - pad))
          );
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
          for (let i = count; i < imgs.length; i++)
            imgs[i].classList.remove("is-on");

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

        // init pool
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
          if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
          }
        });

        // visibilitychange: nie dotykamy audio
        ctx.on(document, "visibilitychange", () => {
          if (document.hidden) {
            for (const img of imgs) img.classList.remove("is-on");
            isOn = false;
          }
        });

        return () => {
          try { if (idleTimer) clearTimeout(idleTimer); } catch {}

          try {
            document.removeEventListener("pointerdown", startOnFirstUserInput, true);
            document.removeEventListener("keydown", startOnFirstUserInput, true);
            document.removeEventListener("input", startOnFirstUserInput, true);
          } catch {}
          try { audio.pause(); } catch {}

          try { layer.remove(); } catch {}
          try { bgWrap.remove(); } catch {}
          try { style.remove(); } catch {}
        };
      },
    };
  });
})();
