// C16 aquatic mobs (pure, no DOM): dolphin / cod / salmon / tropical_fish / pufferfish.
// Fish can be caught into a bucket and released; dolphin swims around; pufferfish inflates
// when the player is near and then deals damage on contact. Deterministic & unit-testable.

export const AQUATIC = {
  dolphin: {
    type: 'aquatic', tameable: false, health: 10, speed: 6.5, color: [110, 150, 190],
    jumpHeights: [0, 2], drops: {}, swimmable: true, behavior: 'swim',
  },
  cod: {
    type: 'aquatic', health: 3, speed: 2.2, color: [150, 120, 90],
    drops: { cod: [1, 1] }, fish: true, bucketId: 'cod_bucket', swimmable: true, behavior: 'drift',
  },
  salmon: {
    type: 'aquatic', health: 3, speed: 2.6, color: [240, 150, 130],
    drops: { salmon: [1, 1] }, fish: true, bucketId: 'salmon_bucket', swimmable: true, behavior: 'drift',
  },
  tropical_fish: {
    type: 'aquatic', health: 3, speed: 2.4, color: [250, 190, 90],
    drops: { tropical_fish: [1, 1] }, fish: true, bucketId: 'tropicalfish_bucket', swimmable: true, behavior: 'drift',
  },
  pufferfish: {
    type: 'aquatic', health: 3, speed: 1.8, color: [210, 200, 110],
    drops: { pufferfish: [1, 1] }, fish: true, bucketId: 'pufferfish_bucket',
    swimmable: true, behavior: 'drift', inflateRadius: 2.5, contactDamage: 2,
  },
};

export function aquaticDef(id) { return AQUATIC[id]; }

/** Bucket item name for an aquatic mob; null when not a fish. */
export function fishBucketItem(mobId) {
  const d = aquaticDef(mobId);
  return d && d.fish ? d.bucketId : null;
}

/**
 * Catch a fish with a water bucket: consume the water bucket, produce the correct
 * fish bucket. Returns { caught, bucketItem } or { caught:false } when not a fish.
 */
export function catchWithBucket(mobId, hasWaterBucket) {
  const bucket = fishBucketItem(mobId);
  if (!bucket || !hasWaterBucket) return { caught: false };
  return { caught: true, bucketItem: bucket };
}

/**
 * Release a fish from a fish bucket: consume the bucket item, return the aquatic mob id
 * (and whether the release yields an empty bucket back is game-layer).
 */
export function releaseFromBucket(bucketItemName) {
  const map = {
    cod_bucket: 'cod', salmon_bucket: 'salmon',
    tropicalfish_bucket: 'tropical_fish', pufferfish_bucket: 'pufferfish',
  };
  const mobId = map[bucketItemName];
  return mobId ? { released: true, mobId } : { released: false, mobId: null };
}

/**
 * AI for an aquatic mob. Returns movement deltas. Pufferfish: when the player gets within
 * inflateRadius it inflates (state 'inflated'); afterwards touching (dist < contact) deals
 * contactDamage. Dolphins swim in gentle circles trying to stay in water.
 */
export function aquaticAI(mob, { playerPos, mobPos, rng = Math.random, dt = 1 } = {}) {
  const d = aquaticDef(mob.id);
  const out = { move: { dx: 0, dy: 0, dz: 0 }, act: 'swim', state: mob.state || 'normal' };

  if (d.behavior === 'drift') {
    // slow sinusoidal drift around the spawn
    const ph = (mob.phase || 0) + dt * 1.5;
    mob.phase = ph;
    out.move = { dx: Math.cos(ph) * d.speed, dy: Math.sin(ph * 0.7) * 1.0, dz: Math.sin(ph) * d.speed };

    // pufferfish inflation near player
    if (mob.id === 'pufferfish') {
      const dist = Math.hypot(playerPos.x - mobPos.x, playerPos.z - mobPos.z);
      const inflated = dist < d.inflateRadius;
      mob.state = inflated ? 'inflated' : 'normal';
      out.state = mob.state;
      if (inflated && dist < 1.6) {
        out.act = 'contact'; // contact damage handled by game layer
      }
    }
    return out;
  }

  // dolphin: swim toward the player's vicinity, bobbing, occasionally breach
  const dx = playerPos.x - mobPos.x, dz = playerPos.z - mobPos.z;
  const dist = Math.hypot(dx, dz) || 1;
  const dirX = dx / dist, dirZ = dz / dist;
  const up = (mob.breachTimer > 0) ? 6 : -0.5;
  out.move = { dx: dirX * d.speed, dy: up, dz: dirZ * d.speed };
  if (rng() < 0.02) mob.breachTimer = 2;
  if (mob.breachTimer) { mob.breachTimer -= dt; if (mob.breachTimer <= 0) mob.breachTimer = 0; }
  return out;
}
