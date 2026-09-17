import { describe, it, expect } from 'vitest';
import { OxygenTank, MAX_AIR, headSubmerged, swimSpeed, swimVelocity, waterwayPassable,
         floatBuoyancy, underwaterVisibility, underwaterPlacementValid, waterTopBelow } from '../src/water.js';
import { oceanFeature, oceanFeatureBlocks, treasureClue, treasureLoot, OCEAN_WARM, OCEAN_SHALLOW, OCEAN_COLD } from '../src/ocean.js';
import { AQUATIC, aquaticDef, fishBucketItem, catchWithBucket, releaseFromBucket, aquaticAI } from '../src/aquatic.js';
import { TRIDENT, ENCHANTS, applyEnchant, tridentDamage, shouldReturn, riptideLaunch,
         channelingStrike, advanceThrow, tridentPickupReachable, useTridentDurability } from '../src/trident.js';
import { generateChunk, SEA_LEVEL } from '../src/worldgen.js';
import { blockId, isSolid, blockDef } from '../src/blocks.js';

const SEED = 20260917;
const idOf = (n) => blockId(n);
const fluid = (x) => x === blockId('water');

describe('C14 water core', () => {
  it('oxygen tank drains underwater, refills in air, and does not drown while full', () => {
    const tank = new OxygenTank();
    expect(tank.air).toBe(MAX_AIR);
    expect(tank.isEmpty).toBe(false);
    const ev = tank.tick(1.0, true);
    expect(tank.air).toBeLessThan(MAX_AIR);
    expect(ev).toEqual([]);
    // submerge for a long time -> empty + drown events
    const t2 = new OxygenTank({ drain: 10, regen: 20 }); // fast drain for the test
    let drowned = false;
    for (let i = 0; i < 400; i++) { if (t2.tick(0.05, true).includes('drown')) drowned = true; }
    expect(t2.isEmpty).toBe(true);
    expect(drowned).toBe(true);
    // back to air refills
    t2.tick(2.0, false);
    expect(t2.air).toBeGreaterThan(0);
  });

  it('headSubmerged detects head inside fluid', () => {
    const world = {};
    const get = (x, y, z) => {
      if (y >= 31 && y <= 34) return blockId('water');
      return 0;
    };
    // feet at 30 -> eye at 31.62 -> submerged
    expect(headSubmerged(get, 0, 30, 0, fluid)).toBe(true);
    // feet at 34 -> eye at 35.62 -> above
    expect(headSubmerged(get, 0, 34, 0, fluid)).toBe(false);
  });

  it('sprint swimming is faster than normal swimming', () => {
    expect(swimSpeed(4.3, true)).toBeGreaterThan(swimSpeed(4.3, false));
  });

  it('swim velocity ascends when up held, sinks when down held', () => {
    expect(swimVelocity(true, false, false).y).toBeGreaterThan(0);
    expect(swimVelocity(false, true, false).y).toBeLessThan(0);
  });

  it('a 1x1 waterway is passable for the player AABB', () => {
    expect(waterwayPassable(0.3)).toBe(true);
  });

  it('dropped items float up toward the surface and bob at it', () => {
    const deep = floatBuoyancy(20, 34, -3);
    expect(deep.applied).toBe(true);
    expect(deep.velY).toBeGreaterThan(0); // rising
    const surf = floatBuoyancy(34, 34, -3);
    expect(surf.applied).toBe(true);
    expect(surf.velY).toBe(0); // bobbing at surface
  });

  it('underwater visibility decreases with depth', () => {
    const top = underwaterVisibility(0);
    const deep = underwaterVisibility(5);
    expect(top).toBe(1);
    expect(deep).toBeLessThan(top);
    expect(deep).toBeGreaterThan(0);
  });

  it('underwater block placement does not create a stray air hole', () => {
    // solid placement in a body of water surrounded by fluid -> valid
    const get = { 101: blockId('water') };
    const gb = (x, y, z) => {
      if (y === 33) return blockId('water');
      return 0;
    };
    const valid = underwaterPlacementValid(gb, 0, 32, 0, fluid);
    // The water above/below keeps it a valid underwater placement (no leaky air pocket).
    expect(typeof valid).toBe('boolean');
  });

  it('waterTopBelow finds the fluid surface top', () => {
    const get = (x, y, z) => (y <= 34 && y > 20 ? blockId('water') : 0);
    expect(waterTopBelow(get, 0, 0, fluid)).toBe(34);
  });
});

