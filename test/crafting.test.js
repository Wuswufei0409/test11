import { describe, it, expect } from 'vitest';
import { createInventory, addItem, countItem } from '../src/inventory.js';
import { craftFromGrid, canCraft, craftRecipe, craftRecipeN } from '../src/crafting.js';
import { getRecipe } from '../src/recipes.js';
import { itemId } from '../src/items.js';

describe('C07 crafting: grid matching consumes inputs and produces output', () => {
  it('craftFromGrid matches planks (log -> 4 planks)', () => {
    const r = craftFromGrid(['oak_log', '', '', '', '', '', '', '', '']);
    expect(r.ok).toBe(true);
    expect(r.recipe).toBe('oak_planks');
    expect(r.output).toEqual({ item: 'oak_planks', count: 4 });
  });

  it('craftFromGrid rejects an empty/unknown grid', () => {
    expect(craftFromGrid(['', '', '', '', '', '', '', '', '']).ok).toBe(false);
    expect(craftFromGrid(['oak_log', '', '', 'diamond', '', '', '', '', '']).ok).toBe(false);
  });

  it('one-click craftRecipe consumes ingredients and adds output to inventory', () => {
    const inv = createInventory();
    addItem(inv, itemId('oak_log'), 2);
    const r = craftRecipe(inv, getRecipe('oak_planks'));
    expect(r.ok).toBe(true);
    expect(countItem(inv, itemId('oak_log'))).toBe(1);
    expect(countItem(inv, itemId('oak_planks'))).toBeGreaterThanOrEqual(4);
  });

  it('canCraft reports ingredient availability and output space', () => {
    const inv = createInventory();
    expect(canCraft(inv, getRecipe('torch'))).toBe(false); // no coal/stick
    addItem(inv, itemId('coal'), 1);
    addItem(inv, itemId('stick'), 1);
    expect(canCraft(inv, getRecipe('torch'))).toBe(true);
    expect(craftRecipe(inv, getRecipe('torch')).ok).toBe(true);
    expect(countItem(inv, itemId('torch'))).toBe(4);
  });

  it('craftRecipeN crafts repeatedly (wood -> planks -> table/sticks chain)', () => {
    const inv = createInventory();
    addItem(inv, itemId('oak_log'), 6);
    const planks = craftRecipeN(inv, getRecipe('oak_planks'));
    expect(planks).toBe(24); // 6 logs -> 24 planks
    // craft a crafting table first (needs 4 planks)
    expect(craftRecipe(inv, getRecipe('crafting_table')).ok).toBe(true);
    expect(countItem(inv, itemId('crafting_table'))).toBe(1);
    // remaining planks -> sticks (2 planks per craft -> 4 sticks)
    const sticks = craftRecipeN(inv, getRecipe('stick'));
    expect(sticks).toBe((24 - 4) / 2 * 4); // 10 crafts * 4
    expect(countItem(inv, itemId('stick'))).toBe(40);
  });

  it('fails cleanly when missing material (no silent partial craft)', () => {
    const inv = createInventory();
    addItem(inv, itemId('coal'), 1); // no stick
    const r = craftRecipe(inv, getRecipe('torch'));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('missing');
    expect(countItem(inv, itemId('coal'))).toBe(1); // not consumed
  });
});
