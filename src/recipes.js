// W3 config-driven crafting recipes (C07): 2x2 player + 3x3 workbench grids + recipe book.
// Every recipe is a pure data entry {id, grid (3x3 of item names or null), out, meta}.
// Pure JS / no DOM so it is unit-testable, and new items are added by editing the config.

// 3x3 helper cells
const _ = null;

/** Recipe definition list. `grid` is always 3x3; a recipe that only fills the top-left 2x2
 *  is a 2x2 recipe (no workbench required), anything spanning 3 cells needs a workbench. */
export const RECIPES = [
  // ---- 2x2 (craftable in the player inventory grid) ----
  { id: 'oak_planks', out: { item: 'oak_planks', count: 4 }, grid: [
    ['oak_log', _, _], [_, _, _], [_, _, _],
  ] },
  { id: 'stick', out: { item: 'stick', count: 4 }, grid: [
    ['oak_planks', _, _], ['oak_planks', _, _], [_, _, _],
  ] },
  { id: 'crafting_table', out: { item: 'crafting_table', count: 1 }, grid: [
    ['oak_planks', 'oak_planks', _], ['oak_planks', 'oak_planks', _], [_, _, _],
  ] },
  { id: 'torch', out: { item: 'torch', count: 4 }, grid: [
    ['coal', _, _], ['stick', _, _], [_, _, _],
  ] },
  { id: 'sponge', out: { item: 'sponge', count: 1 }, grid: [
    ['sand', 'sand', _], ['sand', 'sand', _], [_, _, _],
  ] }, // underwater representative block

  // ---- 3x3 (needs the crafting_table / workbench) ----
  { id: 'chest', out: { item: 'chest', count: 1 }, grid: [
    ['oak_planks', 'oak_planks', 'oak_planks'],
    ['oak_planks', _, 'oak_planks'],
    ['oak_planks', 'oak_planks', 'oak_planks'],
  ] },
  { id: 'furnace', out: { item: 'furnace', count: 1 }, grid: [
    ['cobblestone', 'cobblestone', 'cobblestone'],
    ['cobblestone', _, 'cobblestone'],
    ['cobblestone', 'cobblestone', 'cobblestone'],
  ] },
  { id: 'boat', out: { item: 'boat', count: 1 }, grid: [
    ['oak_planks', 'oak_planks', 'oak_planks'],
    ['oak_planks', _, 'oak_planks'],
    ['oak_planks', 'oak_planks', 'oak_planks'],
  ] },
  { id: 'bucket', out: { item: 'bucket', count: 1 }, grid: [
    [_, 'iron_ingot', _], ['iron_ingot', _, 'iron_ingot'], [_, 'iron_ingot', _],
  ] },
  { id: 'bread', out: { item: 'bread', count: 1 }, grid: [
    ['wheat', 'wheat', 'wheat'], [_, _, _], [_, _, _],
  ] },

  // ---- tools (3x3, workbench) ----
  { id: 'wooden_pickaxe', out: { item: 'wooden_pickaxe', count: 1 }, grid: [
    ['oak_planks', 'oak_planks', 'oak_planks'], [_, 'stick', _], [_, 'stick', _],
  ] },
  { id: 'stone_pickaxe', out: { item: 'stone_pickaxe', count: 1 }, grid: [
    ['cobblestone', 'cobblestone', 'cobblestone'], [_, 'stick', _], [_, 'stick', _],
  ] },
  { id: 'iron_pickaxe', out: { item: 'iron_pickaxe', count: 1 }, grid: [
    ['iron_ingot', 'iron_ingot', 'iron_ingot'], [_, 'stick', _], [_, 'stick', _],
  ] },
  { id: 'wooden_axe', out: { item: 'wooden_axe', count: 1 }, grid: [
    ['oak_planks', 'stick', _], ['oak_planks', 'stick', _], [_, _, _],
  ] },
  { id: 'stone_axe', out: { item: 'stone_axe', count: 1 }, grid: [
    ['cobblestone', 'stick', _], ['cobblestone', 'stick', _], [_, _, _],
  ] },
  { id: 'iron_axe', out: { item: 'iron_axe', count: 1 }, grid: [
    ['iron_ingot', 'stick', _], ['iron_ingot', 'stick', _], [_, _, _],
  ] },
  { id: 'wooden_shovel', out: { item: 'wooden_shovel', count: 1 }, grid: [
    ['oak_planks', _, _], ['stick', _, _], ['stick', _, _],
  ] },
  { id: 'stone_shovel', out: { item: 'stone_shovel', count: 1 }, grid: [
    ['cobblestone', _, _], ['stick', _, _], ['stick', _, _],
  ] },
  { id: 'iron_shovel', out: { item: 'iron_shovel', count: 1 }, grid: [
    ['iron_ingot', _, _], ['stick', _, _], ['stick', _, _],
  ] },
  { id: 'wooden_sword', out: { item: 'wooden_sword', count: 1 }, grid: [
    ['oak_planks', _, _], ['oak_planks', _, _], ['stick', _, _],
  ] },
  { id: 'stone_sword', out: { item: 'stone_sword', count: 1 }, grid: [
    ['cobblestone', _, _], ['cobblestone', _, _], ['stick', _, _],
  ] },
  { id: 'iron_sword', out: { item: 'iron_sword', count: 1 }, grid: [
    ['iron_ingot', _, _], ['iron_ingot', _, _], ['stick', _, _],
  ] },
];

