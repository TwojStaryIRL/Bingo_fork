(() => {
  // ===== config =====
  const CFG = {
    STORAGE_KEY: "bingo_kyspro_gate_v2",

    // co ile ma wracać paywall (ms)
    PERIOD_MS: 5 * 30 * 1000, // 3 minuty

    // minimalny odstęp od ostatniego zdjęcia paywalla (ms)
    MIN_COOLDOWN_MS: 15 * 1000,

    // tolerancja literówek (im więcej, tym łatwiej)
    MAX_DIST_SHORT: 2,
    MAX_DIST_LONG: 3,

    ACCEPT: [
      "grzecznym chlopcem",  
      "grzecznym chłopcem",
      "jestem grzeczny",
      "jestem grzecznym chlopcem",
      "jestem grzecznym chłopcem",
      "potwierdzam ze jestem grzeczny",
      "i am a good boy",
      "im a good boy",
      "yes i am a good boy",
      "a good boy",
      "good boy"
    ],

    TITLE: "Weryfikacja dostępu",
    SUBTITLE: "Kim jesteś?",
    PLACEHOLDER: "wiesz doskonale co tutaj trzeba wpisać",
    BUTTON: "Potwierdzam - Adrian Gosek",
    ERROR: "Tatuś jest bardzo zawiedziony",
    OK: "Grzeczny chłopiec",
  };

  // ===== helpers =====
  function now() { return Date.now(); }

  function normalize(str) {
    return String(str || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function levenshtein(a, b) {
    a = normalize(a);
    b = normalize(b);
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;

    const dp = Array.from({ length: m + 1 }, (_, i) => i);
    for (let j = 1; j <= n; j++) {
      let prev = dp[0];
      dp[0] = j;
      for (let i = 1; i <= m; i++) {
        const tmp = dp[i];
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + cost);
        prev = tmp;
      }
    }
    return dp[m];
  }

  function isAccepted(input) {
    const x = normalize(input);
    if (!x) return false;

    for (const phrase of CFG.ACCEPT) {
      const p = normalize(phrase);
      if (x === p) return true;

      const d = levenshtein(x, p);
      const limit = p.length <= 18 ? CFG.MAX_DIST_SHORT : CFG.MAX_DIST_LONG;
      if (d <= limit) return true;
    }
    return false;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(CFG.STORAGE_KEY);
      return raw ? JSON.parse(raw) : { last_passed_at: 0, armed_at: 0 };
    } catch {
      return { last_passed_at: 0, armed_at: 0 };
    }
  }

  function saveState(state) {
    try { localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function whenRuntime(fn) {
    if (window.BingoPluginRuntime?.initUserPlugin) return fn();
    const t = setInterval(() => {
      if (window.BingoPluginRuntime?.initUserPlugin) {
        clearInterval(t);
        fn();
      }
    }, 40);
  }

  // ===== plugin =====
  whenRuntime(() => {
    window.BingoUserPlugin = {
      init(api) {
        const { ctx, sfx } = api;
        const root = document.getElementById("plugin-root");
        if (!root) return;

        // ===== AUDIO (loop) =====
        // Autoplay policy: startujemy dopiero po pierwszym kliknięciu / klawiszu.
        // Dodatkowo: kiedy paywall się pokazuje, też próbujemy odpalić.
        let bg = null;
        let audioUnlocked = false;

        function getAudioUrl() {
          const v = sfx?.mommy_asmr;
          // obsłuż: string albo [string]
          if (Array.isArray(v)) return v[0] ? String(v[0]) : "";
          if (typeof v === "string") return v;
          return "";
        }

        function startLoopAudio() {
          const url = getAudioUrl();
          if (!url) return false;

          if (bg && !bg.paused) return true;

          try { if (bg) { bg.pause(); bg.currentTime = 0; } } catch {}

          bg = new Audio(url);
          bg.loop = true;
          bg.volume = 0.75;
          bg.preload = "auto";

          const p = bg.play();
          if (p && typeof p.then === "function") {
            p.then(() => { audioUnlocked = true; }).catch(() => {});
          }
          return true;
        }

        function unlockAudioOnce() {
          if (audioUnlocked) return;
          startLoopAudio();
        }

        // ctx.on(window, "pointerdown", unlockAudioOnce, { once: true });
        // ctx.on(window, "keydown", unlockAudioOnce, { once: true });
        //fix przycisków

        ctx.on(document, "pointerdown", unlockAudioOnce, { once: true, capture: true });
        ctx.on(document, "keydown", unlockAudioOnce, { once: true, capture: true });

        // ===== UI =====
        const style = document.createElement("style");
        style.textContent = `
#plugin-root { position: relative; z-index: 2147483000; }

/* overlay musi ŁAPAĆ klik */
.kys-overlay{
  position: fixed; inset: 0;
  z-index: 2147483646;
  pointer-events: auto; /* <<< BLOKUJE stronę */
  background: rgba(0,0,0,.78);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  padding: 22px;
}

.kys-modal{
  width: min(520px, 92vw);
  border-radius: 18px;
  background: rgba(18,18,18,.96);
  border: 1px solid rgba(255,255,255,.10);
  box-shadow: 0 28px 90px rgba(0,0,0,.6);
  padding: 18px 18px 16px;
  color: #fff;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
}

.kys-title{ font-size: 18px; font-weight: 700; margin: 0 0 6px; }
.kys-sub{ font-size: 13px; opacity: .85; margin: 0 0 14px; line-height: 1.35; }

.kys-input{
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: #fff;
  padding: 12px 12px;
  outline: none;
  font-size: 14px;
}

.kys-row{ display:flex; gap:10px; margin-top:12px; align-items:center; }
.kys-btn{
  border: 0;
  border-radius: 12px;
  padding: 12px 14px;
  font-weight: 700;
  cursor: pointer;
  background: #ffffff;
  color: #111;
}
.kys-msg{ font-size: 12px; opacity: .9; margin-top: 10px; min-height: 16px; }
.kys-msg.error{ color: #ffb4b4; }
.kys-msg.ok{ color: #b9ffd4; }
        `;
        document.head.appendChild(style);

        let overlay = null;
        let input = null;
        let msg = null;

        function setMsg(text, kind = "") {
          if (!msg) return;
          msg.textContent = text || "";
          msg.classList.toggle("error", kind === "error");
          msg.classList.toggle("ok", kind === "ok");
        }

        function isOverlayOpen() {
          return !!overlay && root.contains(overlay);
        }

        function openGate() {
          // 
          startLoopAudio();

          // guard
          if (document.getElementById("kys-overlay")) return;

          overlay = document.createElement("div");
          overlay.className = "kys-overlay";
          overlay.id = "kys-overlay";
          overlay.setAttribute("role", "dialog");
          overlay.setAttribute("aria-modal", "true");

          const modal = document.createElement("div");
          modal.className = "kys-modal";

          const h = document.createElement("h2");
          h.className = "kys-title";
          h.textContent = CFG.TITLE;

          const s = document.createElement("p");
          s.className = "kys-sub";
          s.textContent = CFG.SUBTITLE;

          input = document.createElement("input");
          input.className = "kys-input";
          input.placeholder = CFG.PLACEHOLDER;
          input.autocomplete = "off";
          input.spellcheck = false;

          const row = document.createElement("div");
          row.className = "kys-row";

          const btn = document.createElement("button");
          btn.className = "kys-btn";
          btn.type = "button";
          btn.textContent = CFG.BUTTON;

          msg = document.createElement("div");
          msg.className = "kys-msg";

          row.appendChild(btn);

          modal.appendChild(h);
          modal.appendChild(s);
          modal.appendChild(input);
          modal.appendChild(row);
          modal.appendChild(msg);

          overlay.appendChild(modal);
          root.appendChild(overlay);

          // klik na overlay NIE ma przechodzić do strony
          ctx.on(overlay, "pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); });
          ctx.on(overlay, "click", (e) => { e.preventDefault(); e.stopPropagation(); });

          function submit() {
            const val = input.value || "";
            if (isAccepted(val)) {
              const st = loadState();
              st.last_passed_at = now();
              saveState(st);
              setMsg(CFG.OK, "ok");
              closeGate();
            } else {
              setMsg(CFG.ERROR, "error");
              try { input.select(); } catch {}
            }
          }

          ctx.on(btn, "click", submit);
          ctx.on(input, "keydown", (e) => { if (e.key === "Enter") submit(); });

          setMsg(""); // reset msg 
          ctx.setTimeoutSafe(() => input.focus(), 60);
        }


        function closeGate() {
          const el = document.getElementById("kys-overlay");
          if (el) { try { el.remove(); } catch {} }

          overlay = null;
          input = null;
          msg = null;
        }


        function shouldShowNow() {
          const st = loadState();
          const last = Number(st.last_passed_at || 0);
          const since = now() - last;

          // jeśli nigdy nie przeszedł -> od razu pokaż
          if (!last) return true;

          // cooldown
          if (since < CFG.MIN_COOLDOWN_MS) return false;

          // periodycznie
          return since >= CFG.PERIOD_MS;
        }

        function tick() {
          if (shouldShowNow()) openGate();
        }

        // start: pokaż natychmiast jeśli trzeba
        ctx.setTimeoutSafe(() => tick(), 250);

        // polling co 2s (tanie i stabilne)
        ctx.setIntervalSafe(() => tick(), 2000);

        // dodatkowo: jak wraca focus na kartę, to sprawdź
        ctx.on(window, "focus", () => tick());

        return () => {
          try { closeGate(); } catch {}
          try { style.remove(); } catch {}
          try { if (bg) { bg.pause(); bg.currentTime = 0; } } catch {}
        };
      }
    };

  });
})();
