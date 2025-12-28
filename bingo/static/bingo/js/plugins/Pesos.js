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

    OPACITY: 0.92,
    SCALE: 0.62,
    ROT_DEG: 0,
    POS: "top-right",

    BG_OPACITY: 0.22,

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

    // <<< SLOWER (about 2x slower than 18-36)
    SPEED_MIN: 36,
    SPEED_MAX: 72,

    MARQUEE_OPACITY: 0.22,

    DEFAULT_VOLUME: 0.18,

    // spam tuning
    SPAM_MS: 260,          // jak długo obrazek ma być widoczny przy spamie
    SPAM_COOLDOWN_MS: 140, // min odstęp między kolejnymi pokazaniami
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

        const style = document.createElement("style");
style.textContent = `

body::before,
body::after{
  background-image: none !important;
  opacity: 0 !important;
  content: "" !important;
}

/* ===== LAYERS (fix) ===== */
#plugin-root{
  position: relative;
  z-index: 1; /* nie kosmos — UI i tak ustawiamy wyżej */
}

/* UI gry zawsze NAD tłem */
.page, .hero, .panel{
  position: relative;
  z-index: 200;
}

/* ===== HARDMODE: MAIN PANEL + GRID ===== */
.panel.panel--wide{
  position: relative;

  /* mocniej niż jull */
  background: rgba(0,0,0,.93) !important;
  outline: 1px solid rgba(255,255,255,.14) !important;
  box-shadow: 0 24px 90px rgba(0,0,0,.82) !important;

  backdrop-filter: blur(14px) saturate(1.05);
  -webkit-backdrop-filter: blur(14px) saturate(1.05);
}

/* dodatkowa „czarna szyba” */
.panel.panel--wide::before{
  content: "";
  position: absolute;
  inset: -8px;               /* lekko wychodzi poza panel */
  border-radius: inherit;
  background: rgba(0,0,0,.55);
  pointer-events: none;
  z-index: 0;
}

/* wszystko w panelu nad overlayem */
.panel.panel--wide > *{
  position: relative;
  z-index: 1;
}

/* tabela i komórki */
.grid-table{
  background: rgba(0,0,0,.68) !important;
  border-radius: 18px;
}

.grid-table td{
  background: rgba(0,0,0,.62) !important;
}

/* pola tekstowe */
textarea.grid-cell{
  background: rgba(0,0,0,.90) !important;
  color: rgba(255,255,255,.95) !important;
  border: 1px solid rgba(255,255,255,.16) !important;
  box-shadow: 0 12px 34px rgba(0,0,0,.62);
}

textarea.grid-cell::placeholder{
  color: rgba(255,255,255,.36) !important;
}

/* custom dropdown */
.cell-wrapper.cd .cd__button{
  background: rgba(0,0,0,.86) !important;
  color: rgba(255,255,255,.95) !important;
  border: 1px solid rgba(255,255,255,.16) !important;
}

.cell-wrapper.cd .cd__list{
  background: rgba(0,0,0,.96) !important;
  border: 1px solid rgba(255,255,255,.14) !important;
}

.cell-wrapper.cd .cd__option{
  color: rgba(255,255,255,.92) !important;
}

.cell-wrapper.cd .cd__option--muted{
  color: rgba(255,255,255,.56) !important;
}

/* ===== BG + MARQUEE (UNDER UI) ===== */
.ps-bgwrap{
  position: fixed;
  inset: 0;
  z-index: 10;               /* klucz: POD .panel (200) */
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

/* opcjonalnie: “koty/paski tylko po bokach” — środek prawie znika */
.ps-bgimg,
.ps-marquee{
  -webkit-mask-image: linear-gradient(
    to right,
    rgba(0,0,0,1) 0%,
    rgba(0,0,0,1) 16%,
    rgba(0,0,0,0.06) 44%,
    rgba(0,0,0,0.06) 56%,
    rgba(0,0,0,1) 84%,
    rgba(0,0,0,1) 100%
  );
  mask-image: linear-gradient(
    to right,
    rgba(0,0,0,1) 0%,
    rgba(0,0,0,1) 16%,
    rgba(0,0,0,0.06) 44%,
    rgba(0,0,0,0.06) 56%,
    rgba(0,0,0,1) 84%,
    rgba(0,0,0,1) 100%
  );
}

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

@keyframes ps-marquee{
  0%   { transform: translateX(0); }
  100% { transform: translateX(calc(-50% - (${CFG.TILE_GAP}px / 2))); }
}

.ps-track.anim{ animation: ps-marquee var(--psDur, 26s) linear infinite; }
.ps-track.reverse{ animation-direction: reverse; }

/* ===== MEMES (OVER UI) ===== */
.ps-layer{
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
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

        // BG + marquee
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

        // meme layer
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

        // deletion tracking + spam
        let lastLenByTextarea = new WeakMap();
        let idleResetTimer = null;

        let lastSpamAt = 0;
        function spam(img) {
          const now = performance.now();
          if (now - lastSpamAt < CFG.SPAM_COOLDOWN_MS) return;
          lastSpamAt = now;
          show(img, CFG.SPAM_MS);
        }

        function scheduleIdleReset() {
          if (idleResetTimer) ctx.clearTimeoutSafe?.(idleResetTimer);
          idleResetTimer = ctx.setTimeoutSafe(() => {
            idleResetTimer = null;
          }, CFG.IDLE_RESET_MS);
        }

        // audio
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

        // init lengths
        document.querySelectorAll("textarea.grid-cell").forEach(t => {
          lastLenByTextarea.set(t, (t.value ?? "").length);
        });

        // INPUT: spam + / - based on length diff
        ctx.on(document, "input", () => {
          const wrapper = getCellWrapperFromActive();
          if (!wrapper) return;
          if (wrapper.classList.contains("plugin-placeholder")) return;

          const { textarea, text, assigned } = getCellState(wrapper);
          if (!textarea) return;

          const prev = lastLenByTextarea.get(textarea);
          const cur = (textarea.value ?? "").length;

          // spam logic
          if (typeof prev === "number") {
            const diff = cur - prev;
            if (diff > 0) {
              // typed characters
              if (assigned) spam(imgPlus); // tylko jak wybrany user (żeby miało sens)
            } else if (diff < 0) {
              // deleted characters
              spam(imgMinus);
              scheduleIdleReset();
            }
          }

          lastLenByTextarea.set(textarea, cur);

          // dodatkowo: jak już spełnione warunki długości, pokaż plus mocniej
          const lenTrim = (text || "").trim().length;
          if (assigned && lenTrim > CFG.MIN_TEXT_LEN) {
            show(imgPlus, 650);
          }
        });

        // keydown: tylko po to, żeby łapać kasowanie bardziej responsywnie (ale spam i tak robi input diff)
        ctx.on(document, "keydown", (e) => {
          if (e.key !== "Backspace" && e.key !== "Delete") return;
          const wrapper = getCellWrapperFromActive();
          if (!wrapper) return;
          scheduleIdleReset();
        });

        // select change: jeśli tekst już długi -> plus
        ctx.on(document, "change", (e) => {
          const sel = e.target;
          if (!(sel instanceof HTMLElement)) return;
          if (!sel.matches?.("select.cell-user--inside")) return;

          const wrapper = sel.closest(".cell-wrapper");
          if (!wrapper || wrapper.classList.contains("plugin-placeholder")) return;

          const { text, assigned } = getCellState(wrapper);
          const len = (text || "").trim().length;
          if (assigned && len > CFG.MIN_TEXT_LEN) show(imgPlus, 650);
        });

        ctx.on(document, "visibilitychange", () => {
          if (document.hidden) {
            imgPlus.classList.remove("is-on");
            imgMinus.classList.remove("is-on");
          }
        });

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
