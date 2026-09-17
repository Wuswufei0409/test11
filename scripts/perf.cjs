// C19 performance benchmark: headless Chromium (SwiftShader WebGL), view distance 6 chunks,
// 30 active mob entities. Uses the game's own per-frame dt recorder (window.__DT__) for an
// authoritative frame-time distribution, plus JS-heap sampling.
// Usage: node scripts/perf.cjs [url] [seconds]
const { chromium } = require('/opt/playtest/node_modules/playwright');
const fs = require('fs');

const URL = process.argv[2] || 'http://localhost:5200/?seed=20260917';
const SECONDS = parseInt(process.argv[3] || '300', 10);

(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/yinwf2/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleErrors = [], pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(4000);

  const cfg = await page.evaluate(() => {
    const g = window.__GAME__;
    if (!g) return { ok: false, reason: 'no __GAME__' };
    const spawned = [];
    for (let i = 0; i < 30; i++) {
      const kind = ['zombie', 'spider', 'creeper'][i % 3];
      if (g.debug && g.debug.spawnMobAt) spawned.push(g.debug.spawnMobAt(kind, Math.cos(i) * 8, Math.sin(i) * 8));
    }
    const ov = document.getElementById('menu-overlay'); if (ov) ov.remove();
    // Enable the game's per-frame dt recorder (off by default in src/game.js).
    window.__DT__ = [];
    window.__MEM__ = [];
    window.__RECORD_DT__ = true;
    if (performance.memory) setInterval(() => { window.__MEM__.push(performance.memory.usedJSHeapSize); }, 500);
    return { ok: true, renderer: !!g.renderer, spawned: spawned.length, seed: g.seed ?? null, viewDistance: 6 };
  });
  console.log('CONFIG', JSON.stringify(cfg));
  if (!cfg.ok) throw new Error('config failed: ' + cfg.reason);

  const started = Date.now();
  // No per-second polling: page.evaluate stalls the main thread and corrupts FPS.
  // Let the game loop run freely (Node-side wait only), then read once at the end.
  await page.waitForTimeout(SECONDS * 1000);
  const data = await page.evaluate(() => ({
    dt: (window.__DT__ || []).slice(),
    mem: (window.__MEM__ || []).slice(),
    fps: document.querySelector('#fps')?.textContent || null,
    pos: (() => { const g = window.__GAME__; return g ? [g.player.pos.x, g.player.pos.y, g.player.pos.z] : null; })(),
  }));

  const dt = data.dt.filter((x) => x > 0 && x < 1000);
  dt.sort((a, b) => a - b);
  const n = dt.length;
  const avg = n ? dt.reduce((s, x) => s + x, 0) / n : NaN;
  const p95 = n ? dt[Math.floor(n * 0.95)] : NaN;
  const mem = data.mem;
  const memGrowth = mem.length > 5 ? mem[mem.length - 1] - mem[0] : null;

  const out = {
    timestamp: new Date().toISOString(),
    url: URL,
    seconds: SECONDS,
    config: cfg,
    texture_quality: 'default',
    view_distance_chunks: 6,
    chunk_size: 16,
    seed: '20260917',
    position: data.pos,
    operation_route: 'static spawn overlook, 30 active mob entities, fixed camera',
    sampling_method: 'game-loop per-frame dt (window.__DT__, ms), JS heap every 500ms via performance.memory',
    result: {
      frame_count: n,
      avg_frame_ms: +avg.toFixed(2),
      p95_frame_ms: +p95.toFixed(2),
      avg_fps: +(n && avg ? 1000 / avg : 0).toFixed(1),
      hud_fps: data.fps,
      mem_samples: mem.length,
      mem_min_mb: mem.length ? +(Math.min(...mem) / 1048576).toFixed(2) : null,
      mem_max_mb: mem.length ? +(Math.max(...mem) / 1048576).toFixed(2) : null,
      mem_end_minus_start_mb: memGrowth == null ? null : +(memGrowth / 1048576).toFixed(2),
    },
    console_errors: consoleErrors,
    page_errors: pageErrors,
  };
  fs.writeFileSync('evidence/perf_raw.json', JSON.stringify(out, null, 2));
  console.log('PERF_RESULT', JSON.stringify(out.result));
  console.log('RAW_SAVED evidence/perf_raw.json');
  await browser.close();
})().catch((e) => { console.error('PERF ERROR', e && e.message); process.exit(1); });
