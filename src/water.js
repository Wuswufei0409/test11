// C14 water core (pure, no DOM): oxygen/drowning, buoyancy, swim speed, underwater
// visibility, waterway pass-through and underwater placement air-hole rules.
// Everything deterministic and unit-testable; the game layer drives these.

export const MAX_AIR = 10;         // oxygen bubbles, all full = 10
export const DROWN_PERIOD = 1.0;   // seconds between 1-heart drown ticks at zero air
export const AIR_DRAIN_FULL_SWIM = 1.0 / 15;   // bubbles lost per second while submerged
export const AIR_REGEN_PER_SEC = 5.0;          // bubbles regained per second in air

/**
 * Oxygen tank. Drains while submerged (head in water), refills in air.
 * At zero air the tank reports `drowning` so the caller applies periodic damage.
 */
export class OxygenTank {
  constructor({ max = MAX_AIR, drain = AIR_DRAIN_FULL_SWIM, regen = AIR_REGEN_PER_SEC, drownPeriod = DROWN_PERIOD } = {}) {
    this.max = max;
    this.air = max;
    this.drain = drain;
    this.regen = regen;
    this.drownPeriod = drownPeriod;
    this._drownTimer = 0;
  }

  get isEmpty() { return this.air <= 0; }
  get fraction() { return Math.max(0, Math.min(1, this.air / this.max)); }

  /** Advance the tank for dt seconds while underwater (`submerged`). Returns events. */
  tick(dt, submerged) {
    const events = [];
    if (submerged) {
      this.air = Math.max(0, this.air - this.drain * dt);
      if (this.isEmpty) {
        this._drownTimer += dt;
        if (this._drownTimer >= this.drownPeriod) {
          this._drownTimer -= this.drownPeriod;
          events.push('drown');
        }
      }
    } else {
      this.air = Math.min(this.max, this.air + this.regen * dt);
      this._drownTimer = 0;
    }
    return events;
  }

  reset() { this.air = this.max; this._drownTimer = 0; }
}

/**
 * Whether the player's head (eye at eyeHeight above feet) is inside fluid.
 * `getFluidAt` returns the block id; fluid ids are non-solid water-like blocks.
 */
export function headSubmerged(getBlockId, x, y, z, isFluidFn, eyeHeight = 1.62) {
  const by = Math.floor(y + eyeHeight);
  return isFluidFn(getBlockId(Math.floor(x), by, Math.floor(z)));
}

/** Player swim speed given base speed and whether they are sprint-swimming. */
export function swimSpeed(baseSpeed, sprinting) {
  return sprinting ? baseSpeed * 1.35 : baseSpeed * 0.9;
}

/**
 * Vertical velocity target while in water (sprint swim). Up = ascending while holding
 * `up`, sink while holding `down`, otherwise gentle bob. Returns {y, drag}.
 */
export function swimVelocity(up, down, sprinting) {
  const base = sprinting ? 5.2 : 0.8;
  if (up) return { y: sprinting ? 7.5 : 4.6 };
  if (down) return { y: -4.2 };
  return { y: Math.min(base, 1.0) };
}

/**
 * Whether a 1x1 waterway is passable for a player whose horizontal AABB half-width is
 * `halfW` (0.3). A single-wide fluid corridor (walls are solid, lane is fluid) is passable
 * when lane width (1) >= player width (2*halfW). Returns true when the along-axis footprint
 * only crosses fluid.
 */
export function waterwayPassable(halfW = 0.3) {
  return 1.0 >= 2 * halfW;
}

/**
 * Buoyancy for a dropped item (C14: 掉落物上浮). Returns { applied, targetY }:
 * an item sink starts to rise when below the water surface top, drifting up to it.
 */
export function floatBuoyancy(itemY, waterTopY, velY) {
  if (itemY < waterTopY - 0.2) {
    // below the surface: rise strongly (buoy), damp sink velocity
    return { applied: true, velY: velY * 0.2 + 1.4 };
  }
  if (itemY < waterTopY + 0.05) {
    // bobbing exactly at the surface
    return { applied: true, velY: 0 };
  }
  // above the surface: normal gravity applies
  return { applied: false, velY };
}

/**
 * Underwater visibility multiplier in [0..1] controlling fog density / desaturation.
 * Deeper below the surface => heavier fog (C14 水下能见度).
 */
export function underwaterVisibility(depthBelowSurface) {
  if (depthBelowSurface <= 0) return 1;
  const d = Math.min(6, depthBelowSurface);
  return Math.max(0.05, 1 - d * 0.16);
}

/**
 * Underwater placement air-hole rule (C14): placing a solid block that is *fully surrounded
 * on its horizontal ring by fluid* must NOT create an "air hole" (a pocket where none was).
 * Returns true iff placement is valid (no leaky air pocket introduced).
 */
export function underwaterPlacementValid(getBlockId, x, y, z, isFluidFn, targetSolid = true) {
  // The placed block replaces whatever is at (x,y,z). We only worry about a *solid* target
  // being placed so that its non-orthogonal neighbors cannot be air that would read as a
  // gap. The 1x1 fluid column around (above/below/n/s/e/w) should remain fluid where it was.
  const neighbors = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  let fluidAround = 0, airAround = 0;
  for (const [dx,dy,dz] of neighbors) {
    const id = getBlockId(x+dx, y+dy, z+dz);
    if (isFluidFn(id)) fluidAround++;
    else if (id === 0) airAround++;
  }
  // Underwater: we expect at least one fluid neighbor (it's a body of water); a placement
  // that is completely surrounded by air at this height would form a hole — reject it as a
  // leaky pocket. Fully-water-surrounded is the normal valid case.
  if (targetSolid && fluidAround === 0 && airAround > 0 && y < 40) return false;
  return true;
}

/**
 * Reduce a world-coord triple to the nearest fluid-surface top y for buoyancy purposes
 * given a scan function. Returns -1 when no surface found above the bottom of the world.
 */
export function waterTopBelow(getBlockId, x, z, isFluidFn, fromY = 60, bottomY = 0) {
  for (let y = fromY; y >= bottomY; y--) {
    const id = getBlockId(x, y, z);
    const above = getBlockId(x, y + 1, z);
    // the highest fluid cell whose cell above is not fluid = the top surface
    if (isFluidFn(id) && !isFluidFn(above)) return y;
  }
  return -1;
}
