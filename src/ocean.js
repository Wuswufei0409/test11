// C15 ocean content (pure, no DOM): deterministic ocean features — coral, kelp, seagrass,
// icebergs, shipwrecks, underwater ruins and buried treasure with a treasure-map clue that
// leads to a diggable reward. All engine-agnostic and unit-testable.

import { hash2, mulberry32 } from './math.js';

// Ocean biome mnemonic tags (string literals kept local to stay dependency-free).
export const OCEAN_WARM = 'ocean_warm';
export const OCEAN_SHALLOW = 'ocean_shallow';
export const OCEAN_DEEP = 'ocean_deep';
export const OCEAN_COLD = 'ocean_cold';
const OCEANS = [OCEAN_WARM, OCEAN_SHALLOW, OCEAN_DEEP, OCEAN_COLD];

// Ocean feature placement density thresholds (tuned to be present but not spammy).
export const OCEAN_FEATURES = {
  coralChance: 0.045,   // warm/shallow reef columns
  kelpChance: 0.03,     // shallow-ish kelp beds
  seagrassChance: 0.05, // seagrass on warm/shallow sandy floor
  icebergChance: 0.004, // cold ocean icebergs
  wreckChance: 0.0015,  // shipwreck
  ruinChance: 0.002,    // underwater ruins
  treasureChance: 0.004,// buried treasure
};

/** Map treasure dig site -> nearby clue spawn region. Only used by the game layer. */

/**
 * Decide what ocean feature (if any) occupies a given surface landmark column.
 * Deterministic from (wx, wz, seed, biome). Returns a feature tag or null.
 * Also returns the terrain surface y so callers can derive placement.
 */
export function oceanFeature(wx, wz, seed, biome, surfaceY) {
  const h = hash2(wx, wz, seed + 3001);
  const inOcean = biome === OCEAN_WARM || biome === OCEAN_SHALLOW ||
                  biome === OCEAN_DEEP || biome === OCEAN_COLD;
  if (!inOcean) return null;
  const isWarm = biome === OCEAN_WARM || biome === OCEAN_SHALLOW;
  const isShallow = biome === OCEAN_SHALLOW;
  const isCold = biome === OCEAN_COLD;
  const isDeepish = biome === OCEAN_DEEP;

  // icebergs only on cold ocean (packed surface)
  if (isCold && h < OCEAN_FEATURES.icebergChance) return { tag: 'iceberg' };
  // coral reefs on warm shallow floor (needs near-surface floor)
  if (isWarm && surfaceY > 24 && h < OCEAN_FEATURES.coralChance) return { tag: 'coral' };
  // kelp on shallow floor
  if (isShallow && surfaceY > 26 && h >= OCEAN_FEATURES.coralChance && h < OCEAN_FEATURES.coralChance + OCEAN_FEATURES.kelpChance) return { tag: 'kelp' };
  // seagrass on sandy shallow floor
  if (isWarm && surfaceY > 26 && h >= 0.05 && h < 0.05 + OCEAN_FEATURES.seagrassChance) return { tag: 'seagrass' };
  // buried treasure on shallow sandy floor
  if (isShallow && surfaceY > 24 && h >= 0.09 && h < 0.09 + OCEAN_FEATURES.treasureChance) return { tag: 'treasure' };
  // shipwreck & ruins across ocean (rare, on any floor)
  if (h >= 0.14 && h < 0.14 + OCEAN_FEATURES.wreckChance) return { tag: 'wreck' };
  if (h >= 0.16 && h < 0.16 + OCEAN_FEATURES.ruinChance) return { tag: 'ruin' };
  return null;
}

/**
 * Compute the set of block placements for an ocean feature at landmark column (wx, wz).
 * Returns an array of {x, y, z, id} placements (ids resolved by caller via resolver) or []
 * when the feature is nil. `surfaceY` is the ocean floor elevation.
 * `idOf(name)` resolves block names -> block ids (injected to keep this module pure).
 */
