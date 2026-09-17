// C12 combat core (pure): melee weapons, bow (ranged), armor damage reduction + durability,
// hit feedback (knockback/critical/cooldown), reach/range and death resolution. Observable
// via deterministic output rather than engine callbacks.

export const WEAPONS = {
  bare_hand: { name: 'Bare Hand', type: 'melee', damage: 1, reach: 3, cooldown: 0.5, knockback: 0.4, durability: Infinity },
  sword_wood: { name: 'Wooden Sword', type: 'melee', damage: 4, reach: 3, cooldown: 0.55, knockback: 0.7, durability: 60 },
  sword_stone: { name: 'Stone Sword', type: 'melee', damage: 5, reach: 3, cooldown: 0.55, knockback: 0.8, durability: 132 },
  sword_iron: { name: 'Iron Sword', type: 'melee', damage: 6, reach: 3, cooldown: 0.55, knockback: 0.9, durability: 251 },
  bow: { name: 'Bow', type: 'ranged', damage: 6, range: 12, cooldown: 1.0, knockback: 1.0, durability: 200, ammo: 'arrow' },
};

export const ARMOR = {
  none: { name: 'None', armorPoints: 0, durability: Infinity },
  leather: { name: 'Leather', armorPoints: 3, durability: 55 },
  iron: { name: 'Iron', armorPoints: 6, durability: 165 },
};

/** Damage taken after armor reduction (MC-like: <= 1/(armor+8) per point, ~0.04*points). */
export function armorMultiplier(armorPoints) {
  return Math.max(0, 1 - armorPoints * 0.04);
}

/**
 * Compute a resolved melee/ranged hit. Returns the applied damage, knockback, critical
 * flag and whether the target was killed. Does not mutate the caller's state (ocr points).
 */
export function resolveHit({ weaponId, baseDamage, range, targetHealth, armorPoints, crit = false, knockbackMul = 1 }) {
  const w = WEAPONS[weaponId] || WEAPONS.bare_hand;
  let dmg = baseDamage ?? w.damage;
  if (crit) dmg = Math.ceil(dmg * 1.5);
  dmg *= armorMultiplier(armorPoints);
  const kb = w.knockback * knockbackMul;
  const dead = targetHealth <= dmg;
  return { damage: dmg, knockback: kb, crit, dead };
}

/** Whether a melee attack connects given the attacker-target distance and weapon reach. */
export function meleeInRange(distance, weaponId = 'bare_hand') {
  return distance <= (WEAPONS[weaponId]?.reach ?? 3);
}

/** Whether a bow shot can reach (max range) and at what distance penalty (falloff). */
export function rangedInRange(distance, weaponId = 'bow') {
  return distance <= (WEAPONS[weaponId]?.range ?? 12);
}

/** Consume one durability; returns true when the item then breaks. Infinite durability never breaks. */
export function useDurability(durability) {
  if (durability === Infinity) return { has: true, broken: false, remaining: Infinity };
  const remaining = durability - 1;
  return { has: remaining > 0, broken: remaining <= 0, remaining: Math.max(0, remaining) };
}

/** Cooldown gate: returns true when enough time has passed for a swing/shot. */
export function readyToAttack(cooldown, weaponId, dt) {
  const c = (WEAPONS[weaponId]?.cooldown ?? 0.5);
  return cooldown + dt >= c;
}
