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
    // robust grounding: check for a solid block supporting the player's feet area (breaks at the
    // exact cell the feet rest on, not the cell the feet are inside)
    const supportY = Math.floor(this.pos.y - 0.5001);
    this.onGround = this.collideAt(this.pos.x, this.pos.y, this.pos.z) ||
      this.collideRectAtSupport(this.pos.x, this.pos.z, supportY);
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

  collideAt(x, y, z) {
    const r = AABB.w / 2;
    for (let by = Math.floor(y); by < Math.floor(y + AABB.h); by++)
      for (let bx = Math.floor(x - r); bx <= Math.floor(x + r); bx++)
        for (let bz = Math.floor(z - r); bz <= Math.floor(z + r); bz++)
          if (isSolid(this.world.getBlock(bx, by, bz))) return true;
    return false;
  }

  /** True if any solid block occupies the horizontal footprint one cell below the given support cell. */
  collideRectAtSupport(x, z, supportCellY) {
    const r = AABB.w / 2;
    for (let bx = Math.floor(x - r); bx <= Math.floor(x + r); bx++)
      for (let bz = Math.floor(z - r); bz <= Math.floor(z + r); bz++)
        if (isSolid(this.world.getBlock(bx, supportCellY, bz))) return true;
    return false;
  }

  /** Move along a single axis, with an automatic 1-block step-up when blocked (台阶跨越). */
  moveAxis(target, axis) {
    const prev = this.pos[axis];
    const horizontal = axis === 'x' || axis === 'z';
    const stepping = this.onGround && horizontal && !this.sneaking;

    if (horizontal && stepping) {
      // try the lateral move, then attempt a 1-block step-up if it collides
      const attempt = { ...this.pos, [axis]: target };
      if (!this.collideAt(attempt.x, attempt.y, attempt.z)) {
        this.pos[axis] = target;
        return;
      }
      // blocked: try to step up one full block (and land on it)
      const lifted = { ...this.pos, y: this.pos.y + 1.0, [axis]: target };
      if (!this.collideAt(lifted.x, lifted.y, lifted.z) && this.collideAt(lifted.x, lifted.y + 0.5, lifted.z) === false) {
        // moving onto the step is clear at +1; also ensure the space above the feet is open
        if (!this.collideAt(lifted.x, lifted.y, lifted.z)) {
          this.pos.y = lifted.y;
          this.pos[axis] = target;
          this.onGround = true;
        }
      }
      return;
    }

    // clamp lateral axes to prevent leaving the loaded world horizontally (void protection)
    if (horizontal) {
      if (this.pos[axis] < -400) this.pos[axis] = -400;
      if (this.pos[axis] > 400) this.pos[axis] = 400;
    }

    this.pos[axis] = target;
    if (this.collideAt(this.pos.x, this.pos.y, this.pos.z)) {
      this.pos[axis] = prev;
      if (axis === 'y' && target < prev) this.onGround = true;
    }
  }

  forward() {
    return { x: -Math.sin(this.yaw), y: -Math.sin(this.pitch), z: -Math.cos(this.yaw) };
  }
}
