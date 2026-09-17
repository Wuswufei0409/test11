// Capture screenshots + a smoke check via Playwright (headless Chromium).
const { chromium } = require('/opt/playtest/node_modules/playwright');

async function main() {
  const browser = await chromium.launch({ executablePath: '/home/yinwf2/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:5199/?seed=20260917', { waitUntil: 'load', timeout: 60000 });
  // let world generate + several frames render
  await page.waitForTimeout(6000);

  const health = await page.evaluate(() => {
    const g = window.__GAME__;
    if (!g) return { ok: false, reason: 'no __GAME__' };
    return {
      ok: true,
      seed: g.spawn ? undefined : undefined,
      chunks: g.world ? g.world.chunks.size : 0,
      pos: [g.player?.pos.x, g.player?.pos.y, g.player?.pos.z],
      webgl: !!g.renderer,
    };
  });
  console.log('HEALTH', JSON.stringify(health));

  // wait, take screenshot
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'evidence/w1_render.png' });

  // also capture after moving the camera/looking at terrain from above
  await page.evaluate(() => {
    const g = window.__GAME__;
    g.camera.position.set(0, 80, 0);
    g.camera.rotation.set(-Math.PI / 2.2, 0, 0);
    g.renderer.render(g.scene, g.camera);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'evidence/w1_topdown.png' });

  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
