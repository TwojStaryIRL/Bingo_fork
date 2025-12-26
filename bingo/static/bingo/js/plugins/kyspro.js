(() => {
  // ===== config =====
  const CFG = {
    STORAGE_KEY: "bingo_goodboy_gate_v1",
    // ile prób zanim dasz mu “hint”
    HINT_AFTER: 2,

    // frazy akceptowane (możesz dopisać warianty)
    ACCEPT: [
      "jestem grzecznym chlopcem",
      "jestem grzeczny",
      "tak jestem grzeczny",
      "potwierdzam ze jestem grzeczny",
      "i am a good boy",
      "im a good boy",
      "yes i am a good boy",
    ],

    // teksty UI
    TITLE: "Weryfikacja dostępu",
    SUBTITLE: "Aby kontynuować, wpisz frazę potwierdzającą.",
    PLACEHOLDER: "Wpisz frazę…",
    BUTTON: "Potwierdzam",
    HINT: "Podpowiedź: zacznij od „jestem …”",
  };

  // ===== helpers =====
  function normalize(str) {
    return String(str || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")     // diakrytyki
      .replace(/[^a-z0-9\s]/g, " ")       // znaki -> spacje
      .replace(/\s+/g, " ")               // wielokrotne spacje
      .trim();
  }

  // Levenshtein distance (tolerancja literówek)
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
        dp[i] = Math.min(
          dp[i] + 1,        // deletion
          dp[i - 1] + 1,    // insertion
          prev + cost       // substitution
        );
        prev = tmp;
      }
    }
    return dp[m];
  }

  function isAccepted(input) {
    const x = normalize(input);
    if (!x) return false;

    // exact / normalized match
    for (const phrase of CFG.ACCEPT) {
      if (x === normalize(phrase)) return true;
    }

    // fuzzy match (literówki): max 2 błędy dla krótkich, 3 dla dłuższych
    for (const phrase of CFG.ACCEPT) {
      const p = normalize(phrase);
      const d = levenshtein(x, p);
      const limit = p.length <= 18 ? 2 : 3;
      if (d <= limit) return true;
    }

    return false;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(CFG.STORAGE_KEY);
      return raw ? JSON.parse(raw) : { passed: false, tries: 0 };
    } catch {
      return { passed: false, tries: 0 };
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(state));
    } catch {}
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

        // jeśli już przeszedł gate, nic nie rób
        const state = loadState();
        if (state.passed) return;

        const root = document.getElementById("plugin-root");
        if (!root) return;

        // audio (loop) – start po pierwszej interakcji
        let bg = null;
        function startLoopAudio() {
          const url = sfx?.goodboy ? String(sfx.goodboy) : "";
          if (!url) return;

          if (bg && !bg.paused) return;

          try { if (bg) { bg.pause(); bg.currentTime = 0; } } catch {}
          bg = new Audio(url);
          bg.loop = true;
          bg.volume = 0.25;
          bg.play().catch(() => {});
        }

        // styles
        const style = document.createElement("style");
        style.textContent = `
#plugin-root { position: relative; z-index: 2147483000; }

.goodboy-overlay {
  position: fixed; inset: 0;
  z-index: 2147483646;
  background: rgba(0,0,0,.78);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  padding: 22px;
}

.goodboy-modal {
  width: min(520px, 92vw);
  border-radius: 18px;
  background: rgba(18,18,18,.96);
  border: 1px solid rgba(255,255,255,.10);
  box-shadow: 0 28px 90px rgba(0,0,0,.6);
  padding: 18px 18px 16px;
  color: #fff;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
}

.goodboy-title { font-size: 18px; font-weight: 700; margin: 0 0 6px; }
.goodboy-sub   { font-size: 13px; opacity: .85; margin: 0 0 14px; line-height: 1.35; }

.goodboy-input {
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: #fff;
  padding: 12px 12px;
  outline: none;
  font-size: 14px;
}

.goodboy-row { display: flex; gap: 10px; margin-top: 12px; align-items: center; }
.goodboy-btn {
  border: 0;
  border-radius: 12px;
  padding: 12px 14px;
  font-weight: 700;
  cursor: pointer;
  background: #ffffff;
  color: #111;
}

.goodboy-msg { font-size: 12px; opacity: .9; margin-top: 10px; min-height: 16px; }
.goodboy-msg.error { color: #ffb4b4; }
.goodboy-msg.ok { color: #b9ffd4; }

.goodboy-hint { font-size: 12px; opacity: .7; margin-top: 8px; }
        `;
        document.head.appendChild(style);

        // DOM
        const overlay = document.createElement("div");
        overlay.className = "goodboy-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");

        const modal = document.createElement("div");
        modal.className = "goodboy-modal";

        const h1 = document.createElement("h2");
        h1.className = "goodboy-title";
        h1.textContent = CFG.TITLE;

        const sub = document.createElement("p");
        sub.className = "goodboy-sub";
        sub.textContent = CFG.SUBTITLE;

        const input = document.createElement("input");
        input.className = "goodboy-input";
        input.placeholder = CFG.PLACEHOLDER;
        input.autocomplete = "off";
        input.spellcheck = false;

        const row = document.createElement("div");
        row.className = "goodboy-row";

        const btn = document.createElement("button");
        btn.className = "goodboy-btn";
        btn.type = "button";
        btn.textContent = CFG.BUTTON;

        const msg = document.createElement("div");
        msg.className = "goodboy-msg";

        const hint = document.createElement("div");
        hint.className = "goodboy-hint";
        hint.style.display = "none";
        hint.textContent = CFG.HINT;

        row.appendChild(btn);
        modal.appendChild(h1);
        modal.appendChild(sub);
        modal.appendChild(input);
        modal.appendChild(row);
        modal.appendChild(msg);
        modal.appendChild(hint);
        overlay.appendChild(modal);
        root.appendChild(overlay);

        function setMsg(text, kind = "") {
          msg.textContent = text || "";
          msg.classList.toggle("error", kind === "error");
          msg.classList.toggle("ok", kind === "ok");
        }

        function pass() {
          const s = loadState();
          s.passed = true;
          saveState(s);
          setMsg("OK ✅", "ok");
          overlay.remove();
          style.remove();
          try { if (bg) { bg.pause(); bg.currentTime = 0; } } catch {}
        }

        function fail() {
          const s = loadState();
          s.tries = (s.tries || 0) + 1;
          saveState(s);

          setMsg("Niegrzeczny chłopiec", "error");
          if (s.tries >= CFG.HINT_AFTER) hint.style.display = "block";
        }

        function submit() {
          const val = input.value || "";
          if (isAccepted(val)) pass();
          else fail();
        }

        // audio unlock: pierwsza interakcja
        const unlock = () => startLoopAudio();
        ctx.on(window, "pointerdown", unlock, { once: true });
        ctx.on(window, "keydown", unlock, { once: true });

        // obsługa
        ctx.on(btn, "click", submit);
        ctx.on(input, "keydown", (e) => {
          if (e.key === "Enter") submit();
        });

        // fokus od razu
        ctx.setTimeoutSafe(() => input.focus(), 60);

        return () => {
          try { overlay.remove(); } catch {}
          try { style.remove(); } catch {}
          try { if (bg) { bg.pause(); bg.currentTime = 0; } } catch {}
        };
      }
    };

    window.BingoPluginRuntime?.initUserPlugin?.();
  });
})();