/** Normalize a recipe grid to a canonical flat 3x3 array of item names ('' for empty).
 * Accepts either a flat 9-array or a nested [[3],[3],[3]] array. */
function norm(grid) {
  const flat = Array.isArray(grid[0]) ? grid.flat() : grid;
  return flat.map((c) => (c && c !== '' ? c : ''));
}

/** All variants (8 dihedral transforms) of a 3x3 grid. */
function variants(grid) {
  const g = norm(grid);
  const out = [];
  let cur = g;
  for (let rot = 0; rot < 4; rot++) {
    out.push(cur);
    out.push(mirror(cur));
    cur = rotate(cur);
  }
  // dedupe
  const seen = new Set();
  return out.filter((v) => { const k = v.join('|'); if (seen.has(k)) return false; seen.add(k); return true; });
}
function rotate(g) { // 90deg clockwise
  return [g[6], g[3], g[0], g[7], g[4], g[1], g[8], g[5], g[2]];
}
function mirror(g) { // horizontal flip
  return [g[2], g[1], g[0], g[5], g[4], g[3], g[8], g[7], g[6]];
}

/** Memory of recipe -> whether it needs a workbench (3x3) or fits in 2x2. */
const META = new Map();
for (const r of RECIPES) {
  const flat = norm(r.grid);
  const cells = flat.filter((c) => c !== '');
  const cols = new Set(), rows = new Set();
  flat.forEach((c, i) => {
    if (c !== '') { rows.add(Math.floor(i / 3)); cols.add(i % 3); }
  });
  const w = Math.max(...cols) + 1;
  const h = Math.max(...rows) + 1;
  const needsWorkbench = w > 2 || h > 2;
  META.set(r.id, { needsWorkbench, width: w, height: h, inputs: cells, output: r.out });
}

export function recipeMeta(id) { return META.get(id) || null; }

/** Look up a recipe by id. */
export function getRecipe(id) { return RECIPES.find((r) => r.id === id) || null; }

/**
 * Match a 3x3 (or smaller, padded) grid of item names against configured recipes.
 * Returns the matched recipe or null. Works for both 2x2 and 3x3 layouts.
 */
export function matchRecipe(grid) {
  const g = norm(grid);
  for (const r of RECIPES) {
    const rv = variants(r.grid);
    for (const v of rv) {
      let ok = true;
      for (let i = 0; i < 9; i++) {
        if ((v[i] !== '') !== (g[i] !== '')) { ok = false; break; }
        if (v[i] !== '' && v[i] !== g[i]) { ok = false; break; }
      }
      if (ok) return r;
    }
  }
  return null;
}

/** The recipe book: supported recipes with their input/output and grid size (C07 list). */
export function listRecipes() {
  return RECIPES.map((r) => ({ id: r.id, ...META.get(r.id) }));
}

/** Human-readable supported-recipe manifest (C07). */
export function supportedRecipeManifest() {
  return RECIPES.map((r) => ({
    id: r.id,
    grid: META.get(r.id).needsWorkbench ? '3x3 (workbench)' : '2x2',
    inputs: META.get(r.id).inputs,
    output: r.out,
  }));
}
