// C11 mobs core (pure): a registry of passive animals and hostile mobs with configurable,
// deterministic drop tables, an AI decision function (wander / track / attack / flee), pairing
// rules, and a pure creeper-explosion that changes a set of world blocks.

export const MOBS = {
  // --- passive animals ---
  pig: { type: 'passive', health: 10, speed: 3.0, color: [246, 158, 176], drops: { raw_pork: [1, 3] } },
  cow: { type: 'passive', health: 10, speed: 3.0, color: [120, 86, 66], drops: { raw_beef: [1, 3], leather: [0, 2] } },
  sheep: { type: 'passive', health: 8, speed: 3.0, color: [235, 235, 235], drops: { raw_mutton: [1, 2], wool: [1, 2] } },
  chicken: { type: 'passive', health: 4, speed: 3.2, color: [255, 255, 255], drops: { raw_chicken: [1, 1], feather: [0, 2] } },
  // --- hostile mobs ---
  zombie: { type: 'hostile', health: 20, attack: 3, speed: 3.4, aggroRange: 16, color: [80, 120, 60], burnInDay: true, drops: { rotten_flesh: [0, 2] } },
  spider: { type: 'hostile', health: 16, attack: 2, speed: 5.0, aggroRange: 18, color: [60, 60, 60], drops: { string: [0, 2] } },
  creeper: { type: 'hostile', health: 20, attack: 0, speed: 3.2, aggroRange: 16, color: [90, 170, 90], fuseTime: 1.5, blastRadius: 3, blastDamage: 20, drops: { gunpowder: [0, 2] } },
};

export function mobDef(id) { return MOBS[id]; }

/** Hostile spawn gating: only at night, not peaceful, near the player. */
export function canSpawnHostile(id, { isNight, difficulty, rng }) {
  const def = mobDef(id);
  if (!def || def.type !== 'hostile') return true;
  if (!isNight) return false;
  if (difficulty === 'peaceful') return false;
  return true;
}

/**
 * AI decision for a single mob update. Returns a normalized movement direction and/or an act.
 * Deterministic given inputs + rng.
 * - passive: wander (random drift) and flee from a nearby threat.
 * - hostile: if player within aggroRange -> track & attack; else wander.
 */
export function mobAI(mob, { playerPos, mobPos, distanceToPlayer, rng = Math.random, dt = 1 }) {
  const def = mobDef(mob.id);
  const out = { move: { x: 0, z: 0 }, act: 'none' };

  if (def.type === 'passive') {
    // flee if a threat (player/types that scare them) is within fleeRange
    if (mob.fleeRange && distanceToPlayer < mob.fleeRange) {
      const dx = mobPos.x - playerPos.x, dz = mobPos.z - playerPos.z;
      const d = Math.hypot(dx, dz) || 1;
      out.move = { x: dx / d, z: dz / d };
      out.act = 'flee';
      return out;
    }
    const ang = rng() * Math.PI * 2;
    out.move = { x: Math.cos(ang), z: Math.sin(ang) };
    out.act = 'wander';
    return out;
  }

  // hostile
  if (distanceToPlayer <= def.aggroRange) {
    const dx = playerPos.x - mobPos.x, dz = playerPos.z - mobPos.z;
    const d = Math.hypot(dx, dz) || 1;
    out.move = { x: dx / d, z: dz / d };
    out.act = distanceToPlayer <= (def.meleeRange || 1.8) ? 'attack' : 'track';
    return out;
  }
  const ang = rng() * Math.PI * 2;
  out.move = { x: Math.cos(ang), z: Math.sin(ang) };
  out.act = 'wander';
  return out;
}

/**
 * Hostile melee attack on the player: returns the base damage (before difficulty),
 * or the explosion when the mob is a creeper and its fuse elapsed.
 */
export function hostileAttack(mob, { fuseElapsed = false } = {}) {
  const def = mobDef(mob.id);
  if (def.type !== 'hostile') return { kind: 'none', damage: 0 };
  if (mob.id === 'creeper') {
    if (!fuseElapsed) return { kind: 'charging', damage: 0 };
    return { kind: 'explode', blastRadius: def.blastRadius, damage: def.blastDamage };
  }
  return { kind: 'melee', damage: def.attack };
}

/**
 * Pure creeper blast: for the blocks within `radius` of (cx,cy,cz), produce a map of
 * block changes (falloff-based; obstruction not modelled — deterministic & testable).
 * Returns [{x,y,z}->airRemoved] list and a central crater of "removed" ids.
 */
export function creeperBlast(cx, cy, cz, radius, getBlock) {
  const removed = [];
  const r2 = radius * radius;
  for (let x = Math.floor(cx - radius); x <= Math.floor(cx + radius); x++)
    for (let y = Math.floor(cy - radius); y <= Math.floor(cy + radius); y++)
      for (let z = Math.floor(cz - radius); z <= Math.floor(cz + radius); z++) {
        const dx = x - cx, dy = y - cy, dz = z - cz;
        if (dx * dx + dy * dy + dz * dz > r2) continue;
        const id = getBlock(x, y, z);
        if (id !== 0) removed.push({ x, y, z, from: id });
      }
  return removed;
}

/** Configure a mob's drops deterministically. Returns a map itemId -> count. */
export function rollDrops(mob, rng = Math.random) {
  const drops = {};
  const def = mobDef(mob.id);
  for (const [item, [lo, hi]] of Object.entries(def.drops || {})) {
    const n = lo + Math.floor(rng() * (hi - lo + 1));
    if (n > 0) drops[item] = n;
  }
  return drops;
}

/** Food value from an item to eat (used when consuming drops in C09). */
export function foodOf(itemId) {
  const foods = { raw_pork: [3, 0.6], raw_beef: [3, 0.6], raw_mutton: [2, 0.4], raw_chicken: [2, 0.4], wheat: [1, 0.2], carrot: [3, 0.6], potato: [1, 0.3] };
  return foods[itemId] || null;
}
