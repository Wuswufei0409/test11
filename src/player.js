// First-person player controller: pointer lock, WASD, jump, gravity, collision, sprint/sneak/swim.

import { isSolid, isFluid } from './blocks.js';
import { WORLD_HEIGHT } from './worldgen.js';

const AABB = { w: 0.6, h: 1.8 };

export class Player {
  constructor(world, spawn) {
    this.world = world;
    this.pos = { x: spawn.x, y: spawn.y, z: spawn.z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = spawn.yaw || 0;
    this.pitch = 0;
    this.onGround = false;
    this.keys = {};
    this.sprinting = false;
    this.sneaking = false;
    this.swimming = false;
    this.health = 20;
    this.food = 20;
  }

  collides(x, y, z) {
    const r = AABB.w / 2;
    const x0 = Math.floor(x - r), x1 = Math.floor(x + r);
    const y0 = Math.floor(y), y1 = Math.floor(y + AABB.h);
    const z0 = Math.floor(z - r), z1 = Math.floor(z + r);
    for (let by = y0; by <= y1; by++)
      for (let bx = x0; bx <= x1; bx++)
        for (let bz = z0; bz <= z1; bz++) {
          const blk = this.world.getBlock(bx, by, bz);
          if (isSolid(blk)) return true;
        }
    return false;
  }

  inFluid() {
    return isFluid(this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.5), Math.floor(this.pos.z)));
  }

  update(dt) {
    const forward = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    const right = { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
    let mx = 0, mz = 0;
    if (this.keys['KeyW']) { mx += forward.x; mz += forward.z; }
    if (this.keys['KeyS']) { mx -= forward.x; mz -= forward.z; }
    if (this.keys['KeyA']) { mx -= right.x; mz -= right.z; }
    if (this.keys['KeyD']) { mx += right.x; mz += right.z; }
    const mag = Math.hypot(mx, mz);
    if (mag > 0) { mx /= mag; mz /= mag; }

    const speed = this.sprinting ? 8.2 : this.sneaking ? 2.2 : 4.3;
    const move = { x: mx * speed, z: mz * speed };

    this.vel.x = move.x;
    this.vel.z = move.z;
    this.vel.y -= 27 * dt;

    if (this.inFluid()) {
      this.swimming = true;
      this.vel.y = Math.max(this.vel.y, this.keys['Space'] ? 6 : this.keys['ShiftLeft'] ? -4 : 0.6);
      this.vel.y += (this.keys['Space'] ? 2 : 0) * dt;
      this.vel.y = Math.min(this.vel.y, this.keys['Space'] ? 10 : 2);
      if (!this.keys['Space'] && !this.keys['ShiftLeft']) this.vel.y = Math.max(this.vel.y - 1.5, -1);
    } else {
      this.swimming = false;
    }

    // integrate with axis-separated collision
    this.moveAxis(this.pos.x + this.vel.x * dt, 'x');
    this.moveAxis(this.pos.y + this.vel.y * dt, 'y');
    this.moveAxis(this.pos.z + this.vel.z * dt, 'z');

    const wasOnGround = this.onGround;
    this.onGround = this.collides(this.pos.x, this.pos.y - 0.01, this.pos.z);
    if (this.onGround) { this.vel.y = Math.max(this.vel.y, 0); }

    if (this.keys['Space'] && (this.onGround || (this.swimming && this.keys['Space']))) {
      this.vel.y = this.swimming ? 6 : 9;
      this.onGround = false;
    }
    if (this.pos.y < -20) {
      this.pos.y = 64; this.pos.z -= 3; this.vel.y = 0; this.health -= 2;
    }

    // keep in world height
    if (this.pos.y <= 0.01) { this.pos.y = 0.02; this.vel.y = 0; }
    if (this.pos.y > WORLD_HEIGHT) this.pos.y = WORLD_HEIGHT;
  }

  moveAxis(target, axis) {
    const prev = this.pos[axis];
    this.pos[axis] = target;
    const r = AABB.w / 2;
    const x0 = Math.floor(this.pos.x - r), x1 = Math.floor(this.pos.x + r);
    const y0 = Math.floor(this.pos.y), y1 = Math.floor(this.pos.y + AABB.h);
    const z0 = Math.floor(this.pos.z - r), z1 = Math.floor(this.pos.z + r);
    const solidBlocks = [];
    for (let by = y0; by <= y1; by++)
      for (let bx = x0; bx <= x1; bx++)
        for (let bz = z0; bz <= z1; bz++)
          if (isSolid(this.world.getBlock(bx, by, bz))) solidBlocks.push([bx, by, bz]);
    if (solidBlocks.length) {
      if (axis === 'x') this.pos.x = prev;
      if (axis === 'y') this.pos.y = prev;
      if (axis === 'z') this.pos.z = prev;
      if (axis === 'y' && target < prev) this.onGround = true;
    }
  }

  forward() {
    return { x: -Math.sin(this.yaw), y: -Math.sin(this.pitch), z: -Math.cos(this.yaw) };
  }
}
