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
    IDLE_MS: 500,         // po ilu ms bez klawisza uznajemy "koniec pisania"
    MAX_ON_SCREEN: 8,     // max obrazków naraz
    SCALE_MIN: 0.45,
    SCALE_MAX: 1.05,
    OPACITY: 0.95,
  };

  const ASSETS = {
    images: [
      "/static/bingo/images/nataliagl131/astarion1.gif",
      "/static/bingo/images/nataliagl131/astarion2.gif",
      "/static/bingo/images/nataliagl131/astarion3.gif",
      "/static/bingo/images/nataliagl131/astarion4.gif",
      "/static/bingo/images/nataliagl131/astarion5.gif",
      "/static/bingo/images/nataliagl131/astarion6.gif",
      "/static/bingo/images/nataliagl131/astarion7.gif",
      "/static/bingo/images/nataliagl131/astarion8.gif",
    ],
  };

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

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

        // ===== styles =====
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
        let iter = 0;        // liczba "oderwań" od klawiatury
        let isOn = false;

        // trzymamy referencje do obrazków, żeby tylko je pokazywać/ukrywać
        const imgs = [];

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
            img.onerror = () => {
              // jak obrazek się nie wczyta, chowamy go żeby nie wisiał "pusty"
              img.classList.remove("is-on");
            };
            imgs.push(img);
            layer.appendChild(img);
          }
        }

        function showWave() {
          if (!ASSETS.images.length) return;

          // iter rośnie przy "oderwaniu", więc w trakcie pisania pokazujemy iter+1
          const count = Math.min(CFG.MAX_ON_SCREEN, Math.max(1, iter + 1));
          ensurePoolSize(count);

          // pokazujemy dokładnie `count` obrazków
          for (let i = 0; i < count; i++) {
            const img = imgs[i];

            // przy pierwszym show po przerwie losujemy nowe gify i pozycje
            // (żeby nie migało przy każdym keydown)
            if (!isOn) {
              img.src = pick(ASSETS.images);
              placeRandomly(img);
            }

            img.classList.add("is-on");
          }

          // resztę (jeśli pool większy z poprzednich fal) chowamy
          for (let i = count; i < imgs.length; i++) {
            imgs[i].classList.remove("is-on");
          }

          isOn = true;
        }

        function hideAllAndCountBreak() {
          if (!isOn) return;

          for (const img of imgs) img.classList.remove("is-on");
          isOn = false;

          // to jest "oderwanie" → eskalacja na następną falę
          iter = Math.min(CFG.MAX_ON_SCREEN - 1, iter + 1);
        }

        function scheduleHide() {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = ctx.setTimeoutSafe(() => {
            idleTimer = null;
            hideAllAndCountBreak();
          }, CFG.IDLE_MS);
        }

        // ===== events =====
        ctx.on(document, "keydown", (e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return;

          const ae = document.activeElement;
          if (!isTypingTarget(ae)) return;

          showWave();     // pokazuj podczas pisania
          scheduleHide(); // a po przerwie zgaś + podbij iter
        });

        // input łapie też wklejanie, autouzupełnianie itd.
        ctx.on(document, "input", () => {
          const ae = document.activeElement;
          if (!isTypingTarget(ae)) return;

          showWave();
          scheduleHide();
        });

        // klik poza input: natychmiast chowamy, ale NIE liczymy jako "oderwanie od klawiatury"
        ctx.on(document, "pointerdown", () => {
          const ae = document.activeElement;
          if (!isTypingTarget(ae)) {
            for (const img of imgs) img.classList.remove("is-on");
            isOn = false;
          }
          if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
        });

        // jak karta znika, chowamy (bez eskalacji)
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
