(() => {
  // ===== config =====
  const CFG = {
    STORAGE_KEY: "bingo_stugsiana_cat_gate_v1",

    TITLE: "Proszę kliknąć na grzeczną kicie",
    SUBTITLE: "Meow ;3",

    // Ścieżki do obrazków (wrzuć je do static i trzymaj jak poniżej)
    IMG_1: "/static/bingo/images/stugsiana/kicia.png",
    IMG_2: "/static/bingo/images/stugsiana/kicia2.png",

    // jeśli chcesz, żeby popup pokazywał się za każdym wejściem na /game/:
    ALWAYS_SHOW: true,
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

  function loadState() {
    try {
      const raw = localStorage.getItem(CFG.STORAGE_KEY);
      return raw ? JSON.parse(raw) : { passed: false };
    } catch {
      return { passed: false };
    }
  }

  function saveState(state) {
    try { localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function preload(url) {
    try { const img = new Image(); img.src = url; } catch {}
  }

  whenRuntime(() => {
    window.BingoUserPlugin = {
      init(api) {
        const { ctx } = api;

        const root = document.getElementById("plugin-root");
        if (!root) return;

        // pokaż tylko na /game/ (jeśli u Ciebie URL jest inny, zmień warunek)
        if (!String(location.pathname || "").includes("game")) return;

        const st = loadState();
        if (!CFG.ALWAYS_SHOW && st.passed) return;

        preload(CFG.IMG_1);
        preload(CFG.IMG_2);

        // ===== styles =====
        const style = document.createElement("style");
        style.textContent = `
#plugin-root { position: relative; z-index: 2147483000; }

.stu-overlay{
  position: fixed; inset: 0;
  z-index: 2147483646;
  pointer-events: auto;
  background: rgba(0,0,0,.78);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: start center;
  padding: 22px;
  overflow: auto;
}

.stu-modal{
  width: min(720px, 94vw);
  border-radius: 18px;
  background: rgba(18,18,18,.96);
  border: 1px solid rgba(255,255,255,.10);
  box-shadow: 0 28px 90px rgba(0,0,0,.6);
  padding: 18px 18px 16px;
  color: #fff;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
  margin-top: 18px;
}

.stu-title{ font-size: 18px; font-weight: 800; margin: 0 0 6px; }
.stu-sub{ font-size: 13px; opacity: .85; margin: 0 0 14px; line-height: 1.35; }

.stu-grid{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.stu-card{
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  padding: 10px;
  cursor: pointer;
  user-select: none;
  transition: transform .12s ease, background .12s ease;
}

.stu-card:hover{ transform: translateY(-2px); background: rgba(255,255,255,.09); }

.stu-imgwrap{
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255,255,255,.05);
  display:flex;
  align-items:center;
  justify-content:center;
}

.stu-img{
  width: 100%;
  height: 100%;
  object-fit: cover;
  display:block;
}

.stu-hint{
  margin-top: 12px;
  font-size: 12px;
  opacity: .8;
}
        `;
        document.head.appendChild(style);

        let overlay = null;

        function close() {
          if (overlay && overlay.parentElement) {
            try { overlay.remove(); } catch {}
          }
          overlay = null;
        }

        function pass() {
          saveState({ passed: true });
          close();
        }

        function open() {
          // guard
          if (document.getElementById("stu-overlay")) return;

          overlay = document.createElement("div");
          overlay.className = "stu-overlay";
          overlay.id = "stu-overlay";
          overlay.setAttribute("role", "dialog");
          overlay.setAttribute("aria-modal", "true");

          const modal = document.createElement("div");
          modal.className = "stu-modal";

          const h = document.createElement("h2");
          h.className = "stu-title";
          h.textContent = CFG.TITLE;

          const s = document.createElement("p");
          s.className = "stu-sub";
          s.textContent = CFG.SUBTITLE;

          const grid = document.createElement("div");
          grid.className = "stu-grid";

          function mkCard(imgUrl, alt) {
            const card = document.createElement("div");
            card.className = "stu-card";
            card.tabIndex = 0;

            const wrap = document.createElement("div");
            wrap.className = "stu-imgwrap";

            const img = document.createElement("img");
            img.className = "stu-img";
            img.src = imgUrl;
            img.alt = alt || "kicia";

            wrap.appendChild(img);
            card.appendChild(wrap);

            ctx.on(card, "click", (e) => {
              e.preventDefault(); e.stopPropagation();
              pass();
            });

            ctx.on(card, "keydown", (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault(); e.stopPropagation();
                pass();
              }
            });

            return card;
          }

          grid.appendChild(mkCard(CFG.IMG_1, "kicia 1"));
          grid.appendChild(mkCard(CFG.IMG_2, "kicia 2"));


          modal.appendChild(h);
          modal.appendChild(s);
          modal.appendChild(grid);
          modal.appendChild(hint);

          overlay.appendChild(modal);
          root.appendChild(overlay);

          // overlay ma blokować stronę (nic pod spodem nie klika)
          ctx.on(overlay, "pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); });
          ctx.on(overlay, "click", (e) => { e.preventDefault(); e.stopPropagation(); });

          // focus trap minimum: złap focus na modal
          ctx.setTimeoutSafe(() => { try { modal.focus?.(); } catch {} }, 30);
        }

        // start
        ctx.setTimeoutSafe(() => open(), 80);

        return () => {
          try { close(); } catch {}
          try { style.remove(); } catch {}
        };
      }
    };
  });
})();
