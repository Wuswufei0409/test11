const { chromium } = require('/opt/playtest/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/home/yinwf2/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:5200/?seed=20260917', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(7000);
  const state = await page.evaluate(() => {
    const g = window.__GAME__;
    if (!g) return { ok: false, reason: 'no __GAME__' };
    // solid ground under the player (worldgen present)
    const under = g.world.getBlock(Math.floor(g.player.pos.x), Math.floor(g.player.pos.y) - 1, Math.floor(g.player.pos.z));
    return {
      ok: true,
      hasWorld: typeof g.world.getBlock === 'function',
      hasInventory: !!g.inventory && g.inventory.length === 36,
      hotbarLatest: g.inventory[4] ? g.inventory[4].id : -1,
      totalItems: g.inventory.reduce((a, s) => a + (s.count || 0), 0),
      solidUnder: under,
      playerY: Math.round(g.player.pos.y),
      hasDrops: Array.isArray(g.drops),
    };
  });
  console.log('STATE', JSON.stringify(state));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
  const err = errors.join(';');
  const pass = state.ok && state.hasInventory && state.solidUnder > 0 && state.totalItems > 0 && !err.includes('PAGEERROR');
  console.log('PASS', pass);
  if (!pass) process.exit(1);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
