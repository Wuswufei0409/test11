// W3 item + tool registry (C07/C08). Extends blocks.js: blocks are items too (type 'block'),
// and we add craftable items — raw materials, tools, food, water items — with ids >= 100.
// Pure JS, no DOM, so it is fully unit-testable.

import { blockId, blockDef, BLOCKS, BLOCK_BY_ID } from './blocks.js';

export const TOOL_TIERS = ['wood', 'stone', 'iron'];

/**
 * Tool capability definitions, keyed by tool item name.
 *  - tier / tierName : material tier (0 wood, 1 stone, 2 iron) — the upgrade chain (C08)
 *  - kind            : pickaxe | axe | shovel | sword
 *  - speed           : mining speed multiplier vs hand (higher = faster on correct block)
 *  - durability      : uses before the tool breaks
 *  - harvest         : highest harvest-tier the tool can mine (wood=0, stone=1, iron=2)
 */
export const TOOLS = {
  wooden_pickaxe: { tier: 0, tierName: 'wood', kind: 'pickaxe', speed: 2.0, durability: 60,  harvest: 0 },
  stone_pickaxe:  { tier: 1, tierName: 'stone', kind: 'pickaxe', speed: 4.0, durability: 132, harvest: 1 },
  iron_pickaxe:   { tier: 2, tierName: 'iron',  kind: 'pickaxe', speed: 6.0, durability: 250, harvest: 2 },
  wooden_axe:     { tier: 0, tierName: 'wood',  kind: 'axe',     speed: 2.0, durability: 60,  harvest: 0 },
  stone_axe:      { tier: 1, tierName: 'stone', kind: 'axe',     speed: 4.0, durability: 132, harvest: 1 },
  iron_axe:       { tier: 2, tierName: 'iron',  kind: 'axe',     speed: 6.0, durability: 250, harvest: 2 },
  wooden_shovel:  { tier: 0, tierName: 'wood',  kind: 'shovel',  speed: 2.0, durability: 60,  harvest: 0 },
  stone_shovel:   { tier: 1, tierName: 'stone', kind: 'shovel',  speed: 4.0, durability: 132, harvest: 1 },
  iron_shovel:    { tier: 2, tierName: 'iron',  kind: 'shovel',  speed: 6.0, durability: 250, harvest: 2 },
  wooden_sword:   { tier: 0, tierName: 'wood',  kind: 'sword',   speed: 1.5, durability: 60,  harvest: 0 },
  stone_sword:    { tier: 1, tierName: 'stone', kind: 'sword',   speed: 1.5, durability: 132, harvest: 1 },
  iron_sword:     { tier: 2, tierName: 'iron',  kind: 'sword',   speed: 1.5, durability: 250, harvest: 2 },
};

/** Color (rgb triple) for HUD/item-icon display. */
const C = {
  stick: [190, 165, 120],
  coal: [45, 45, 48],
  iron_ingot: [226, 226, 228],
  gold_ingot: [250, 210, 70],
  diamond: [110, 235, 245],
  iron_ore_raw: [210, 170, 120],
  gold_ore_raw: [240, 200, 80],
  bread: [220, 158, 70],
  wheat: [224, 190, 96],
  boat: [160, 120, 74],
  bucket: [150, 155, 160],
  sponge: [214, 196, 92],
  torch: [255, 214, 110],
  chest: [133, 97, 53],
  furnace: [126, 118, 108],
  crafting_table: [136, 104, 60],
};
const TOOL_COLORS = {
  wood: [200, 175, 130], stone: [150, 150, 150], iron: [225, 226, 232],
};

/** Item definitions for non-block items. Blocks remain reachable via their block id/name. */
export const ITEM_DEFS = [
  // raw materials (renumbered to 200+ to avoid collision with blocks.js item defs 100-125)
  { id: 200, name: 'stick', type: 'item', stack: 64, color: C.stick },
  { id: 201, name: 'coal', type: 'item', stack: 64, color: C.coal },
  { id: 202, name: 'iron_ingot', type: 'item', stack: 64, color: C.iron_ingot },
  { id: 203, name: 'gold_ingot', type: 'item', stack: 64, color: C.gold_ingot },
  { id: 204, name: 'diamond', type: 'item', stack: 64, color: C.diamond },
  { id: 205, name: 'iron_ore_raw', type: 'item', stack: 64, color: C.iron_ore_raw },
  { id: 206, name: 'gold_ore_raw', type: 'item', stack: 64, color: C.gold_ore_raw },
  // food / water
  { id: 208, name: 'bread', type: 'item', stack: 64, color: C.bread, food: 5 },
  { id: 209, name: 'boat', type: 'item', stack: 1, color: C.boat },
  { id: 210, name: 'bucket', type: 'item', stack: 16, color: C.bucket },
  // tools
  ...Object.entries(TOOLS).map(([name, t]) => ({
    id: toolIdFor(name), name, type: 'tool', stack: 1,
    color: TOOL_COLORS[t.tierName] || C.stick, tool: t,
  })),
];

/** Stable id assignment for tools (220..231). */
function toolIdFor(name) {
  const idx = Object.keys(TOOLS).indexOf(name);
  return 220 + idx;
}
export const TOOL_ID_BASE = 220;

const BLOCK_ITEMS = BLOCKS
  .filter((b) => b.id > 0)
  .map((b) => ({ id: b.id, name: b.name, type: 'block', stack: 64, color: b.side || [200, 200, 200] }));

/** Master item registry: block items + W3 items, indexed by id and by name. */
export const ITEMS = [...BLOCK_ITEMS, ...ITEM_DEFS].filter((it, i, arr) => arr.findIndex((x) => x.id === it.id) === i);
export const ITEM_BY_ID = new Map(ITEMS.map((it) => [it.id, it]));
export const ITEM_BY_NAME = new Map(ITEMS.map((it) => [it.name, it]));

/** Resolve an item name to its id (blocks + items). */
export function itemId(name) {
  if (ITEM_BY_NAME.has(name)) return ITEM_BY_NAME.get(name).id;
  return blockId(name);
}

/** Get item definition by id or name. Falls back to a block def when present. */
export function itemDef(ref) {
  if (typeof ref === 'string') return ITEM_BY_NAME.get(ref) || null;
  return ITEM_BY_ID.get(ref) || null;
}

export function itemName(id) {
  const b = BLOCK_BY_ID.get(id);
  if (b) return b.name;
  const it = ITEM_BY_ID.get(id);
  return it ? it.name : '?';
}

/** Tool capability for a tool item id/name; null if the item is not a tool. */
export function toolDef(itemIdOrName) {
  const d = itemDef(itemIdOrName);
  if (!d) return null;
  return d.tool || null;
}

export function isTool(name) {
  const d = itemDef(name);
  return !!d && d.type === 'tool';
}
