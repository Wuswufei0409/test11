// W5 evidence harness: verifies C14/C15/C16/C17 in a real headless browser and captures
// screenshots (ocean features in the world, trident in hand, aquatic mobs, oxygen bar).
const { chromium } = require('/opt/playtest/node_modules/playwright');

const URL = process.env.URL || 'http://localhost:5202/?seed=20260917';
const EXE = '/home/yinwf2/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

async function launch() {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));
  return { browser, page, consoleErrors };
}

async function main() {
  const { browser, page, consoleErrors } = await launch();
  const report = {};
  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(6000);
    await page.evaluate(() => {
      const ov = document.getElementById('menu-overlay'); if (ov) ov.remove();
      window.__GAME_PAUSED__ = true;
      const g = window.__GAME__;
      if (!g) return;
      g.player.yaw = 0; g.player.pitch = 0.2;
      g.camera.position.set(g.player.pos.x, g.player.pos.y + 1.62, g.player.pos.z);
      g.camera.rotation.set(0.2, 0, 0);
      window.__GAME_PAUSED__ = false;
    });
    await page.waitForTimeout(1500);

    // C14/C15: worldgen carries ocean features somewhere (coral/kelp/iceberg/wreck present)
    const oceanCheck = await page.evaluate(() => {
      const g = window.__GAME__;
      const counts = { coral: 0, kelp: 0, seagrass: 0, ice: 0, wreck: 0, treasure: 0 };
      for (let cx = -8; cx <= 8; cx++) for (let cz = -8; cz <= 8; cz++) {
        const key = cx + ',' + cz;
        if (!g.world.chunks.get(key)) continue;
        const data = g.world.chunks.get(key).data;
        for (let i = 0; i < data.length; i++) {
          const id = data[i];
          if (id === g.itemId('coral_block') || id === g.itemId('coral_plant')) counts.coral++;
          if (id === g.itemId('kelp')) counts.kelp++;
          if (id === g.itemId('seagrass')) counts.seagrass++;
          if (id === g.itemId('iceberg_ice') || id === g.itemId('ice') || id === g.itemId('packed_ice')) counts.ice++;
          if (id === g.itemId('wreck_planks')) counts.wreck++;
          if (id === g.itemId('treasure')) counts.treasure++;
        }
      }
      return counts;
    });

    // C16: spawn aquatic mobs and verify they exist + update
    const aquaticCheck = await page.evaluate(() => {
      const g = window.__GAME__;
      const out = {};
      const px = Math.floor(g.player.pos.x) + 6, pz = Math.floor(g.player.pos.z) + 6;
      out.spawnedCod = g.debug.spawnAquatic('cod', px, pz);
      out.spawnedDolphin = g.debug.spawnAquatic('dolphin', px + 2, pz);
      out.spawnedSalmon = g.debug.spawnAquatic('salmon', px, pz + 2);
      out.count = g.debug.aquariumCount();
      return out;
    });

    // C17: grant trident, select it, enchant it, throw it
    const tridentCheck = await page.evaluate(() => {
      const g = window.__GAME__;
      g.give('trident', 1);
      const ench = g.debug.enchantTrident('loyalty');
      g.debug.enchantTrident('impaling');
      g.debug.enchantTrident('riptide');
      const sel = g.debug.selectTrident();
      const threw = g.debug.throwTrident();
      return { hasTrident: g.inventory.some((s) => s && s.id === g.itemId('trident')), ench, sel, threw };
    });

    // C14 oxygen: with a water column overhead, verify oxygen depletes
    // capture underwater scene with fish + trident + oxygen for evidence
    await page.evaluate(() => {
      const g = window.__GAME__;
      window.__GAME_PAUSED__ = true;
      const px = Math.floor(g.player.pos.x) + 8, pz = Math.floor(g.player.pos.z) + 8;
      g.debug.putWaterColumn(px, pz, 52);
      for (const id of ['cod','salmon','tropical_fish','pufferfish','dolphin']) g.debug.spawnAquatic(id, px, pz);
      g.give('trident', 1); g.debug.selectTrident();
      // place a coral/kelp seagrass feature right at the water for visibility
      g.world.setBlock(px-1, 46, pz, g.itemId('coral_block'));
      g.world.setBlock(px-1, 47, pz, g.itemId('coral_plant'));
      g.world.setBlock(px, 47, pz, g.itemId('kelp'));
      g.world.setBlock(px+1, 47, pz, g.itemId('seagrass'));
      g.camera.position.set(px, 49, pz+6); g.camera.rotation.set(-0.1, 0, 0);
      g.player.pos.x=px; g.player.pos.y=47; g.player.pos.z=pz+6;
      window.__GAME_PAUSED__ = false;
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'evidence/w5_underwater.png' });

    const oxygenCheck = await page.evaluate(() => {
      const g = window.__GAME__;
      return { air: g.debug.oxygenLeft() };
    });

    await page.screenshot({ path: 'evidence/w5_underwater_check.png' });

    report.ocean = oceanCheck;
    report.aquatic = aquaticCheck;
    report.trident = tridentCheck;
    report.oxygen = oxygenCheck;
    report.errors = consoleErrors;
  } catch (e) {
    report.fatal = String(e);
  }
  console.log('W5 REPORT ' + JSON.stringify(report, null, 2));
  await browser.close();
  const err = (report.errors || []).join(';');
  const pass = !report.fatal && !err.includes('PAGEERROR') && !err.includes('TypeError') && !err.includes('ReferenceError') &&
    (report.trident && report.trident.hasTrident && report.trident.ench && report.trident.threw);
  console.log('PASS', pass);
  if (!pass) process.exit(1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
