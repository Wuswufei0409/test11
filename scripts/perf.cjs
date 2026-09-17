// C19 performance benchmark: headless Chromium (SwiftShader WebGL), view distance 6 chunks,
// 30 active mob entities. Samples FPS / P95 frame-time / JS-heap over a window via an
// in-page RAF sampler polled from Node (robust vs long-held evaluate).
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
  const consoleErrors = [];
  const pageErrors = [];
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
    // start continuous in-page sampler
    window.__FRAMES__ = [];
    window.__MEM__ = [];
    let last = performance.now();
    function raf(now) { window.__FRAMES__.push(now - last); last = now; requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    if (performance.memory) setInterval(() => { window.__MEM__.push(performance.memory.usedJSHeapSize); }, 500);
    return { ok: true, renderer: !!g.renderer, spawned: spawned.length, seed: g.seed ?? null, viewDistance: 6 };
  });
  console.log('CONFIG', JSON.stringify(cfg));
  if (!cfg.ok) throw new Error('config failed: ' + cfg.reason);

  // Poll from Node until the window elapses.
  const started = Date.now();
  let lastLen = 0;
  let memSample = [];
  while (Date.now() - started < SECONDS * 1000) {
    await page.waitForTimeout(2000);
    const s = await page.evaluate(() => ({ len: window.__FRAMES__.length, mem: window.__MEM__ ? window.__MEM__.length : 0 })).catch(() => null);
    if (!s) { console.error('POLL FAIL, page likely crashed'); break; }
    lastLen = s.len;
  }
  const data = await page.evaluate(() => ({
    frames: window.__FRAMES__.slice(),
    mem: window.__MEM__ ? window.__MEM__.slice() : [],
    fps: document.querySelector('#fps')?.textContent || null,
    pos: (() => { const g = window.__GAME__; return g ? [g.player.pos.x, g.player.pos.y, g.player.pos.z] : null; })(),
  }));

  const frames = data.frames.filter((f) => f > 0 && f < 1000);
  frames.sort((a, b) => a - b);
  const n = frames.length;
  const avgFrame = frames.length ? frames.reduce((s, x) => s + x, 0) / frames.length : NaN;
  const p95 = frames.length ? frames[Math.floor(frames.length * 0.95)] : NaN;
  const mem = data.mem;
  const memStart = mem.length ? Math.min(...mem) : 0;
  const memEnd = mem.length ? Math.max(...mem) : 0;
  const memGrowth = mem.length > 5 ? mem[mem.length - 1] - mem[0] : null;

  const out = {
    timestamp: new Date().toISOString(),
    url: URL,
    seconds: SECONDS,
    config: cfg,
    texture_quality: 'default',
    view_distance_chunks: cfg.viewDistance,
    chunk_size: 16,
    seed: '20260917',
    position: data.pos,
    operation_route: 'static spawn overlook, 30 active mob entities (zombie/spider/creeper), fixed camera',
    sampling_method: 'in-page requestAnimationFrame deltas sampled over the window; JS heap via performance.memory every 500ms',
    result: {
      frame_count: n,
      avg_frame_ms: +avgFrame.toFixed(2),
      p95_frame_ms: +p95.toFixed(2),
      avg_fps: +(n && avgFrame ? 1000 / avgFrame : 0).toFixed(1),
      hud_fps: data.fps,
      mem_samples: mem.length,
      mem_min_mb: +(memStart / 1048576).toFixed(2),
      mem_max_mb: +(memEnd / 1048576).toFixed(2),
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
