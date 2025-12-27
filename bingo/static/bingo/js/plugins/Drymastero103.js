(() => {
  // ====== DRYMASTERO103 - Visual Tile Thief Plugin ======
  // Wymagania:
  // 1) Pojawia się PNG (z lewej lub prawej), nad nim tekst znika po 3s
  // 2) Po 3s "znika" losowy kafelek (wizualnie) - przenosimy jego DOM do overlay
  // 3) Na dole napis: "Traf tego, który myśli, że ci to zabrał."
  // 4) Po zabraniu kafelka pojawiają się 2 ruchome PNG na różnych wysokościach:
  //    - PNG2: NIE MOŻE iść z PRAWEJ do LEWEJ (czyli zawsze L->P)
  //      klik = kafelek wraca
  //    - PNG3: może iść w obie strony, klik = popup "wybrałeś złą osobę" (OK)
  //
  // To jest 100% wizualne: kafelek wraca z poprzednim stanem, bo przenosimy node.

  const CFG = {
    // podmień na swoje realne ścieżki do obrazków (static)
    IMG1: "/static/bingo/images/Drymastero103/czarny.png",
    IMG2: "/static/bingo/images/Drymastero103/czarnyidzie.jpg",
    IMG3: "/static/bingo/images/Drymastero103/bialy.jpg",

    INTRO_TEXT: "Hej odwróć się na chwilę!",
    BOTTOM_TEXT: "Klikniecie = strzał",

    WRONG_PICK_TEXT: "Whadesigma?",

    INTRO_TEXT_HIDE_MS: 3000,
    AFTER_STEAL_DELAY_MS: 650,

    RUN_DURATION_MS: 5200,  // czas przelotu
    RUN_GAP_MS: 900,        // przerwa między przelotami (jeśli kafelek dalej zabrany)

    // wysokości (vh) dla runnerów - różne poziomy
    RUNNER2_TOP_VH: 22,
    RUNNER3_TOP_VH: 46,
    STEAL_EVERY_MS: 60_000,
    // rozmiary (możesz dopasować)
    INTRO_W: 180,
    INTRO_H: 180,
    RUNNER_W: 160,
    RUNNER_H: 160,
  };

  function whenRuntime(fn) {
    if (window.BingoPluginRuntime?.initUserPlugin) return fn();
    const t = setInterval(() => {
      if (window.BingoPluginRuntime?.initUserPlugin) {
        clearInterval(t);
        fn();
      }
    }, 40);
  }

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pickSide() {
    return Math.random() < 0.5 ? "left" : "right";
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function makeEl(tag, cls, attrs = {}) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    Object.entries(attrs).forEach(([k, val]) => {
      if (val == null) return;
      if (k === "text") el.textContent = String(val);
      else el.setAttribute(k, String(val));
    });
    return el;
  }

  function animateRunner(el, { fromX, toX, topPx, duration, onDone }) {
    const start = performance.now();
    const dx = toX - fromX;

    function tick(now) {
      const t = clamp((now - start) / duration, 0, 1);
      const x = fromX + dx * t;
      el.style.transform = `translate3d(${x}px, ${topPx}px, 0)`;
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        onDone?.();
      }
    }
    requestAnimationFrame(tick);
  }

  whenRuntime(() => {
    window.BingoUserPlugin = {
      init(api) {
        const { ctx, tiles } = api;
        const root = document.getElementById("plugin-root");
        if (!root) return;

        // ===== STYLE =====
        const style = document.createElement("style");
        style.textContent = `
#plugin-root { position: relative; z-index: 2147483000; }

/* overlay nie blokuje klików na stronę (runner ma własny pointer-events) */
.dry-overlay{
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  pointer-events: none;
}

.dry-intro{
  position: fixed;
  top: 18vh;
  z-index: 2147483647;
  pointer-events: none;
  display: grid;
  place-items: center;
}

.dry-intro .dry-bubble{
  position: absolute;
  top: -38px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,.72);
  color: #fff;
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 12px;
  padding: 8px 10px;
  font: 700 13px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial;
  white-space: nowrap;
  box-shadow: 0 14px 50px rgba(0,0,0,.45);
}

.dry-intro img{
  width: ${CFG.INTRO_W}px;
  height: ${CFG.INTRO_H}px;
  object-fit: contain;
  filter: drop-shadow(0 18px 40px rgba(0,0,0,.55));
}

/* Runner klikany */
.dry-runner{
  position: fixed;
  left: 0; top: 0;
  z-index: 2147483647;
  width: ${CFG.RUNNER_W}px;
  height: ${CFG.RUNNER_H}px;
  pointer-events: auto;
  cursor: pointer;
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 18px 40px rgba(0,0,0,.55));
}

.dry-bottom{
  position: fixed;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  z-index: 2147483647;
  pointer-events: none;
  background: rgba(0,0,0,.66);
  color: #fff;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 999px;
  padding: 10px 14px;
  font: 800 13px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial;
  letter-spacing: .2px;
  box-shadow: 0 18px 60px rgba(0,0,0,.45);
  opacity: 0;
  transition: opacity .22s ease;
}
.dry-bottom.is-on{ opacity: 1; }

/* delikatny slide-in intro */
@keyframes drySlideInLeft { from { transform: translateX(-220px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes drySlideInRight{ from { transform: translateX(220px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        `;
        document.head.appendChild(style);

        // ===== STATE =====
        const overlay = makeEl("div", "dry-overlay");
        root.appendChild(overlay);
        let nextStealTimer = null;

        let introWrap = null;
        let bottom = null;

        let stolen = null;        // wynik tiles.teleport(...)
        let stolenTd = null;      // kotwica, gdzie wraca
        let stealLocked = false;

        let runner2 = null;       // "dobry" - klik przywraca kafelek
        let runner3 = null;       // "zły"  - klik alert

        let runnerLoopTimer = null;
        let runnerLoopTimer2 = null;

        function cleanupIntro() {
          if (introWrap?.parentElement) introWrap.parentElement.removeChild(introWrap);
          introWrap = null;
        }

        function ensureBottom() {
          if (bottom) return bottom;
          bottom = makeEl("div", "dry-bottom", { text: CFG.BOTTOM_TEXT });
          overlay.appendChild(bottom);
          return bottom;
        }

        function setBottom(on) {
          const b = ensureBottom();
          b.classList.toggle("is-on", !!on);
        }

        function stealTileOnce() {
          if (stealLocked) return;
          stealLocked = true;

          const tile = tiles.pickRandom?.() || null;
          if (!tile) return;

          // tileWrapper siedzi w <td>; runtime robi placeholder i przenosi node
          stolenTd = tile.parentElement || null;
          stolen = tiles.teleport(tile);

          // chowamy "pływający" node (ale trzymamy go w overlay, żeby stan został)
          if (stolen?.floating) {
            stolen.floating.style.position = "fixed";
            stolen.floating.style.left = "-99999px";
            stolen.floating.style.top = "-99999px";
            stolen.floating.style.width = "0";
            stolen.floating.style.height = "0";
            stolen.floating.style.overflow = "hidden";
            stolen.floating.style.pointerEvents = "none";
          }

          setBottom(true);

          // po zabraniu odpalamy biegaczy
          ctx.setTimeoutSafe(() => {
            startRunners();
          }, CFG.AFTER_STEAL_DELAY_MS);
        }

        function restoreTile() {
          if (!stolen) return false;

          // oddaj kafelek dokładnie tam gdzie był (placeholder -> wrapper)
          tiles.return(stolen, stolenTd || null);
          stolen = null;
          stolenTd = null;

          // sprzątamy runnerów i dół
          stopRunners();
          setBottom(false);
          scheduleNextSteal();
          return true;
        }

        function stopRunners() {
  if (runnerLoopTimer) {
    clearTimeout(runnerLoopTimer);
    runnerLoopTimer = null;
  }

  if (runnerLoopTimer2) {
    clearTimeout(runnerLoopTimer2);
    runnerLoopTimer2 = null;
  }

  if (runner2?.parentElement) {
    runner2.parentElement.removeChild(runner2);
  }

  if (runner3?.parentElement) {
    runner3.parentElement.removeChild(runner3);
  }

  runner2 = null;
  runner3 = null;
}

        function spawnRunner2() {
          if (!stolen) return;

          const img = makeEl("img", "dry-runner", { src: CFG.IMG2, alt: "runner2" });
          img.style.top = `${Math.round(window.innerHeight * (CFG.RUNNER2_TOP_VH / 100))}px`;

          // runner2: ZAWSZE L->P (bo nie może iść P->L)
          const fromX = -CFG.RUNNER_W - 30;
          const toX = window.innerWidth + 30;

          overlay.appendChild(img);

          ctx.on(img, "click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            restoreTile();
          });

          animateRunner(img, {
            fromX,
            toX,
            topPx: Math.round(window.innerHeight * (CFG.RUNNER2_TOP_VH / 100)),
            duration: CFG.RUN_DURATION_MS,
            onDone: () => {
              try { img.remove(); } catch {}
              // jeśli nadal zabrany kafelek - zaplanuj kolejny przebieg
              if (stolen) {
                runnerLoopTimer = setTimeout(() => spawnRunner2(), CFG.RUN_GAP_MS);
              }
            }
          });

          runner2 = img;
        }

        function spawnRunner3() {
          if (!stolen) return;

          const img = makeEl("img", "dry-runner", { src: CFG.IMG3, alt: "runner3" });
          img.style.top = `${Math.round(window.innerHeight * (CFG.RUNNER3_TOP_VH / 100))}px`;

          // runner3: losowo L->P albo P->L
          const dir = Math.random() < 0.5 ? "L2R" : "R2L";
          const fromX = dir === "L2R" ? (-CFG.RUNNER_W - 30) : (window.innerWidth + 30);
          const toX = dir === "L2R" ? (window.innerWidth + 30) : (-CFG.RUNNER_W - 30);

          overlay.appendChild(img);

          ctx.on(img, "click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            // popup OK
            window.alert(CFG.WRONG_PICK_TEXT);
          });

          animateRunner(img, {
            fromX,
            toX,
            topPx: Math.round(window.innerHeight * (CFG.RUNNER3_TOP_VH / 100)),
            duration: CFG.RUN_DURATION_MS,
            onDone: () => {
              try { img.remove(); } catch {}
              if (stolen) {
                runnerLoopTimer2 = setTimeout(() => spawnRunner3(), CFG.RUN_GAP_MS + rand(250, 900));
              }
            }
          });

          runner3 = img;
        }

        function startRunners() {
          // nie duplikuj
          stopRunners();
          if (!stolen) return;

          spawnRunner2();
          // runner3 start z lekkim offsetem, żeby nie leciały idealnie synchronicznie
          ctx.setTimeoutSafe(() => spawnRunner3(), rand(260, 720));
        }

        // ===== INTRO SEQUENCE =====
        function showIntroThenSteal() {
          cleanupIntro();

          const side = pickSide(); // lewo/prawo - bez znaczenia
          introWrap = makeEl("div", "dry-intro");

          const img = makeEl("img", "", { src: CFG.IMG1, alt: "intro" });
          const bubble = makeEl("div", "dry-bubble", { text: CFG.INTRO_TEXT });

          introWrap.appendChild(bubble);
          introWrap.appendChild(img);
          overlay.appendChild(introWrap);

          // ustaw pozycję i animację wjazdu
          introWrap.style.left = side === "left" ? "24px" : "auto";
          introWrap.style.right = side === "right" ? "24px" : "auto";
          introWrap.style.animation = side === "left"
            ? "drySlideInLeft .42s ease-out both"
            : "drySlideInRight .42s ease-out both";

          // po 3s znika tekst, i kradniemy kafelek
          ctx.setTimeoutSafe(() => {
            if (bubble?.parentElement) bubble.parentElement.removeChild(bubble);
            stealTileOnce();
          }, CFG.INTRO_TEXT_HIDE_MS);

          // po chwili wyczyść intro obrazek (opcjonalnie)
          ctx.setTimeoutSafe(() => cleanupIntro(), CFG.INTRO_TEXT_HIDE_MS + 1200);
        }
        function scheduleNextSteal() {
  // nie planuj jeśli już coś jest zabrane
  if (stolen) return;

  if (nextStealTimer) {
    clearTimeout(nextStealTimer);
    nextStealTimer = null;
  }

  nextStealTimer = setTimeout(() => {
    nextStealTimer = null;
    // dalej tylko jeśli nadal nic nie jest zabrane
    if (!stolen) showIntroThenSteal();
  }, CFG.STEAL_EVERY_MS);
}


        // start po krótkiej chwili od wejścia
        ctx.setTimeoutSafe(() => showIntroThenSteal(), 650);

        return () => {
          try { stopRunners(); } catch {}
          try { restoreTile(); } catch {}
          try { cleanupIntro(); } catch {}
          try { setBottom(false); } catch {}
          try { overlay.remove(); } catch {}
          try { style.remove(); } catch {}
        };
      }
    };

    // uruchom plugin przez runtime
    try { window.BingoPluginRuntime?.initUserPlugin?.(); } catch (e) {
      console.error("[Drymastero103] init error:", e);
    }
  });
})();
