import { describe, it, expect } from 'vitest';
import {
  createInventory, addItem, removeItem, countItem, canAdd, swapSlots, moveStack,
  splitStack, dropAll, isEmpty, HOTBAR, STORAGE, SLOTS, MAX_STACK,
} from '../src/inventory.js';

describe('C06 inventory: stacking', () => {
  it('creates 36 slots (9 hotbar + 27 storage), all empty', () => {
    const inv = createInventory();
    expect(inv.length).toBe(SLOTS);
    expect(HOTBAR).toBe(9);
    expect(STORAGE).toBe(27);
    expect(inv.every(isEmpty)).toBe(true);
  });

  it('addItem stacks into one slot up to 64, then into a second slot', () => {
    const inv = createInventory();
    expect(addItem(inv, 3, 40)).toBe(40);
    expect(addItem(inv, 3, 40)).toBe(40);
    expect(countItem(inv, 3)).toBe(80);
    // exactly two slots hold 64 + 16
    const filled = inv.filter((s) => s.id === 3).map((s) => s.count);
    expect(filled.sort((a, b) => b - a)).toEqual([64, 16]);
  });

  it('addItem returns 0 when inventory is full (full-handling)', () => {
    const inv = createInventory();
    addItem(inv, 3, MAX_STACK * SLOTS);
    expect(countItem(inv, 3)).toBe(MAX_STACK * SLOTS);
    expect(addItem(inv, 3, 1)).toBe(0);
    expect(countItem(inv, 3)).toBe(MAX_STACK * SLOTS);
  });

  it('addItem merges into partially filled same-id stacks before new slots', () => {
    const inv = createInventory();
    addItem(inv, 5, 20);
    // vacate all but the first, leaving it partially full at 20
    addItem(inv, 1, 1); // a different item occupies slot 1
    const first = inv[0];
    expect(first.id).toBe(5);
    expect(first.count).toBe(20);
    addItem(inv, 5, 10);
    expect(inv[0].count).toBe(30); // merged, not a new slot
  });

  it('canAdd reflects true capacity', () => {
    const inv = createInventory();
    expect(canAdd(inv, 3, MAX_STACK * SLOTS)).toBe(true);
    expect(canAdd(inv, 3, MAX_STACK * SLOTS + 1)).toBe(false);
  });
});

describe('C06 inventory: split / swap / move', () => {
  it('splitStack moves half of a stack to an empty slot', () => {
    const inv = createInventory();
    addItem(inv, 7, 30);
    const src0 = inv[0];
    expect(splitStack(inv, 0, 1)).toBe(true);
    expect(src0.count).toBe(15);
    expect(inv[1].id).toBe(7);
    expect(inv[1].count).toBe(15);
  });

  it('splitStack respects an explicit amount and caps at count-1', () => {
    const inv = createInventory();
    addItem(inv, 7, 10);
    expect(splitStack(inv, 0, 1, 3)).toBe(true);
    expect(inv[0].count).toBe(7);
    expect(inv[1].count).toBe(3);
    // cannot split a size-1 stack
    addItem(inv, 7, 0);
    const inv2 = createInventory();
    addItem(inv2, 7, 1);
    expect(splitStack(inv2, 0, 1)).toBe(false);
  });

  it('moveStack merges into a same-id stack with room', () => {
    const inv = createInventory();
    // clean setup: slot 0 = 20 of id 3, slot 1 = 30 of id 3 (room for 34)
    inv[0] = { id: 3, count: 20 };
    inv[1] = { id: 3, count: 30 };
    expect(moveStack(inv, 0, 1)).toBe(true);
    expect(inv[1].count).toBe(50); // merged into slot 1
    expect(inv[0].id).toBe(0);
  });

  it('moveStack swaps different-item slots', () => {
    const inv = createInventory();
    inv[0] = { id: 3, count: 5 };
    inv[1] = { id: 6, count: 2 };
    expect(moveStack(inv, 0, 1)).toBe(true);
    expect(inv[0].id).toBe(6);
    expect(inv[1].id).toBe(3);
  });

  it('swapSlots exchanges two slots in place', () => {
    const inv = createInventory();
    inv[0] = { id: 1, count: 3 };
    inv[5] = { id: 9, count: 7 };
    swapSlots(inv, 0, 5);
    expect(inv[0].id).toBe(9);
    expect(inv[5].id).toBe(1);
  });
});

describe('C06 inventory: remove / drop-all', () => {
  it('removeItem takes from stacks and zeroes empty', () => {
    const inv = createInventory();
    addItem(inv, 3, 10);
    addItem(inv, 3, 10);
    expect(removeItem(inv, 3, 15)).toBe(15);
    expect(countItem(inv, 3)).toBe(5);
  });

  it('dropAll returns counts and empties the inventory (death drops)', () => {
    const inv = createInventory();
    addItem(inv, 3, 10);
    addItem(inv, 6, 5);
    const dropped = dropAll(inv);
    expect(dropped[3]).toBe(10);
    expect(dropped[6]).toBe(5);
    expect(inv.every(isEmpty)).toBe(true);
  });
});
