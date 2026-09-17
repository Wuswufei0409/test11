// C09 survival core (pure, no DOM): health/saturation/life, damage types, fall/drown/enemy
// damage, death/respawn, hunger/exhaustion, food, and difficulty scaling of hostile damage.

export const DIFFICULTY = {
  PEACEFUL: 'peaceful',
  EASY: 'easy',
  NORMAL: 'normal',
  HARD: 'hard',
};

/** Hostile-damage multiplier per difficulty (night hostiles don't spawn on peaceful). */
export function difficultyDamage(difficulty) {
  switch (difficulty) {
    case 'peaceful': return 0;
    case 'easy': return 0.5;
    case 'hard': return 1.5;
    default: return 1.0; // normal
  }
}

export function hostilesSpawn(difficulty) {
  return difficulty !== 'peaceful';
}

/** Food that regenerates health (consumed when food >= lateRegenThreshold) and starvation ceiling. */
export const REGEN_FOOD_THRESHOLD = 18;
export const STARVATION_CEILING = 0; // health won't regen above this while starving (MC behavior)

const FULL_REGEN_PERIOD = 4; // seconds between 1-health regens
const STARVE_PERIOD = 4;     // seconds between 1-health starve ticks

export class PlayerStats {
  constructor({ difficulty = DIFFICULTY.NORMAL, maxHealth = 20, maxFood = 20 } = {}) {
    this.difficulty = difficulty;
    this.maxHealth = maxHealth;
    this.maxFood = maxFood;
    this.health = maxHealth;
    this.food = maxFood;
    this.saturation = 5;
    this.exhaustion = 0;
    this.alive = true;
    this.lastRow = [];
    this._regenTimer = 0;
    this._starveTimer = 0;
  }

  /** Apply damage of a given type. Returns the actual damage taken (0 if already dead). */
  damage(amount, type = 'misc') {
    if (!this.alive || amount <= 0) return 0;
    let dmg = amount;
    if (type === 'hostile') dmg = amount * difficultyDamage(this.difficulty);
    // hunger/other friendly damage is unaffected by difficulty in MC; keep hostile-only scaling
    this.health = Math.max(0, this.health - dmg);
    if (this.health <= 0) this.alive = false;
    return dmg;
  }

  heal(amount) {
    if (!this.alive) return 0;
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    return this.health - before;
  }

  eat({ food, saturation }) {
    if (!this.alive) return;
    this.food = Math.min(this.maxFood, this.food + (food || 0));
    this.saturation = Math.min(this.maxFood, this.saturation + (saturation || 0));
  }

  /** Exhaustion: 4 units burns one food/saturation point (MC hunger model). */
  addExhaustion(x) {
    if (!this.alive) return;
    this.exhaustion += x;
    while (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation--;
      else if (this.food > 0) this.food--;
    }
  }

  canRegenNow() {
    return this.alive && this.food > STARVATION_CEILING && this.food >= REGEN_FOOD_THRESHOLD && this.health < this.maxHealth;
  }

  /**
   * Per-frame homeostasis: regenerate health when well-fed, starve when food exhausted.
   * Returns events: ['regen'] | ['starve'] | [].
   */
  tick(dt) {
    const events = [];
    if (!this.alive) return events;
    if (this.food <= 0 && this.health > 0) {
      this._starveTimer += dt;
      if (this._starveTimer >= STARVE_PERIOD) { this._starveTimer = 0; this.damage(1, 'starve'); events.push('starve'); }
    } else if (this.canRegenNow()) {
      this._regenTimer += dt;
      if (this._regenTimer >= FULL_REGEN_PERIOD) { this._regenTimer = 0; this.heal(1); events.push('regen'); }
    }
    return events;
  }

  /** Full reset used on respawn (keeps difficulty). */
  reset() {
    this.health = this.maxHealth;
    this.food = this.maxFood;
    this.saturation = 5;
    this.exhaustion = 0;
    this.alive = true;
  }

  /** Cycle through difficulty (debug/control surface proves difficulty changes damage). */
  nextDifficulty() {
    const order = [DIFFICULTY.PEACEFUL, DIFFICULTY.EASY, DIFFICULTY.NORMAL, DIFFICULTY.HARD];
    this.difficulty = order[(order.indexOf(this.difficulty) + 1) % order.length];
    return this.difficulty;
  }
}

/** Fall damage: ~1 heart per block fallen beyond 3, capped per MC-ish curve. */
export function fallDamage(fallDistance) {
  if (fallDistance <= 3) return 0;
  return Math.min(20, Math.floor((fallDistance - 3) * 1));
}

/** Whether the body (0.5-1.0) is submerged for drowning. */
export function isSubmerged(getBlock, x, y, z, fluidPredicate) {
  return fluidPredicate(getBlock(Math.floor(x), Math.floor(y + 0.5), Math.floor(z)));
}
