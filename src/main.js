import { initGame } from './game.js';

// Seed: fixed default for reproducibility; override via ?seed=NNN
const seed = (() => {
  const p = new URLSearchParams(location.search).get('seed');
  if (p !== null) {
    const n = parseInt(p, 10);
    if (!isNaN(n)) return n >>> 0;
  }
  return 20260917;
})();

window.__GAME__ = initGame({ seed });
