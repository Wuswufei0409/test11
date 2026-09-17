// W3 tool system (C08): tool tiers, mining speed, durability, wrong-tool restriction,
// ore drops, and a correct upgrade chain (wood -> stone -> iron). Pure JS, unit-testable.

import { blockDef, blockId, BLOCK_BY_ID } from './blocks.js';
import { toolDef, itemId, itemName } from './items.js';

// Block -> required tool kind + tier. Two categories:
//  - SOFT (shovel/axe blocks): the right tool speeds mining, but bare hands still drop them.
//  - HARD (stone/ore): a pickaxe of sufficient tier is REQUIRED to drop anything at all.
const SOFT = [
  { names: ['dirt', 'grass', 'sand', 'gravel', 'clay', 'snow', 'sandstone'], kind: 'shovel', tier: 0 },
  { names: ['oak_log', 'spruce_log', 'birch_log', 'oak_planks', 'chest', 'crafting_table'], kind: 'axe', tier: 0 },
];
const HARD = [
  { names: ['stone', 'cobblestone', 'stone_bricks', 'granite', 'bricks', 'mossy_cobblestone', 'furnace'], kind: 'pickaxe', tier: 0 },
  { names: ['coal_ore'], kind: 'pickaxe', tier: 0 }, // wood pickaxe enough
  { names: ['iron_ore', 'gold_ore'], kind: 'pickaxe', tier: 1 }, // needs stone pickaxe
  { names: ['diamond_ore'], kind: 'pickaxe', tier: 2 }, // needs iron pickaxe
];

/** Preferred tool kind/tier for a block (soft or hard). Null = hand is fine. */
export function requirement(blockIdv) {
  const name = blockName(blockIdv);
  if (!name) return null;
  for (const list of [SOFT, HARD]) {
    for (const r of list) {
      if (r.names.includes(name)) return { kind: r.kind, tier: r.tier };
    }
  }
  return null;
}

/** Is this a HARD block (pickaxe + tier required to drop)? */
export function isHard(blockIdv) {
  const name = blockName(blockIdv);
  if (!name) return false;
  return HARD.some((r) => r.names.includes(name));
}

function blockName(id) {
  const b = BLOCK_BY_ID.get(id);
  return b ? b.name : null;
}

/** A valid, unbroken tool id/name. */
function toolInfo(toolIdOrName) {
  if (toolIdOrName == null) return null;
  return toolDef(toolIdOrName);
}

/** True if the player can harvest `block` with `tool` (drops resources). */
export function canHarvest(blockIdv, toolIdOrName) {
  if (!isHard(blockIdv)) return true; // soft/hand-ok blocks always drop
  const req = requirement(blockIdv);
  const t = toolInfo(toolIdOrName);
  if (!t) return false; // bare hand cannot harvest hard blocks
  if (t.kind !== req.kind) return false;
  return t.harvest >= req.tier;
}

/** Whether the given tool is the "correct kind" for this block (speeds it up). */
export function isCorrectTool(blockIdv, toolIdOrName) {
  const req = requirement(blockIdv);
  if (!req) return true;
  const t = toolInfo(toolIdOrName);
  if (!t) return false;
  return t.kind === req.kind;
}

/**
 * Break time (seconds) for block with tool. Hand is slow on hard blocks; a correct tool
 * speeds it up; a wrong tool is slower than hand. Unbreakable -> Infinity.
 */
export function mineSeconds(blockIdv, toolIdOrName) {
  const def = blockDef(blockIdv);
  if (!def || def.hardness < 0) return Infinity;
  let base = def.hardness * 0.9;
  const req = requirement(blockIdv);
  const t = toolInfo(toolIdOrName);
  if (t && !req) return Math.max(0.05, base / t.speed);
  if (t && req && t.kind === req.kind) return Math.max(0.05, base / t.speed);
  if (t && req && t.kind !== req.kind) return base * 3; // wrong tool: 3x slower
  return base; // bare hand
}

/** Drops for breaking `block` with `tool`; [] when nothing drops (wrong tool / wrong tier). */
export function dropsFor(blockIdv, toolIdOrName) {
  const name = blockName(blockIdv);
  if (!name) return [];
  // Plants / instant blocks have no tool gate
  if (isPlantish(blockIdv)) return [{ id: blockIdv, count: 1 }];
  // Ore drop table
  const oreDrops = {
    coal_ore: 'coal', iron_ore: 'iron_ore_raw', gold_ore: 'gold_ore_raw', diamond_ore: 'diamond',
  };
  if (oreDrops[name]) {
    if (!canHarvest(blockIdv, toolIdOrName)) return []; // wrong tier -> nothing
    return [{ id: itemId(oreDrops[name]), count: 1 }];
  }
  // Hard stone blocks need a pickaxe to drop
  if (isHard(blockIdv)) {
    if (canHarvest(blockIdv, toolIdOrName)) return [{ id: blockIdv, count: 1 }];
    return [];
  }
  // Soft blocks (dirt/sand/logs/planks) drop by hand
  return [{ id: blockIdv, count: 1 }];
}

function isPlantish(blockIdv) {
  const def = blockDef(blockIdv);
  if (!def) return false;
  return !!def.plant || !def.solid;
}

/** Durability: one use per mined block. Returns {used, broken} and mutates a tool stack. */
export function useDurability(stack) {
  const t = toolDef(stack.id);
  if (!t) return { used: false, broken: false };
  if (stack.durability === undefined) stack.durability = t.durability;
  stack.durability -= 1;
  if (stack.durability <= 0) {
    stack.id = 0; stack.count = 0; stack.durability = 0;
    return { used: true, broken: true };
  }
  return { used: true, broken: false };
}

export function isBroken(stack) {
  return !stack || stack.id === 0 || stack.count <= 0 || (stack.durability !== undefined && stack.durability <= 0);
}

/** Ordering helper for the upgrade chain: higher tier = higher rank. */
export function tierRank(toolIdOrName) {
  const t = toolDef(toolIdOrName);
  return t ? t.tier : -1;
}
