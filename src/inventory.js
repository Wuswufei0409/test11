// Inventory: 9-slot hotbar + 27-slot storage grid (36 total), with stacking, split,
// swap, full-inventory handling. Pure JS (no DOM) so it is fully unit-testable (C05/C06).

export const MAX_STACK = 64;
export const HOTBAR = 9;
export const STORAGE = 27;
export const SLOTS = HOTBAR + STORAGE; // 36

/** A slot is { id:number, count:number } where id 0 == empty. */
export function emptySlot() {
  return { id: 0, count: 0 };
}

/** Create a fresh inventory array of SLOTS empty slots, index 0..8 = hotbar. */
export function createInventory() {
  return Array.from({ length: SLOTS }, emptySlot);
}

export function isEmpty(slot) {
  return !slot || slot.id === 0 || slot.count <= 0;
}

/** Stack-size limit for a given item id (all 64 for now). */
export function stackSize(itemId) {
  return MAX_STACK;
}

/** Count total of an item id across the whole inventory. */
export function countItem(inv, itemId) {
  return inv.reduce((acc, s) => acc + (isEmpty(s) ? 0 : (s.id === itemId ? s.count : 0)), 0);
}

/**
 * Add a stack of itemId/count into the inventory. First merges into existing stacks,
 * then into empty slots. Returns the number actually added (stops when full / max stack).
 */
export function addItem(inv, itemId, count) {
  if (!itemId || count <= 0) return 0;
  let remaining = count;
  const max = stackSize(itemId);
  // 1) top-up existing partially-filled stacks
  for (const s of inv) {
    if (remaining <= 0) break;
    if (!isEmpty(s) && s.id === itemId && s.count < max) {
      const room = max - s.count;
      const put = Math.min(room, remaining);
      s.count += put;
      remaining -= put;
    }
  }
  // 2) fill empty slots
  for (const s of inv) {
    if (remaining <= 0) break;
    if (isEmpty(s)) {
      const put = Math.min(max, remaining);
      s.id = itemId;
      s.count = put;
      remaining -= put;
    }
  }
  return count - remaining;
}

/** Attempt to remove `count` of itemId. Returns the number actually removed. */
export function removeItem(inv, itemId, count) {
  let remaining = count;
  for (let i = inv.length - 1; i >= 0 && remaining > 0; i--) {
    const s = inv[i];
    if (!isEmpty(s) && s.id === itemId) {
      const take = Math.min(s.count, remaining);
      s.count -= take;
      remaining -= take;
      if (s.count <= 0) { s.id = 0; s.count = 0; }
    }
  }
  return count - remaining;
}

/** True if the inventory can hold at least `count` more of itemId. */
export function canAdd(inv, itemId, count) {
  const max = stackSize(itemId);
  let space = inv.reduce((acc, s) => acc + (isEmpty(s) ? max : (s.id === itemId ? max - s.count : 0)), 0);
  return space >= count;
}

/** Swap the contents of two slots. */
export function swapSlots(inv, a, b) {
  const tmp = inv[a];
  inv[a] = inv[b];
  inv[b] = tmp;
}

/**
 * Move stack from slot `from` to slot `to` (merge if same id & room, else swap).
 * Returns true if contents changed.
 */
export function moveStack(inv, from, to) {
  if (from === to) return false;
  const src = inv[from];
  const dst = inv[to];
  if (isEmpty(src)) return false;
  // merge into same-item stack with room
  if (!isEmpty(dst) && dst.id === src.id && dst.count < stackSize(dst.id)) {
    const room = stackSize(dst.id) - dst.count;
    const put = Math.min(room, src.count);
    dst.count += put;
    src.count -= put;
    if (src.count <= 0) { src.id = 0; src.count = 0; }
    return true;
  }
  // else swap
  swapSlots(inv, from, to);
  return true;
}

/**
 * Split a stack in half (or by an explicit amount) from `from` into `to`.
 * If `to` is empty, moves half (or `amount`) over; returns true on success.
 */
export function splitStack(inv, from, to, amount) {
  if (from === to) return false;
  const src = inv[from];
  const dst = inv[to];
  if (isEmpty(src) || src.count < 2) return false;
  if (!isEmpty(dst)) return false; // destination must be empty for a split
  const amt = amount !== undefined ? Math.min(amount, src.count - 1) : Math.floor(src.count / 2);
  if (amt <= 0) return false;
  inv[to] = { id: src.id, count: amt };
  src.count -= amt;
  if (src.count <= 0) { src.id = 0; src.count = 0; }
  return true;
}

/** Compact: merge duplicate stacks of the same item (used after world interactions). */
export function compact(inv) {
  // merge same ids into earlier slots
  for (let i = 0; i < inv.length; i++) {
    const s = inv[i];
    if (isEmpty(s)) continue;
    const max = stackSize(s.id);
    let remaining = max - s.count;
    if (remaining <= 0) continue;
    for (let j = i + 1; j < inv.length && remaining > 0; j++) {
      const t = inv[j];
      if (!isEmpty(t) && t.id === s.id) {
        const put = Math.min(remaining, t.count);
        s.count += put;
        t.count -= put;
        if (t.count <= 0) { t.id = 0; t.count = 0; }
        remaining -= put;
      }
    }
  }
}

/** Drop-all: return a map itemId->count of everything in the inventory and empty it. */
export function dropAll(inv) {
  const dropped = {};
  for (const s of inv) {
    if (!isEmpty(s)) {
      dropped[s.id] = (dropped[s.id] || 0) + s.count;
      s.id = 0; s.count = 0;
    }
  }
  return dropped;
}
