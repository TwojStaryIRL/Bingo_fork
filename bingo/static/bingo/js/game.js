(() => {

    console.log("123");


  // ===== SAVE SOUND (global, for everyone) =====
    function playAudio(
      id = "rerollSound",
      {
        volume = 1.0,
        reset = true,
        log = false
      } = {}
    ) {
      const audio = document.getElementById(id);

      if (!audio) {
        if (log) console.log(`[playAudio] no element #${id}`);
        return false;
      }

      audio.volume = Math.max(0, Math.min(1, volume));
      if (reset) audio.currentTime = 0;

      const p = audio.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          if (log) console.log(`[playAudio] OK #${id} vol=${audio.volume}`);
        }).catch(err => {
          if (log) console.error(`[playAudio] FAILED #${id}:`, err?.name, err?.message);
        });
      }

      return true;
    }


    // END OF SOUND

  // bierzemy helpery z app.js
  const { getCookie, showToast } = window.Bingo || {};

  function getJSONScript(id, fallback = null) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    try { return JSON.parse(el.textContent || "null"); } catch { return fallback; }
  }

  const CURRENT_USER = getJSONScript("current-user", "");
  const SAVED = getJSONScript("saved-grid", {}) || {};

  function loadSavedGrid() {
    const grid = SAVED.grid;
    if (!Array.isArray(grid)) return;

    const byCell = new Map();
    grid.forEach(item => {
      if (item && item.cell) byCell.set(item.cell, item);
    });

    document.querySelectorAll(".cell-wrapper").forEach(w => {
      const textarea = w.querySelector("textarea");
      const select = w.querySelector("select");
      const cellId = textarea?.dataset?.cell;
      const item = cellId ? byCell.get(cellId) : null;
      if (!item) return;

      textarea.value = item.text || "";
      select.value = item.assigned_user || "";

      const btn = w.querySelector(".cd__button");
      if (btn) {
        const opt = [...select.options].find(o => o.value === select.value);
        btn.textContent = opt ? opt.text : "—";
      }
    });
  }

  function burstConfetti(count = 90) {
    const table = document.querySelector(".grid-table");
    if (!table) return;

    const rect = table.getBoundingClientRect();
    const leftX = rect.left - 10;
    const rightX = rect.right + 10;
    const floorY = window.innerHeight + 6;

    const wrap = document.createElement("div");
    wrap.className = "confetti";
    document.body.appendChild(wrap);

    const colors = ["#2AFF8C", "#00CDB4", "#FFFFFF", "#4C7DFF", "#FFD24C"];

    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "confetti__piece";

      const fromLeft = Math.random() < 0.5;

      const startX = (fromLeft ? leftX : rightX) + (Math.random() * 20 - 10);
      const startY = floorY + (Math.random() * 10);

      p.style.left = startX + "px";
      p.style.top = startY + "px";

      const dx = (fromLeft ? -1 : 1) * (Math.random() * 180 + 80);
      const dy = -(Math.random() * 520 + 380);

      const rot = (Math.random() * 900 - 450) + "deg";
      const dur = (Math.random() * 0.55 + 0.95);
      const delay = Math.random() * 0.06;

      const w = Math.random() * 6 + 6;
      const h = Math.random() * 10 + 10;

      p.style.width = w + "px";
      p.style.height = h + "px";
      p.style.background = colors[(Math.random() * colors.length) | 0];

      p.style.setProperty("--dx", dx + "px");
      p.style.setProperty("--dy", dy + "px");
      p.style.setProperty("--rot", rot);

      p.style.animationDuration = dur + "s";
      p.style.animationDelay = delay + "s";

      wrap.appendChild(p);
    }

    setTimeout(() => wrap.remove(), 1000);
  }

    const MAX_PER_USER = 2;

  function getActiveSelects() {
    // 
    return Array.from(document.querySelectorAll(
      ".cell-wrapper:not(.plugin-placeholder) select.cell-user--inside"
    ));
  }

  function countPicks() {
    const counts = new Map();
    for (const sel of getActiveSelects()) {
      const v = (sel.value || "").trim();
      if (!v) continue;
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    return counts;
  }

  function setCustomOptionDisabled(wrapper, value, disabled) {
    const optDiv = wrapper.querySelector(`.cd__option[data-value="${CSS.escape(value)}"]`);
    if (!optDiv) return;
    optDiv.classList.toggle("cd__option--disabled", !!disabled);
    optDiv.setAttribute("aria-disabled", disabled ? "true" : "false");
  }

  const UNLIMITED_USERS = new Set(["Ktoś", "Event", "Ktokolwiek"]);

  function applyUserPickRules({ toastOnViolation = false, changedSelect = null, prevValue = "" } = {}) {
    const counts = countPicks();
    const selects = getActiveSelects();

    for (const sel of selects) {
      const wrapper = sel.closest(".cell-wrapper");
      if (!wrapper) continue;

      for (const opt of Array.from(sel.options)) {
        const val = (opt.value || "").trim();
        if (!val) continue;

        const isSelf = (val === CURRENT_USER);
        const picked = counts.get(val) || 0;
        const isUnlimited = UNLIMITED_USERS.has(val);

        const shouldDisableByLimit =
        !isUnlimited && (picked >= MAX_PER_USER) && (sel.value !== val);
        // const shouldDisableByLimit = (picked >= MAX_PER_USER) && (sel.value !== val);

        const disabled = isSelf || shouldDisableByLimit;

        opt.disabled = disabled;

        // zaktualizuj UI 
        setCustomOptionDisabled(wrapper, val, disabled);
      }
    }

    
    if (toastOnViolation && changedSelect) {
      const v = (changedSelect.value || "").trim();

      if (v === CURRENT_USER) {
        changedSelect.value = prevValue || "";
        changedSelect.dispatchEvent(new Event("change", { bubbles: true }));
        showToast?.("Nie możesz wybrać samego siebie.", "error", 2600);
        return;
      }

      if (!UNLIMITED_USERS.has(v)) {
        const c = countPicks().get(v) || 0;
        if (v && c > MAX_PER_USER) {
          changedSelect.value = prevValue || "";
          changedSelect.dispatchEvent(new Event("change", { bubbles: true }));
          showToast?.(`Nick "${v}" może być przypisany maksymalnie ${MAX_PER_USER} razy.`, "error", 2800);
          return;
        }

      }
    }
  }




  function enhanceDropdowns() {
    function closeAll(exceptWrapper = null) {
      document.querySelectorAll(".cd--open").forEach(w => {
        if (w !== exceptWrapper) w.classList.remove("cd--open");
      });
    }

    function enhanceOne(select) {
      select.setAttribute("aria-hidden", "true");
      select.tabIndex = -1;
      select.style.position = "absolute";
      select.style.left = "-99999px";
      select.style.width = "1px";
      select.style.height = "1px";
      select.style.opacity = "0";
      select.style.pointerEvents = "none";

      const wrapper = select.closest(".cell-wrapper");
      if (!wrapper) return;
      wrapper.classList.add("cd");

      if (wrapper.querySelector(".cd__button")) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cd__button";

      const list = document.createElement("div");
      list.className = "cd__list";

      function syncFromSelect() {
        const opt = select.options[select.selectedIndex];
        btn.textContent = opt ? opt.text : "—";
      }

        [...select.options].forEach(opt => {
        const div = document.createElement("div");
        div.className = "cd__option";
        div.dataset.value = opt.value || "";          
        if (!opt.value) div.classList.add("cd__option--muted");
        div.textContent = opt.text;

        div.addEventListener("click", (e) => {
          e.stopPropagation();

          
          if (div.classList.contains("cd__option--disabled")) return;

          select.value = opt.value;
          // event change 
          select.dispatchEvent(new Event("change", { bubbles: true }));

          syncFromSelect();
          wrapper.classList.remove("cd--open");
        });

        list.appendChild(div);
      });


      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = wrapper.classList.contains("cd--open");
        closeAll(wrapper);
        wrapper.classList.toggle("cd--open", !isOpen);
      });

      list.addEventListener("click", (e) => e.stopPropagation());

      const anchor = document.createElement("div");
      anchor.className = "cd__anchor";
      anchor.appendChild(btn);
      anchor.appendChild(list);
      wrapper.appendChild(anchor);

      syncFromSelect();
    }

    document.querySelectorAll("select.cell-user--inside").forEach(enhanceOne);
    document.addEventListener("click", () => closeAll(null));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll(null);
    });
  }

