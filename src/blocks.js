// Block registry. Original, original material palette. No Minecraft assets are copied.

export const AIR = 0;

// Each block: name, rgb for top/side/bottom base colors, hardness (0 blocks not breakable),
// solid (collision), opaque (whether it occludes neighbors / rendered opaque), and a refresh
// variant id to give per-type noise.
const DEFS = [
  { id: 0,  name: 'air',        solid: false, opaque: false },
  { id: 1,  name: 'grass',      top: [106,170,64], side: [122,104,68], bot: [122,104,68], hardness: 0.6, solid: true, opaque: true },
  { id: 2,  name: 'dirt',       top: [122,104,68], side: [122,104,68], bot: [122,104,68], hardness: 0.5, solid: true, opaque: true },
  { id: 3,  name: 'stone',      top: [128,128,128], side: [128,128,128], bot: [128,128,128], hardness: 1.5, solid: true, opaque: true },
  { id: 4,  name: 'cobblestone',top: [110,110,110], side: [110,110,110], bot: [110,110,110], hardness: 2.0, solid: true, opaque: true },
  { id: 5,  name: 'bedrock',    top: [52,52,52], side: [52,52,52], bot: [52,52,52], hardness: -1, solid: true, opaque: true },
  { id: 6,  name: 'sand',       top: [219,209,158], side: [219,209,158], bot: [219,209,158], hardness: 0.5, solid: true, opaque: true },
  { id: 7,  name: 'sandstone',  top: [222,214,162], side: [222,214,162], bot: [222,214,162], hardness: 0.8, solid: true, opaque: true },
  { id: 8,  name: 'gravel',     top: [136,130,124], side: [136,130,124], bot: [136,130,124], hardness: 0.6, solid: true, opaque: true },
  { id: 9,  name: 'clay',       top: [151,156,162], side: [151,156,162], bot: [151,156,162], hardness: 0.6, solid: true, opaque: true },
  { id: 10, name: 'oak_log',    top: [150,112,64], side: [99,72,42], bot: [150,112,64], hardness: 2.0, solid: true, opaque: true },
  { id: 11, name: 'oak_planks', top: [178,141,79], side: [178,141,79], bot: [178,141,79], hardness: 2.0, solid: true, opaque: true },
  { id: 12, name: 'oak_leaves', top: [56,122,35], side: [56,122,35], bot: [56,122,35], hardness: 0.2, solid: true, opaque: false },
  { id: 13, name: 'spruce_log', top: [90,64,40], side: [62,41,25], bot: [90,64,40], hardness: 2.0, solid: true, opaque: true },
  { id: 14, name: 'spruce_leaves', top: [50,94,48], side: [50,94,48], bot: [50,94,48], hardness: 0.2, solid: true, opaque: false },
  { id: 15, name: 'birch_log',  top: [214,206,190], side: [172,158,140], bot: [214,206,190], hardness: 2.0, solid: true, opaque: true },
  { id: 16, name: 'cactus',     top: [94,135,55], side: [94,135,55], bot: [94,135,55], hardness: 0.4, solid: true, opaque: true },
  { id: 17, name: 'snow',       top: [248,250,252], side: [248,250,252], bot: [248,250,252], hardness: 0.2, solid: true, opaque: true },
  { id: 18, name: 'ice',        top: [150,196,228], side: [150,196,228], bot: [150,196,228], hardness: 0.5, solid: true, opaque: false },
  { id: 19, name: 'packed_ice', top: [160,198,232], side: [160,198,232], bot: [160,198,232], hardness: 0.5, solid: true, opaque: true },
  { id: 20, name: 'water',      top: [52,96,190], side: [52,96,190], bot: [52,96,190], hardness: -1, solid: false, opaque: false, fluid: true },
  { id: 21, name: 'coal_ore',   top: [118,118,118], side: [118,118,118], bot: [118,118,118], hardness: 3.0, solid: true, opaque: true, ore: true },
  { id: 22, name: 'iron_ore',   top: [128,122,116], side: [128,122,116], bot: [128,122,116], hardness: 3.0, solid: true, opaque: true, ore: true },
  { id: 23, name: 'gold_ore',   top: [128,124,96], side: [128,124,96], bot: [128,124,96], hardness: 3.0, solid: true, opaque: true, ore: true },
  { id: 24, name: 'diamond_ore', top: [112,144,150], side: [112,144,150], bot: [112,144,150], hardness: 3.0, solid: true, opaque: true, ore: true },
  { id: 25, name: 'poppy',     top: [200,55,35], side: [40,110,30], bot: [40,110,30], hardness: 0, solid: false, opaque: false, plant: true },
  { id: 26, name: 'dandelion', top: [240,215,60], side: [40,110,30], bot: [40,110,30], hardness: 0, solid: false, opaque: false, plant: true },
  { id: 27, name: 'tall_grass', top: [96,150,70], side: [96,150,70], bot: [96,150,70], hardness: 0, solid: false, opaque: false, plant: true },
  { id: 28, name: 'dead_bush', top: [150,120,70], side: [150,120,70], bot: [150,120,70], hardness: 0, solid: false, opaque: false, plant: true },
  { id: 29, name: 'stone_bricks', top: [142,142,142], side: [142,142,142], bot: [142,142,142], hardness: 1.5, solid: true, opaque: true },
  { id: 30, name: 'glass',     top: [200,225,238], side: [200,225,238], bot: [200,225,238], hardness: 0.3, solid: true, opaque: false },
  { id: 31, name: 'granite',   top: [150,114,100], side: [150,114,100], bot: [150,114,100], hardness: 1.5, solid: true, opaque: true },
];

export const BLOCKS = DEFS.map((d) => ({ ...d }));

/** Index by id and by name for convenience. */
export const BLOCK_BY_ID = new Map(BLOCKS.map((b) => [b.id, b]));
export const BLOCK_BY_NAME = new Map(BLOCKS.map((b) => [b.name, b.id]));

export function blockDef(id) {
  return BLOCK_BY_ID.get(id) || BLOCK_BY_ID.get(AIR);
}

/** Resolve a block name to its id. */
export function blockId(name) {
  return BLOCK_BY_NAME.has(name) ? BLOCK_BY_NAME.get(name) : AIR;
}

export function isSolid(id) {
  const d = blockDef(id);
  return !!d && d.solid;
}

export function isOpaque(id) {
  const d = blockDef(id);
  return !!d && d.opaque;
}

export function isFluid(id) {
  const d = blockDef(id);
  return !!d && !!d.fluid;
}

/** Distinct breakable block ids that enter the 'mine -> inventory -> place' loop (>=30 by C05). */
export function breakableBlockCount() {
  return BLOCKS.filter((b) => b.solid && b.hardness >= 0).length;
}
