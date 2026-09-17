import { describe, it, expect } from 'vitest';
import { mobDef, canSpawnHostile, mobAI, hostileAttack, creeperBlast, rollDrops } from '../src/mobs.js';
import { DIFFICULTY } from '../src/survival.js';

describe('C11 mobs: registry, spawn, AI (wander/track/attack/flee), drops, creeper blast', () => {
  it('registry has 4 passive + 3 hostile mobs with configurable drops', () => {
    for (const id of ['pig', 'cow', 'sheep', 'chicken']) expect(mobDef(id).type).toBe('passive');
    for (const id of ['zombie', 'spider', 'creeper']) expect(mobDef(id).type).toBe('hostile');
    expect(mobDef('pig').drops).toMatchObject({ raw_pork: [1, 3] });
    expect(mobDef('creeper').blastRadius).toBe(3);
  });

  it('hostiles only spawn at night and not on peaceful', () => {
    expect(canSpawnHostile('zombie', { isNight: true, difficulty: DIFFICULTY.NORMAL, rng: Math.random })).toBe(true);
    expect(canSpawnHostile('zombie', { isNight: false, difficulty: DIFFICULTY.NORMAL, rng: Math.random })).toBe(false);
    expect(canSpawnHostile('zombie', { isNight: true, difficulty: DIFFICULTY.PEACEFUL, rng: Math.random })).toBe(false);
  });

  it('passive mob wanders and can flee a threat', () => {
    const mob = { id: 'pig', fleeRange: 5 };
    const wander = mobAI(mob, { playerPos: { x: 100, z: 100 }, mobPos: { x: 0, z: 0 }, distanceToPlayer: 50, rng: () => 0.5 });
    expect(wander.act).toBe('wander');
    const flee = mobAI(mob, { playerPos: { x: 0, z: 0 }, mobPos: { x: 1, z: 0 }, distanceToPlayer: 1, rng: () => 0.5 });
    expect(flee.act).toBe('flee');
    expect(flee.move.x).toBeGreaterThan(0); // moves away from the threat
  });

  it('hostile tracks then attacks when in melee range, else wanders', () => {
    const mob = { id: 'zombie' };
    const track = mobAI(mob, { playerPos: { x: 0, z: 0 }, mobPos: { x: 5, z: 0 }, distanceToPlayer: 5, rng: () => 0.5 });
    expect(track.act).toBe('track');
    const attack = mobAI(mob, { playerPos: { x: 0, z: 0 }, mobPos: { x: 1, z: 0 }, distanceToPlayer: 1, rng: () => 0.5 });
    expect(attack.act).toBe('attack');
    const wander = mobAI(mob, { playerPos: { x: 100, z: 100 }, mobPos: { x: 0, z: 0 }, distanceToPlayer: 100, rng: () => 0.5 });
    expect(wander.act).toBe('wander');
  });

  it('creeper explodes modifying the world (block removal within the blast)', () => {
    const world = {};
    const getBlock = (x, y, z) => (x === 0 && y === 0 && z === 0) ? 3 : (x * 0 + 0); // stone center only
    const removed = creeperBlast(0, 0, 0, 1, getBlock);
    expect(removed.some((b) => b.x === 0 && b.y === 0 && b.z === 0 && b.from === 3)).toBe(true);
    expect(hostileAttack({ id: 'creeper' }, { fuseElapsed: true }).kind).toBe('explode');
  });

  it('rolls deterministic drops from the configured table', () => {
    const drops = rollDrops({ id: 'cow' }, () => 0); // min rolls
    expect(drops.raw_beef).toBe(1);
    expect(drops.leather === undefined || drops.leather === 0).toBe(true); // optional 0-count omitted
  });

  it('zombie melee damage is observable', () => {
    expect(hostileAttack({ id: 'zombie' }).damage).toBe(3);
  });
});
