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

  // tło: góra = Astarion, dół = losowe "puppy" z ASSETS.images
  const BG = {
    TOP: "/static/bingo/images/nataliagl131/astarionbg.gif",
    BOTTOM_POOL: ASSETS.images.filter(x => /puppy/i.test(x)),
    // co ile ms ma się zmieniać losowy piesek w tle (dół)
    PUPPY_ROTATE_MS: 900,
    // rozmiar "kafelków" w tle (dół)
    PUPPY_TILE: 240,
  };

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pickOne(arr) { return arr[(Math.random() * arr.length) | 0]; }

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

        const style = document.createElement("style");
        style.textContent = `
#plugin-root { position: relative; z-index: 2147483000; }

/* ===== background split (TOP/BOTTOM) ===== */
.ast-bg{
  position: fixed;
  inset: 0;
  z-index: 2147483644;
  pointer-events: none;
}

/* górna połowa: NIE przycinamy - rozciągamy na 50vh */
.ast-bg::before{
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 50vh;

  background-image: var(--top-bg);
  background-repeat: no-repeat;
  background-position: center top;

  /* klucz: rozciągnij na całą górną połowę (może zniekształcać, ale nie ucina) */
  background-size: 100% 100%;

  opacity: 0.35;
}

/* dolna połowa – puppy pattern (losowo zmieniany) */
.ast-bg::after{
  content: "";
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 50vh;

  background-image: var(--puppy-bg);
  background-repeat: repeat;
  background-size: var(--puppy-tile) var(--puppy-tile);

  opacity: 0.30;
}

/* ===== floating images ===== */
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

        // background layer (pod gifami)
        const bg = document.createElement("div");
        bg.className = "ast-bg";
        root.appendChild(bg);

        // floating layer (gify)
        const layer = document.createElement("div");
        layer.className = "ast-layer";
        root.appendChild(layer);

        // ustaw TOP bg z configu
        bg.style.setProperty("--top-bg", `url("${BG.TOP}")`);
        bg.style.setProperty("--puppy-tile", `${BG.PUPPY_TILE}px`);

        // ===== losowe pieski na dole (rotacja co N ms) =====
        let puppyTimer = null;
        let lastPuppy = null;

        function setRandomPuppyBG() {
          if (!BG.BOTTOM_POOL.length) return;
          if (BG.BOTTOM_POOL.length === 1) {
            bg.style.setProperty("--puppy-bg", `url("${BG.BOTTOM_POOL[0]}")`);
            return;
          }

          // unikaj wylosowania tego samego 2x z rzędu
          let img = pickOne(BG.BOTTOM_POOL);
          let guard = 0;
          while (img === lastPuppy && guard++ < 12) img = pickOne(BG.BOTTOM_POOL);

          lastPuppy = img;
          bg.style.setProperty("--puppy-bg", `url("${img}")`);
        }

        function startPuppyRotation() {
          setRandomPuppyBG();
          if (puppyTimer) ctx.clearIntervalSafe?.(puppyTimer);
          // Bingo ctx może nie mieć clearIntervalSafe; fallback do clearInterval
          puppyTimer = ctx.setIntervalSafe
            ? ctx.setIntervalSafe(setRandomPuppyBG, BG.PUPPY_ROTATE_MS)
            : setInterval(setRandomPuppyBG, BG.PUPPY_ROTATE_MS);
        }

        function stopPuppyRotation() {
          if (!puppyTimer) return;
          if (ctx.clearIntervalSafe) ctx.clearIntervalSafe(puppyTimer);
          else clearInterval(puppyTimer);
          puppyTimer = null;
        }

        // start rotacji piesków od razu
        startPuppyRotation();

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
            // jak karta ukryta, wstrzymaj rotację (mniej mieli CPU)
            stopPuppyRotation();
          } else {
            startPuppyRotation();
          }
        });

        return () => {
          try { if (idleTimer) clearTimeout(idleTimer); } catch {}
          try { stopPuppyRotation(); } catch {}
          try { layer.remove(); } catch {}
          try { bg.remove(); } catch {}
          try { style.remove(); } catch {}
        };
      }
    };
  });
})();
