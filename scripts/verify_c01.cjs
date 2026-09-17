// C01 verification against the deployed public HTTPS URL (or any URL):
//  - first open reaches playable game within 60s,
//  - refresh does not white-screen and has no blocking console/page errors.
// Usage: node scripts/verify_c01.cjs [url]
const { chromium } = require('/opt/playtest/node_modules/playwright');
const fs = require('fs');

const URL = process.argv[2] || 'https://wuswufei0409.github.io/test11/';

function collect(page, bucket) {
  page.on('console', (m) => { if (m.type() === 'error') bucket.push('console: ' + m.text()); });
  page.on('pageerror', (e) => bucket.push('pageerror: ' + e.message));
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/yinwf2/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  collect(page, errors);

  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  // Wait for the game to be reachable (game object present) and menu overlay to render.
  let tGame = null;
  for (let i = 0; i < 60; i++) {
    const g = await page.evaluate(() => !!window.__GAME__).catch(() => false);
    if (g) { tGame = Date.now(); break; }
    await page.waitForTimeout(1000);
  }
  const tToGame = tGame ? (tGame - t0) / 1000 : null;

  // Dismiss the menu overlay so the world is live.
  const entered = await page.evaluate(() => {
    const ov = document.getElementById('menu-overlay');
    if (ov) ov.remove();
    const canvas = document.querySelector('canvas');
    return { hadOverlay: !!ov, canvas: !!canvas, fps: (document.querySelector('#fps')||{}).textContent || null };
  });
  await page.waitForTimeout(3000);
  const before = { errors: errors.slice() };

  // Refresh: must not white-screen and must not produce new blocking errors.
  const errCountBefore = errors.length;
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  let tReload = null;
  for (let i = 0; i < 40; i++) {
    const g = await page.evaluate(() => !!window.__GAME__).catch(() => false);
    if (g) { tReload = i + 1; break; }
    await page.waitForTimeout(1000);
  }
  const afterState = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const appChildren = (document.getElementById('app') || {}).childElementCount || 0;
    const ctx = canvas && canvas.getContext('2d');
    return { canvas, appChildren, has3d: typeof WebGLRenderingContext !== 'undefined', bodyBg: getComputedStyle(document.body).backgroundColor };
  });
  const newErrors = errors.slice(errCountBefore);

  const out = {
    timestamp: new Date().toISOString(),
    url: URL,
    first_open: { t_to_game_seconds: tToGame, reached: tToGame != null },
    refresh: { t_to_game_seconds_after_refresh: tReload, white_screen: !afterState.canvas && afterState.appChildren === 0 },
    after_refresh: afterState,
    console_page_errors_first: before.errors,
    console_page_errors_after_refresh: newErrors,
    blocking_error_free: errors.length === 0,
  };
  fs.writeFileSync('evidence/c01_verify.json', JSON.stringify(out, null, 2));
  console.log('C01', JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error('C01 ERROR', e && e.message); process.exit(1); });
