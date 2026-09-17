const { chromium } = require('/opt/playtest/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/home/yinwf2/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:5200/?seed=20260917', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(7000);
  await page.evaluate(() => { const ov = document.getElementById('menu-overlay'); if (ov) ov.remove(); });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'evidence/w2_firstperson.png' });
  // open inventory panel
  await page.evaluate(() => { window.__GAME__.toggleInventory(); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'evidence/w2_inventory.png' });
  console.log('SHOT', JSON.stringify({ ok: true, invLen: await page.evaluate(() => window.__GAME__.inventory.length) }));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
