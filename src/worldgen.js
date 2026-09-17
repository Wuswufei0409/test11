// Deterministic world generation (pure JS, no DOM) — testable.
// Biomes: plains, forest, desert, mountains + cold/shallow/warm/deep oceans. Same seed => same terrain.

import { fbm2, hash2, hash3, mulberry32 } from './math.js';
import { BLOCK_BY_NAME, BLOCK_BY_ID, isSolid, isFluid } from './blocks.js';

export const CHUNK = 16;
export const WORLD_HEIGHT = 96;
export const SEA_LEVEL = 34;

export const BIOMES = {
  OCEAN_DEEP: 'ocean_deep',
  OCEAN_WARM: 'ocean_warm',
  OCEAN_SHALLOW: 'ocean_shallow',
  OCEAN_COLD: 'ocean_cold',
  PLAINS: 'plains',
  FOREST: 'forest',
  DESERT: 'desert',
  MOUNTAINS: 'mountains',
  SNOW: 'snow',
};

export const SEA_SURFACE = SEA_LEVEL; // water fills up to y = SEA_SURFACE

const G = {
  id: 'stone', D: 'dirt', S: 'sand', W: 'water', A: 'air', Gr: 'grass', Sa: 'sandstone',
  Sn: 'snow', Ic: 'ice', Grv: 'gravel', Cl: 'clay', Pa: 'packed_ice', B: 'bedrock',
};

function id(name) {
  return BLOCK_BY_ID.has(name) ? name : BLOCK_BY_ID.get(name);
}

export function blockId(name) {
  return BLOCK_BY_NAME.has(name) ? BLOCK_BY_NAME.get(name) : 0;
}

/**
 * Whole-column biome + surface elevation decision. Deterministic in (wx, wz) for a seed.
 * Returns { biome, elevation }.
 */
export function columnInfo(wx, wz, seed) {
  const temp = fbm2(wx * 0.004, wz * 0.004, seed + 11, 4);
  const moist = fbm2(wx * 0.004 + 50, wz * 0.004 - 40, seed + 27, 4);
  // Continental-scale elevation
  const cont = fbm2(wx * 0.0016, wz * 0.0016, seed + 7, 3);
  // Region/hill noise
  const hills = fbm2(wx * 0.02, wz * 0.02, seed + 41, 4);
  let elev = SEA_LEVEL - 8 + cont * 26 + hills * 12;
  // mountains
  const ridge = Math.max(0, fbm2(wx * 0.006, wz * 0.006, seed + 101, 4));
  if (ridge > 0.35) elev += (ridge - 0.35) * 3.0 * (fbm2(wx * 0.02 + 9, wz * 0.02 + 9, seed + 3, 4) + 1) * 30;

  let biome;
  if (elev < SEA_LEVEL - 6) biome = BIOMES.OCEAN_DEEP;
  else if (elev < SEA_LEVEL - 1) biome = BIOMES.OCEAN_SHALLOW;
  else if (elev >= SEA_LEVEL + 24) biome = BIOMES.MOUNTAINS;
  else {
    // land biomes by temp/moist
    if (temp < -0.35) biome = BIOMES.SNOW;
    else if (temp > 0.35 && moist < -0.15) biome = BIOMES.DESERT;
    else if (moist > 0.25) biome = BIOMES.FOREST;
    else biome = BIOMES.PLAINS;
  }
  // override oceans by temp for warm/cold variants
  if (biome === BIOMES.OCEAN_DEEP) biome = temp > 0.15 ? BIOMES.OCEAN_WARM : BIOMES.OCEAN_DEEP;
  if (biome === BIOMES.OCEAN_SHALLOW) biome = temp > 0.15 ? BIOMES.OCEAN_SHALLOW : BIOMES.OCEAN_COLD;
  // ensure elevation < sea for all oceans
  if (biome === BIOMES.OCEAN_DEEP || biome === BIOMES.OCEAN_WARM) elev = Math.min(elev, SEA_LEVEL - 6);
  if (biome === BIOMES.OCEAN_SHALLOW || biome === BIOMES.OCEAN_COLD) elev = Math.min(elev, SEA_LEVEL - 1);
  return { biome, elevation: Math.round(elev) };
}

