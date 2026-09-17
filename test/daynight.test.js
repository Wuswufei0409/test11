import { describe, it, expect } from 'vitest';
import { DayNight, isNight, brightness, undeadBurn, dayFraction } from '../src/daynight.js';

describe('C10 day/night: cycle, brightness, night spawn, undead burn, bed skip', () => {
  it('brightness is high at midday and low at night', () => {
    expect(brightness(0.5)).toBeGreaterThan(0.8); // midday
    expect(brightness(0.85)).toBeLessThan(0.3);   // deep night
  });

  it('night detection and undead burn are complementary', () => {
    const day = new DayNight({ startTime: 0.25 });
    expect(day.isNight()).toBe(false);
    expect(day.undeadBurn()).toBe(true);
    const night = new DayNight({ startTime: 0.8 });
    expect(night.isNight()).toBe(true);
    expect(night.undeadBurn()).toBe(false);
  });

  it('advancing time moves the clock', () => {
    const c = new DayNight({ startTime: 0.25 });
    const before = c.time;
    c.advance(1200 / 2); // half a day
    expect(c.time).not.toBe(before);
  });

  it('sleeping skips the night to sunrise', () => {
    const night = new DayNight({ startTime: 0.8 });
    expect(night.isNight()).toBe(true);
    const ok = night.sleep();
    expect(ok).toBe(true);
    expect(night.isNight()).toBe(false); // skipped past the night into day
  });

  it('cannot sleep during the day', () => {
    const day = new DayNight({ startTime: 0.25 });
    expect(day.sleep()).toBe(false);
  });

  it('dayFraction normalizes to [0,1)', () => {
    expect(dayFraction(1.3)).toBeCloseTo(0.3);
    expect(dayFraction(-0.2)).toBeCloseTo(0.8);
  });
});
