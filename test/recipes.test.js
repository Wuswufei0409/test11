import { describe, it, expect } from 'vitest';
import { RECIPES, matchRecipe, listRecipes, getRecipe, recipeMeta, supportedRecipeManifest } from '../src/recipes.js';
import { ITEMS, ITEM_BY_ID, ITEM_BY_NAME, toolDef, itemId } from '../src/items.js';
import { blockId } from '../src/blocks.js';

describe('C07 recipe book: supported recipes and grid sizes', () => {
  it('exposes workbench, wood/stone/iron tools, torch, chest, furnace, boat, bucket, bread + underwater rep', () => {
    const ids = listRecipes().map((r) => r.id);
    for (const req of [
      'crafting_table', 'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'iron_axe', 'iron_shovel',
      'torch', 'chest', 'furnace', 'boat', 'bucket', 'bread', 'sponge',
    ]) {
      expect(ids).toContain(req);
    }
  });

  it('2x2 recipes do not need a workbench; 3x3 recipes do', () => {
    expect(recipeMeta('stick').needsWorkbench).toBe(false);
    expect(recipeMeta('crafting_table').needsWorkbench).toBe(false);
    expect(recipeMeta('oak_planks').needsWorkbench).toBe(false);
    expect(recipeMeta('iron_pickaxe').needsWorkbench).toBe(true);
    expect(recipeMeta('chest').needsWorkbench).toBe(true);
    expect(recipeMeta('furnace').needsWorkbench).toBe(true);
    expect(recipeMeta('bucket').needsWorkbench).toBe(true);
    expect(recipeMeta('bread').needsWorkbench).toBe(true);
  });

  it('manifest lists actual supported recipes (C07 listing)', () => {
    const manifest = supportedRecipeManifest();
    expect(manifest.length).toBe(RECIPES.length);
    const ironPick = manifest.find((r) => r.id === 'iron_pickaxe');
    expect(ironPick.grid).toBe('3x3 (workbench)');
    expect(ironPick.inputs).toHaveLength(5); // 3 ingots + 2 sticks
    expect(ironPick.inputs.filter((i) => i === 'iron_ingot')).toHaveLength(3);
    expect(ironPick.inputs.filter((i) => i === 'stick')).toHaveLength(2);
    expect(ironPick.output).toEqual({ item: 'iron_pickaxe', count: 1 });
  });

  it('matchRecipe matches a valid 2x2 grid (planks, stick, torch)', () => {
    expect(matchRecipe(['oak_log', '', '', '', '', '', '', '', '']).id).toBe('oak_planks');
    // stick: 2 planks stacked vertically in the top-left 2x2
    const stick = matchRecipe(['oak_planks', '', '', 'oak_planks', '', '', '', '', '']);
    expect(stick.id).toBe('stick');
    // torch: coal over stick (any orientation via transforms)
    const torch = matchRecipe(['coal', '', '', 'stick', '', '', '', '', '']);
    expect(torch.id).toBe('torch');
  });

  it('matchRecipe matches 3x3 tools and rejects empty / unknown grids', () => {
    const ironPick = matchRecipe([
      'iron_ingot', 'iron_ingot', 'iron_ingot',
      '', 'stick', '', '', 'stick', '',
    ]);
    expect(ironPick.id).toBe('iron_pickaxe');
    expect(matchRecipe(['', '', '', '', '', '', '', '', ''])).toBeNull();
    expect(matchRecipe(['oak_log', '', '', 'diamond', '', '', '', '', ''])).toBeNull();
  });
});

describe('item registry (C08 tool definitions)', () => {
  it('registers tools with tier/kind/durability and an id > 100', () => {
    const p = toolDef('wooden_pickaxe');
    expect(p.tier).toBe(0);
    expect(p.kind).toBe('pickaxe');
    const ip = toolDef('iron_pickaxe');
    expect(ip.tier).toBe(2);
    expect(ip.durability).toBeGreaterThan(toolDef('wooden_pickaxe').durability);
    expect(toolDef('iron_pickaxe').speed).toBeGreaterThan(toolDef('wooden_pickaxe').speed);
  });

  it('tierRank / speed order wood < stone < iron (C08 upgrade chain)', () => {
    expect(toolDef('wooden_pickaxe').tier).toBeLessThan(toolDef('stone_pickaxe').tier);
    expect(toolDef('stone_pickaxe').tier).toBeLessThan(toolDef('iron_pickaxe').tier);
    expect(ITEM_BY_NAME.has('iron_ingot')).toBe(true);
    expect(itemId('iron_ingot')).toBeGreaterThan(100);
  });
});
