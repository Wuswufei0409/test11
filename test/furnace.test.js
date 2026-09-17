import { describe, it, expect } from 'vitest';
import { Furnace, SMELT, FUEL, fuelSeconds, smeltToIngot, smeltResult } from '../src/furnace.js';
import { itemId } from '../src/items.js';

describe('C08 furnace smelting: ore/coal -> ingot with fuel', () => {
  it('smelt table maps raw ores to ingots', () => {
    expect(smeltResult('iron_ore_raw')).toEqual({ out: 'iron_ingot', seconds: 10 });
    expect(smeltResult('gold_ore_raw')).toEqual({ out: 'gold_ingot', seconds: 10 });
  });

  it('fuel table gives coal the most burn time', () => {
    expect(fuelSeconds('coal')).toBeGreaterThan(fuelSeconds('oak_planks'));
    expect(fuelSeconds('oak_planks')).toBeGreaterThan(fuelSeconds('stick'));
  });

  it('smelts iron_ore_raw into iron_ingot with coal fuel (smeltToIngot helper)', () => {
    const out = smeltToIngot('iron_ore_raw', 'coal');
    expect(out).not.toBeNull();
    expect(out.id).toBe(itemId('iron_ingot'));
    expect(out.count).toBe(1);
  });

  it('tick-by-tick: consumes an ore, produces an ingot, fuel is finite', () => {
    const f = new Furnace();
    f.input = { id: itemId('iron_ore_raw'), count: 1 };
    f.fuel = { id: itemId('coal'), count: 1 }; // 80s burn
    for (let t = 0; t < 12; t += 0.1) f.tick(0.1); // > 10s needed
    expect(f.output).not.toBeNull();
    expect(f.output.id).toBe(itemId('iron_ingot'));
    expect(f.input).toBeNull(); // ore consumed
    expect(f.burn).toBeGreaterThan(0); // coal not fully spent yet
    expect(f.isLit).toBe(true);
  });

  it('does not smelt without fuel', () => {
    const f = new Furnace();
    f.input = { id: itemId('iron_ore_raw'), count: 1 };
    f.tick(30);
    expect(f.output).toBeNull();
    expect(f.isLit).toBe(false);
  });

  it('serializes furnace state for save/load (C18)', () => {
    const f = new Furnace();
    f.input = { id: itemId('iron_ore_raw'), count: 1 };
    f.fuel = { id: itemId('coal'), count: 1 };
    f.tick(5);
    const json = f.toJSON();
    expect(json.burn).toBeGreaterThan(0);
    // reload round-trips
    const f2 = new Furnace();
    f2.load({ input: json.input, fuel: json.fuel, output: json.output });
    f2.burn = json.burn;
    f2.progress = json.progress;
    f2.progressTotal = json.progressTotal;
    for (let t = 0; t < 10; t += 0.1) f2.tick(0.1);
    expect(f2.output).not.toBeNull();
  });

  it('wheat_bread smelt not applicable (only ore/cobble/sand recipes defined)', () => {
    expect(smeltResult('wheat')).toBeNull();
  });
});
