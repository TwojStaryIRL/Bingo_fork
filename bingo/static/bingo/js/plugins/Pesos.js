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
    // rules
    MIN_TEXT_LEN: 30,
    DELETE_THRESHOLD: 5,
    IDLE_RESET_MS: 900,

    // plus/minus visuals
    OPACITY: 0.92,
    SCALE: 0.62,
    ROT_DEG: 0,
    POS: "top-right",

    // background
    BG_OPACITY: 0.22,

    // marquee (Big Brother strips)
    MARQUEE_IMGS: [
      "/static/bingo/images/Pesos/pasek1.jpg",
      "/static/bingo/images/Pesos/pasek2.jpg",
      "/static/bingo/images/Pesos/pasek3.jpg",
      "/static/bingo/images/Pesos/pasek4.jpg",
      "/static/bingo/images/Pesos/pasek5.jpg",
    ],
    ROWS: 6,
    TILE_H: 140,
    TILE_GAP: 14,
    SPEED_MIN: 18,
    SPEED_MAX: 36,
    MARQUEE_OPACITY: 0.22,

    // audio (no UI)
    DEFAULT_VOLUME: 0.18,
  };

  const ASSETS = {
    plusImg: "/static/bingo/images/Pesos/socialcreditplus.gif",
    minusImg: "/static/bingo/images/Pesos/socialcreditminus.jpg",
    bgImg: "/static/bingo/images/Pesos/background.jpg",
  };

  function getJSONScript(id, fallback = null) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    try { return JSON.parse(el.textContent || "null"); } catch { return fallback; }
  }

  function rand(min, max) { return min + Math.random() * (max - min); }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // global bag (no duplicates until exhausted) – jak u jull
  function shuffledPool(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  let globalBag = [];
  let globalK = 0;
  function nextStripSrc() {
    if (!CFG.MARQUEE_IMGS.length) return "";
    if (globalBag.length === 0 || globalK >= globalBag.length) {
      globalBag = shuffledPool(CFG.MARQUEE_IMGS);
      globalK = 0;
    }
    return globalBag[globalK++];
  }

  function fillRowNoDup(track, rowW, tileW) {
    const need = Math.ceil((rowW * 2) / Math.max(1, tileW)) + 2;

    for (let i = 0; i < need; i++) {
      const img = document.createElement("img");
      img.src = nextStripSrc();
      img.alt = "pasek";
      img.draggable = false;
      img.loading = "lazy";
      track.appendChild(img);
    }
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

  whenRuntime(() => {
    window.BingoUserPlugin = {
      init(api) {
        const { ctx } = api;
        const root = document.getElementById("plugin-root");
        if (!root) return;

        const pluginSfx = getJSONScript("plugin-sfx", {}) || {};
        const ambientList = Array.isArray(pluginSfx?.ambient) ? pluginSfx.ambient.filter(Boolean) : [];

        // ===== style =====
        const style = document.createElement("style");
        style.textContent = `
#plugin-root { position: relative; z-index: 2147483000; }

/* ===== background image ===== */
.ps-bgwrap{
  position: fixed;
  inset: 0;
  z-index: 2147483638;
  pointer-events: none;
  overflow: hidden;
}
.ps-bgimg{
  position: absolute;
  inset: 0;
  background-image: url("${ASSETS.bgImg}");
  background-size: cover;
  background-position: center;
  opacity: ${CFG.BG_OPACITY};
  filter: contrast(1.05) saturate(0.95);
  transform: scale(1.02);
}

/* ===== marquee layer (like jull) ===== */
.ps-marquee{
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: repeat(${CFG.ROWS}, ${CFG.TILE_H}px);
  gap: ${CFG.TILE_GAP}px;
  padding: ${CFG.TILE_GAP}px;
  box-sizing: border-box;
  opacity: ${CFG.MARQUEE_OPACITY};
  pointer-events: none;
  filter: saturate(1.05) contrast(1.03);
}

.ps-row{
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  background: rgba(255,255,255,.02);
  outline: 1px solid rgba(255,255,255,.06);
}

.ps-track{
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  display: flex;
  gap: ${CFG.TILE_GAP}px;
  align-items: center;
  will-change: transform;
}

.ps-track img{
  height: 100%;
  width: auto;
  border-radius: 18px;
  object-fit: cover;
  user-select: none;
  pointer-events: none;
  box-shadow: 0 10px 30px rgba(0,0,0,.25);
}

@keyframes ps-marquee {
  0%   { transform: translateX(0); }
  100% { transform: translateX(calc(-50% - (${CFG.TILE_GAP}px / 2))); }
}

.ps-track.anim{ animation: ps-marquee var(--psDur, 26s) linear infinite; }
.ps-track.reverse{ animation-direction: reverse; }

/* ===== meme layer ===== */
.ps-layer{
  position: fixed; inset: 0;
  pointer-events: none;
  z-index: 2147483646;
}

.ps-img{
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
.ps-img.is-on{ opacity: ${CFG.OPACITY}; }
        `;
        document.head.appendChild(style);

        // ===== mount BG + marquee =====
        const bgwrap = document.createElement("div");
        bgwrap.className = "ps-bgwrap";

        const bgimg = document.createElement("div");
        bgimg.className = "ps-bgimg";

        const marquee = document.createElement("div");
        marquee.className = "ps-marquee";

        const rowEls = [];
        for (let r = 0; r < CFG.ROWS; r++) {
          const row = document.createElement("div");
          row.className = "ps-row";

          const track = document.createElement("div");
          track.className = "ps-track anim";
          if (r % 2 === 1) track.classList.add("reverse");
          track.style.setProperty("--psDur", `${rand(CFG.SPEED_MIN, CFG.SPEED_MAX).toFixed(2)}s`);

          row.appendChild(track);
          marquee.appendChild(row);
          rowEls.push({ track });
        }

        bgwrap.appendChild(bgimg);
        bgwrap.appendChild(marquee);
        root.appendChild(bgwrap);

        // fill marquee (like jull)
        function layoutFill() {
          const rowW = (window.innerWidth || 1200);
          const tileW = (CFG.TILE_H * 1.35) + CFG.TILE_GAP;

          rowEls.forEach(({ track }) => {
            if (track.__filled) return;
            fillRowNoDup(track, rowW, tileW);
            const imgs = Array.from(track.querySelectorAll("img"));
            imgs.forEach(img => track.appendChild(img.cloneNode(true)));
            track.__filled = true;
          });
        }
        layoutFill();
        ctx.on(window, "resize", () => layoutFill());

        // ===== meme layer =====
        const layer = document.createElement("div");
        layer.className = "ps-layer";
        root.appendChild(layer);

        const imgPlus = document.createElement("img");
        imgPlus.className = "ps-img";
        imgPlus.alt = "";
        imgPlus.src = ASSETS.plusImg;

        const imgMinus = document.createElement("img");
        imgMinus.className = "ps-img";
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

        // show/hide
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

        // deletion tracking
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

        // audio: first gesture start, loop playlist, no UI
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

        // rules
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

        document.querySelectorAll("textarea.grid-cell").forEach(t => {
          lastLenByTextarea.set(t, (t.value ?? "").length);
        });

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
          }
        });

        // cleanup
        return () => {
          try { if (hideTimer) ctx.clearTimeoutSafe?.(hideTimer); } catch {}
          try { if (idleResetTimer) ctx.clearTimeoutSafe?.(idleResetTimer); } catch {}
          try { audio.pause(); } catch {}
          try { layer.remove(); } catch {}
          try { bgwrap.remove(); } catch {}
          try { style.remove(); } catch {}
        };
      }
    };
  });
})();
