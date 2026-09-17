import { describe, it, expect } from 'vitest';
import { World } from '../src/world.js';
import { blockId } from '../src/blocks.js';

// A minimal THREE stub is enough because we never call rebuildDirty/buildMesh here;
// getBlock/setBlock/ensureChunk are pure. This guards the C05/C13 setBlock path
// (historically crashed: "Cannot read properties of undefined (reading 'add')").
const THREE_STUB = {};

describe('World inline mutation (C05/C13/creeper setBlock path)', () => {
  it('getBlock/setBlock roundtrip without throwing on a loaded chunk', () => {
    const w = new World(20260917, THREE_STUB);
    w.updateAround(0, 0); // load chunks around origin
    const before = w.getBlock(8, 40, 8);
    expect(w.setBlock(8, 40, 8, blockId('stone'))).toBe(true);
    expect(w.getBlock(8, 40, 8)).toBe(blockId('stone'));
    // change back to air (mining) also works
    expect(w.setBlock(8, 40, 8, 0)).toBe(true);
    expect(w.getBlock(8, 40, 8)).toBe(0);
  });

  it('does not mutate unloaded chunks (returns false, no throw)', () => {
    const w = new World(20260917, THREE_STUB);
    w.updateAround(0, 0);
    const farY = 40;
    expect(w.setBlock(1000, farY, 1000, blockId('stone'))).toBe(false);
  });
});
