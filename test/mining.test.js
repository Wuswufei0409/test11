import { describe, it, expect } from 'vitest';
import { mineTime, hardnessRank } from '../src/mining.js';
import { blockId } from '../src/blocks.js';

describe('C05 mining: hardness determines break time', () => {
  it('dirt/grass break faster than stone', () => {
    const tDirt = mineTime(blockId('dirt'));
    const tGrass = mineTime(blockId('grass'));
    const tStone = mineTime(blockId('stone'));
    expect(tDirt).toBeLessThan(tStone);
    expect(tGrass).toBeLessThan(tStone);
    expect(tDirt).toBeCloseTo(0.5 * 0.9, 2); // ~0.45s
  });

  it('logs and ores take longer than dirt (tool-tier progression)', () => {
    const tDirt = mineTime(blockId('dirt'));
    const tLog = mineTime(blockId('oak_log'));
    const tStone = mineTime(blockId('stone'));
    const tIron = mineTime(blockId('iron_ore'));
    expect(tLog).toBeGreaterThan(tDirt);
    expect(tStone).toBeGreaterThan(tDirt);
    expect(tIron).toBeGreaterThan(tStone);
  });

  it('bedrock and water are unbreakable', () => {
    expect(mineTime(blockId('bedrock'))).toBe(Infinity);
    expect(mineTime(blockId('water'))).toBe(Infinity);
  });

  it('hardnessRank orders blocks correctly (error-tool restriction by tier)', () => {
    expect(hardnessRank(blockId('dirt'))).toBeLessThan(hardnessRank(blockId('stone')));
    expect(hardnessRank(blockId('stone'))).toBeLessThan(hardnessRank(blockId('iron_ore')));
    expect(hardnessRank(blockId('diamond_ore'))).toBeGreaterThanOrEqual(hardnessRank(blockId('iron_ore')));
  });
});