/** Deterministic tree decision. */
function treeAt(wx, wz, seed, biome) {
  if (biome !== BIOMES.FOREST && biome !== BIOMES.PLAINS) return null;
  const h = hash2(wx, wz, seed + 500);
  if (biome === BIOMES.FOREST && h < 0.28) return h < 0.09 ? 'spruce' : 'oak';
  if (biome === BIOMES.PLAINS && h < 0.05) return 'oak';
  return null;
}

function plantAt(wx, wz, seed, biome, surfaceY) {
  const h = hash2(wx, wz, seed + 700);
  if (biome === BIOMES.DESERT) {
    if (surfaceY < SEA_LEVEL) return 0;
    if (h < 0.04) return blockId('cactus');
    if (h < 0.09) return blockId('dead_bush');
    return 0;
  }
  if (biome === BIOMES.PLAINS) {
    if (h < 0.06) return blockId('poppy');
    if (h < 0.1) return blockId('dandelion');
    if (h < 0.2) return blockId('tall_grass');
    return 0;
  }
  if (biome === BIOMES.FOREST) {
    if (h < 0.08) return blockId('tall_grass');
    if (h < 0.1) return blockId('poppy');
    return 0;
  }
  return 0;
}

function placeTree(chunk, wx, wz, surfaceY, type, rng) {
  const top = surfaceY + 1;
  const base = surfaceY;
  if (type === 'spruce') {
    const h = 5 + Math.floor(rng() * 3);
    for (let y = 1; y <= h; y++) chunk.setRaw(wx & 15, base + y, wz & 15, blockId('spruce_log'), false);
    for (let ly = h + 1; ly <= h + 2; ly++) {
      const r = ly === h + 2 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && ly === h + 2) continue;
          const bx = wx + dx, bz = wz + dz;
          if (chunk.getWorldVoid(bx, base + ly + 1, bz) === 0) chunk.setWorld(bx, base + ly + 1, bz, blockId('spruce_leaves'));
        }
    }
  } else {
    const h = 4 + Math.floor(rng() * 2);
    for (let y = 1; y <= h; y++) chunk.setRaw(wx & 15, base + y, wz & 15, blockId('oak_log'), false);
    for (let ly = h - 1; ly <= h + 1; ly++) {
      const r = ly === h + 1 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && ly === h + 1) continue;
          const bx = wx + dx, bz = wz + dz;
          const cur = chunk.getWorldVoid(bx, base + ly + 1, bz);
          if (cur === 0) chunk.setWorld(bx, base + ly + 1, bz, blockId('oak_leaves'));
        }
    }
    chunk.setRaw(wx & 15, base + h + 1, wz & 15, blockId('oak_leaves'), false);
  }
}

/** A mutable chunk buffer bound to world coordinates for tree placement. */
class ChunkBuffer {
  constructor() { this.data = new Uint8Array(CHUNK * WORLD_HEIGHT * CHUNK); this.cx = 0; this.cz = 0; }
  idx(bx, y, bz) { return ((y * CHUNK) + bz) * CHUNK + bx; }
  setRaw(bx, y, bz, idv) { if (y >= 0 && y < WORLD_HEIGHT) this.data[this.idx(bx, y, bz)] = idv; }
  setWorld(wx, y, wz, idv) { this.setRaw(wx & 15, y, wz & 15, idv); }
  getWorldVoid(wx, y, wz, defaultVal = 0) {
    if (y < 0) return blockId('bedrock');
    if (y >= WORLD_HEIGHT) return 0;
    const bx = ((wx % CHUNK) + CHUNK) % CHUNK;
    const bz = ((wz % CHUNK) + CHUNK) % CHUNK;
    return this.data[this.idx(bx, y, bz)];
  }
  get(bx, y, bz) { if (y < 0) return blockId('bedrock'); if (y >= WORLD_HEIGHT) return 0; return this.data[this.idx(bx, y, bz)]; }
}

