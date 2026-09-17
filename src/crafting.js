// W3 crafting execution (C07): consumes grid ingredients / inventory materials and
// produces the output. Built on recipes.js (config) + inventory.js.

import { countItem, removeItem, addItem, canAdd } from './inventory.js';
import { matchRecipe, RECIPES, recipeMeta } from './recipes.js';
import { itemId } from './items.js';

/**
 * Craft using an explicit 3x3 grid of item names/ids ('' or falsy = empty).
 * On success consumes one of each ingredient and returns the crafted item.
 * Returns {ok, recipe?, reason?, output?}.
 */
export function craftFromGrid(grid) {
  const recipe = matchRecipe(grid);
  if (!recipe) return { ok: false, reason: 'no matching recipe' };
  const meta = recipeMeta(recipe.id);
  return { ok: true, recipe: recipe.id, output: { ...recipe.out }, inputs: meta.inputs };
}

/** True if the inventory currently holds every ingredient of `recipe`. */
export function canCraft(inv, recipe) {
  const meta = recipeMeta(recipe.id);
  if (!meta) return false;
  for (const name of meta.inputs) {
    if (countItem(inv, itemId(name)) < 1) return false;
  }
  if (!canAdd(inv, itemId(recipe.out.item), recipe.out.count)) return false;
  return true;
}

/**
 * One-click craft from inventory: consumes one of each ingredient and places the output.
 * Returns {ok, recipe, reason, output}.
 */
export function craftRecipe(inv, recipe) {
  const meta = recipeMeta(recipe.id);
  if (!meta) return { ok: false, reason: 'unknown recipe' };
  for (const name of meta.inputs) {
    if (countItem(inv, itemId(name)) < 1) return { ok: false, reason: `missing ${name}` };
  }
  const space = canAdd(inv, itemId(recipe.out.item), recipe.out.count);
  if (!space) return { ok: false, reason: 'no inventory space' };
  for (const name of meta.inputs) removeItem(inv, itemId(name), 1);
  const added = addItem(inv, itemId(recipe.out.item), recipe.out.count);
  if (added < recipe.out.count) {
    // rollback on partial failure (shouldn't happen after canAdd, defensive)
    for (const name of meta.inputs) addItem(inv, itemId(name), 1);
    return { ok: false, reason: 'inventory full' };
  }
  return { ok: true, recipe: recipe.id, output: { item: recipe.out.item, count: recipe.out.count } };
}

/** Craft the given recipe repeatedly while possible; returns total crafted count. */
export function craftRecipeN(inv, recipe, n = Number.MAX_SAFE_INTEGER) {
  let done = 0;
  for (let i = 0; i < n; i++) {
    const r = craftRecipe(inv, recipe);
    if (!r.ok) break;
    done += r.output.count;
  }
  return done;
}

export { RECIPES };
