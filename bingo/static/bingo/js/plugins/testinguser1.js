window.BingoUserPlugin = window.BingoUserPlugin || {};

window.BingoUserPlugin.init = function (api) {
  const pick = (arr) => (Array.isArray(arr) && arr.length ? arr[(Math.random() * arr.length) | 0] : null);

  const CFG = {
    maxFloating: 6,
    vanishAnimMs: 1000,      // 1s fade→gray w tabeli / na stronie
    cloakMs: 7000,           // ile ma być "na niewidce" po zniknięciu
    minGapMs: 45000,         // >= 45s przerwy między prankami
    sfxHideVol: 0.35,
    sfxRevealVol: 0.35,

    // side spawn:
    sideMargin: 12,
    sideBandWidth: 220,      
    topPad: 10,
    bottomPad: 10,
  };

  // ===== SPACEGLIDING TOGGLE =====
  const MUSIC_URL = "/static/bingo/sfx/everything_black.mp3"; 
  let spaceOn = false;

  const music = new Audio(MUSIC_URL);
  music.loop = true;
  music.preload = "auto";
  music.volume = 0.35; // 

  function updateBtn() {
    btn.dataset.on = spaceOn ? "1" : "0";
    btn.textContent = spaceOn ? "Spacegliding: ON" : "Spacegliding: OFF";
  }

  async function setSpace(on) {
    spaceOn = !!on;
    updateBtn();

    document.body.classList.toggle("spaceglide", spaceOn);

    if (spaceOn) {
      // play() może zwrócić promise i czasem się wywali — łapiemy
      try { await music.play(); } catch (e) { console.log("[space] play blocked:", e?.name); }
    } else {
      music.pause();
      music.currentTime = 0;
    }
  }

  // UI - przycisk manualnie dodany do strony
  const root = document.getElementById("plugin-root") || document.body;

  const wrap = document.createElement("div");
  const btn = document.createElement("button");
  btn.type = "button";

  // ===== STYLE: ŚRODEK EKRANU =====
  wrap.style.position = "fixed";
  wrap.style.left = "50%";
  wrap.style.top = "90%";
  wrap.style.transform = "translate(-50%, -50%)";
  wrap.style.zIndex = "99999";
  wrap.style.pointerEvents = "none";

  btn.style.pointerEvents = "auto";
  btn.style.padding = "18px 28px";
  btn.style.fontSize = "20px";
  btn.style.fontWeight = "800";
  btn.style.borderRadius = "999px";
  btn.style.border = "2px solid rgba(42,255,140,0.9)";
  btn.style.background = "rgba(0,0,0,0.82)";
  btn.style.color = "rgba(42,255,140,0.95)";
  btn.style.cursor = "pointer";

  btn.addEventListener("click", () => setSpace(!spaceOn));

  wrap.appendChild(btn);
  root.appendChild(wrap);

  // default OFF
  updateBtn();

  // opcjonalnie: komenda w konsoli
  window.testinguser1 = window.testinguser1 || {};
  window.testinguser1.space = (on) => setSpace(on);
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
    const tiles = allRealTiles().filter(t => t !== focused && !cloaked.has(t));
    if (!tiles.length) return null;
    return tiles[(Math.random() * tiles.length) | 0];
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

  function prankOnce() {
    // twardy limiter: min 30s odstępu
    if (now() < nextAllowedAt) return;
    // limit: max 6 kafelków może być poza tabelą
    if (floating.size >= CFG.maxFloating) return;

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

  // Uruchamiaj automatycznie co sekundę, ale prank odpali max co 30s
  api.ctx.setIntervalSafe(() => {
    prankOnce();
  }, 1000);

  // Debug hotkey: Ctrl+Alt+P wymusza (ignoruje gap? NIE — respektuje gap)
  api.ctx.on(document, "keydown", (e) => {
    if (e.ctrlKey && e.altKey && (e.key === "p" || e.key === "P")) {
      prankOnce();
    }
  });

  // Jeśli chcesz żeby to działo się tylko po save:
  // api.hooks.on("save:ok", prankOnce);

  return () => {
  try { style.remove(); } catch {}
  api.ctx.destroy();
};

};
