(() => {



  // ===== SAVE SOUND (global, for everyone) =====
    function playAudio(
  id = "rerollSound",
  {
    volume = 1.0,   // 0.0 – 1.0
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
        if (!opt.value) div.classList.add("cd__option--muted");
        div.textContent = opt.text;

        div.addEventListener("click", (e) => {
          e.stopPropagation();
          select.value = opt.value;
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

  async function onSave() {
    const wrappers = document.querySelectorAll(".cell-wrapper");
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
      showToast?.("UDAŁO SIĘ YIPIEE!!!", "success", 2200);
      burstConfetti(90);
      playAudio("SaveSound", {volume: 0.25});
    } else {
      const txt = await resp.text();
      showToast?.("Are you serious right meow :(" + (txt || ""), "error", 2600);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    enhanceDropdowns();
    loadSavedGrid();

    const saveBtn = document.getElementById("save-btn");
    if (saveBtn) saveBtn.addEventListener("click", onSave);
  });
})();
