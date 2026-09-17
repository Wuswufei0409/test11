// C10 day/night cycle (pure): 24h time, daylight brightness, night-time hostile spawning,
// undead burning in daylight, and sleeping in a bed to skip the night + set a respawn point.

export const DAY_TICKS = 12000;   // 24h in "ticks" (~20 real minutes to keep a full day demoable)
export const CYCLE_SECONDS = 1200; // a full day advances this many real seconds at 1.0 speed

export const SUNRISE = 0.23;  // start of day (t fraction)
export const SUNSET = 0.72;   // start of night
// 0..1 normalized fraction of the day

/** Normalize an absolute time to [0,1) day fraction. */
export function dayFraction(time) {
  const f = (time % 1 + 1) % 1;
  return f;
}

/** 0..1 sky/light brightness from the sun+moon angle. */
export function brightness(time) {
  const f = dayFraction(time);
  // smooth day/night ramp: brightness is low at night, high around midday
  if (f >= SUNRISE && f <= SUNSET) {
    const p = (f - SUNRISE) / (SUNSET - SUNRISE); // 0..1 across the day
    return 0.25 + 0.75 * Math.sin(p * Math.PI);
  }
  // night: gentle moonlight, slightly brighter at the fringes
  return 0.12;
}

/** True when it is night (hostiles can spawn). */
export function isNight(time) {
  const f = dayFraction(time);
  return f < SUNRISE || f > SUNSET;
}

/** True when it is day enough that undead exposed to sky would burn (not fully dark). */
export function undeadBurn(time) {
  return brightness(time) > 0.28;
}

export class DayNight {
  constructor({ startTime = 0.25, speed = 1.0 } = {}) {
    this.time = startTime; // 0..1 normalized; 0.25 ~ morning
    this.speed = speed;
    this.timeScale = CYCLE_SECONDS / DAY_TICKS; // real seconds per day-tick
  }

  advance(dt) {
    // dt is real seconds; advance the normalized clock fractionally
    this.time = dayFraction(this.time + (dt * this.speed) / CYCLE_SECONDS);
  }

  isNight() { return isNight(this.time); }
  brightness() { return brightness(this.time); }
  undeadBurn() { return undeadBurn(this.time); }

  /** Try to sleep a bed at night; on success skip to just after sunrise and return true. */
  sleep() {
    if (!this.isNight()) return false;
    this.time = SUNRISE + 0.01; // robustly day (avoids the 0.23 float boundary)
    return true;
  }

  /** Force daytime (used at spawn / respawn convenience). */
  setDay() { this.time = SUNRISE; }
  setNight() { this.time = (SUNSET + 0.02); }
}

/**
 * Bed respawn bookmark. A pure holder so the respawn point is set when a bed is slept in.
 * Location is just coordinates; sleeping also sets this.
 */
export function makeBedBookmark() {
  return { has: false, x: 0, y: 0, z: 0 };
}
