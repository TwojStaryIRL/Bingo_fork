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
    // po ilu ms bez klawisza uznajemy "oderwanie" od pisania
    IDLE_MS: 500,

    // ile max "oderwań" liczymy (potem już nie eskaluje)
    MAX_ITERS: 9,

    // ile ms ma żyć jeden obrazek (potem znika)
    LIFE_MS: 1800,

    // max obrazków jednocześnie w DOM (ochrona przed lagiem)
    MAX_ON_SCREEN: 8,

    // skala obrazków (losowo w tym zakresie)
    SCALE_MIN: 0.45,
    SCALE_MAX: 1.05,

    // przezroczystość obrazków
    OPACITY: 0.95,

    // placeholder na muzykę w tle (na razie nic)
    // możesz potem wpiąć przez sfx i odpalać po pierwszym kliknięciu jak w poprzednich pluginach
    BG_MUSIC_SFX_KEY: "", // np. "bg_music"
  };

  const ASSETS = {
    // tu wrzuć ścieżki do obrazków (może być 1 albo wiele)
    images: [
      "/static/bingo/images/USER_X/wtf1.png",
      "/static/bingo/images/USER_X/wtf2.png",
      "/static/bingo/images/USER_X/wtf3.png",
    ],
  };

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "TEXTAREA" || (tag === "INPUT" && (el.type === "text" || el.type === "search" || el.type === "email" || el.type === "password"));
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
.wtf-layer{
  position: fixed; inset: 0;
  pointer-events: none;
  z-index: 2147483646;
  overflow: hidden;
}
.wtf-img{
  position: fixed;
  left: 0; top: 0;
  will-change: transform, opacity;
  filter: drop-shadow(0 16px 30px rgba(0,0,0,.45));
  user-select: none;
}
@keyframes wtfPop {
  0%   { transform: translate(var(--x), var(--y)) scale(var(--s)) rotate(var(--r)); opacity: 0; }
  12%  { transform: translate(var(--x), var(--y)) scale(calc(var(--s) * 1.05)) rotate(var(--r)); opacity: var(--o); }
  100% { transform: translate(var(--x), var(--y)) scale(var(--s)) rotate(var(--r)); opacity: 0; }
}
        `;
        document.head.appendChild(style);

        const layer = document.createElement("div");
        layer.className = "wtf-layer";
        root.appendChild(layer);

        // ===== state =====
        let iter = 0;
        let idleTimer = null;
        let onScreen = 0;

        function spawnOne() {
          if (!ASSETS.images.length) return;
          if (onScreen >= CFG.MAX_ON_SCREEN) return;

          const img = document.createElement("img");
          img.className = "wtf-img";
          img.alt = "";
          img.src = pick(ASSETS.images);

          // pozycjonowanie: losowo, ale tak żeby w większości było na ekranie
          const pad = 18;
          const x = Math.floor(rand(pad, window.innerWidth - pad));
          const y = Math.floor(rand(pad, window.innerHeight - pad));
          const s = rand(CFG.SCALE_MIN, CFG.SCALE_MAX);
          const r = Math.floor(rand(-18, 18)) + "deg";

          img.style.setProperty("--x", `${x}px`);
          img.style.setProperty("--y", `${y}px`);
          img.style.setProperty("--s", `${s}`);
          img.style.setProperty("--r", r);
          img.style.setProperty("--o", `${CFG.OPACITY}`);

          // animacja “pojaw się i zniknij”
          img.style.animation = `wtfPop ${CFG.LIFE_MS}ms ease-out 1 forwards`;

          onScreen += 1;
          layer.appendChild(img);

          // sprzątanie
          ctx.setTimeoutSafe(() => {
            try { img.remove(); } catch {}
            onScreen = Math.max(0, onScreen - 1);
          }, CFG.LIFE_MS + 60);

          // jeśli src walnięty — usuń szybciej
          img.onerror = () => {
            try { img.remove(); } catch {}
            onScreen = Math.max(0, onScreen - 1);
          };
        }

        function spawnWave(count) {
          for (let i = 0; i < count; i++) spawnOne();
        }

        function onIdleBreak() {
          iter = Math.min(CFG.MAX_ITERS, iter + 1);
          spawnWave(iter); // eskalacja: im więcej przerw, tym więcej obrazków
        }

        function scheduleIdle() {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = ctx.setTimeoutSafe(() => {
            idleTimer = null;
            onIdleBreak();
          }, CFG.IDLE_MS);
        }

        // “startTyping” = dowolny klawisz gdy fokus jest w polu tekstowym
        ctx.on(document, "keydown", (e) => {
          // ignoruj np. ctrl/alt itp, żeby nie naliczać skrótów
          if (e.ctrlKey || e.metaKey || e.altKey) return;

          const ae = document.activeElement;
          if (!isTypingTarget(ae)) return;

          scheduleIdle();
        });

        // opcjonalnie: gdy user kliknie gdzieś poza input, nie naliczaj przerwy
        ctx.on(document, "pointerdown", () => {
          if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
        });

        return () => {
          try { if (idleTimer) clearTimeout(idleTimer); } catch {}
          try { layer.remove(); } catch {}
          try { style.remove(); } catch {}
        };
      }
    };

    // nie musisz wołać initUserPlugin() tutaj, bo game.js już to robi po DOMContentLoaded
    // ale jeśli chcesz plugin “self-running” na innych stronach, możesz odkomentować:
    // window.BingoPluginRuntime?.initUserPlugin?.();
  });
})();
