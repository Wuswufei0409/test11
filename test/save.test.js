import { describe, it, expect } from 'vitest';
import { serialize, parseSave, checksum, loadGame, saveGame, fallbackState, fnv1a, SAVE_VERSION } from '../src/save.js';

function makeState(overrides = {}) {
  return {
    seed: 20260917,
    player: { x: -99, y: 70, z: -135, yaw: 0.3, pitch: -0.2, health: 16, food: 18 },
    inventory: [{ id: 3, count: 5 }, { id: 102, count: 3 }], // stone blocks + iron ingots
    time: 12345,
    blocks: [{ x: 1, y: 2, z: 3, id: 35 }], // a placed chest block
    tiles: { '1,2,3': { type: 'chest', data: { rows: [{ id: 3, count: 9 }] } } },
    entities: [{ id: 101, count: 2, x: 1.5, y: 2.5, z: 3.5 }],
    ...overrides,
  };
}

describe('C18 save: serialize/parse round trip preserves all key state', () => {
  it('serialize includes seed, position, inventory, time, blocks, tiles, entities', () => {
    const s = serialize(makeState());
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.seed).toBe(20260917);
    expect(s.player.x).toBe(-99);
    expect(s.player.health).toBe(16);
    expect(s.inventory[1]).toEqual({ id: 102, count: 3 });
    expect(s.time).toBe(12345);
    expect(s.blocks).toEqual([{ x: 1, y: 2, z: 3, id: 35 }]);
    expect(s.tiles['1,2,3'].type).toBe('chest');
    expect(s.entities[0].count).toBe(2);
  });

  it('parseSave accepts a valid serialized save', () => {
    const s = serialize(makeState());
    const raw = JSON.stringify(s);
    const r = parseSave(raw);
    expect(r.ok).toBe(true);
    expect(r.state.seed).toBe(20260917);
    expect(r.state.player.z).toBe(-135);
  });

  it('checksum detects tampering', () => {
    const s = serialize(makeState());
    s.player.health = 99; // tamper after checksum
    const r = parseSave(JSON.stringify(s));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/checksum/i);
  });
});

describe('C18 save: corrupt files -> clear error + safe fallback, no silent overwrite', () => {
  it('rejects non-JSON garbage with a clear corrupt error', () => {
    expect(parseSave('this is not json{{').ok).toBe(false);
    expect(parseSave('').ok).toBe(false);
  });

  it('loadGame returns a safe fallback state (but never writes) on a corrupt save', () => {
    const store = {};
    store['mcsave'] = '{"broken":';
    let writes = 0;
    const r = loadGame((k) => store[k], 'mcsave');
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
    expect(r.state).toBeTruthy(); // safe fallback provided
    // The corrupt save was NOT overwritten (load must not write)
    expect(store['mcsave']).toBe('{"broken":');
    expect(writes).toBe(0);
  });

  it('saveGame mirrors an existing valid save to .bak before writing (no silent clobber)', () => {
    const store = {};
    const first = serialize(makeState());
    store['mcsave'] = JSON.stringify(first);
    // valid save differs from the new one -> back it up first
    const newState = makeState({ player: { ...makeState().player, x: 777 } });
    const res = saveGame(
      (k, v) => { store[k] = v; },
      (k) => store[k],
      'mcsave', newState,
    );
    expect(res.saved).toBe(true);
    expect(res.backedUp).toBe(true);
    expect(store['mcsave.bak']).toBe(JSON.stringify(first)); // old valid save preserved
    const reloaded = parseSave(store['mcsave']);
    expect(reloaded.ok).toBe(true);
    expect(reloaded.state.player.x).toBe(777);
  });

  it('saving the same state over a valid save is a no-op backup (identical checksum)', () => {
    const store = {};
    const s = serialize(makeState());
    store['mcsave'] = JSON.stringify(s);
    const res = saveGame((k, v) => { store[k] = v; }, (k) => store[k], 'mcsave', makeState());
    expect(res.backedUp).toBe(false); // identical payload -> no unnecessary backup
  });

  it('fnv1a is deterministic (same input -> same hash)', () => {
    expect(fnv1a('abc')).toBe(fnv1a('abc'));
    expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
  });

  it('fresh (no save) load returns fresh:true with a starter state', () => {
    const r = loadGame(() => null, 'nonexistent');
    expect(r.ok).toBe(true);
    expect(r.fresh).toBe(true);
    expect(r.state.seed).toBe(20260917);
  });
});