function oresFor(biome) {
  return [
    { id: blockId('diamond_ore'), min: 0, max: 12, chance: 0.004 },
    { id: blockId('gold_ore'), min: 0, max: 28, chance: 0.01 },
    { id: blockId('iron_ore'), min: 0, max: 44, chance: 0.03 },
    { id: blockId('coal_ore'), min: 0, max: 64, chance: 0.06 },
  ];
}

/** Generate a full chunk (16 x H x 16) of block ids for world coords [cx*16, (cx+1)*16). */
export function generateChunk(cx, cz, seed) {
  const chunk = new ChunkBuffer();
  chunk.cx = cx; chunk.cz = cz;
  const rng = mulberry32(seed ^ (cx * 104729) ^ (cz * 1299709));
  const baseX = cx * CHUNK;
  const baseZ = cz * CHUNK;
  const biomeColumns = new Map();

  for (let lx = 0; lx < CHUNK; lx++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      const wx = baseX + lx;
      const wz = baseZ + lz;
      const { biome, elevation } = columnInfo(wx, wz, seed);
      biomeColumns.set(lx * CHUNK + lz, { biome, elevation });
      // sea floor / land surface block choice
      if (biome === BIOMES.OCEAN_DEEP || biome === BIOMES.OCEAN_WARM) {
        chunk.setRaw(lx, elevation, lz, blockId('gravel'));
      } else if (biome === BIOMES.OCEAN_SHALLOW || biome === BIOMES.OCEAN_COLD) {
        chunk.setRaw(lx, elevation, lz, blockId(biome === BIOMES.OCEAN_COLD ? 'gravel' : 'sand'));
      } else {
        chunk.setRaw(lx, elevation, lz, blockId('grass'));
      }
      // underground filler
      for (let y = elevation - 1; y >= 1; y--) {
        const depth = elevation - y;
        let fill;
        if (biome === BIOMES.DESERT || biome === BIOMES.OCEAN_SHALLOW || biome === BIOMES.OCEAN_WARM) {
          if (depth <= 3) fill = G.S;
          else if (depth === 4) fill = G.Sa;
          else fill = G.id;
        } else if (biome === BIOMES.OCEAN_DEEP || biome === BIOMES.OCEAN_COLD) {
          if (depth === 1) fill = G.Cl;
          else fill = G.id;
        } else {
          fill = depth <= 3 ? G.D : G.id;
        }
        chunk.setRaw(lx, y, lz, blockId(fill));
      }
      chunk.setRaw(lx, 0, lz, blockId('bedrock'));

      // Water fill in oceans
      if (biome === BIOMES.OCEAN_DEEP || biome === BIOMES.OCEAN_WARM || biome === BIOMES.OCEAN_SHALLOW || biome === BIOMES.OCEAN_COLD) {
        for (let y = elevation + 1; y <= SEA_LEVEL; y++) chunk.setRaw(lx, y, lz, blockId('water'));
        // ice cap on cold ocean surface
        if (biome === BIOMES.OCEAN_COLD) chunk.setRaw(lx, SEA_LEVEL, lz, blockId('ice'));
      }

      // mountain snow cap + packed ice, snow biome counts as mountains-with-snow
      if ((biome === BIOMES.MOUNTAINS || biome === BIOMES.SNOW) && elevation > SEA_LEVEL + 6) {
        chunk.setRaw(lx, elevation, lz, blockId('snow'));
        chunk.setRaw(lx, elevation - 1, lz, blockId('ice'));
      }
    }
  }

  // Ores (deterministic per column+seed)
  for (let lx = 0; lx < CHUNK; lx++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      const wx = baseX + lx;
      const wz = baseZ + lz;
      const { biome, elevation } = biomeColumns.get(lx * CHUNK + lz);
      const region = (Math.floor(wx / 4) * 31 + Math.floor(wz / 4) * 57 + seed) | 0;
      const h = hash3(Math.floor(wx / 4), Math.floor(wz / 4), 0, seed + 900);
      const vein = h;
      const tables = oresFor(biome);
      let chosen = null;
      for (const o of tables) {
        if (vein < o.chance * 6) { chosen = o; break; }
      }
      if (chosen) {
        const cx0 = (wx % 4 + 4) % 4;
        const cz0 = (wz % 4 + 4) % 4;
        const y0 = chosen.min + Math.floor(hash3(wx, wz, 1, seed + 901) * (chosen.max - chosen.min));
        for (let dx = 0; dx < 3; dx++)
          for (let dy = 0; dy < 3; dy++)
            for (let dz = 0; dz < 2; dz++) {
              const xx = wx - cx0 + dx;
              const yy = y0 + dy;
              const zz = wz - cz0 + dz;
              if (yy < 1 || yy >= elevation) continue;
              if (chunk.getWorldVoid(xx, yy, zz) === blockId('stone') || chunk.getWorldVoid(xx, yy, zz) === blockId('cobblestone')) {
                chunk.setWorld(xx, yy, zz, chosen.id);
              }
            }
      }
    }
  }

  // Trees + plants (iterate only over column tops present in this chunk for determinism)
  for (let lx = 0; lx < CHUNK; lx++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      const wx = baseX + lx;
      const wz = baseZ + lz;
      const { biome, elevation } = biomeColumns.get(lx * CHUNK + lz);
      if (elevation >= SEA_LEVEL) {
        const tree = treeAt(wx, wz, seed, biome);
        if (tree) placeTree(chunk, wx, wz, elevation, tree, rng);
        else {
          const p = plantAt(wx, wz, seed, biome, elevation);
          if (p && chunk.get(wx & 15, elevation, wz & 15) !== 0) chunk.setRaw(lx, elevation + 1, lz, p);
        }
      }
    }
  }

  return { cx, cz, seed, columns: [...biomeColumns.values()], data: chunk.data, get: (bx, y, bz) => chunk.get(bx, y, bz) };
}