//end of sfx //end of sfx //end of sfx //end of sfx //end of sfx 
  
  async function onSave() {
    
    const wrappers = document.querySelectorAll(".cell-wrapper:not(.plugin-placeholder)");
    const grid = [];

    wrappers.forEach(w => {
      const textarea = w.querySelector("textarea");
      const select = w.querySelector("select");

      grid.push({
        cell: textarea?.dataset?.cell || null,
        text: (textarea?.value || "").trim(),
        assigned_user: (select?.value || "") || null
      });
    });

    const payload = {
      author: CURRENT_USER,
      timestamp: new Date().toISOString(),
      email: "",
      grid
    };

    const resp = await fetch("/game/save/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie?.("csrftoken"),
      },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      showToast?.("MAMY TO YIPIEE!!!", "success", 2200);
      playAudio("SaveSound", {volume: 0.2});
      burstConfetti(120);
    } else {
      const txt = await resp.text();
      showToast?.("Are you serious right meow :(" + (txt || ""), "error", 2600);
    }
  }

  function initPluginWhenReady() {
  // failsafe jakby plugin się długo ładował i guess
  const maxMs = 8000;
  const step = 80;
  let waited = 0;

  const t = setInterval(() => {
    const hasRuntime = !!window.BingoPluginRuntime?.initUserPlugin;
    const hasUserPlugin = typeof window.BingoUserPlugin?.init === "function";

    if (hasRuntime && hasUserPlugin) {
      clearInterval(t);
      window.BingoPluginRuntime.initUserPlugin();
      return;
    }

    waited += step;
    if (waited >= maxMs) clearInterval(t);
  }, step);
}






    document.addEventListener("DOMContentLoaded", () => {
    enhanceDropdowns();
    loadSavedGrid();

    
    applyUserPickRules();

    // nasłuchuj zmian
    let lastValueBySelect = new WeakMap();

    for (const sel of document.querySelectorAll("select.cell-user--inside")) {
      lastValueBySelect.set(sel, sel.value || "");

      sel.addEventListener("focus", () => {
        lastValueBySelect.set(sel, sel.value || "");
      });

      sel.addEventListener("change", () => {
        const prev = lastValueBySelect.get(sel) || "";
        applyUserPickRules({ toastOnViolation: true, changedSelect: sel, prevValue: prev });
        lastValueBySelect.set(sel, sel.value || "");
      });
    }

    const saveBtn = document.getElementById("save-btn");
    if (saveBtn) saveBtn.addEventListener("click", onSave);

    
    initPluginWhenReady();
  });


})();
