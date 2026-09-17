// C20 CI fixed-seed smoke: assert seed reproducibility for the canonical demo seed.
// Deterministic world generation is a core invariant (C03). Pure Node, no browser.
import { terrainFingerprint, findSafeSpawn, columnInfo } from '../src/worldgen.js';

const SEED = 20260917;
const a = terrainFingerprint(SEED);
const b = terrainFingerprint(SEED);
if (a !== b) {
  console.error(`FIXED-SEED SMOKE FAIL: fingerprint not reproducible: ${a} != ${b}`);
  process.exit(1);
}
if (a === terrainFingerprint(SEED + 1)) {
  // different seed should (overwhelmingly) differ
  console.error('FIXED-SEED SMOKE FAIL: different seed produced identical fingerprint');
  process.exit(1);
}
const spawn = findSafeSpawn(SEED);
if (!spawn) {
  console.error(`FIXED-SEED SMOKE FAIL: no safe spawn for seed ${SEED}`);
  process.exit(1);
}
const ci = columnInfo(Math.round(spawn.x), Math.round(spawn.z), SEED);
console.log(
  `FIXED-SEED SMOKE OK seed=${SEED} fingerprint=${a} spawn=(${spawn.x.toFixed(1)},${spawn.y.toFixed(1)},${spawn.z.toFixed(1)}) biome=${ci.biome}`
);
