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

  // cfg
  const CFG = {
    MIN_TEXT_LEN: 30,
    DELETE_THRESHOLD: 5,
    IDLE_RESET_MS: 900,

    // visuals
    OPACITY: 0.92,
    SCALE: 0.62,
    ROT_DEG: 0,
    POS: "top-right",

    // audio
    DEFAULT_VOLUME: 0.25,
    START_MUTED: false,
  };

  const ASSETS = {
    plusImg: "/static/bingo/images/Pesos/socialcreditplus.gif",
    minusImg: "/static/bingo/images/Pesos/socialcreditminus.jpg",
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

.sc-audio-ui{
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 2147483647;
  background: rgba(10,10,10,.62);
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 14px;
  padding: 10px 12px;
  color: rgba(255,255,255,.92);
  font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial;
  display: flex;
  gap: 10px;
  align-items: center;
  backdrop-filter: blur(8px);
  pointer-events: auto;
}

.sc-audio-ui button{
  border: 0;
  border-radius: 10px;
  padding: 7px 10px;
  background: rgba(255,255,255,.12);
  color: rgba(255,255,255,.92);
  cursor: pointer;
}
.sc-audio-ui button:hover{ background: rgba(255,255,255,.18); }

.sc-audio-ui input[type="range"]{
  width: 140px;
}
.sc-audio-ui .label{
  opacity: .8;
}
        `;
        document.head.appendChild(style);

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

        // ===== audio: shuffle once, then loop in that order =====
        let playlist = shuffle(ambientList);
        let idx = 0;

        const audio = document.createElement("audio");
        audio.preload = "auto";
        audio.loop = false;
        audio.volume = CFG.DEFAULT_VOLUME;
        audio.muted = !!CFG.START_MUTED;

        function setTrack(i) {
          if (!playlist.length) return;
          idx = (i + playlist.length) % playlist.length;
          audio.src = playlist[idx];
        }

        function playNext() {
          if (!playlist.length) return;
          setTrack(idx + 1);
          audio.play().catch(() => {});
          updateUi();
        }

        function playStart() {
          if (!playlist.length) return;
          if (!audio.src) setTrack(0);
          audio.play().catch(() => {});
          updateUi();
        }

        audio.addEventListener("ended", () => {
          // next track, same shuffled order, infinite
          if (!playlist.length) return;
          playNext();
        });

        // small UI for volume + start/stop
        const ui = document.createElement("div");
        ui.className = "sc-audio-ui";
        ui.innerHTML = `
  <span class="label">Pemos Radio</span>
  <button type="button" data-act="toggle">Play</button>
  <input type="range" min="0" max="1" step="0.01" value="${CFG.DEFAULT_VOLUME}" aria-label="volume">
  <button type="button" data-act="mute">${CFG.START_MUTED ? "Unmute" : "Mute"}</button>
        `;
        root.appendChild(ui);

        const btnToggle = ui.querySelector('button[data-act="toggle"]');
        const btnMute = ui.querySelector('button[data-act="mute"]');
        const range = ui.querySelector('input[type="range"]');

        function updateUi() {
          const playing = !audio.paused && !audio.ended;
          if (btnToggle) btnToggle.textContent = playing ? "Pause" : "Play";
          if (btnMute) btnMute.textContent = audio.muted ? "Unmute" : "Mute";
        }

        btnToggle?.addEventListener("click", () => {
          if (!playlist.length) return;
          if (audio.paused) playStart();
          else audio.pause();
          updateUi();
        });

        btnMute?.addEventListener("click", () => {
          audio.muted = !audio.muted;
          updateUi();
        });

        range?.addEventListener("input", () => {
          const v = Number(range.value);
          audio.volume = Math.max(0, Math.min(1, isFinite(v) ? v : CFG.DEFAULT_VOLUME));
        });

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
        // 1) input in textarea -> track deletes + maybe plus
        ctx.on(document, "input", () => {
          const wrapper = getCellWrapperFromActive();
          if (!wrapper) return;
          const { textarea } = getCellState(wrapper);
          updateDeleteCountFromTextarea(textarea);
          maybeShowPlus();
        });

        // 2) keydown specifically for backspace/delete (more responsive)
        ctx.on(document, "keydown", (e) => {
          if (e.key !== "Backspace" && e.key !== "Delete") return;
          const wrapper = getCellWrapperFromActive();
          if (!wrapper) return;
          const { textarea } = getCellState(wrapper);
          // we still rely on input diff, but we schedule reset aggressively
          scheduleIdleReset();
          // let input event do the diff; nothing else needed
        });

        // 3) select change -> plus condition may become true
        ctx.on(document, "change", (e) => {
          const sel = e.target;
          if (!(sel instanceof HTMLElement)) return;
          if (!sel.matches?.("select.cell-user--inside")) return;

          const wrapper = sel.closest(".cell-wrapper");
          if (!wrapper || wrapper.classList.contains("plugin-placeholder")) return;

          // if textarea in that wrapper already long enough, show plus
          const { text, assigned } = getCellState(wrapper);
          const len = (text || "").trim().length;
          if (assigned && len > CFG.MIN_TEXT_LEN) show(imgPlus, 800);
        });

        // UX cleanups
        ctx.on(document, "visibilitychange", () => {
          if (document.hidden) {
            imgPlus.classList.remove("is-on");
            imgMinus.classList.remove("is-on");
          }
        });

        // Try to start audio after first user gesture (autoplay restrictions)
        const startOnFirstGesture = () => {
          document.removeEventListener("pointerdown", startOnFirstGesture, true);
          document.removeEventListener("keydown", startOnFirstGesture, true);
          if (!playlist.length) return;
          // don't force-play if muted and you don't want it; but starting muted is safe
          playStart();
        };
        document.addEventListener("pointerdown", startOnFirstGesture, true);
        document.addEventListener("keydown", startOnFirstGesture, true);

        updateUi();

        // cleanup
        return () => {
          try { if (hideTimer) ctx.clearTimeoutSafe?.(hideTimer); } catch {}
          try { if (idleResetTimer) ctx.clearTimeoutSafe?.(idleResetTimer); } catch {}
          try { audio.pause(); } catch {}
          try { ui.remove(); } catch {}
          try { layer.remove(); } catch {}
          try { style.remove(); } catch {}
        };
      }
    };
  });
})();