/** Terrain fingerprint: fixed coordinate height samples hashed. Used to prove seed reproducibility. */
export function terrainFingerprint(seed, samples = 64, spread = 480) {
  let h = 0x811c9dc5 | 0;
  const rng = mulberry32(seed + 2026);
  for (let i = 0; i < samples; i++) {
    const wx = Math.floor(rng() * spread) - spread / 2;
    const wz = Math.floor(rng() * spread) - spread / 2;
    const { elevation } = columnInfo(wx, wz, seed);
    h = Math.imul(h ^ elevation, 0x01000193);
    h = (h ^ (Math.imul(wx, 31) + wz)) | 0;
  }
  return (h >>> 0).toString(16);
}

/**
 * Robustly find a safe, open, DRY land spawn well above the water line (C02).
 *
 * The spawn surface must sit clearly ABOVE sea level so the camera eye (~+1.62) composes
 * a legible sky-over-terrain frame rather than sitting at/under the water line looking out
 * over ocean (the root cause of repeated C02 FAILs). Requirements (all deterministic):
 *  - dry land, not a water/ocean column, elevation well above SEA_LEVEL;
 *  - exposed solid ground with clear headspace above feet AND above the eye (~8 blocks);
 *  - the standing column and a wide ~36-block radius are genuine land (no water/ice floor),
 *    so the player is deep in a landmass, not on a coastal sliver;
 *  - an open forward corridor of real terrain at eye height (no wall of near foliage/water).
 * Prefers open biomes (plains/desert) to steer clear of dense forests. Deterministic per seed.
 */
