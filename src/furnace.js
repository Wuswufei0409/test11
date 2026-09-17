// W3 furnace smelting (C07/C08): ore -> ingot, with fuel consumption, burn time and per-item
// processing. Pure JS / deterministic, so the full upgrade chain is unit-testable.

import { itemId, itemName } from './items.js';
import { addItem, removeItem, countItem, canAdd } from './inventory.js';

/** Smelting recipes: input item name -> { out, seconds per unit }. */
export const SMELT = {
  iron_ore_raw: { out: 'iron_ingot', seconds: 10 },
  gold_ore_raw: { out: 'gold_ingot', seconds: 10 },
  cobblestone: { out: 'stone', seconds: 10 },
  sand: { out: 'glass', seconds: 8 },
  coal_ore: { out: 'coal', seconds: 10 },
};

/** Fuel burn seconds per unit of an item. */
export const FUEL = {
  coal: 80, oak_planks: 15, spruce_log: 15, birch_log: 15, oak_log: 15,
  stick: 5, crafting_table: 15, chest: 15,
  coal_ore: 4,
};

export function smeltResult(inputName) {
  const r = SMELT[inputName];
  return r ? { out: r.out, seconds: r.seconds } : null;
}

export function fuelSeconds(name) { return FUEL[name] || 0; }

/**
 * A furnace block-entity. Holds input (to smelt), fuel, and output slots (each a stack).
 * tick(dt) advances burn + smelt progress deterministically.
 */
export class Furnace {
  constructor() {
    this.input = null;   // {id,count}  (the ore / item being smelted)
    this.fuel = null;    // {id,count}  (fuel waiting to be consumed)
    this.output = null;  // {id,count}  (smelted result stack)
    this.burn = 0;       // seconds of active burn remaining
    this.progress = 0;   // seconds into the current item's smelt
    this.progressTotal = 0;
    this.lit = false;
  }

  /** Whether the furnace is actively burning fuel. */
  get isLit() { return this.lit; }

  load({ input, fuel, output }) {
    if (input) this.input = { ...input };
    if (fuel) this.fuel = { ...fuel };
    if (output) this.output = { ...output };
  }

  refuel() {
    if (this.burn > 0 || !this.fuel || this.fuel.count <= 0) return;
    const secs = fuelSeconds(itemNameOf(this.fuel.id));
    if (secs <= 0) return;
    this.burn += secs;
    this.fuel.count -= 1;
    if (this.fuel.count <= 0) this.fuel = null;
  }

  /** Advance simulation by dt seconds. */
  tick(dt) {
    this.refuel();
    if (this.burn <= 0) { this.lit = false; return; }
    if (!this.input || this.input.count <= 0) { this.lit = this.burn > 0; return; }
    const res = smeltResult(itemNameOf(this.input.id));
    if (!res) { this.lit = this.burn > 0; return; }
    // output capacity check: different item already occupying output -> can't proceed
    if (this.output && this.output.id !== itemId(res.out) && this.output.count > 0) {
      this.lit = this.burn > 0; return;
    }
    if (this.progressTotal !== res.seconds) { this.progressTotal = res.seconds; this.progress = 0; }
    this.lit = true;
    const step = Math.min(dt, this.burn);
    this.burn -= step;
    this.progress += step;
    if (this.progress >= this.progressTotal) {
      this.progress = 0;
      this.input.count -= 1;
      if (this.input.count <= 0) this.input = null;
      if (this.output && this.output.id === itemId(res.out)) this.output.count += 1;
      else this.output = { id: itemId(res.out), count: 1 };
    }
  }

  /** Serialize for save/load (C18). */
  toJSON() {
    return {
      input: this.input ? { ...this.input } : null,
      fuel: this.fuel ? { ...this.fuel } : null,
      output: this.output ? { ...this.output } : null,
      burn: this.burn, progress: this.progress, progressTotal: this.progressTotal, lit: this.lit,
    };
  }
}

function itemNameOf(id) {
  return itemName(id);
}

/** Convenience: smelt one unit of input with enough fuel; returns the output stack (or null). */
export function smeltToIngot(startInput = 'iron_ore_raw', fuel = 'coal') {
  const f = new Furnace();
  f.input = { id: itemId(startInput), count: 1 };
  f.fuel = { id: itemId(fuel), count: 1 };
  for (let t = 0; t < 300; t += 0.1) f.tick(0.1);
  return f.output;
}
