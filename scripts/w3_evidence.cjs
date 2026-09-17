// W3 evidence harness: drives crafting, tool chain, furnace smelting, and local save/load
// in a real headless browser, captures screenshots, and prints PASS/FAIL checks (C07/C08/C18).
const { chromium } = require('/opt/playtest/node_modules/playwright');

const URL = 'http://localhost:5201/?seed=20260917';
const EXE = '/home/yinwf2/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

async function launch() {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));
  return { browser, page, consoleErrors };
}

async function loadGame(page) {
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const ov = document.getElementById('menu-overlay'); if (ov) ov.remove();
    window.__GAME_PAUSED__ = true;
    const g = window.__GAME__;
    if (g && g.player) { g.player.yaw = 0; g.player.pitch = 0.2; g.camera.rotation.set(0.2, 0, 0); }
    window.__GAME_PAUSED__ = false;
  });
  await page.waitForTimeout(1200);
}

async function main() {
  const { browser, page, consoleErrors } = await launch();
  const report = {};
  try {
    // ---- fresh context (no prior save) ----
    await loadGame(page);

    // C07/C08: drive the full crafting chain through the recipe book in the live game
    const chain = await page.evaluate(() => {
      const g = window.__GAME__;
      const out = {};
      g.give('oak_log', 12);
      for (let i = 0; i < 3; i++) g.craft('oak_planks');
      g.craft('stick');
      g.craft('crafting_table');
      g.give('stick', 24);
      g.craft('wooden_pickaxe');
      g.craft('stone_pickaxe');
      g.give('cobblestone', 8);
      g.give('iron_ingot', 6);
      g.craft('iron_pickaxe');
      g.craft('furnace');
      g.craft('boat');
      g.craft('bucket');
      g.give('coal', 1); g.give('sand', 4);
      g.craft('torch');
      g.craft('sponge');
      g.give('wheat', 3);
      g.craft('bread');
      const count = (name) => g.inventory.reduce((a, s) => a + (s && s.id === g.itemId(name) ? s.count : 0), 0);
      out.wooden_pickaxe = count('wooden_pickaxe');
      out.stone_pickaxe = count('stone_pickaxe');
      out.iron_pickaxe = count('iron_pickaxe');
      out.furnace = count('furnace');
      out.boat = count('boat');
      out.bucket = count('bucket');
      out.torch = count('torch');
      out.sponge = count('sponge');
      out.bread = count('bread');
      out.inventoryTotal = g.inventory.reduce((a, s) => a + (s ? s.count : 0), 0);
      return out;
    });

    // open the recipe book panel and screenshot it
    await page.evaluate(() => { const g = window.__GAME__; g.openCraft(); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'evidence/w3_recipebook.png' });
    await page.evaluate(() => { const g = window.__GAME__; g.openCraft(); }); // close

    // C08 furnace smelting
    const smash = await page.evaluate(() => {
      const g = window.__GAME__;
      const s = g.demoSmelt();
      // place a live furnace tile with partial progress to render the furnace UI
      const f = g.placeFurnace(0, 64, 0);
      f.input = { id: g.itemId('iron_ore_raw'), count: 1 };
      f.fuel = { id: g.itemId('coal'), count: 1 };
      for (let t = 0; t < 5; t += 0.1) f.tick(0.1); // partial progress
      f.tick(4.9);
      g.openFurnaceTile('0,64,0');
      return { ingotId: s.output && s.output.id, ingotCount: s.output && s.output.count, lit: s.lit, smeltedToIron: s.output && s.output.id === 102 };
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'evidence/w3_furnace.png' });

    // C18 save/load in browser
    const saveResult = await page.evaluate(() => {
      const g = window.__GAME__;
      g.give('diamond', 7);
      g.give('coal', 5);
      const invCount = g.inventory.reduce((a, s) => a + (s ? s.count : 0), 0);
      const r = g.save();
      const raw = g.rawSave();
      return { saved: r.saved, hasRaw: !!raw, rawLen: raw ? raw.length : 0, invCount, snapBlocks: g.getSnapshot().blocks.length, doesExist: g.doesSaveExist() };
    });

    // no-silent-overwrite: saving a changed world backs up the previous valid save
    const backup = await page.evaluate(() => {
      const g = window.__GAME__;
      g.give('bread', 2); // change inventory so the next save differs
      const r = g.save();
      return { backedUp: r.backedUp, hasBak: !!localStorage.getItem('mcsave.bak') };
    });

    await page.screenshot({ path: 'evidence/w3_saved.png' });

    // C18 close/reopen: reload and confirm the world continues (inventory + blocks restored)
    await loadGame(page); // reload the page (fresh browser parse)
    const reopen = await page.evaluate(() => {
      const g = window.__GAME__;
      const count = (name) => g.inventory.reduce((a, s) => a + (s && s.id === g.itemId(name) ? s.count : 0), 0);
      return { doesLoad: !!g.rawSave(), diamond: count('diamond'), coal: count('coal'), loadedFromDisk: g.doesSaveExist(), invTotal: g.inventory.reduce((a, s) => a + (s ? s.count : 0), 0) };
    });

    // C18 corrupt save -> clear error + safe fallback: the game must boot to a fresh world
    const corrupt = await page.evaluate(() => {
      localStorage.setItem('mcsave', '{"corrupt": not-json!!!');
      return localStorage.getItem('mcsave');
    });
    await loadGame(page);
    const corruptAfter = await page.evaluate(() => {
      const rev = localStorage.getItem('mcsave');
      const g = window.__GAME__;
      // a fresh, valid save now exists (page close auto-saved a valid snapshot after safe-boot)
      return { gameBooted: !!g && !!g.world, hasInventory: !!g.inventory, recovered: !!rev && rev.indexOf('corrupt') === -1 };
    });

    report.chain = chain;
    report.smelt = smash;
    report.save = saveResult;
    report.backup = backup;
    report.reopen = reopen;
    report.corrupt = { original: corrupt, after: corruptAfter };
  } finally {
    report.errors = consoleErrors;
    await browser.close();
  }

  const pass =
    report.chain.iron_pickaxe >= 1 &&
    report.chain.stone_pickaxe >= 1 &&
    report.chain.wooden_pickaxe >= 1 &&
    report.chain.furnace >= 1 &&
    report.chain.boat >= 1 &&
    report.chain.bucket >= 1 &&
    report.chain.torch >= 1 &&
    report.chain.bread >= 1 &&

    report.smelt.smeltedToIron === true &&
    report.save.saved === true &&
    report.save.hasRaw === true &&
    report.backup.backedUp === true &&
    report.backup.hasBak === true &&
    report.reopen.diamond >= 7 &&
    report.corrupt.after.gameBooted === true &&
    report.corrupt.after.hasInventory === true &&
    report.corrupt.after.recovered === true &&
    report.errors.length === 0;

  console.log('REPORT ' + JSON.stringify(report, null, 2));
  console.log('PASS ' + pass);
  if (!pass) process.exit(1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
