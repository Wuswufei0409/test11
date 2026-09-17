import { describe, it, expect } from 'vitest';
import { PlayerStats, DIFFICULTY, difficultyDamage, hostilesSpawn, fallDamage } from '../src/survival.js';

describe('C09 survival: health/damage/hunger/death/respawn/difficulty', () => {
  it('starts alive at full health and food', () => {
    const p = new PlayerStats();
    expect(p.health).toBe(20);
    expect(p.food).toBe(20);
    expect(p.alive).toBe(true);
  });

  it('damage reduces health; hostile damage scales with difficulty', () => {
    const p = new PlayerStats({ difficulty: DIFFICULTY.NORMAL });
    p.damage(10, 'hostile');
    expect(p.health).toBe(10);
    const hard = new PlayerStats({ difficulty: DIFFICULTY.HARD });
    hard.damage(10, 'hostile');
    expect(hard.health).toBe(5);
    const easy = new PlayerStats({ difficulty: DIFFICULTY.EASY });
    easy.damage(10, 'hostile');
    expect(easy.health).toBe(15);
  });

  it('peaceful difficulty has zero hostile damage and no hostile spawns', () => {
    const p = new PlayerStats({ difficulty: DIFFICULTY.PEACEFUL });
    p.damage(50, 'hostile');
    expect(p.health).toBe(20);
    expect(hostilesSpawn('peaceful')).toBe(false);
    expect(hostilesSpawn('normal')).toBe(true);
    expect(difficultyDamage('peaceful')).toBe(0);
  });

  it('death occurs at 0 health; respawn resets stats', () => {
    const p = new PlayerStats();
    p.damage(20, 'misc');
    expect(p.alive).toBe(false);
    p.reset();
    expect(p.alive).toBe(true);
    expect(p.health).toBe(20);
    expect(p.food).toBe(20);
  });

  it('eating restores food and saturation up to the cap', () => {
    const p = new PlayerStats();
    p.saturation = 0;                 // empty the saturation buffer first
    p.addExhaustion(4);               // burns one food point
    p.addExhaustion(4);
    expect(p.food).toBeLessThan(20);
    p.eat({ food: 6, saturation: 6 });
    expect(p.food).toBe(20);
  });

  it('fall damage scales with distance (none <=3 blocks)', () => {
    expect(fallDamage(2)).toBe(0);
    expect(fallDamage(3)).toBe(0);
    expect(fallDamage(8)).toBe(5);
  });

  it('regenerates health when well-fed, starves when food is empty', () => {
    const p = new PlayerStats();
    p.damage(6, 'misc'); // 14 health
    let anyRegen = false;
    for (let i = 0; i < 300; i++) { const ev = p.tick(0.05); if (ev.includes('regen')) anyRegen = true; }
    expect(p.health).toBeGreaterThan(14);
    expect(anyRegen).toBe(true);
    const starve = new PlayerStats();
    starve.food = 0;
    const before = starve.health;
    for (let i = 0; i < 200; i++) starve.tick(0.05); // 10s starving -> 2 damage
    expect(starve.health).toBeLessThan(before);
  });
});