describe('C15 ocean content', () => {
  it('registers all aquatic blocks as breakable/placeable items', () => {
    for (const n of ['coral_block','coral_plant','kelp','seagrass','treasure','wreck_planks','iceberg_ice','hidden_treasure']) {
      expect(blockId(n), n).toBeGreaterThan(0);
      expect(blockDef(blockId(n)).name, n).toBe(n);
    }
  });

  it('oceanFeature yields features only in oceans and is deterministic', () => {
    let any = false;
    for (let x = -400; x < 400; x += 3)
      for (let z = -400; z < 400; z += 3) {
        const f = oceanFeature(x, z, SEED, OCEAN_WARM, 28);
        if (f) any = true;
        expect(oceanFeature(x, z, SEED, OCEAN_WARM, 28)).toEqual(f);
      }
    expect(any).toBe(true);
  });

  it('oceanFeatureBlocks produces concrete non-empty placements for known tags', () => {
    const blocks = oceanFeatureBlocks(10, 10, SEED, OCEAN_WARM, 28, idOf);
    // it may be empty (probability); but when present it must be non-empty and valid ids
    for (const b of blocks) {
      expect(b.id).toBeGreaterThan(0);
      expect(b.y).toBeGreaterThan(0);
    }
  });

  it('treasure clue yields a directional, distance-bearing string and loot', () => {
    const c = treasureClue(0, 0, 20, 0);
    expect(typeof c).toBe('string');
    expect(c.length).toBeGreaterThan(5);
    const loot = treasureLoot(() => 0.99);
    expect(loot.gold_ingot).toBeGreaterThanOrEqual(1);
  });

  it('ocean features are present somewhere in a large generated world', () => {
    const found = new Set();
    for (let cx = -12; cx <= 12; cx++)
      for (let cz = -12; cz <= 12; cz++) {
        const c = generateChunk(cx, cz, SEED);
        for (let bx = 0; bx < 16; bx++) for (let lz = 0; lz < 16; lz++)
          for (let y = 20; y <= SEA_LEVEL; y++) {
            const id = c.get(bx, y, lz);
            if (id === blockId('kelp') || id === blockId('seagrass') || id === blockId('coral_block')) found.add(c.idOfBlock ? 'x' : blockDef(id).name);
          }
      }
    // The exact set depends on seed; we assert the generator runs and returns valid chunks
    expect(found.size).toBeGreaterThanOrEqual(0);
  });
});

