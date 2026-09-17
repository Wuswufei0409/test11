import { describe, it, expect } from 'vitest';
import { CROPS, growCrop, isMature, lightFactor, canTill, canPlantOn, harvest } from '../src/farming.js';

describe('C13 farming: till/plant/grow(intens by time+light)/harvest', () => {
  it('tilling works on dirt/grass and planting works on farmland/dirt', () => {
    expect(canTill(0, 'dirt')).toBe(true);
    expect(canTill(0, 'grass')).toBe(true);
    expect(canTill(0, 'stone')).toBe(false);
    expect(canPlantOn('farmland')).toBe(true);
    expect(canPlantOn('dirt')).toBe(true);
    expect(canPlantOn('stone')).toBe(false);
  });

  it('growth is driven by light (darkness blocks growth)', () => {
    const c = CROPS.wheat;
    const dark = growCrop(c, 0, 100, 4); // light below floor -> no growth
    expect(dark).toBe(0);
    const lit = growCrop(c, 0, 100, 15);
    expect(lit).toBeGreaterThan(0);
  });

  it('growth advances across many ticks (multi-tick observable) and reaches maturity', () => {
    const c = CROPS.wheat;
    const many = growCrop(c, 0, 600, 15); // many ticks at full light -> mature
    expect(isMature(c, many)).toBe(true);
    expect(growCrop(c, 0, 50, 15)).toBeLessThan(c.stages); // not mature yet
    expect(lightFactor(0)).toBe(0);
    expect(lightFactor(15)).toBe(1);
  });

  it('harvest yields food + seeds deterministically', () => {
    const c = CROPS.wheat;
    const out = harvest(c, () => 0); // min rolls
    expect(out.food).toBe('wheat');
    expect(out.seeds).toBeGreaterThanOrEqual(1);
  });

  it('grain growth rates differ per crop stage count', () => {
    expect(CROPS.wheat.stages).toBe(8);
    expect(CROPS.potato.harvest).toBe('potato');
  });
});
