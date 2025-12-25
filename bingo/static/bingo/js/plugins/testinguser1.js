window.BingoUserPlugin.init = function(api) {

  // ===== DIAGNOSTYKA ŁADOWANIA PLUGINU I SFX =====
  console.groupCollapsed(
    "%c[Bingo Plugin] testinguser1 – init OK",
    "color:#2AFF8C;font-weight:bold"
  );

  if (!api.sfx || Object.keys(api.sfx).length === 0) {
    console.warn("❌ No SFX provided for this user");
  } else {
    console.log("✅ SFX loaded");

    // ładna tabelka: typ -> index -> url
    const table = [];
    for (const [type, list] of Object.entries(api.sfx)) {
      if (!Array.isArray(list)) continue;
      list.forEach((url, i) => {
        table.push({
          type,
          index: i,
          file: url.split("/").pop(),
          url
        });
      });
    }

    console.table(table);
  }

  console.groupEnd();
  // ===== KONIEC DIAGNOSTYKI =====



// // Contract: window.BingoUserPlugin.init(api)
// window.BingoUserPlugin = window.BingoUserPlugin || {};

// window.BingoUserPlugin.init = function(api) {
//   // wybieramy tile do pranka: losowy, ale nie ten w focusie (jeśli focus jest w tile)
//   function tileFromActiveElement() {
//     const ae = document.activeElement;
//     if (!ae) return null;
//     return ae.closest?.(".cell-wrapper") || null;
//   }

//   function prankOnce() {
//     const focusedTile = tileFromActiveElement();
//     const victim = api.tiles.pickRandom(focusedTile);
//     if (!victim) return;

//     // 1) SFX vanish
//     api.playSfx(api.sfx.vanish, { volume: 0.55 });

//     // 2) teleportuj tile do overlay
//     const tele = api.tiles.teleport(victim);
//     if (!tele) return;

//     // ustaw pozycję blisko focusa
//     const rect = api.tiles.focusRect();
//     const pos = api.tiles.randomPosNear(rect);
//     tele.floatingWrap.style.left = `${pos.x}px`;
//     tele.floatingWrap.style.top = `${pos.y}px`;

//     // 3) po 6 sekundach “pojaw się” gdzie indziej (blisko focusa) i SFX appear
//     api.ctx.setTimeoutSafe(() => {
//       // wybierz docelowe TD: blisko focusa -> bierzemy tile najbliższy focus i jego parent <td>
//       // (prosto: losujemy nowy target td z tile'i)
//       const targetTile = api.tiles.pickRandom(null);
//       const targetTd = targetTile ? targetTile.parentElement : null;

//       api.tiles.return(tele, targetTd);

//       const s = Math.random() < 0.5 ? api.sfx.appear1 : api.sfx.appear2;
//       api.playSfx(s, { volume: 0.65 });
//     }, 6000);
//   }

//   // Trigger na test: ctrl+alt+p (żebyś mógł odpalać kiedy chcesz)
//   api.ctx.on(document, "keydown", (e) => {
//     if (e.ctrlKey && e.altKey && (e.key === "p" || e.key === "P")) {
//       prankOnce();
//     }
//   });

//   // cleanup
//   return () => {
//     api.ctx.destroy();
//   };
// };