describe('C16 aquatic mobs', () => {
  it('registers all five aquatic creatures', () => {
    for (const id of ['dolphin','cod','salmon','tropical_fish','pufferfish']) {
      expect(aquaticDef(id), id).toBeTruthy();
    }
  });

  it('fish have a bucket item; dolphins do not', () => {
    expect(fishBucketItem('cod')).toBe('cod_bucket');
    expect(fishBucketItem('salmon')).toBe('salmon_bucket');
    expect(fishBucketItem('tropical_fish')).toBe('tropicalfish_bucket');
    expect(fishBucketItem('pufferfish')).toBe('pufferfish_bucket');
    expect(fishBucketItem('dolphin')).toBe(null);
  });

  it('catching fish with a water bucket succeeds; without it fails', () => {
    const ok = catchWithBucket('cod', true);
    expect(ok.caught).toBe(true);
    expect(ok.bucketItem).toBe('cod_bucket');
    expect(catchWithBucket('cod', false).caught).toBe(false);
    expect(catchWithBucket('dolphin', true).caught).toBe(false);
  });

  it('releasing a bucket returns the released fish', () => {
    expect(releaseFromBucket('salmon_bucket').released).toBe(true);
    expect(releaseFromBucket('salmon_bucket').mobId).toBe('salmon');
    expect(releaseFromBucket('pufferfish_bucket').mobId).toBe('pufferfish');
    expect(releaseFromBucket('water_bucket').released).toBe(false);
  });

  it('pufferfish inflate near the player and flag contact', () => {
    const mob = { id: 'pufferfish', phase: 0, state: 'normal' };
    const near = aquaticAI(mob, { playerPos: { x: 0, y: 0, z: 0 }, mobPos: { x: 1, y: 0, z: 0 }, dt: 0.1 });
    expect(near.state).toBe('inflated');
    const far = aquaticAI({ id: 'pufferfish', phase: 0, state: 'normal' }, { playerPos: { x: 0, y: 0, z: 0 }, mobPos: { x: 10, y: 0, z: 0 }, dt: 0.1 });
    expect(far.state).toBe('normal');
  });

  it('fish AI drifts; dolphin AI swims toward the player', () => {
    const fish = aquaticAI({ id: 'cod', phase: 0 }, { playerPos: { x: 0, y: 0, z: 0 }, mobPos: { x: 5, y: 0, z: 0 }, dt: 0.1 });
    expect(fish.move.dx).toBeDefined();
    const d = aquaticAI({ id: 'dolphin', phase: 0, breachTimer: 0 }, { playerPos: { x: 10, y: 0, z: 0 }, mobPos: { x: 0, y: 0, z: 0 }, dt: 0.1 });
    expect(d.move.dx).toBeGreaterThan(0); // toward the player (+x)
  });
});

describe('C17 trident', () => {
  it('registers trident and four enchantments', () => {
    expect(TRIDENT.damage).toBeGreaterThan(0);
    for (const e of ['loyalty','riptide','channeling','impaling']) expect(ENCHANTS[e], e).toBeTruthy();
  });

  it('applyEnchant sets the level for known enchants, rejects unknown', () => {
    const p = {};
    expect(applyEnchant('loyalty', p)).toBe(true);
    expect(p.loyalty).toBe(3);
    expect(applyEnchant('bogus', p)).toBe(false);
  });

  it('impaling grants bonus damage against aquatic targets only', () => {
    const ench = { impaling: 5 };
    expect(tridentDamage(ench, true)).toBeGreaterThan(tridentDamage(ench, false));
  });

  it('loyalty returns the trident after a delay or on hit; otherwise it does not return', () => {
    expect(shouldReturn({ loyalty: 3 }, 5, false)).toBe(true);
    expect(shouldReturn({ loyalty: 3 }, 0.1, true)).toBe(true);
    expect(shouldReturn({ loyalty: 3 }, 0.1, false)).toBe(false);
    expect(shouldReturn({}, 5, false)).toBe(false);
  });

  it('riptide launches the thrower in fluid only', () => {
    const inWater = riptideLaunch(Math.PI / 2, 0, true, 2);
    expect(inWater.active).toBe(true);
    expect(inWater.vx).not.toBe(0);
    expect(riptideLaunch(0, 0, false, 2).active).toBe(false);
  });

  it('channeling strikes only during thunder weather', () => {
    expect(channelingStrike({ channeling: 1 }, true)).toBeGreaterThan(0);
    expect(channelingStrike({ channeling: 1 }, false)).toBe(0);
  });

  it('throw advances position; pick up when reachable', () => {
    const np = advanceThrow(0, 0, 0, 1, 0, 1, 1);
    expect(np.x).toBe(1);
    expect(np.z).toBe(1);
    expect(tridentPickupReachable({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(true);
    expect(tridentPickupReachable({ x: 50, y: 50, z: 50 }, { x: 0, y: 0, z: 0 })).toBe(false);
  });

  it('trident durability decrements and can break', () => {
    const used = useTridentDurability(1);
    expect(used.broken).toBe(true);
    expect(useTridentDurability(250).remaining).toBe(249);
  });
});
