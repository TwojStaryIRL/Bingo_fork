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
    MIN_TEXT_LEN: 30,
    DELETE_THRESHOLD: 5,
    IDLE_RESET_MS: 900,

    // visuals
    OPACITY: 0.92,
    SCALE: 0.62,
    ROT_DEG: 0,
    POS: "top-right",

    // background
    BG_OPACITY: 0.22,         // jak mocno tło ma być widoczne
    BARS_OPACITY: 0.22,       // jak mocne paski "censored"
    BARS_HEIGHT: 18,          // wysokość paska
    BARS_GAP: 44,             // odstęp między paskami
    CCTV_NOISE_OPACITY: 0.07, // delikatny noise

    // audio (no UI)
    DEFAULT_VOLUME: 0.18,     // testuj 0.15–0.20
  };

  const ASSETS = {
    // + / - memes
    plusImg: "/static/bingo/images/Pesos/socialcreditplus.gif",
    minusImg: "/static/bingo/images/Pesos/socialcreditminus.jpg",

    
    bgImg: "/static/bingo/images/Pesos/background.jpg",
  };

  function getJSONScript(id, fallback = null) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    try { return JSON.parse(el.textContent || "null"); } catch { return fallback; }
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "TEXTAREA" ||
      (tag === "INPUT" && ["text", "search", "email", "password"].includes(el.type));
  }

  function getCellWrapperFromActive() {
    const ae = document.activeElement;
    if (!isTypingTarget(ae)) return null;
    return ae.closest?.(".cell-wrapper") || null;
  }

  function getCellState(wrapper) {
    const textarea = wrapper?.querySelector?.("textarea.grid-cell");
    const select = wrapper?.querySelector?.("select.cell-user--inside");
    const text = (textarea?.value ?? "");
    const assigned = (select?.value ?? "").trim();
    return { textarea, select, text, assigned };
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  whenRuntime(() => {
    window.BingoUserPlugin = {
      init(api) {
        const { ctx } = api;
        const root = document.getElementById("plugin-root");
        if (!root) return;

        // plugin sfx from backend (json_script id="plugin-sfx")
        const pluginSfx = getJSONScript("plugin-sfx", {}) || {};
        const ambientList = Array.isArray(pluginSfx?.ambient) ? pluginSfx.ambient.filter(Boolean) : [];

        // ===== DOM / CSS =====
        const style = document.createElement("style");
        style.textContent = `
#plugin-root { position: relative; z-index: 2147483000; }

/* ===== background layer ===== */
.sc-bg{
  position: fixed; inset: 0;
  pointer-events: none;
  z-index: 2147483640;
  overflow: hidden;
}
.sc-bg__img{
  position: absolute; inset: 0;
  background-image: url("${ASSETS.bgImg}");
  background-size: cover;
  background-position: center;
  opacity: ${CFG.BG_OPACITY};
  filter: contrast(1.05) saturate(0.95);
  transform: scale(1.02);
}

/* ===== censor bars overlay ===== */
.sc-bg__bars{
  position: absolute; inset: 0;
  opacity: ${CFG.BARS_OPACITY};
  background: repeating-linear-gradient(
    0deg,
    rgba(0,0,0,0.92) 0px,
    rgba(0,0,0,0.92) ${CFG.BARS_HEIGHT}px,
    rgba(0,0,0,0.0) ${CFG.BARS_HEIGHT}px,
    rgba(0,0,0,0.0) ${CFG.BARS_GAP}px
  );
  mix-blend-mode: multiply;
}

/* ===== subtle CCTV noise ===== */
.sc-bg__noise{
  position: absolute; inset: -40px;
  opacity: ${CFG.CCTV_NOISE_OPACITY};
  background-image:
    repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 1px, rgba(0,0,0,0) 1px 3px);
  mix-blend-mode: overlay;
  animation: sc-noiseMove 7s linear infinite;
}
@keyframes sc-noiseMove{ to { transform: translate3d(0, 40px, 0); } }

/* ===== meme layer ===== */
.sc-layer{
  position: fixed; inset: 0;
  pointer-events: none;
  z-index: 2147483646;
}

.sc-img{
  position: fixed;
  width: min(34vw, 520px);
  max-width: 520px;
  height: auto;
  user-select: none;
  opacity: 0;
  transform: scale(${CFG.SCALE}) rotate(${CFG.ROT_DEG}deg);
  transition: opacity 120ms ease;
  filter: drop-shadow(0 16px 30px rgba(0,0,0,.45));
}
.sc-img.is-on{ opacity: ${CFG.OPACITY}; }
        `;
        document.head.appendChild(style);

        // ===== background mount =====
        const bg = document.createElement("div");
        bg.className = "sc-bg";
        bg.innerHTML = `
  <div class="sc-bg__img"></div>
  <div class="sc-bg__bars"></div>
  <div class="sc-bg__noise"></div>
        `;
        root.appendChild(bg);

        // ===== meme layer =====
        const layer = document.createElement("div");
        layer.className = "sc-layer";
        root.appendChild(layer);

        const imgPlus = document.createElement("img");
        imgPlus.className = "sc-img";
        imgPlus.alt = "";
        imgPlus.src = ASSETS.plusImg;

        const imgMinus = document.createElement("img");
        imgMinus.className = "sc-img";
        imgMinus.alt = "";
        imgMinus.src = ASSETS.minusImg;

        layer.appendChild(imgPlus);
        layer.appendChild(imgMinus);

        function positionImage(img) {
          const m = 18;
          switch (CFG.POS) {
            case "top-left":
              img.style.left = m + "px"; img.style.top = m + "px";
              img.style.right = "auto"; img.style.bottom = "auto";
              img.style.transformOrigin = "top left";
              break;
            case "bottom-right":
              img.style.right = m + "px"; img.style.bottom = m + "px";
              img.style.left = "auto"; img.style.top = "auto";
              img.style.transformOrigin = "bottom right";
              break;
            case "bottom-left":
              img.style.left = m + "px"; img.style.bottom = m + "px";
              img.style.right = "auto"; img.style.top = "auto";
              img.style.transformOrigin = "bottom left";
              break;
            case "center":
              img.style.left = "50%"; img.style.top = "50%";
              img.style.right = "auto"; img.style.bottom = "auto";
              img.style.transform = `translate(-50%, -50%) scale(${CFG.SCALE}) rotate(${CFG.ROT_DEG}deg)`;
              img.style.transformOrigin = "center";
              break;
            case "top-right":
            default:
              img.style.right = m + "px"; img.style.top = m + "px";
              img.style.left = "auto"; img.style.bottom = "auto";
              img.style.transformOrigin = "top right";
          }
        }
        positionImage(imgPlus);
        positionImage(imgMinus);

        // ===== show/hide helpers =====
        let hideTimer = null;
        function show(img, ms = 650) {
          imgPlus.classList.remove("is-on");
          imgMinus.classList.remove("is-on");

          img.classList.add("is-on");
          if (hideTimer) ctx.clearTimeoutSafe?.(hideTimer);
          hideTimer = ctx.setTimeoutSafe(() => {
            img.classList.remove("is-on");
            hideTimer = null;
          }, ms);
        }

        // ===== deletion tracking =====
        let lastLenByTextarea = new WeakMap();
        let deletedSinceReset = 0;
        let idleResetTimer = null;

        function scheduleIdleReset() {
          if (idleResetTimer) ctx.clearTimeoutSafe?.(idleResetTimer);
          idleResetTimer = ctx.setTimeoutSafe(() => {
            deletedSinceReset = 0;
            idleResetTimer = null;
          }, CFG.IDLE_RESET_MS);
        }

        // ===== audio: start on first user input, loop playlist, NO UI =====
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

        // "first user input" = jakikolwiek gesture lub input
        document.addEventListener("pointerdown", startOnFirstUserInput, true);
        document.addEventListener("keydown", startOnFirstUserInput, true);
        document.addEventListener("input", startOnFirstUserInput, true);

        // ===== core rules =====
        function maybeShowPlus() {
          const wrapper = getCellWrapperFromActive();
          if (!wrapper) return;
          if (wrapper.classList.contains("plugin-placeholder")) return;

          const { text, assigned } = getCellState(wrapper);
          const len = (text || "").trim().length;

          if (assigned && len > CFG.MIN_TEXT_LEN) {
            show(imgPlus, 800);
          }
        }

        function updateDeleteCountFromTextarea(textarea) {
          if (!textarea) return;

          const prev = lastLenByTextarea.get(textarea);
          const cur = (textarea.value ?? "").length;

          if (typeof prev === "number") {
            const diff = prev - cur;
            if (diff > 0) {
              deletedSinceReset += diff;
              scheduleIdleReset();
              if (deletedSinceReset >= CFG.DELETE_THRESHOLD) {
                deletedSinceReset = 0;
                show(imgMinus, 800);
              }
            }
          }

          lastLenByTextarea.set(textarea, cur);
        }

        // init lengths for all cells
        document.querySelectorAll("textarea.grid-cell").forEach(t => {
          lastLenByTextarea.set(t, (t.value ?? "").length);
        });

        // EVENTS:
        ctx.on(document, "input", () => {
          const wrapper = getCellWrapperFromActive();
          if (!wrapper) return;
          const { textarea } = getCellState(wrapper);
          updateDeleteCountFromTextarea(textarea);
          maybeShowPlus();
        });

        ctx.on(document, "keydown", (e) => {
          if (e.key !== "Backspace" && e.key !== "Delete") return;
          const wrapper = getCellWrapperFromActive();
          if (!wrapper) return;
          scheduleIdleReset();
        });

        ctx.on(document, "change", (e) => {
          const sel = e.target;
          if (!(sel instanceof HTMLElement)) return;
          if (!sel.matches?.("select.cell-user--inside")) return;

          const wrapper = sel.closest(".cell-wrapper");
          if (!wrapper || wrapper.classList.contains("plugin-placeholder")) return;

          const { text, assigned } = getCellState(wrapper);
          const len = (text || "").trim().length;
          if (assigned && len > CFG.MIN_TEXT_LEN) show(imgPlus, 800);
        });

        ctx.on(document, "visibilitychange", () => {
          if (document.hidden) {
            imgPlus.classList.remove("is-on");
            imgMinus.classList.remove("is-on");
            // audio nie pauzuję — ma grać permanentnie (tak chciałeś)
          }
        });

        // cleanup
        return () => {
          try { if (hideTimer) ctx.clearTimeoutSafe?.(hideTimer); } catch {}
          try { if (idleResetTimer) ctx.clearTimeoutSafe?.(idleResetTimer); } catch {}
          try { audio.pause(); } catch {}
          try { bg.remove(); } catch {}
          try { layer.remove(); } catch {}
          try { style.remove(); } catch {}
        };
      }
    };
  });
})();
