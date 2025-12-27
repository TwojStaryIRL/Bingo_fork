(() => {
  // === CONFIG ===
  const CFG = {
    // mp3 które ma zagrać podczas fade-out
    SFX_SRC: "/static/bingo/sfx/intoraffle.mp3",

    // ile trwa fade do czerni (ms)
    FADE_MS: 12670,

    // na ile ms pokazać obrazek na "dropie"
    DROP_IMG_MS: 3000,

    // obrazek który ma wyskoczyć na dropie
    DROP_IMG_SRC: "/static/bingo/images/absolutne.jpg",

    // kiedy pokazać obrazek względem startu muzyki (ms)
    // (np. 1500 = po 1.5s od kliknięcia)
    DROP_AT_MS: 1000*15,

    // docelowa głośność sfx
    SFX_VOL: 0.15,

    // jeśli audio nie ruszy (autoplay / błąd) → i tak przechodzimy po tym czasie
    FALLBACK_NAV_MS: 25000,
  };

  // tylko na /game/
  if (!String(location.pathname || "").includes("game")) return;

  function ensureOverlay() {
    let ov = document.getElementById("transition-ov");
    if (ov) return ov;

    ov = document.createElement("div");
    ov.id = "transition-ov";
    ov.style.position = "fixed";
    ov.style.inset = "0";
    ov.style.background = "rgba(0,0,0,0)";
    ov.style.opacity = "0";
    ov.style.pointerEvents = "none";
    ov.style.zIndex = "2147483644";
    ov.style.transition = `opacity ${CFG.FADE_MS}ms ease`;
    document.body.appendChild(ov);
    return ov;
  }

  function ensureDropImg() {
    let img = document.getElementById("transition-drop-img");
    if (img) return img;

    img = document.createElement("img");
    img.id = "transition-drop-img";
    img.src = CFG.DROP_IMG_SRC;
    img.alt = "drop";
    img.style.position = "fixed";
    img.style.inset = "0";
    img.style.margin = "auto";
    img.style.maxWidth = "72vw";
    img.style.maxHeight = "72vh";
    img.style.opacity = "0";
    img.style.transform = "scale(0.98)";
    img.style.transition = "opacity 140ms ease, transform 140ms ease";
    img.style.pointerEvents = "none";
    img.style.zIndex = "2147483645";
    document.body.appendChild(img);
    return img;
  }

  function fadeOutEverything() {
    const ov = ensureOverlay();
    ov.style.pointerEvents = "auto";
    // czarne tło z fade
    requestAnimationFrame(() => {
      ov.style.opacity = "1";
      ov.style.background = "black";
    });
  }

  function showDrop() {
    const img = ensureDropImg();
    img.style.opacity = "1";
    img.style.transform = "scale(1)";
    setTimeout(() => {
      img.style.opacity = "0";
      img.style.transform = "scale(0.98)";
    }, CFG.DROP_IMG_MS);
  }

  async function playSfx() {
    const a = new Audio(CFG.SFX_SRC);
    a.preload = "auto";
    a.volume = Math.max(0, Math.min(1, Number(CFG.SFX_VOL) || 1));

    // ważne: to jest wywoływane po kliknięciu usera, więc powinno przejść autoplay
    await a.play();
    return a;
  }

  function findRaffleLink(el) {
    // klik mógł być w środku (span itp.)
    const a = el?.closest?.("a.btn.btn--secondary");
    if (!a) return null;

    const href = a.getAttribute("href") || "";
    // celujemy w /raffle/ lub url z nazwy
    if (!href.includes("raffle")) return null;
    return a;
  }

  let locked = false;

  document.addEventListener("click", async (e) => {
    const a = findRaffleLink(e.target);
    if (!a) return;

    // blokuj podwójne kliknięcia
    if (locked) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    locked = true;

    // zatrzymaj natychmiastową nawigację
    e.preventDefault();
    e.stopPropagation();

    const targetHref = a.href;

    // fade do czerni
    fadeOutEverything();

    // odpal muzykę + ustaw fallback nawigacji
    let navDone = false;
    const fallbackTimer = setTimeout(() => {
      if (navDone) return;
      navDone = true;
      location.href = targetHref;
    }, CFG.FALLBACK_NAV_MS);

    try {
      const audio = await playSfx();

      // drop obrazka w określonym momencie
      setTimeout(() => {
        // jak już nawigujemy, nie ma sensu
        if (navDone) return;
        showDrop();
      }, CFG.DROP_AT_MS);

      // kiedy audio dobiegnie końca → przejście
      audio.addEventListener("ended", () => {
        if (navDone) return;
        navDone = true;
        clearTimeout(fallbackTimer);
        location.href = targetHref;
      });
    } catch {
      // jeśli audio nie ruszy, fallback zrobi przejście
    }
  }, true);
})();
