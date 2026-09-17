import { describe, it, expect } from 'vitest';
import { WEAPONS, resolveHit, meleeInRange, rangedInRange, useDurability, readyToAttack, armorMultiplier } from '../src/combat.js';

describe('C12 combat: melee/bow/armor/durability + observable feedback', () => {
  it('melee sword deals more damage than a bare hand', () => {
    const hand = resolveHit({ weaponId: 'bare_hand', targetHealth: 20, armorPoints: 0 });
    const sword = resolveHit({ weaponId: 'sword_iron', targetHealth: 20, armorPoints: 0 });
    expect(sword.damage).toBeGreaterThan(hand.damage);
  });

  it('armor reduces damage taken', () => {
    const naked = resolveHit({ weaponId: 'sword_stone', targetHealth: 30, armorPoints: 0 });
    const armored = resolveHit({ weaponId: 'sword_stone', targetHealth: 30, armorPoints: 6 });
    expect(armored.damage).toBeLessThan(naked.damage);
    expect(armorMultiplier(0)).toBe(1);
    expect(armorMultiplier(6)).toBeLessThan(1);
  });

  it('criticals boost damage and result is observable (death resolution)', () => {
    const crit = resolveHit({ weaponId: 'sword_iron', targetHealth: 4, armorPoints: 0, crit: true });
    expect(crit.crit).toBe(true);
    expect(crit.damage).toBeGreaterThan(WEAPONS.sword_iron.damage);
    const kill = resolveHit({ weaponId: 'sword_iron', targetHealth: 2, armorPoints: 0 });
    expect(kill.dead).toBe(true);
  });

  it('reach and range gates are observable', () => {
    expect(meleeInRange(2.5, 'sword_wood')).toBe(true);
    expect(meleeInRange(4, 'sword_wood')).toBe(false);
    expect(rangedInRange(8, 'bow')).toBe(true);
    expect(rangedInRange(20, 'bow')).toBe(false);
  });

  it('durability decrements and allows breaking', () => {
    const r = useDurability(1); // one-damage item breaks
    expect(r.broken).toBe(true);
    expect(r.has).toBe(false);
    const r2 = useDurability(WEAPONS.sword_wood.durability - 1);
    expect(r2.broken).toBe(false);
  });

  it('cooldown gates attacks', () => {
    expect(readyToAttack(0.0, 'sword_wood', 0.1)).toBe(false);
    expect(readyToAttack(0.0, 'sword_wood', 0.6)).toBe(true);
    expect(readyToAttack(0.0, 'bow', 1.05)).toBe(true);
  });
});
