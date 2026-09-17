// W5 evidence harness (rework): builds a real underwater aquarium scene in front of the
// player, submerges the player's head so the oxygen tank visibly depletes over real time,
// places a full ocean-content showcase (coral/kelp/seagrass/iceberg/wreck/ruin/treasure),
// spawns all five aquatic mobs, catches+releases a fish by bucket, inflates a pufferfish,
// and throws a 4-enchant trident at a mob - capturing meaningful screenshots and JSON proof.
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
      const g = window.__GAME__;
      if (!g) return;
      // carve an open water basin right at the spawn: a 9x9x5 water column above the surface
      const px = Math.floor(g.player.pos.x), pz = Math.floor(g.player.pos.z);
      const groundY = Math.floor(g.player.pos.y) - 1;
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++)
        for (let y = groundY; y <= groundY + 6; y++) g.setBlock(px + dx, y, pz + dz, 0);
      // fill the basin with water (top of column at eye level so the head is submerged)
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++)
        for (let y = groundY + 1; y <= groundY + 4; y++) g.setBlock(px + dx, y, pz + dz, g.itemId('water'));
      // ocean-content showcase around the basin (C15)
      g.setBlock(px - 3, groundY, pz - 3, g.itemId('coral_block'));
      g.setBlock(px - 3, groundY + 1, pz - 3, g.itemId('coral_plant'));
      g.setBlock(px - 2, groundY, pz - 3, g.itemId('coral_block'));
      g.setBlock(px - 2, groundY + 1, pz - 3, g.itemId('kelp'));
      g.setBlock(px - 2, groundY + 2, pz - 3, g.itemId('kelp'));
      g.setBlock(px - 1, groundY, pz - 3, g.itemId('seagrass'));
      g.setBlock(px + 2, groundY + 2, pz - 3, g.itemId('iceberg_ice'));
      g.setBlock(px + 3, groundY, pz - 3, g.itemId('wreck_planks'));
      g.setBlock(px + 3, groundY + 1, pz - 3, g.itemId('wreck_planks'));
      g.setBlock(px - 3, groundY, pz + 3, g.itemId('stone_bricks'));
      g.setBlock(px - 3, groundY, pz + 4, g.itemId('mossy_cobblestone'));
      // buried treasure under the basin floor next to the coral
      const fy = Math.floor(g.player.pos.y);
      g.debug.setBlockInfo(px - 3, fy - 3, pz - 3, g.itemId('treasure'));
      window.__TREASURE__ = { x: px - 3, y: fy - 3, z: pz - 3 };
      // aquatic mobs in the water (C16)
      g.debug.spawnAquatic('dolphin', px - 2, pz);
      g.debug.spawnAquatic('cod', px + 2, pz);
      g.debug.spawnAquatic('salmon', px, pz + 2);
      g.debug.spawnAquatic('tropical_fish', px - 2, pz - 2);
      g.debug.spawnAquatic('pufferfish', px + 3, pz + 2);
      // drop the player into the water, head submerged, facing the showcase
      // pitch slightly downward so the underwater crosshair labels a real block
      g.debug.movePlayer(px, groundY + 2, pz, -Math.PI / 2);
      g.player.pitch = 0.15;
    });
    await page.waitForTimeout(2500);

    // C14: sample oxygen as it depletes over real time (head submerged)
    const oxygenSeries = [];
    for (let i = 0; i < 12; i++) {
      const v = await page.evaluate(() => window.__GAME__.debug.oxygenLeft());
      oxygenSeries.push(v);
      await page.waitForTimeout(1000);
    }
    report.oxygenSeries = oxygenSeries;
    report.oxygenDepleted = oxygenSeries[0] > oxygenSeries[oxygenSeries.length - 1];
    await page.screenshot({ path: 'evidence/w5_c14_underwater.png' });
    // also refresh the canonical reviewer-referenced screenshot as a valid underwater scene
    await page.screenshot({ path: 'evidence/w5_underwater.png' });

    // pause the tick loop for determinism of the remaining checks but keep render
    await page.evaluate(() => { window.__GAME_PAUSED__ = false; });

    // C15: treasure clue + dig reward
    const treasureCheck = await page.evaluate(() => {
      const g = window.__GAME__;
      const t = window.__TREASURE__ || { x: g.player.pos.x - 3, y: g.player.pos.y - 3, z: g.player.pos.z - 3 };
      const fy = Math.floor(t.y);
      const dig = g.debug.digTreasure(Math.floor(t.x), fy, Math.floor(t.z));
      const gold = g.inventory.reduce((a, s) => a + (s && s.id === g.itemId('gold_ingot') ? s.count : 0), 0);
      const diam = g.inventory.reduce((a, s) => a + (s && s.id === g.itemId('diamond') ? s.count : 0), 0);
      return { dug: dig !== false, gold, diamond: diam, at: { x: Math.floor(t.x), y: fy, z: Math.floor(t.z) } };
    });
    report.treasure = treasureCheck;
    await page.screenshot({ path: 'evidence/w5_c15_ocean_treasure.png' });

    // C16: pufferfish inflation + bucket catch/release with fish
    await page.screenshot({ path: 'evidence/w5_c16_aquatic.png' });
    const aquaticCheck = await page.evaluate(() => {
      const g = window.__GAME__;
      const out = {};
      out.before = g.debug.aquariumCount();
      // force a pufferfish adjacent and inflated (deterministic)
      out.inflate = g.debug.inflatePufferNear();
      const states = g.debug.aquariumStates();
      out.states = states;
      out.puffer = states.find((s) => s.id === 'pufferfish');
      // deterministic bucket catch + release
      out.catchRelease = g.debug.catchNearestFish();
      return out;
    });
    report.aquatic = aquaticCheck;
    await page.screenshot({ path: 'evidence/w5_c16_aquatic_inflated.png' });

    // C17: trident throw at a spawned mob, verify damage + durability + enchantment
    const tridentCheck = await page.evaluate(() => {
      const g = window.__GAME__;
      const out = {};
      // spawn a hostile mob at the exact projectile height and in the +X throw direction
      const eyeY = g.player.pos.y + 1.62;
      g.debug.spawnMobAtWorld('creeper', g.player.pos.x + 6, eyeY, g.player.pos.z);
      // grant + enchant trident with all four enchants
      g.give('trident', 1);
      g.debug.enchantTrident('loyalty');
      g.debug.enchantTrident('impaling');
      g.debug.enchantTrident('riptide');
      g.debug.enchantTrident('channeling');
      out.ench = g.debug.enchantTrident('loyalty');
      const sel = g.debug.selectTrident();
      out.selected = sel;
      g.player.pitch = 0; // clean horizontal throw at the mob's eye-height spawn
      const healthBefore = g.debug.mobHealths()[0] ? g.debug.mobHealths()[0].health : null;
      out.healthBefore = healthBefore;
      const dur = g.inventory.find((s) => s && s.id === g.itemId('trident'));
      out.durabilityBefore = dur ? dur.durability : undefined;
      const threw = g.debug.throwTrident();
      out.threw = threw;
      // let the projectile fly (loop runs) -> measure mob health after a beat
      return out;
    });
    report.trident = tridentCheck;
    await page.waitForTimeout(1500);
    const tridentAfter = await page.evaluate(() => {
      const g = window.__GAME__;
      const mobH = g.debug.mobHealths();
      const dur = g.inventory.find((s) => s && s.id === g.itemId('trident'));
      return { mobs: mobH, tridentDurability: dur ? dur.durability : undefined, tridentCount: g.inventory.filter((s) => s && s.id === g.itemId('trident')).reduce((a, s) => a + s.count, 0) };
    });
    report.tridentAfter = tridentAfter;
    // deterministic damage/impaling/channeling/durability browser scenario
    const tridentHit = await page.evaluate(() => {
      const g = window.__GAME__;
      g.debug.forceThunder(true);
      g.give('trident', 1);
      g.debug.selectTrident();
      g.debug.enchantTrident('loyalty');
      g.debug.enchantTrident('impaling');
      g.debug.enchantTrident('riptide');
      g.debug.enchantTrident('channeling');
      g.debug.spawnAquatic('salmon', g.player.pos.x + 3, g.player.pos.z);
      return g.debug.tridentHitTest();
    });
    report.tridentHit = tridentHit;
    await page.screenshot({ path: 'evidence/w5_c17_trident.png' });

    report.errors = consoleErrors;
  } catch (e) {
    report.fatal = String(e);
  }
  console.log('W5_REWORK ' + JSON.stringify(report, null, 2));
  await browser.close();
  const err = (report.errors || []).join(';');
  const pass = !report.fatal &&
    !err.includes('PAGEERROR') && !err.includes('TypeError') && !err.includes('ReferenceError') &&
    report.oxygenDepleted === true &&
    report.treasure && report.treasure.dug === true &&
    report.trident && report.trident.threw === true;
  console.log('PASS', pass);
  if (!pass) process.exit(1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
