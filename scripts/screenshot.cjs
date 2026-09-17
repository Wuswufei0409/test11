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
      pos: [g.player?.pos.x, g.player?.pos.y, g.player?.pos.z],
      webgl: !!g.renderer,
    };
  });
  console.log('HEALTH', JSON.stringify(health));

  // dismiss the menu overlay so the clean first-person render is captured
  await page.evaluate(() => {
    const ov = document.getElementById('menu-overlay');
    if (ov) ov.remove();
  });

  // wait, take screenshot
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'evidence/w1_render.png' });

  // pixel legibility check: sample center + scene colors from the rendered frame
  const px = await page.evaluate(() => {
    const g = window.__GAME__;
    const gl = g.renderer.getContext();
    const w = g.renderer.domElement.width, h = g.renderer.domElement.height;
    const d = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, d);
    let green = 0, brown = 0, water = 0, sky = 0, nonUniform = 0, n = w * h;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g2 = d[i + 1], b = d[i + 2];
      // terrain green (grass/leaves)
      if (g2 > 80 && r > 40 && g2 > r * 1.15 && b < g2) green++;
      // brown (dirt/wood/ground)
      else if (r > 90 && r > g2 * 1.2 && g2 > 60 && b < g2) brown++;
      // deep water blue
      else if (b > 110 && b > r * 1.5 && b > g2) water++;
      // sky blue
      else if (b > 180 && r > 100 && g2 > 150) sky++;
      // any non-black pixel
      if (r + g2 + b > 30) nonUniform++;
    }
    return { greenPct: (green / n * 100).toFixed(1), brownPct: (brown / n * 100).toFixed(1), waterPct: (water / n * 100).toFixed(1), skyPct: (sky / n * 100).toFixed(1), contentPct: (nonUniform / n * 100).toFixed(1) };
  });
  console.log('LEGIBLE_STATS', JSON.stringify(px));

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
