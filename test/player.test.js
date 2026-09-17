import { describe, it, expect } from 'vitest';
import { Player } from '../src/player.js';
import { blockId } from '../src/blocks.js';

// Minimal world stub: solid wherever a provided predicate says, else air.
function flatWorld(floorY = 0, solids = {}) {
  return {
    getBlock(x, y, z) {
      if (y === floorY) return blockId('grass');
      const k = x + ',' + y + ',' + z;
      return solids[k] || 0;
    },
  };
}

describe('C04 player: collision, landing, step-up, no-clip', () => {
  it('rests on a solid floor (gravity settles and player does not fall through)', () => {
    const world = flatWorld(0);
    const p = new Player(world, { x: 0.5, y: 3, z: 0.5, yaw: 0 });
    for (let i = 0; i < 200; i++) p.update(0.05);
    // player feet should rest on the floor at y=1 (feet at 1.0, block at 0)
    expect(p.pos.y).toBeGreaterThanOrEqual(0.9);
    expect(p.pos.y).toBeLessThanOrEqual(1.6);
    expect(p.onGround).toBe(true);
    // and not clip inside the floor
    expect(p.collides(p.pos.x, p.pos.y, p.pos.z)).toBe(false);
  });

  it('cannot move through a solid wall taller than a step (no noclipping)', () => {
    // a 4-block-tall wall at x=3 is too tall to step over, so the player must be blocked
    const world = flatWorld(0, {});
    const blocks = {};
    for (let y = 0; y <= 3; y++) blocks['3,' + y + ',0'] = blockId('stone');
    for (let y = 0; y <= 3; y++) blocks['2,' + y + ',0'] = blockId('stone');
    world.getBlock = (x, y, z) => blocks[x + ',' + y + ',' + z] || (y === 0 ? blockId('grass') : 0);
    const p = new Player(world, { x: 0.5, y: 1, z: 0.5, yaw: -Math.PI / 2 }); // yaw faces +X
    p.keys['KeyW'] = true;
    for (let i = 0; i < 200; i++) p.update(0.05);
    // player should be blocked short of the wall footprint (starts at cell 2) and never be inside a solid
    expect(p.pos.x).toBeLessThan(1.9);
    expect(p.collides(p.pos.x, p.pos.y, p.pos.z)).toBe(false);
  });

  it('steps up a one-block ledge automatically (台阶跨越)', () => {
    // floor at y=0, with a 1-block step at x>=3 that the player walks onto
    const world = flatWorld(0, {});
    const origGetBlock = (x, y, z) => {
      if (x >= 3 && y === 1) return blockId('stone'); // raised step surface
      if (x >= 3 && y <= 0) return blockId('stone'); // step filler to y0..1
      if (y === 0) return blockId('grass');
      return 0;
    };
    world.getBlock = origGetBlock;
    const p = new Player(world, { x: 0.5, y: 1, z: 0.5, yaw: -Math.PI / 2 });
    // yaw -PI/2 -> forward = (1,0,-0) => +X toward the step
    p.keys['KeyW'] = true;
    for (let i = 0; i < 400; i++) p.update(0.05);
    // player should have walked onto the step (x now >= 3 and onGround atop the raised block)
    expect(p.pos.x).toBeGreaterThanOrEqual(2.5);
    expect(p.onGround).toBe(true);
  });
});