export function oceanFeatureBlocks(wx, wz, seed, biome, surfaceY, idOf) {
  const feat = oceanFeature(wx, wz, seed, biome, surfaceY);
  if (!feat) return [];
  const out = [];
  const rng = mulberry32(seed ^ (wx * 31) ^ (wz * 57));
  const top = surfaceY;

  switch (feat.tag) {
    case 'coral': {
      // a small reef: coral_block base + coral_plant above
      out.push({ x: wx, y: top, z: wz, id: idOf('coral_block') });
      if (rng() < 0.6) out.push({ x: wx, y: top + 1, z: wz, id: idOf('coral_plant') });
      if (rng() < 0.3) out.push({ x: wx + 1, y: top, z: wz, id: idOf('coral_block') });
      if (rng() < 0.3) out.push({ x: wx - 1, y: top, z: wz, id: idOf('coral_plant') });
      break;
    }
    case 'kelp': {
      // kelp stalk 2-3 tall from floor upward (within water column)
      const h = 2 + Math.floor(rng() * 2);
      out.push({ x: wx, y: top + 1, z: wz, id: idOf('kelp') });
      if (h >= 2) out.push({ x: wx, y: top + 2, z: wz, id: idOf('kelp') });
      if (h >= 3) out.push({ x: wx, y: top + 3, z: wz, id: idOf('kelp') });
      break;
    }
    case 'seagrass': {
      // clump of seagrass on the floor
      out.push({ x: wx, y: top + 1, z: wz, id: idOf('seagrass') });
      if (rng() < 0.5) out.push({ x: wx + 1, y: top + 1, z: wz, id: idOf('seagrass') });
      if (rng() < 0.5) out.push({ x: wx - 1, y: top + 1, z: wz, id: idOf('seagrass') });
      break;
    }
    case 'iceberg': {
      // a gleaming ice mound rising above the surface line
      const h = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < h; i++) out.push({ x: wx, y: surfaceY + i, z: wz, id: idOf('iceberg_ice') });
      out.push({ x: wx, y: surfaceY, z: wz + 1, id: idOf('iceberg_ice') });
      out.push({ x: wx + 1, y: surfaceY, z: wz, id: idOf('iceberg_ice') });
      break;
    }
    case 'treasure': {
      // buried treasure: treasure block buried 2-3 below the sandy floor
      out.push({ x: wx, y: top - 2, z: wz, id: idOf('treasure') });
      // treasure_map item is dropped/looted as the clue (handled by game layer via position)
      feat.loot = { x: wx, y: top - 2, z: wz };
      break;
    }
    case 'wreck': {
      // a small shipwreck: hull of wreck_planks + a mast of oak_log
      out.push({ x: wx, y: top, z: wz, id: idOf('wreck_planks') });
      out.push({ x: wx + 1, y: top, z: wz, id: idOf('wreck_planks') });
      out.push({ x: wx, y: top + 1, z: wz, id: idOf('wreck_planks') });
      out.push({ x: wx, y: top, z: wz + 1, id: idOf('wreck_planks') });
      out.push({ x: wx, y: top + 1, z: wz, id: idOf('spruce_log') });
      break;
    }
    case 'ruin': {
      // low underwater ruin walls
      out.push({ x: wx, y: top, z: wz, id: idOf('stone_bricks') });
      out.push({ x: wx + 1, y: top, z: wz, id: idOf('stone_bricks') });
      out.push({ x: wx - 1, y: top, z: wz, id: idOf('stone_bricks') });
      out.push({ x: wx, y: top, z: wz + 1, id: idOf('mossy_cobblestone') });
      break;
    }
    default: break;
  }
  return out;
}

/**
 * Treasure-map clue text derived from dig-site vs player position (C15 藏宝图或等价线索引导
 * 到可挖掘奖励). Deterministic bearing + distance hint string.
 */
export function treasureClue(digX, digZ, playerX, playerZ) {
  const dx = digX - playerX, dz = digZ - playerZ;
  const dist = Math.ceil(Math.hypot(dx, dz));
  const ang = Math.atan2(dx, dz) * 180 / Math.PI;
  const dir = ang >= -22.5 && ang < 22.5 ? 'north' :
              ang >= 22.5 && ang < 67.5 ? 'northeast' :
              ang >= 67.5 && ang < 112.5 ? 'east' :
              ang >= 112.5 && ang < 157.5 ? 'southeast' :
              ang >= 157.5 || ang < -157.5 ? 'south' :
              ang >= -157.5 && ang < -112.5 ? 'southwest' :
              ang >= -112.5 && ang < -67.5 ? 'west' : 'northwest';
  return `Treasure bearing ${dir}, ~${dist}m away`;
}

/**
 * Resolve how much buried treasure loot is granted (C15 reward). Deterministic-ish (rng).
 */
export function treasureLoot(rng = Math.random) {
  return {
    gold_ingot: 1 + Math.floor(rng() * 3),
    diamond: rng() < 0.3 ? 1 : 0,
  };
}
