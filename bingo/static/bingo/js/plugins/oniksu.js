window.BingoUserPlugin = window.BingoUserPlugin || {};

window.BingoUserPlugin.init = function (api) {
  const pick = (arr) => (Array.isArray(arr) && arr.length ? arr[(Math.random() * arr.length) | 0] : null);

  const CFG = {
    maxFloating: 6,
    vanishAnimMs: 1000,      // 1s fade→gray w tabeli / na stronie
    cloakMs: 7000,           // ile ma być "na niewidce" po zniknięciu
    minGapMs: 45000,         // >= 45s miedzy tilesami znikającymi
    sfxHideVol: 0.35,
    sfxRevealVol: 0.35,

    // side spawn:
    sideMargin: 12,
    sideBandWidth: 220,      
    topPad: 10,
    bottomPad: 10,
  };

   // ===== SPACEGLIDING TOGGLE (self-contained, bez ruszania style.css) =====
  const SPACE = {
    GIF_URL: "/static/bingo/images/spacegliding.gif",
    GIF_OPACITY: 0.25,
    GIF_SIZE: 200,

    ROWS: 6,
    TILE_H: 140,
    TILE_GAP: 14,
    SPEED_MIN: 36,
    SPEED_MAX: 72,
    MARQUEE_OPACITY: 0.82,

    AUDIO_VOL: 0.35,
  };

  function getJSONScript(id, fallback = null) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    try { return JSON.parse(el.textContent || "null"); } catch { return fallback; }
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function rand(min, max) { return min + Math.random() * (max - min); }

  let spaceOn = false;

  // ---- pobieramy sfx z runtime (jak Pesos) ----
  const pluginSfx = getJSONScript("plugin-sfx", {}) || {};
  const ambientList = Array.isArray(pluginSfx?.ambient) ? pluginSfx.ambient.filter(Boolean) : [];
  const stripList   = Array.isArray(pluginSfx?.strips)  ? pluginSfx.strips.filter(Boolean)  : [];

  // ---- AUDIO (tylko Spaceglide, start po user gesture) ----
  const playlist = shuffle(ambientList);
  let aIdx = 0;

  const audio = document.createElement("audio");
  audio.preload = "auto";
  audio.loop = false;
  audio.volume = SPACE.AUDIO_VOL;

  function setTrack(i) {
    if (!playlist.length) return;
    aIdx = (i + playlist.length) % playlist.length;
    audio.src = playlist[aIdx];
  }
  function playCurrent() {
    if (!playlist.length) return;
    if (!audio.src) setTrack(0);
    return audio.play().catch(() => {});
  }
  function playNext() {
    if (!playlist.length) return;
    setTrack(aIdx + 1);
    playCurrent();
  }
  audio.addEventListener("ended", () => {
    if (!spaceOn) return;
    playNext();
  });

  

  // ---- MARQUEE + GIF overlay (tylko Spaceglide) ----
  let sgStyle = null;
  let sgWrap = null;
  let sgBgGif = null;
  let rowEls = null;

  // losowanie stripów bez dupli w “paczce”
  let stripBag = [];
  let stripK = 0;
  function nextStripSrc() {
    if (!stripList.length) return "";
    if (stripBag.length === 0 || stripK >= stripBag.length) {
      stripBag = shuffle(stripList);
      stripK = 0;
    }
    return stripBag[stripK++];
  }

  function fillRowNoDup(track, rowW, tileW) {
    const need = Math.ceil((rowW * 2) / Math.max(1, tileW)) + 2;
    for (let i = 0; i < need; i++) {
      const img = document.createElement("img");
      img.src = nextStripSrc();
      img.alt = "strip";
      img.draggable = false;
      img.loading = "lazy";
      track.appendChild(img);
    }
  }

  function ensureSpaceUI() {
    if (sgWrap) return;

    // 1) runtime “reset” tła z CSS (bez edycji style.css)
    //    -> żeby nie mieć GIF-na-GIF, robimy inline override
    document.body.style.backgroundImage = "none";

    // 2) GIF overlay
    sgBgGif = document.createElement("div");
    sgBgGif.style.position = "fixed";
    sgBgGif.style.inset = "0";
    sgBgGif.style.zIndex = "0";
    sgBgGif.style.pointerEvents = "none";
    sgBgGif.style.backgroundImage = `url("${SPACE.GIF_URL}")`;
    sgBgGif.style.backgroundRepeat = "repeat";
    sgBgGif.style.backgroundSize = `${SPACE.GIF_SIZE}px ${SPACE.GIF_SIZE}px`;
    sgBgGif.style.opacity = "0";
    sgBgGif.style.transition = "opacity 450ms ease";
    document.body.appendChild(sgBgGif);
    requestAnimationFrame(() => { if (sgBgGif) sgBgGif.style.opacity = String(SPACE.GIF_OPACITY); });

    // 3) marquee style (własne, self-contained)
    sgStyle = document.createElement("style");
    sgStyle.textContent = `
      .sg-bgwrap{
        position: fixed;
        inset: 0;
        z-index: 1;
        pointer-events: none;
        overflow: hidden;
      }
      .sg-marquee{
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-rows: repeat(${SPACE.ROWS}, ${SPACE.TILE_H}px);
        gap: ${SPACE.TILE_GAP}px;
        padding: ${SPACE.TILE_GAP}px;
        box-sizing: border-box;
        opacity: ${SPACE.MARQUEE_OPACITY};
        pointer-events: none;

        -webkit-mask-image: linear-gradient(
          to right,
          rgba(0,0,0,1) 0%,
          rgba(0,0,0,1) 16%,
          rgba(0,0,0,0.10) 42%,
          rgba(0,0,0,0.10) 58%,
          rgba(0,0,0,1) 84%,
          rgba(0,0,0,1) 100%
        );
        mask-image: linear-gradient(
          to right,
          rgba(0,0,0,1) 0%,
          rgba(0,0,0,1) 16%,
          rgba(0,0,0,0.10) 42%,
          rgba(0,0,0,0.10) 58%,
          rgba(0,0,0,1) 84%,
          rgba(0,0,0,1) 100%
        );
      }
      .sg-row{
        position: relative;
        overflow: hidden;
        border-radius: 18px;
        background: rgba(255,255,255,.02);
        outline: 1px solid rgba(255,255,255,.06);
      }
      .sg-track{
        position: absolute;
        top: 0; left: 0;
        height: 100%;
        display: flex;
        gap: ${SPACE.TILE_GAP}px;
        align-items: center;
        will-change: transform;
      }
      .sg-track img{
        height: 100%;
        width: auto;
        border-radius: 18px;
        object-fit: cover;
        user-select: none;
        pointer-events: none;
        box-shadow: 0 10px 30px rgba(0,0,0,.25);
      }
      @keyframes sg-marquee {
        0%   { transform: translateX(0); }
        100% { transform: translateX(calc(-50% - (${SPACE.TILE_GAP}px / 2))); }
      }
      .sg-track.anim{ animation: sg-marquee var(--sgDur, 26s) linear infinite; }
      .sg-track.reverse{ animation-direction: reverse; }

      /* UI nad efektami */
      .page, .hero, .panel{ position: relative; z-index: 50; }
    `;
    document.head.appendChild(sgStyle);

    // 4) DOM marquee
    const root = document.getElementById("plugin-root") || document.body;

    sgWrap = document.createElement("div");
    sgWrap.className = "sg-bgwrap";

    const marquee = document.createElement("div");
    marquee.className = "sg-marquee";

    rowEls = [];
    for (let r = 0; r < SPACE.ROWS; r++) {
      const row = document.createElement("div");
      row.className = "sg-row";

      const track = document.createElement("div");
      track.className = "sg-track anim";
      if (r % 2 === 1) track.classList.add("reverse");
      track.style.setProperty("--sgDur", `${rand(SPACE.SPEED_MIN, SPACE.SPEED_MAX).toFixed(2)}s`);

      row.appendChild(track);
      marquee.appendChild(row);
      rowEls.push({ track });
    }

    sgWrap.appendChild(marquee);
    root.appendChild(sgWrap);

    // fill (raz) + clone (jak w Pesos)
    function layoutFill() {
      const rowW = (window.innerWidth || 1200);
      const tileW = (SPACE.TILE_H * 1.35) + SPACE.TILE_GAP;

      rowEls.forEach(({ track }) => {
        if (track.__filled) return;
        fillRowNoDup(track, rowW, tileW);
        const imgs = Array.from(track.querySelectorAll("img"));
        imgs.forEach(img => track.appendChild(img.cloneNode(true)));
        track.__filled = true;
      });
    }
    layoutFill();

    api.ctx.on(window, "resize", () => {
      if (!spaceOn) return;
      layoutFill();
    });
  }

  function teardownSpaceUI() {
    // remove marquee + style
    try { if (sgWrap) sgWrap.remove(); } catch {}
    sgWrap = null;
    rowEls = null;

    try { if (sgStyle) sgStyle.remove(); } catch {}
    sgStyle = null;

    // fade-out gif i remove
    if (sgBgGif) {
      try { sgBgGif.style.opacity = "0"; } catch {}
      api.ctx.setTimeoutSafe(() => {
        try { sgBgGif.remove(); } catch {}
        sgBgGif = null;
      }, 500);
    }

    // oddaj kontrolę background do CSS (czyli wraca jak było)
    document.body.style.backgroundImage = "";
  }

  function updateBtn() {
    btn.dataset.on = spaceOn ? "1" : "0";
    btn.textContent = spaceOn ? "Spacegliding: ON" : "Spacegliding: OFF";
  }

  async function setSpace(on) {
    spaceOn = !!on;
    updateBtn();
    document.body.classList.toggle("spaceglide", spaceOn);

    if (spaceOn) {
      ensureSpaceUI();

      // audio tylko w Spaceglide
      if (playlist.length) {
        try { await playCurrent(); } catch {}
      }

    } else {

      // stop audio
      try { audio.pause(); } catch {}
      try { audio.currentTime = 0; } catch {}

      teardownSpaceUI();
    }
  }

  // UI - przycisk
  const root = document.getElementById("plugin-root") || document.body;

  const wrap = document.createElement("div");
  const btn = document.createElement("button");
  btn.type = "button";

  wrap.style.position = "fixed";
  wrap.style.left = "50%";
  wrap.style.top = "4%";
  wrap.style.transform = "translate(-50%, -50%)";
  wrap.style.zIndex = "99999";
  wrap.style.pointerEvents = "none";

  btn.style.pointerEvents = "auto";
  btn.style.padding = "8px 12px";
  btn.style.fontSize = "12px";
  btn.style.fontWeight = "800";
  btn.style.borderRadius = "999px";
  btn.style.border = "1px solid rgba(42,255,140,0.9)";
  btn.style.background = "rgba(0,0,0,0.82)";
  btn.style.color = "rgba(42,255,140,0.95)";
  btn.style.cursor = "pointer";

  btn.addEventListener("click", () => setSpace(!spaceOn));

  wrap.appendChild(btn);
  root.appendChild(wrap);

  updateBtn();
  // ===== END SPACEGLIDING =====



  // tile -> tele (czyli już jest floating / poza tabelą)
  const floating = new Map();
  const cloaked = new Set(); // tile aktualnie "na niewidce" (żeby nie brać go drugi raz)

  let nextAllowedAt = Date.now() + 15000; //delay po starcie strony 40 sek

  function now() { return Date.now(); }

  function tileFromActiveElement() {
    const ae = document.activeElement;
    return ae?.closest?.(".cell-wrapper") || null;
  }

  function allRealTiles() {
    // placeholdery mają klasę .plugin-placeholder
    return api.tiles.all().filter(t => !t.classList.contains("plugin-placeholder"));
  }

  function pickVictim() {
  const focused = tileFromActiveElement();

  const inTable = allRealTiles();
  const alreadyFloating = Array.from(floating.keys());

  // połącz i usuń duplikaty
  const all = Array.from(new Set([...inTable, ...alreadyFloating]));

  const candidates = all.filter(t => t && t !== focused && !cloaked.has(t));
  if (!candidates.length) return null;

  return candidates[(Math.random() * candidates.length) | 0];
}


  function playHide() { api.playSfx(pick(api.sfx?.hide), { volume: CFG.sfxHideVol }); }
  function playReveal() { api.playSfx(pick(api.sfx?.reveal), { volume: CFG.sfxRevealVol }); }

function randomSidePos() {
  const padX = CFG.sideMargin;
  const band = CFG.sideBandWidth;

  const w = window.innerWidth;
  const h = window.innerHeight;

  const xLeft = padX + Math.random() * band;
  const xRight = w - padX - band + Math.random() * band;

  let x = (Math.random() < 0.5) ? xLeft : xRight;

  const yMin = CFG.topPad;
  const yMax = Math.max(yMin, h - CFG.bottomPad -40);
  let y = yMin + Math.random() * (yMax - yMin);

  // ===== CLAMP DO VIEWPORTU =====
  const EDGE = 12; // margines bezpieczeństwa
  x = Math.max(EDGE, Math.min(w - EDGE, x));
  y = Math.max(EDGE, Math.min(h - EDGE, y));
  // ==============================

  return { x, y };
}


  function placeFloating(tele) {
  const p = randomSidePos();
  tele.floating.style.left = `${p.x}px`;
  tele.floating.style.top = `${p.y}px`;

  // korekta po layout
  requestAnimationFrame(() => {
    const r = tele.floating.getBoundingClientRect();
    const x = Math.max(8, Math.min(window.innerWidth - r.width - 8, r.left));
    const y = Math.max(8, Math.min(window.innerHeight - r.height - 8, r.top));
    tele.floating.style.left = `${x}px`;
    tele.floating.style.top = `${y}px`;
  });
}


  function cloakElement(el, on) {
    // "na niewidce": nie blokuje layoutu, nie klikalny, niewidoczny
    if (on) {
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
    } else {
      el.style.opacity = "";
      el.style.pointerEvents = "";
    }
  }

  function ensureTeleported(tile) {
    if (floating.has(tile)) return floating.get(tile);

    const tele = api.tiles.teleport(tile); // tworzy placeholder w tabeli, tile idzie do overlay
    if (!tele) return null;

    // ustawiamy pozycję od razu, ale ukryjemy go na czas cloaka
    placeFloating(tele);
    floating.set(tile, tele);
    return tele;
  }

  function VanishOnce() {
    // twardy limiter: min 30s odstępu
    if (now() < nextAllowedAt) return;
    // limit: max 6 kafelków może być poza tabelą
    if (cloaked.size >= CFG.maxFloating) return;

    const tile = pickVictim();
    if (!tile) return;

    nextAllowedAt = now() + CFG.minGapMs;

    // 1) fade→gray + hide sfx
    tile.classList.add("plugin-vanish");
    playHide();

    // po 1s kończymy animację i wchodzimy w cloak
    api.ctx.setTimeoutSafe(() => {
      tile.classList.remove("plugin-vanish");

      // 2) teleport do overlay (jeśli jeszcze nie teleportowany)
      const tele = ensureTeleported(tile);
      if (!tele) return;

      // 3) cloak 6s
      cloaked.add(tile);
      cloakElement(tile, true);

      api.ctx.setTimeoutSafe(() => {
        // 4) pojawia się na boku (nowa pozycja), reveal sfx
        placeFloating(tele);
        cloakElement(tile, false);
        playReveal();
        cloaked.delete(tile);
      }, CFG.cloakMs);

    }, CFG.vanishAnimMs);
  }

  // Uruchamiaj automatycznie co sekundę, ale 
  api.ctx.setIntervalSafe(() => {
    VanishOnce();
  }, 1000);

  // Debug hotkey: Ctrl+Alt+P wymusza (ignoruje gap? NIE — respektuje gap)
  api.ctx.on(document, "keydown", (e) => {
    if (e.ctrlKey && e.altKey && (e.key === "p" || e.key === "P")) {
      VanishOnce();
    }
  });



  return () => {
  try { setSpace(false); } catch {}
  try { wrap.remove(); } catch {}
  api.ctx.destroy();
};


};
