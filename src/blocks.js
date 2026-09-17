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
  { id: 32, name: 'bricks',    top: [170,105,95], side: [170,105,95], bot: [170,105,95], hardness: 2.0, solid: true, opaque: true },
  { id: 33, name: 'mossy_cobblestone', top: [104,120,96], side: [104,120,96], bot: [104,120,96], hardness: 2.0, solid: true, opaque: true },
  // ---- C13 farming (crops are non-solid plant crops; farmland is solid ground) ----
  { id: 34, name: 'farmland',   top: [120,90,50], side: [92,66,42], bot: [92,66,42], hardness: 0.5, solid: true, opaque: true },
  { id: 35, name: 'wheat_crop', top: [210,190,90], side: [210,190,90], bot: [210,190,90], hardness: 0, solid: false, opaque: false, plant: true },
  { id: 36, name: 'carrot_crop',top: [230,150,70], side: [230,150,70], bot: [230,150,70], hardness: 0, solid: false, opaque: false, plant: true },
  { id: 37, name: 'potato_crop',top: [200,170,80], side: [200,170,80], bot: [200,170,80], hardness: 0, solid: false, opaque: false, plant: true },
  { id: 38, name: 'bed',       top: [220,70,90], side: [180,60,80], bot: [120,50,60], hardness: 0.4, solid: true, opaque: true },
  // ---- W3 craftable blocks (renumbered 39-43 to avoid collision with farming 34-38) ----
  { id: 39, name: 'sponge',      top: [214,196,92], side: [214,196,92], bot: [214,196,92], hardness: 0.6, solid: true, opaque: true },
  { id: 40, name: 'chest',       top: [150,112,64], side: [133,97,53], bot: [150,112,64], hardness: 2.5, solid: true, opaque: true },
  { id: 41, name: 'furnace',     top: [116,116,116], side: [126,118,108], bot: [116,116,116], hardness: 3.5, solid: true, opaque: true },
  { id: 42, name: 'torch',       top: [255,214,110], side: [150,118,64], bot: [150,118,64], hardness: 0, solid: false, opaque: false, plant: true },
  { id: 43, name: 'crafting_table', top: [168,132,74], side: [136,104,60], bot: [150,112,64], hardness: 2.5, solid: true, opaque: true },
  // ---- C11/C12 drops, food, seeds, weapons, armor (item defs; not world blocks) ----
  { id: 100, name: 'raw_pork',   color: [240,150,160], hardness: 0, solid: false, opaque: false, item: true },
  { id: 101, name: 'raw_beef',   color: [200,90,90], hardness: 0, solid: false, opaque: false, item: true },
  { id: 102, name: 'raw_mutton', color: [210,110,110], hardness: 0, solid: false, opaque: false, item: true },
  { id: 103, name: 'raw_chicken',color: [240,220,200], hardness: 0, solid: false, opaque: false, item: true },
  { id: 104, name: 'wheat',      color: [220,190,90], hardness: 0, solid: false, opaque: false, item: true },
  { id: 105, name: 'wheat_seeds',color: [180,150,80], hardness: 0, solid: false, opaque: false, item: true },
  { id: 106, name: 'carrot',     color: [240,140,40], hardness: 0, solid: false, opaque: false, item: true },
  { id: 107, name: 'potato',     color: [190,150,80], hardness: 0, solid: false, opaque: false, item: true },
  { id: 108, name: 'leather',    color: [160,120,70], hardness: 0, solid: false, opaque: false, item: true },
  { id: 109, name: 'wool',       color: [240,240,240], hardness: 0, solid: false, opaque: false, item: true },
  { id: 110, name: 'feather',    color: [250,250,250], hardness: 0, solid: false, opaque: false, item: true },
  { id: 111, name: 'rotten_flesh',color: [120,110,60], hardness: 0, solid: false, opaque: false, item: true, food: 2 },
  { id: 112, name: 'string',     color: [210,210,210], hardness: 0, solid: false, opaque: false, item: true },
  { id: 113, name: 'gunpowder',  color: [120,120,120], hardness: 0, solid: false, opaque: false, item: true },
  { id: 114, name: 'arrow',      color: [200,180,150], hardness: 0, solid: false, opaque: false, item: true },
  { id: 120, name: 'sword_wood', color: [150,110,70], hardness: 0, solid: false, opaque: false, item: true },
  { id: 121, name: 'sword_stone',color: [190,190,190], hardness: 0, solid: false, opaque: false, item: true },
  { id: 122, name: 'sword_iron', color: [220,220,225], hardness: 0, solid: false, opaque: false, item: true },
  { id: 123, name: 'bow',        color: [140,95,55], hardness: 0, solid: false, opaque: false, item: true },
  { id: 124, name: 'leather_armor', color: [170,130,80], hardness: 0, solid: false, opaque: false, item: true },
  { id: 125, name: 'iron_armor', color: [210,210,215], hardness: 0, solid: false, opaque: false, item: true },
  // ---- C14/C15 aquatic blocks (44-51) ----
  { id: 44, name: 'coral_block', top: [214,96,70], side: [214,96,70], bot: [214,96,70], hardness: 0.9, solid: true, opaque: true },
  { id: 45, name: 'coral_plant', top: [214,96,70], side: [150,70,54], bot: [150,70,54], hardness: 0.1, solid: false, opaque: false, plant: true, water: true },
  { id: 46, name: 'kelp', top: [64,150,60], side: [48,120,50], bot: [48,120,50], hardness: 0.1, solid: false, opaque: false, plant: true, water: true },
  { id: 47, name: 'seagrass', top: [70,160,70], side: [54,130,58], bot: [54,130,58], hardness: 0.1, solid: false, opaque: false, plant: true, water: true },
  { id: 48, name: 'treasure', top: [200,170,60], side: [150,120,70], bot: [150,120,70], hardness: 1.2, solid: true, opaque: true },
  { id: 49, name: 'wreck_planks', top: [140,104,66], side: [120,88,56], bot: [120,88,56], hardness: 2.0, solid: true, opaque: true },
  { id: 50, name: 'iceberg_ice', top: [190,220,240], side: [170,205,230], bot: [170,205,230], hardness: 0.6, solid: true, opaque: true },
  { id: 51, name: 'hidden_treasure', top: [150,120,70], side: [120,92,54], bot: [120,92,54], hardness: 1.2, solid: true, opaque: true },
  // ---- C16 aquatic fish/items (126-134) ----
  { id: 126, name: 'cod',      color: [150,110,70],  hardness: 0, solid: false, opaque: false, item: true, food: 2 },
  { id: 127, name: 'salmon',   color: [240,130,120], hardness: 0, solid: false, opaque: false, item: true, food: 2 },
  { id: 128, name: 'tropical_fish', color: [250,190,90], hardness: 0, solid: false, opaque: false, item: true, food: 1 },
  { id: 129, name: 'pufferfish', color: [210,190,90], hardness: 0, solid: false, opaque: false, item: true, food: 1 },
  { id: 130, name: 'trident', color: [110,180,190], hardness: 0, solid: false, opaque: false, item: true },
  { id: 131, name: 'cod_bucket',   color: [130,140,170], hardness: 0, solid: false, opaque: false, item: true },
  { id: 132, name: 'salmon_bucket',   color: [220,150,140], hardness: 0, solid: false, opaque: false, item: true },
  { id: 133, name: 'tropicalfish_bucket', color: [235,190,120], hardness: 0, solid: false, opaque: false, item: true },
  { id: 134, name: 'pufferfish_bucket', color: [200,190,120], hardness: 0, solid: false, opaque: false, item: true },
  { id: 135, name: 'water_bucket', color: [60,110,200], hardness: 0, solid: false, opaque: false, item: true },
  { id: 136, name: 'treasure_map', color: [230,190,120], hardness: 0, solid: false, opaque: false, item: true },
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

/**
 * Distinct block ids obtainable in the 'mine -> inventory -> place' loop (C05, >=30).
 * Includes solid breakable blocks AND instantly-breakable plants; excludes air, bedrock, water.
 */
export function breakableBlockCount() {
  return BLOCKS.filter((b) => b.id !== 0 && b.name !== 'bedrock' && b.name !== 'water' && (b.solid || b.plant)).length;
}
