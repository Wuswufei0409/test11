// Mining timing: deterministic break time from block hardness (C05, 按硬度破坏).
// Higher hardness => longer break. Unbreakable blocks (negative hardness, e.g. bedrock)
// return Infinity. Pure so it is unit-testable.

import { blockDef } from './blocks.js';

/** Break time in seconds from a block id; Infinity for unbreakable. */
export function mineTime(blockId) {
  const def = blockDef(blockId);
  if (!def || def.hardness < 0) return Infinity;
  return Math.max(0.05, def.hardness * 0.9);
}

/** Ordered by hardness: dirt < grass/leaves < stone < wood/logs < ore. */
export function hardnessRank(blockId) {
  return blockDef(blockId) ? Math.max(0, blockDef(blockId).hardness) : Infinity;
}
