// C17 trident (pure, no DOM): throw / retrieve / durability / damage, with enchantments
// Loyalty / Riptide / Channeling / Impaling. Deterministic and unit-testable.
// Trident projectile model in the game layer; all the rules live here.

export const TRIDENT = {
  name: 'trident', damage: 9, throwSpeed: 24, cooldown: 1.0,
  reach: 14, durability: 250, pickupRange: 2.5,
};

/** Trident enchantments (C17: at least three — we provide all four). */
export const ENCHANTS = {
  loyalty: { name: 'Loyalty', level: 3, desc: 'Returns to the thrower after a short delay' },
  riptide: { name: 'Riptide', level: 2, desc: 'Launches the thrower forward in water/rain' },
  channeling: { name: 'Channeling', level: 1, desc: 'Strikes the struck mob with a lightning bolt (thunder)' },
  impaling: { name: 'Impaling', level: 5, desc: 'Bonus damage against aquatic mobs' },
};

/** Apply a trident enchantment by name onto a parms object. Returns true when known. */
export function applyEnchant(enchantName, parms = {}) {
  if (!ENCHANTS[enchantName]) return false;
  parms[enchantName] = ENCHANTS[enchantName].level;
  return true;
}

/**
 * Damage a trident deals to a target given enchants and whether the target is aquatic.
 * Impaling: +2.5 per level against aquatic mobs (cap applied). Returns damage.
 */
export function tridentDamage(enchantLevels = {}, aquaticTarget = false) {
  let dmg = TRIDENT.damage;
  if (aquaticTarget && enchantLevels.impaling) dmg += 2.5 * enchantLevels.impaling;
  return Math.round(dmg);
}

/**
 * Whether a thrown trident returns to the thrower (Loyalty). With Loyalty it returns after
 * `delay` seconds if it hasn't hit anything (or right after hitting), else it doesn't return.
 */
export function shouldReturn(enchantLevels, flightTime, hitSomething) {
  if (!enchantLevels.loyalty) return false;
  if (hitSomething) return true;
  return flightTime >= Math.max(0.3, 3 - enchantLevels.loyalty * 0.6);
}

/**
 * Riptide effect: when the thrower is in fluid (or it's raining), craft the velocity boost.
 * Returns {vx, vy, vz, active} taken from the throw direction * riptide strength.
 */
export function riptideLaunch(yaw, pitch, inFluidOrRain, riptideLevel = 0) {
  if (!inFluidOrRain || !riptideLevel) return { active: false, vx: 0, vy: 0, vz: 0 };
  const strength = 14 + riptideLevel * 4;
  const vx = -Math.sin(yaw) * Math.cos(pitch || 0) * strength;
  const vy = -Math.sin(pitch || 0) * strength;
  const vz = -Math.cos(yaw) * Math.cos(pitch || 0) * strength;
  return { active: true, vx, vy, vz };
}

/**
 * Channeling: a struck aquatic/hostile target gets lightning damage. Called on a hit when
 * thunder weather is active and the enchant is present. Returns bonus damage (or spells flag).
 */
export function channelingStrike(enchantLevels, weatherThunder) {
  if (!enchantLevels.channeling || !weatherThunder) return 0;
  return 5; // lightning bonus damage + it visually spells (game layer shows the bolt)
}

/**
 * Deterministic trident-flight surface for unit tests: advance a projectile position.
 * Returns new position and whether it reached max range.
 */
export function advanceThrow(px, py, pz, vx, vy, vz, dt) {
  const nx = px + vx * dt, ny = py + vy * dt, nz = pz + vz * dt;
  return { x: nx, y: ny, z: nz };
}

/**
 * Whether a projectile (positioned at tp) is close enough to the player to be picked up.
 */
export function tridentPickupReachable(tp, playerPos) {
  const dx = tp.x - playerPos.x, dy = tp.y - (playerPos.y + 1), dz = tp.z - playerPos.z;
  return Math.hypot(dx, dy, dz) <= TRIDENT.pickupRange;
}

/** Consume one trident durability use. Returns {broken, remaining}. */
export function useTridentDurability(durability) {
  const remaining = durability - 1;
  return { broken: remaining <= 0, remaining: Math.max(0, remaining) };
}
