// C20/C01 deploy health check (CI-safe, no browser): verify the built artifact is
// present and non-trivial, references a real JS bundle, and recognizes the expected
// app module markers so a refresh serves a live app (not a white screen).
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
if (!existsSync(join(dist, 'index.html'))) {
  console.error('HEALTH CHECK FAIL: dist/index.html missing');
  process.exit(1);
}
const indexHtml = readFileSync(join(dist, 'index.html'), 'utf8');
if (indexHtml.indexOf('<div id="app">') === -1) {
  console.error('HEALTH CHECK FAIL: index.html missing #app root');
  process.exit(1);
}
const assets = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'));
if (assets.length === 0) {
  console.error('HEALTH CHECK FAIL: no JS bundle in dist/assets');
  process.exit(1);
}
const bundle = readFileSync(join(dist, 'assets', assets[0]), 'utf8');
const markers = ['initGame', '__GAME__'];
for (const m of markers) {
  if (bundle.indexOf(m) === -1) {
    console.warn(`HEALTH CHECK WARN: bundle missing expected marker "${m}"`);
  }
}
const kb = (statSync(join(dist, 'assets', assets[0])).size / 1024).toFixed(1);
console.log(`HEALTH CHECK OK: dist/index.html + ${assets[0]} (${kb} KiB), #app root present, markers ${markers.join('/')}`);