export function findSafeSpawn(seed, maxRadius = 480, step = 4, sight = 16, minElevAboveSea = 5) {
  const chunkCache = new Map();
  const getBlock = (wx, y, wz) => {
    if (y < 0) return BLOCK_BY_ID.get('bedrock');
    if (y >= WORLD_HEIGHT) return 0;
    const cx = Math.floor(wx / CHUNK);
    const cz = Math.floor(wz / CHUNK);
    const key = cx + ',' + cz;
    let c = chunkCache.get(key);
    if (!c) { c = generateChunk(cx, cz, seed); chunkCache.set(key, c); }
    const bx = ((wx % CHUNK) + CHUNK) % CHUNK;
    const bz = ((wz % CHUNK) + CHUNK) % CHUNK;
    return c.data[((y * CHUNK) + bz) * CHUNK + bx];
  };
  // Is this column standing on dry land whose exposed top is clearly above the water line?
  // Returns the surface y (a solid block whose block above is air AND above sea level), else -1.
  // This deliberately excludes ocean ice floors: a real surface must sit above the water line
  // (ice sits AT sea level at 34, so an ice column's exposed-top == SEA_LEVEL is rejected).
  const drySurface = (px, pz) => {
    let st = -1;
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const above = getBlock(px, y + 1, pz);
      if (isSolid(getBlock(px, y, pz)) && !isFluid(above) && y >= SEA_LEVEL + minElevAboveSea) { st = y; break; }
    }
    return st;
  };
  const headClearAboveEye = (px, pz, surfaceY) => {
    // player eye sits ~ surfaceY + 1.62; require a clear (non-solid, non-fluid) column of air
    // above the eye for at least 8 blocks so the player is never boxed in by canopy/foliage.
    const eye = Math.floor(surfaceY) + 2;
    for (let yy = eye; yy <= eye + 8; yy++) {
      const b = getBlock(px, yy, pz);
      if (b !== 0 && (isSolid(b) || isFluid(b))) return false;
    }
    return true;
  };
  const topSolid = (px, pz) => {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) if (isSolid(getBlock(px, y, pz))) return y;
    return -1;
  };
  // does the forward near sector hold a genuine reachable terrain block (grass/dirt/stone/sand,
  // not foliage/logs/water/ice) so the first-person crosshair shows a non-water target label?
  const FOLIAGE = new Set([blockId('oak_log'), blockId('oak_leaves'), blockId('spruce_log'), blockId('spruce_leaves'), blockId('birch_log'), blockId('poppy'), blockId('dandelion'), blockId('tall_grass'), blockId('cactus'), blockId('dead_bush')]);
  const hasReachableTerrain = (px, pz, dx, dz, eyeY) => {
    // require a terrain block reachable at MILD downward pitch: near eye height (eye-3..eye),
    // so the first-person crosshair naturally labels grass/dirt without looking straight down.
    for (let d = 1; d <= 5; d++) {
      const wx = px + dx * d, wz = pz + dz * d;
      for (let yy = eyeY - 3; yy <= eyeY; yy++) {
        const b = getBlock(wx, yy, wz);
        if (b !== 0 && isSolid(b) && !isFluid(b) && !FOLIAGE.has(b)) return true;
      }
    }
    return false;
  };

  // pick the cardinal direction with an open sightline at eye height, a reachable non-water
  // terrain label, AND a gentle elevated overlook over REAL exposed land (not water), so the
  // lower frame fills with low voxel terrain while the crosshair retains a readable label.
  const bestSight = (px, pz, eyeY) => {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    let best = null;
    for (const [dx, dz] of dirs) {
      if (!hasReachableTerrain(px, pz, dx, dz, eyeY)) continue; // need a non-water label ahead
      let k = 0;
      for (; k <= sight; k++) {
        const wx = px + dx * k, wz = pz + dz * k;
        if (getBlock(wx, eyeY, wz) !== 0 && (isSolid(getBlock(wx, eyeY, wz)) || isFluid(getBlock(wx, eyeY, wz)))) break;
        if (getBlock(wx, eyeY - 1, wz) !== 0 && (isSolid(getBlock(wx, eyeY - 1, wz)) || isFluid(getBlock(wx, eyeY - 1, wz)))) break;
      }
      if (k < 8) continue;
      let drop = 0, sampled = 0;
      for (let j = 6; j <= 24; j += 3) {
        const st = drySurface(px + dx * j, pz + dz * j);
        if (st < 0) continue; // not dry land ahead -> skip (avoids dropping into ocean/water)
        drop += eyeY - st; sampled++;
      }
      if (sampled < 4) continue; // need mostly dry land ahead
      drop /= sampled;
      if (best === null || drop > best.drop) best = { len: k, drop, dx, dz };
    }
    return best;
  };
  const best = { dist: Infinity, spawn: null };
  for (let r = 0; r <= maxRadius; r += step) {
    const pts = [];
    for (let dx = -r; dx <= r; dx += step) { pts.push([dx, -r], [dx, r]); }
    for (let dz = -r; dz <= r; dz += step) { pts.push([-r, dz], [r, dz]); }
    for (const [px, pz] of pts) {
      const c = columnInfo(px, pz, seed);
      if (c.elevation < SEA_LEVEL + minElevAboveSea) continue; // must be well above the water line
      // open biomes only: plains/desert (no mountains - their walls hide the sky/horizon, C02)
      const open = c.biome === BIOMES.PLAINS || c.biome === BIOMES.DESERT;
      if (!open) continue;
      const surfaceY = drySurface(px, pz);
      if (surfaceY < 0) continue; // must be exposed dry land above the water line
      const top = topSolid(px, pz);
      if (top < 0 || top - c.elevation > 2) continue; // on ground, not a tree/pillar
      if (!headClearAboveEye(px, pz, surfaceY)) continue;
      // land-interior: a ~36-block radius must be DRY land so the player is deep in a landmass,
      // NOT on a coastal sliver or frozen ocean where water/ice can dominate the view.
      let landNear = 0, landFar = 0, landWide = 0;
      for (const [ox, oz] of [[-6,0],[6,0],[0,-6],[0,6],[-4,-4],[4,4],[-4,4],[4,-4]]) landNear += drySurface(px + ox, pz + oz) >= 0 ? 1 : 0;
      for (const [ox, oz] of [[-18,0],[18,0],[0,-18],[0,18],[-12,-12],[12,12],[-12,12],[12,-12]]) landFar += drySurface(px + ox, pz + oz) >= 0 ? 1 : 0;
      for (let ox = -32; ox <= 32; ox += 8) for (let oz = -32; oz <= 32; oz += 8) landWide += drySurface(px + ox, pz + oz) >= 0 ? 1 : 0;
      if (landNear < 7 || landFar < 6 || landWide < 60) continue; // must be surrounded by dry land
      const eye = top + 4;
      const s = bestSight(px, pz, eye);
      if (!s || s.drop < 2) continue; // need a visible dry-land drop-ahead (elevated overlook)
      const d = Math.hypot(px, pz);
      if (d < best.dist) {
        const yaw = Math.atan2(-s.dx, -s.dz);
        best.dist = d;
        best.spawn = { x: px + 0.5, y: top + 2, z: pz + 0.5, yaw, surfaceY: top, biome: c.biome, sight: s.len, drop: s.drop, eyeClear: true };
      }
    }
    if (best.spawn) return best.spawn;
  }
  if (best.spawn) return best.spawn;
  // Final fallback: lift the candidate onto the highest nearby dry land above sea level.
  for (let r = 0; r <= maxRadius; r += step) {
    for (const [px, pz] of [...Array.from({ length: Math.ceil(2 * r / step) + 1 }, (_, i) => [-r + i * step, -r]), ...Array.from({ length: Math.ceil(2 * r / step) + 1 }, (_, i) => [-r + i * step, r])]) {
      const surfaceY = drySurface(px, pz);
      if (surfaceY < 0) continue;
      if (!headClearAboveEye(px, pz, surfaceY)) continue;
      const top = topSolid(px, pz);
      const s = bestSight(px, pz, top + 4);
      if (!s) continue;
      const yaw = Math.atan2(-s.dx, -s.dz);
      return { x: px + 0.5, y: top + 2, z: pz + 0.5, yaw, surfaceY: top, biome: columnInfo(px, pz, seed).biome, sight: s.len, drop: s.drop, eyeClear: true };
    }
  }
  return { x: 0.5, y: SEA_LEVEL + minElevAboveSea + 2, z: 0.5, yaw: 0, surfaceY: SEA_LEVEL + minElevAboveSea, biome: BIOMES.PLAINS };
}
