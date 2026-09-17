const { chromium } = require('/opt/playtest/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/home/yinwf2/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:5200/?seed=20260917', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(8000);
  const state = await page.evaluate(() => {
    const g = window.__GAME__;
    if (!g) return { ok: false, reason: 'no __GAME__' };
    // spawn a zombie via mobs wiring is internal; expose a test helper? Instead verify stats + day/night presence.
    return {
      ok: true,
      health: g.player.health, food: g.player.food, difficulty: g.stats.difficulty,
      daynight: !!g.daynight && !!document.getElementById('daynightbar'),
      mobsArr: Array.isArray(g.mobs),
      skySolid: g.world.getBlock(Math.floor(g.player.pos.x), Math.floor(g.player.pos.y) - 1, Math.floor(g.player.pos.z)),
      armorBar: !!document.querySelector('#armor'),
      statsHealth: g.stats.health,
    };
  });
  console.log('W4 STATE', JSON.stringify(state));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
  const err = errors.join(';');
  const pass = state.ok && state.daynight && state.mobsArr && state.armorBar && state.skySolid > 0 && !err.includes('PAGEERROR') && !err.includes('TypeError') && !err.includes('ReferenceError');
  console.log('PASS', pass);
  if (!pass) process.exit(1);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
