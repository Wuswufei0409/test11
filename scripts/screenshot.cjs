// Capture screenshots + a smoke check via Playwright (headless Chromium).
const { chromium } = require('/opt/playtest/node_modules/playwright');

async function main() {
  const browser = await chromium.launch({ executablePath: '/home/yinwf2/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:5200/?seed=20260917', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(6000);

  const health = await page.evaluate(() => {
    const g = window.__GAME__;
    if (!g) return { ok: false, reason: 'no __GAME__' };
    return { ok: true, pos: [g.player?.pos.x, g.player?.pos.y, g.player?.pos.z], webgl: !!g.renderer };
  });
  console.log('HEALTH', JSON.stringify(health));

  // dismiss the menu overlay; aim the natural spawn to a legible sky-over-terrain view that
  // locks the crosshair onto nearby dry ground (grass/dirt, non-water) -> visible target label (C02).
  // findSafeSpawn now guarantees the spawn's OWN forward direction has a reachable non-water
  // terrain block, so use the spawn's deterministic yaw with a gentle downward pitch to frame
  // sky-over-low-terrain while the crosshair labels terrain (NOT a forest/mountain/water wall).
  await page.evaluate(() => {
    const g = window.__GAME__;
    window.__GAME_PAUSED__ = true;
    g.player.yaw = g.spawn.yaw;
    g.player.pitch = 0.35;
    g.camera.rotation.set(0.35, g.spawn.yaw, 0);
    window.__GAME_PAUSED__ = false;
    const ov = document.getElementById('menu-overlay'); if (ov) ov.remove();
  });
  await page.waitForTimeout(2500);

  // capture the crosshair-label + block under the crosshair from the live frame
  const targetInfo = await page.evaluate(() => {
    const g = window.__GAME__;
    const label = (document.getElementById('block-label') || {}).textContent || '';
    const eye = { x: g.player.pos.x, y: g.player.pos.y + 1.62, z: g.player.pos.z };
    const dir = g.player.forward();
    let bx=Math.floor(eye.x),by=Math.floor(eye.y),bz=Math.floor(eye.z);
    const stepX=Math.sign(dir.x)||1,stepY=Math.sign(dir.y)||1,stepZ=Math.sign(dir.z)||1;
    const tdx=Math.abs(1/(dir.x||1e-9)),tdy=Math.abs(1/(dir.y||1e-9)),tdz=Math.abs(1/(dir.z||1e-9));
    let tmx=(dir.x>0?bx+1-eye.x:eye.x-bx)/(dir.x||1e-9);
    let tmy=(dir.y>0?by+1-eye.y:eye.y-by)/(dir.y||1e-9);
    let tmz=(dir.z>0?bz+1-eye.z:eye.z-bz)/(dir.z||1e-9);
    let hit=-1, dist=0, hitPos=null;
    for(let i=0;i<64;i++){
      const d=Math.min(tmx,tmy,tmz);
      if(tmx<tmy&&tmx<tmz){bx+=stepX;tmx+=tdx;} else if(tmy<tmz){by+=stepY;tmy+=tdy;} else {bz+=stepZ;tmz+=tdz;}
      const b=g.world.getBlock(bx,by,bz); if(b!==0){hit=b;dist=d;hitPos=[bx,by,bz];break;}
    }
    return { label, hitId:hit, dist, hitPos, yaw:g.player.yaw, pitch:g.player.pitch, surfaceY:g.spawn.surfaceY, spawnY:g.spawn.y, biome:g.spawn.biome };
  });
  console.log('TARGET_LABEL', JSON.stringify(targetInfo));

  await page.screenshot({ path: 'evidence/w1_render.png' });

  // top-down terrain overview (freeze, lift camera) for C03 evidence
  await page.evaluate(() => {
    window.__GAME_PAUSED__ = true;
    const g = window.__GAME__;
    g.camera.position.set(g.spawn.x, 95, g.spawn.z);
    g.camera.rotation.set(-Math.PI / 2, 0, 0);
    g.renderer.render(g.scene, g.camera);
  });
  await page.waitForTimeout(60);
  await page.screenshot({ path: 'evidence/w1_topdown.png' });

  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
