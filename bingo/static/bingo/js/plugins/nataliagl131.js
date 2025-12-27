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
    MAX_ON_SCREEN: 8,
    SCALE_MIN: 0.26,
    SCALE_MAX: 0.37,
    OPACITY: 0.55,
  };

  const ASSETS = {
    images: [
      "/static/bingo/images/nataliagl131/astarion1.gif",
      "/static/bingo/images/nataliagl131/astarion2.gif",
      "/static/bingo/images/nataliagl131/astarion3.gif",
      "/static/bingo/images/nataliagl131/astarion4.jpg",
      "/static/bingo/images/nataliagl131/astarion5.gif",
      "/static/bingo/images/nataliagl131/astarion6.gif",
      "/static/bingo/images/nataliagl131/happy_puppy2.gif",
      "/static/bingo/images/nataliagl131/piesek.jpg",
    ],
  };

  function rand(min, max) { return min + Math.random() * (max - min); }

  // losuj 1 element z tablicy (zakładamy, że tablica niepusta)
  function pickOne(arr) {
    return arr[(Math.random() * arr.length) | 0];
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

        const style = document.createElement("style");
        style.textContent = `
#plugin-root { position: relative; z-index: 2147483000; }
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

        const layer = document.createElement("div");
        layer.className = "ast-layer";
        root.appendChild(layer);

        // ===== state =====
        let idleTimer = null;
        let iter = 0;
        let isOn = false;

        const imgs = [];

        // >>> TO JEST KLUCZ: rosnąca pula bez powtórek
        let chosenPool = [];

        function countForIter(it) {
          return Math.min(CFG.MAX_ON_SCREEN, Math.max(1, it + 1));
        }

        function rebuildIfAssetsChanged() {
          // jeśli kiedyś zmienisz ASSETS.images w locie, to to zabezpiecza przed dziwnymi stanami
          const set = new Set(ASSETS.images);
          chosenPool = chosenPool.filter(x => set.has(x));
        }

        function growChosenPoolTo(count) {
          rebuildIfAssetsChanged();

          // jeśli count >= liczby assetów → bierzemy WSZYSTKIE (zero losowania z 8)
          if (count >= ASSETS.images.length) {
            chosenPool = ASSETS.images.slice();
            return;
          }

          // inaczej: dobieramy z "remaining" aż osiągniemy count
          while (chosenPool.length < count) {
            const chosenSet = new Set(chosenPool);
            const remaining = ASSETS.images.filter(x => !chosenSet.has(x));

            if (!remaining.length) break; // safety

            chosenPool.push(pickOne(remaining));
          }

          // (gdyby kiedykolwiek count spadł — nie powinno, ale tnijmy)
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

          // upewnij się, że pula ma dokładnie `count` unikalnych
          growChosenPoolTo(count);

          // tylko przy "pierwszym show po przerwie" ustawiamy src/pozycje,
          // żeby nie migało przy każdym keydown
          if (!isOn) {
            for (let i = 0; i < count; i++) {
              const img = imgs[i];
              img.src = chosenPool[i];   // <- zero powtórek w trakcie eskalacji
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

          // "oderwanie" → iter++
          iter = Math.min(CFG.MAX_ON_SCREEN - 1, iter + 1);

          // WAŻNE: teraz nie losujemy całej puli od zera,
          // tylko na następną falę "dorośnie" o 1 brakujący element.
          // (czyli powtórki znikają)
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
          }
        });

        return () => {
          try { if (idleTimer) clearTimeout(idleTimer); } catch {}
          try { layer.remove(); } catch {}
          try { style.remove(); } catch {}
        };
      }
    };
  });
})();
