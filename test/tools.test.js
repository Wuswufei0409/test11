import { describe, it, expect } from 'vitest';
import { mineSeconds, canHarvest, isCorrectTool, dropsFor, requirement, useDurability } from '../src/tools.js';
import { itemId } from '../src/items.js';
import { blockId } from '../src/blocks.js';

describe('C08 tool tiers: mining speed / harvest level / wrong-tool restriction / ore drops', () => {
  it('iron tools mine faster than stone, stone faster than wood on the correct block', () => {
    const tWood = mineSeconds(blockId('stone'), 'wooden_pickaxe');
    const tStone = mineSeconds(blockId('stone'), 'stone_pickaxe');
    const tIron = mineSeconds(blockId('stone'), 'iron_pickaxe');
    expect(tWood).toBeGreaterThan(tStone);
    expect(tStone).toBeGreaterThan(tIron);
  });

  it('wrong tool kind is 3x slower (error-tool restriction, C08)', () => {
    const hand = mineSeconds(blockId('stone'), null);
    const shovelOnStone = mineSeconds(blockId('stone'), 'wooden_shovel');
    expect(shovelOnStone).toBeGreaterThan(hand);
    expect(isCorrectTool(blockId('stone'), 'wooden_shovel')).toBe(false);
    expect(isCorrectTool(blockId('stone'), 'wooden_pickaxe')).toBe(true);
  });

  it('ore harvest requires the matching pickaxe tier (iron/gold need stone, diamond needs iron)', () => {
    expect(canHarvest(blockId('iron_ore'), 'wooden_pickaxe')).toBe(false);
    expect(canHarvest(blockId('iron_ore'), 'stone_pickaxe')).toBe(true);
    expect(canHarvest(blockId('gold_ore'), 'stone_pickaxe')).toBe(true);
    expect(canHarvest(blockId('diamond_ore'), 'stone_pickaxe')).toBe(false);
    expect(canHarvest(blockId('diamond_ore'), 'iron_pickaxe')).toBe(true);
    expect(canHarvest(blockId('coal_ore'), 'wooden_pickaxe')).toBe(true);
  });

  it('ore drops: raw ores only with correct tool; wrong tool/tier yields nothing', () => {
    // coal drops with a wooden pickaxe
    expect(dropsFor(blockId('coal_ore'), 'wooden_pickaxe')).toEqual([{ id: itemId('coal'), count: 1 }]);
    // iron drops raw ore only with stone+ pickaxe
    expect(dropsFor(blockId('iron_ore'), 'wooden_pickaxe')).toEqual([]);
    expect(dropsFor(blockId('iron_ore'), 'stone_pickaxe')).toEqual([{ id: itemId('iron_ore_raw'), count: 1 }]);
    // diamond needs iron
    expect(dropsFor(blockId('diamond_ore'), 'stone_pickaxe')).toEqual([]);
    expect(dropsFor(blockId('diamond_ore'), 'iron_pickaxe')).toEqual([{ id: itemId('diamond'), count: 1 }]);
    // hand on stone drops nothing (needs a pickaxe)
    expect(dropsFor(blockId('stone'), null)).toEqual([]);
    expect(dropsFor(blockId('stone'), 'wooden_pickaxe')).toEqual([{ id: blockId('stone'), count: 1 }]);
  });

  it('dirt/sand drop by hand but axe is not the correct tool for dirt (shovel is)', () => {
    expect(requirement(blockId('dirt')).kind).toBe('shovel');
    expect(dropsFor(blockId('dirt'), 'wooden_shovel')).toEqual([{ id: blockId('dirt'), count: 1 }]);
    expect(isCorrectTool(blockId('dirt'), 'iron_axe')).toBe(false);
    // W2 hand-mining loop preserved: soft blocks drop with a bare hand
    expect(dropsFor(blockId('dirt'), null)).toEqual([{ id: blockId('dirt'), count: 1 }]);
    expect(dropsFor(blockId('oak_log'), null)).toEqual([{ id: blockId('oak_log'), count: 1 }]);
    expect(dropsFor(blockId('oak_planks'), null)).toEqual([{ id: blockId('oak_planks'), count: 1 }]);
    expect(canHarvest(blockId('dirt'), null)).toBe(true);
  });

  it('durability: mining consumes uses and the tool breaks at 0', () => {
    const stack = { id: itemId('wooden_pickaxe'), count: 1, durability: 1 };
    const r1 = useDurability(stack);
    expect(r1.used).toBe(true);
    expect(r1.broken).toBe(true); // broke on the single remaining use
    expect(stack.id).toBe(0);
  });

  it('full C08 upgrade chain end-to-end', () => {
    // wood -> stone -> iron harnessed via drops: mine iron with stone pick -> raw -> (furnace smelts)
    expect(canHarvest(blockId('stone'), 'wooden_pickaxe')).toBe(true);        // make cobblestone / stone tools
    expect(canHarvest(blockId('iron_ore'), 'stone_pickaxe')).toBe(true);      // stone pick unlocks iron ore
    const raw = dropsFor(blockId('iron_ore'), 'iron_pickaxe');
    expect(raw).toEqual([{ id: itemId('iron_ore_raw'), count: 1 }]);
    // iron tool tier > stone tier
    expect(requirement(blockId('diamond_ore')).tier).toBe(2);
    expect(mineSeconds(blockId('diamond_ore'), 'iron_pickaxe')).toBeLessThan(
      mineSeconds(blockId('diamond_ore'), 'stone_pickaxe'),
    );
  });
});
