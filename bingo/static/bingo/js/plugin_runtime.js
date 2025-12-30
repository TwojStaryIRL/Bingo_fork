(() => {
  function clamp01(x) {
    const n = Number(x);
    if (!isFinite(n)) return 1;
    return Math.max(0, Math.min(1, n));
  }

  function getJSONScript(id, fallback = null) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    try { return JSON.parse(el.textContent || "null"); } catch { return fallback; }
  }

  function createCtx(name = "userplugin") {
    const timers = new Set();
    const listeners = [];
    let destroyed = false;

    function on(target, type, handler, opts) {
      if (destroyed) return;
      target.addEventListener(type, handler, opts);
      listeners.push([target, type, handler, opts]);
    }

    function setTimeoutSafe(fn, ms) {
      if (destroyed) return null;
      const id = setTimeout(fn, ms);
      timers.add(id);
      return id;
    }

    function setIntervalSafe(fn, ms) {
      if (destroyed) return null;
      const id = setInterval(fn, ms);
      timers.add(id);
      return id;
    }

    function destroy() {
      destroyed = true;
      timers.forEach(id => { clearTimeout(id); clearInterval(id); });
      timers.clear();
      listeners.forEach(([t, ty, h, o]) => t.removeEventListener(ty, h, o));
      listeners.length = 0;
    }

    return { name, on, setTimeoutSafe, setIntervalSafe, destroy };
  }

  function playSfx(url, { volume = 0.35 } = {}) {
    if (!url) return false;
    const a = new Audio(url);
    a.volume = clamp01(volume);
    a.currentTime = 0;
    a.play().catch(() => {});
    return true;
  }

  // hooks: core -> plugin event bus
  function createHooks() {
    const map = new Map();
    function on(event, fn) {
      if (!map.has(event)) map.set(event, new Set());
      map.get(event).add(fn);
      return () => map.get(event)?.delete(fn);
    }
    function emit(event, payload) {
      const set = map.get(event);
      if (!set) return;
      set.forEach(fn => { try { fn(payload); } catch {} });
    }
    return { on, emit };
  }

  const hooks = createHooks();

  // overlay root 
  function root() { return document.getElementById("plugin-root"); }

  // tiles API 
  function tilesAll() {
    return Array.from(document.querySelectorAll(".cell-wrapper"));
  }

  function tilesPickRandom(except = null) {
    const arr = tilesAll().filter(x => x !== except);
    if (!arr.length) return null;
    return arr[(Math.random() * arr.length) | 0];
  }

  function focusRect() {
    const ae = document.activeElement;
    if (ae && ae.getBoundingClientRect) return ae.getBoundingClientRect();
    const panel = document.querySelector(".panel") || document.body;
    return panel.getBoundingClientRect();
  }

  function randomPosNearRect(rect) {
    const pad = 18;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (Math.random() * 260 - 130);
    const dy = (Math.random() * 220 - 110);
    const x = Math.max(pad, Math.min(window.innerWidth - pad, cx + dx));
    const y = Math.max(pad, Math.min(window.innerHeight - pad, cy + dy));
    return { x, y };
  }

  function teleportTile(tileWrapper) {
    const r = root();
    if (!r || !tileWrapper) return null;

    const parent = tileWrapper.parentElement; // <td>
    if (!parent) return null;

    const ph = document.createElement("div");
    ph.className = "cell-wrapper plugin-placeholder";
    ph.textContent = "—";
    parent.replaceChild(ph, tileWrapper);

    const floating = document.createElement("div");
    floating.className = "plugin-floating";
    floating.appendChild(tileWrapper);
    r.appendChild(floating);

    return { floating, tileWrapper, anchorParent: parent, placeholder: ph };
  }

  function returnTile(tele, targetTd = null) {
    if (!tele) return false;
    const { floating, tileWrapper, anchorParent, placeholder } = tele;

    if (floating && floating.parentElement) floating.parentElement.removeChild(floating);

    const dest = targetTd || anchorParent;
    if (!dest) return false;

    if (placeholder && placeholder.parentElement === dest) {
      dest.replaceChild(tileWrapper, placeholder);
    } else {
      dest.appendChild(tileWrapper);
      if (placeholder && placeholder.parentElement) placeholder.parentElement.removeChild(placeholder);
    }
    return true;
  }

  function initUserPlugin() {
    const initFn = window.BingoUserPlugin?.init;
    if (typeof initFn !== "function") return null;

    const ctx = createCtx("userplugin");
    const sfx = getJSONScript("plugin-sfx", {}) || {};

    const api = {
      ctx,
      sfx,
      playSfx,
      hooks,
      tiles: {
        all: tilesAll,
        pickRandom: tilesPickRandom,
        teleport: teleportTile,
        return: returnTile,
        focusRect,
        randomPosNear: randomPosNearRect,
      }
    };

    let cleanup = null;
    try { cleanup = initFn(api); } catch (e) { console.error("[runtime] plugin init error:", e); }

    window.addEventListener("beforeunload", () => {
      try { if (typeof cleanup === "function") cleanup(); } catch {}
      ctx.destroy();
    });

    return api;
  }

  window.BingoPluginRuntime = { initUserPlugin, hooks, getJSONScript };
})();
