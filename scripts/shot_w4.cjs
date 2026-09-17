const { chromium } = require('/opt/playtest/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/home/yinwf2/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:5200/?seed=20260917', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(7000);
  await page.evaluate(() => { const o = document.getElementById('menu-overlay'); if (o) o.remove(); });

  await page.evaluate(() => { window.__GAME__.debug.forceDay(); });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'evidence/w4_day.png' });

  await page.evaluate(() => {
    const d = window.__GAME__.debug; d.forceNight();
    d.spawnMobAt('zombie', 3, 2); d.spawnMobAt('zombie', -3, 2); d.spawnMobAt('spider', 2, -3);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'evidence/w4_night_mobs.png' });

  await page.evaluate(() => {
    const d = window.__GAME__.debug; d.give(122, 1); d.give(124, 1); d.damage(6); d.setSelected(0);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'evidence/w4_combat_hud.png' });

  await page.evaluate(() => {
    const g = window.__GAME__; const d = g.debug;
    const px = Math.floor(g.player.pos.x), py = Math.floor(g.player.pos.y), pz = Math.floor(g.player.pos.z);
    for (let i = 1; i <= 3; i++) { g.setBlock(px + 2, py - 1, pz + i, 34); d.cropAt(px + 2, py, pz + i, 'wheat', 8); }
    d.forceDay();
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'evidence/w4_farm.png' });

  await page.evaluate(() => {
    const d = window.__GAME__.debug; d.give(100, 8); d.give(104, 6); d.give(105, 12); d.give(108, 3); d.give(113, 2); d.give(114, 16);
  });
  await page.evaluate(() => { window.__GAME__.toggleInventory(); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'evidence/w4_inventory.png' });

  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
  if (errors.some((e) => e.includes('PAGEERROR') || e.includes('TypeError') || e.includes('ReferenceError'))) process.exit(1);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
