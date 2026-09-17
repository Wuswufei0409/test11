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
 * Robustly find a safe, open land spawn: a land column (elevation >= SEA_LEVEL) whose
 * player-sized headspace (feet..feet+2) is clear of solid blocks, whose facing corridor
 * (eye-height, -Z for yaw 0) is open for SIGHT blocks so the first-person view composes
 * sky-over-terrain rather than a wall of near foliage (C02). Prefers open biomes
 * (plains/desert) to avoid dense forests / steep mountains. Deterministic per seed.
 */
export function findSafeSpawn(seed, maxRadius = 480, step = 4, sight = 16) {
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
  const topSolid = (px, pz) => {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) if (isSolid(getBlock(px, y, pz))) return y;
    return -1;
  };
  const headClear = (px, pz, top) => {
    const feet = top + 2;
    for (let yy = feet; yy <= feet + 2; yy++) if (isSolid(getBlock(px, yy, pz))) return false;
    return true;
  };
  const surfaceHeight = (px, pz) => {
    // highest solid block with air above its face (an exposed land surface, not under water)
    let st = -1;
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      if (isSolid(getBlock(px, y, pz)) && !isFluid(getBlock(px, y + 1, pz))) { st = y; break; }
    }
    return st;
  };
  // pick the cardinal direction with open sightline AND a drop over exposed LAND ahead
  // (a gentle overlook so the lower frame fills with voxel terrain, not an empty-sky horizon or ocean)
  const bestSight = (px, pz, eyeY) => {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    let best = null;
    for (const [dx, dz] of dirs) {
      let k = 0;
      for (; k <= sight; k++) {
        const wx = px + dx * k, wz = pz + dz * k;
        if (isSolid(getBlock(wx, eyeY, wz)) || isSolid(getBlock(wx, eyeY - 1, wz))) break;
      }
      if (k < 8) continue;
      let drop = 0, sampled = 0;
      for (let j = 6; j <= 24; j += 3) {
        const st = surfaceHeight(px + dx * j, pz + dz * j);
        if (st < 0) continue; // not exposed land -> skip (avoids dropping into ocean)
        drop += eyeY - st; sampled++;
      }
      if (sampled < 4) continue; // need mostly exposed land ahead
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
      if (c.elevation < SEA_LEVEL) continue;
      const open = c.biome === BIOMES.PLAINS || c.biome === BIOMES.DESERT || c.biome === BIOMES.MOUNTAINS;
      if (!open) continue;
      const top = topSolid(px, pz);
      if (top < 0 || top - c.elevation > 2) continue; // on ground, not a tree/pillar
      if (!headClear(px, pz, top)) continue;
      // land-interior: a ~36-block radius must be exposed land so the player is deep in a landmass,
      // NOT on a thin coastal sliver where water can dominate the view (reviewer C02)
      let landNear = 0, landFar = 0, landWide = 0;
      for (const [ox, oz] of [[-6,0],[6,0],[0,-6],[0,6],[-4,-4],[4,4],[-4,4],[4,-4]]) landNear += surfaceHeight(px + ox, pz + oz) >= 0 ? 1 : 0;
      for (const [ox, oz] of [[-18,0],[18,0],[0,-18],[0,18],[-12,-12],[12,12],[-12,12],[12,-12]]) landFar += surfaceHeight(px + ox, pz + oz) >= 0 ? 1 : 0;
      for (let ox = -32; ox <= 32; ox += 8) for (let oz = -32; oz <= 32; oz += 8) landWide += surfaceHeight(px + ox, pz + oz) >= 0 ? 1 : 0;
      if (landNear < 7 || landFar < 6 || landWide < 60) continue; // must be surrounded by land
      const eye = top + 4;
      const s = bestSight(px, pz, eye);
      if (!s || s.drop < 2) continue; // need a visible land drop-ahead (overlook)
      const d = Math.hypot(px, pz);
      if (d < best.dist) {
        const yaw = Math.atan2(-s.dx, -s.dz);
        best.dist = d;
        best.spawn = { x: px + 0.5, y: top + 2, z: pz + 0.5, yaw, surfaceY: top, biome: c.biome, sight: s.len, drop: s.drop };
      }
    }
    if (best.spawn) return best.spawn;
  }
  if (best.spawn) return best.spawn;
  return { x: 0.5, y: SEA_LEVEL + 8, z: 0.5, yaw: 0, surfaceY: SEA_LEVEL, biome: BIOMES.PLAINS };
}
