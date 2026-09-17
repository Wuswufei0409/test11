import { describe, it, expect } from 'vitest';
import { columnInfo, generateChunk, terrainFingerprint, CHUNK, WORLD_HEIGHT, SEA_LEVEL, BIOMES } from '../src/worldgen.js';
import { mulberry32, valueNoise2, fbm2, hash2 } from '../src/math.js';
import { blockId, BLOCKS, breakableBlockCount, isSolid } from '../src/blocks.js';

const SEED = 20260917;

describe('math determinism', () => {
  it('mulberry32 is deterministic', () => {
    const a = mulberry32(42); const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('noise is deterministic for same seed', () => {
    expect(fbm2(3.3, 4.4, SEED, 4)).toBe(fbm2(3.3, 4.4, SEED, 4));
    expect(valueNoise2(2, 9, 5)).not.toBe(valueNoise2(2, 9, 6));
  });
});

describe('world generation', () => {
  it('same seed + coords -> identical chunk data', () => {
    const c1 = generateChunk(1, -2, SEED);
    const c2 = generateChunk(1, -2, SEED);
    for (let i = 0; i < c1.data.length; i++) expect(c1.data[i]).toBe(c2.data[i]);
  });

  it('different seeds -> (overwhelmingly) different terrain fingerprint', () => {
    expect(terrainFingerprint(SEED)).toBe(terrainFingerprint(SEED));
    // collision probability is negligible
    expect(terrainFingerprint(SEED)).not.toBe(terrainFingerprint(SEED + 1));
  });

  it('columnInfo is reproducible and yields both land and ocean', () => {
    let land = 0, ocean = 0;
    for (let x = -200; x < 200; x += 8)
      for (let z = -200; z < 200; z += 8) {
        const { biome, elevation } = columnInfo(x, z, SEED);
        expect(columnInfo(x, z, SEED).elevation).toBe(elevation);
        if (biome.includes('ocean')) ocean++; else land++;
      }
    expect(land).toBeGreaterThan(0);
    expect(ocean).toBeGreaterThan(0);
  });

  it('covers all required biomes across a large area', () => {
    const found = new Set();
    for (let x = -600; x < 600; x += 12)
      for (let z = -600; z < 600; z += 12)
        found.add(columnInfo(x, z, SEED).biome);
    for (const b of [BIOMES.PLAINS, BIOMES.FOREST, BIOMES.DESERT, BIOMES.MOUNTAINS,
                     BIOMES.OCEAN_COLD, BIOMES.OCEAN_WARM, BIOMES.OCEAN_SHALLOW, BIOMES.OCEAN_DEEP])
      expect(found.has(b), `missing biome ${b}`).toBe(true);
  });

  it('registry carries a rich set of distinct blocks (>=30) for later modules', () => {
    expect(BLOCKS.length).toBeGreaterThanOrEqual(32);
    expect(breakableBlockCount()).toBeGreaterThanOrEqual(20);
  });

  it('chunk data has bedrock at y=0 and valid ids everywhere', () => {
    const c = generateChunk(0, 0, SEED);
    for (let bx = 0; bx < CHUNK; bx++)
      for (let bz = 0; bz < CHUNK; bz++) {
        expect(c.get(bx, 0, bz)).toBe(blockId('bedrock'));
        for (let y = 0; y < WORLD_HEIGHT; y++) expect(c.get(bx, y, bz)).toBeGreaterThanOrEqual(0);
      }
  });

  it('ocean columns hold water up to sea level', () => {
    // find an ocean column
    let oceanCol = null;
    for (let x = -300; x < 300 && !oceanCol; x += 4)
      for (let z = -300; z < 300 && !oceanCol; z += 4) {
        const ci = columnInfo(x, z, SEED);
        if (ci.biome.includes('ocean')) oceanCol = { x, z, ci };
      }
    expect(oceanCol).toBeTruthy();
    const c = generateChunk(Math.floor(oceanCol.x / CHUNK), Math.floor(oceanCol.z / CHUNK), SEED);
    const lx = ((oceanCol.x % CHUNK) + CHUNK) % CHUNK;
    const lz = ((oceanCol.z % CHUNK) + CHUNK) % CHUNK;
    const elev = oceanCol.ci.elevation;
    expect(c.get(lx, elev + 1, lz)).toBe(blockId('water'));
    expect(c.get(lx, SEA_LEVEL - 1, lz)).toBe(blockId('water'));
  });
});

describe('block semantics used by rendering', () => {
  it('grass is solid; air is not', () => {
    expect(isSolid(blockId('grass'))).toBe(true);
    expect(isSolid(blockId('air'))).toBe(false);
  });
});
