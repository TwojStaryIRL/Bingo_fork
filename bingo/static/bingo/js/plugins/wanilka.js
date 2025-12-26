(() => {
  function whenReady(fn) {
    if (window.BingoPluginRuntime?.initUserPlugin) return fn();
    const t = setInterval(() => {
      if (window.BingoPluginRuntime?.initUserPlugin) {
        clearInterval(t);
        fn();
      }
    }, 40);
  }

  // ====== konfiguracja (tu sobie kręcisz gałkami) ======
  const CFG = {
    // czas lotu od lewej do punktu eksplozji (ms)
    FLIGHT_MS: 15000,

    // gdzie ma nastąpić eksplozja (0..1)
    EXPLODE_AT_X: 0.90,

    // rozmiar samolotu (px)
    PLANE_W: 220,

    // intensywność wstrząsu
    SHAKE_MS: 650,

    // czarna dziura: ile trwa wciąganie (ms)
    HOLE_EAT_MS: 2000,

    // po ilu ms od eksplozji podmienić stronę na kotki
    SWITCH_TO_POSTAPO_MS: 700,

    // ile kafli GIF na ekranie (większa wartość = mniejsze kafle)
    POSTAPO_TILE: 220,
  };

  // ====== assety (hardcode) ======
  // Ustaw tu ścieżki, jeśli masz inne. Najczęściej będzie:
  // /static/bingo/img/samolot.jpg
  // /static/bingo/gif/postapo.gif
  const ASSETS = {
    plane: [
      "/static/bingo/images/wanilka/samolot.jpg",
    ],
    postapo: [
      "/static/bingo/images/wanilka/dancing.gif",
    ],
  };

  function pickFirstWorkingUrl(urls) {
    // bez fetchowania (CORS/HEAD różnie bywa); bierzemy pierwszą, a jak nie zadziała to onerror przeskoczy
    return urls[0];
  }

  whenReady(() => {
    window.BingoUserPlugin = {
      init(api) {
        const { ctx } = api;

        const root = document.getElementById("plugin-root");
        if (!root) return;

        // ===== styles =====
        const style = document.createElement("style");
        style.textContent = `
#plugin-root { position: relative; z-index: 2147483000; }
.plugin-overlay {
  position: fixed; inset: 0;
  pointer-events: none;
}
.plugin-plane {
  position: fixed;
  width: ${CFG.PLANE_W}px;
  height: auto;
  left: 0; top: 0;
  transform: translate(-9999px, -9999px);
  will-change: transform, opacity, filter;
  filter: drop-shadow(0 12px 22px rgba(0,0,0,.42));
  opacity: 1;
}
.plugin-flash {
  position: fixed; inset: 0;
  background: rgba(255,255,255,0);
  pointer-events: none;
}
.plugin-flash.is-on {
  animation: pluginFlash 260ms ease-out 1;
}
@keyframes pluginFlash {
  0% { background: rgba(255,255,255,0); }
  28% { background: rgba(255,255,255,.95); }
  100% { background: rgba(255,255,255,0); }
}
@keyframes pluginShake {
  0% { transform: translate(0,0) rotate(0deg); }
  10% { transform: translate(-10px, 3px) rotate(-.5deg); }
  25% { transform: translate(12px,-7px) rotate(.7deg); }
  40% { transform: translate(-11px, 8px) rotate(-.6deg); }
  55% { transform: translate(9px,-5px) rotate(.45deg); }
  70% { transform: translate(-6px, 4px) rotate(-.25deg); }
  100% { transform: translate(0,0) rotate(0deg); }
}
.plugin-shake-target.is-shaking {
  animation: pluginShake ${CFG.SHAKE_MS}ms cubic-bezier(.2,.9,.2,1) 1;
}

.plugin-hole {
  position: fixed;
  width: 14px; height: 14px;
  border-radius: 999px;
  transform: translate(-50%, -50%) scale(0.1);
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.14), rgba(0,0,0,1) 62%);
  box-shadow: 0 0 80px rgba(0,0,0,.75);
  opacity: 0;
  will-change: transform, opacity;
}
.plugin-hole.is-on {
  opacity: 1;
  animation: holeGrow ${CFG.HOLE_EAT_MS}ms cubic-bezier(.2,.9,.2,1) 1 forwards;
}
@keyframes holeGrow {
  0%   { transform: translate(-50%, -50%) scale(0.1); }
  100% { transform: translate(-50%, -50%) scale(30); }
}

.plugin-destroy {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0);
  pointer-events: none;
  opacity: 0;
}
.plugin-destroy.is-on {
  opacity: 1;
  background: rgba(0,0,0,1);
  transition: background 220ms ease-out, opacity 220ms ease-out;
}

.plugin-postapo {
  position: fixed; inset: 0;
  pointer-events: auto;
  z-index: 2147483647;
  background: #000;
}
        `;
        document.head.appendChild(style);

        const overlay = document.createElement("div");
        overlay.className = "plugin-overlay";
        root.appendChild(overlay);

        const plane = document.createElement("img");
        plane.className = "plugin-plane";
        plane.alt = "";
        overlay.appendChild(plane);

        const flash = document.createElement("div");
        flash.className = "plugin-flash";
        overlay.appendChild(flash);

        const hole = document.createElement("div");
        hole.className = "plugin-hole";
        overlay.appendChild(hole);

        const destroy = document.createElement("div");
        destroy.className = "plugin-destroy";
        overlay.appendChild(destroy);

        // asset fallback: jak ścieżka zła, próbuj następnej
        let planeIdx = 0;
        function setPlaneSrc() {
          plane.src = ASSETS.plane[planeIdx] || pickFirstWorkingUrl(ASSETS.plane);
        }
        plane.onerror = () => {
          planeIdx += 1;
          if (planeIdx < ASSETS.plane.length) setPlaneSrc();
        };
        setPlaneSrc();

        let postapoIdx = 0;
        function getPostapoUrl() {
          return ASSETS.postapo[postapoIdx] || pickFirstWorkingUrl(ASSETS.postapo);
        }

        function doFlash() {
          flash.classList.remove("is-on");
          void flash.offsetWidth;
          flash.classList.add("is-on");
        }

        function shake() {
          const t = document.querySelector(".panel") || document.body;
          t.classList.add("plugin-shake-target", "is-shaking");
          ctx.setTimeoutSafe(() => t.classList.remove("is-shaking"), CFG.SHAKE_MS + 80);
        }

        function explodeAt(x, y) {
          doFlash();
          shake();

          // ustaw dziurę dokładnie w miejscu eksplozji
          hole.style.left = x + "px";
          hole.style.top = y + "px";
          hole.classList.remove("is-on");
          void hole.offsetWidth;
          hole.classList.add("is-on");

          // ciemniej = “zjadanie”
          destroy.classList.add("is-on");

          // zniknij samolot
          plane.style.opacity = "0";
        }

        function wipePageToPostapo() {
          // ukryj wszystko poza overlayem
          const html = document.documentElement;
          const body = document.body;

          // wyłącz scroll i interakcje strony
          html.style.overflow = "hidden";
          body.style.overflow = "hidden";

          // "wymaż" stronę: schowaj wszystkie dzieci body poza plugin-root
          const keep = new Set([root]);
          Array.from(body.children).forEach((ch) => {
            if (!keep.has(ch)) ch.style.display = "none";
          });

          // stwórz postapo wall
          const post = document.createElement("div");
          post.className = "plugin-postapo";

          // kafelkowanie gifów (kotki)
          post.style.backgroundImage = `url("${getPostapoUrl()}")`;
          post.style.backgroundRepeat = "repeat";
          post.style.backgroundSize = `${CFG.POSTAPO_TILE}px ${CFG.POSTAPO_TILE}px`;

          // jak gif url zły, próbuj kolejnej ścieżki
          post.onerror = null; // (div nie ma onerror)
          // więc robimy trik: pre-load img i jak fail, zmieniamy url
          const imgProbe = new Image();
          imgProbe.onload = () => {};
          imgProbe.onerror = () => {
            postapoIdx += 1;
            if (postapoIdx < ASSETS.postapo.length) {
              post.style.backgroundImage = `url("${getPostapoUrl()}")`;
              const p2 = new Image();
              p2.src = getPostapoUrl();
            }
          };
          imgProbe.src = getPostapoUrl();

          body.appendChild(post);
        }

        async function run() {
          // start lotu: losowa wysokość
          const y = Math.max(60, Math.min(window.innerHeight - 160, window.innerHeight * (0.18 + Math.random() * 0.35)));

          const startX = -CFG.PLANE_W - 40;
          const explodeX = Math.floor(window.innerWidth * CFG.EXPLODE_AT_X);
          const endX = explodeX; // kończymy lot dokładnie w punkcie eksplozji
          const planeRot = 8 + Math.random() * 6;

          plane.style.opacity = "1";
          plane.style.transform = `translate(${startX}px, ${y}px) rotate(${planeRot}deg)`;

          // animacja lotu
          const fly = plane.animate(
            [
              { transform: `translate(${startX}px, ${y}px) rotate(${planeRot}deg)` },
              { transform: `translate(${endX}px, ${y - 18}px) rotate(${planeRot - 3}deg)` },
            ],
            {
              duration: CFG.FLIGHT_MS,
              easing: "cubic-bezier(.2,.9,.2,1)",
              fill: "forwards",
            }
          );

          await fly.finished.catch(() => {});
          fly.cancel();

          // eksplozja przy 90%
          const explodeY = y - 18 + (CFG.PLANE_W * 0.12);
          explodeAt(explodeX, explodeY);

          // daj chwilę na “zjedzenie”
          ctx.setTimeoutSafe(() => wipePageToPostapo(), CFG.SWITCH_TO_POSTAPO_MS);
        }

        // odpal raz po wejściu
        ctx.setTimeoutSafe(() => run(), 650);

        // i opcjonalnie: na klik save też
        const saveBtn = document.getElementById("save-btn");
        if (saveBtn) {
          ctx.on(saveBtn, "click", () => ctx.setTimeoutSafe(() => run(), 120));
        }

        return () => {
          try { overlay.remove(); } catch {}
          try { style.remove(); } catch {}
        };
      }
    };
  });
})();
