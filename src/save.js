// W3 local world save/load (C18): seed / position / inventory / time / modified blocks /
// chest-furnace tile state / entity key state. Deterministic checksum; corrupt saves report a
// clear error and fall back safely WITHOUT silently overwriting an existing valid save.

export const SAVE_VERSION = 3;

/** FNV-1a 32-bit hash of a string -> unsigned hex. */
export function fnv1a(str) {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function pick(o, keys) {
  const out = {};
  for (const k of keys) out[k] = o ? o[k] : undefined;
  return out;
}

/** Compute a checksum over the "payload" fields of a serialized save object. */
export function checksum(obj) {
  const payload = { ...obj };
  delete payload.checksum;
  return fnv1a(JSON.stringify(payload) + '|mc-save-v' + SAVE_VERSION);
}

/**
 * Build a serializable save object from a state snapshot.
 * snapshot: { seed, player{...}, inventory, time, blocks:[{x,y,z,id}], tiles:{key:{type,data}}, entities:[...] }
 */
export function serialize(snapshot) {
  const s = {
    version: SAVE_VERSION,
    seed: snapshot.seed,
    player: pick(snapshot.player, ['x', 'y', 'z', 'yaw', 'pitch', 'health', 'food']),
    inventory: snapshot.inventory || [],
    time: snapshot.time ?? 0,
    blocks: snapshot.blocks || [],
    tiles: snapshot.tiles || {},
    entities: snapshot.entities || [],
  };
  s.checksum = checksum(s);
  return s;
}

/**
 * Parse + validate a raw save string. Returns:
 *   { ok:true, state }            on success
 *   { ok:false, error:<reason> }  on any corruption / checksum mismatch
 */
export function parseSave(rawStr) {
  if (typeof rawStr !== 'string' || rawStr.trim() === '') {
    return { ok: false, error: 'corrupt/missing save: empty data' };
  }
  let obj;
  try {
    obj = JSON.parse(rawStr);
  } catch {
    return { ok: false, error: 'corrupt save: not valid JSON' };
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, error: 'corrupt save: not an object' };
  }
  if (typeof obj.version !== 'number' || obj.version > SAVE_VERSION) {
    return { ok: false, error: `unsupported save version ${obj.version}` };
  }
  if (typeof obj.seed !== 'number') {
    return { ok: false, error: 'corrupt save: missing/invalid seed' };
  }
  if (!obj.player || typeof obj.player.x !== 'number' || typeof obj.player.z !== 'number') {
    return { ok: false, error: 'corrupt save: missing player position' };
  }
  if (typeof obj.checksum !== 'string' || checksum(obj) !== obj.checksum) {
    return { ok: false, error: 'corrupt save: checksum mismatch (tampered or truncated)' };
  }
  return { ok: true, state: obj };
}

/**
 * Load a save through the provided storage getter. If corrupt, returns a clear error plus a
 * safe fallback (a fresh world state) — but NEVER writes/overwrites the existing save.
 */
export function loadGame(getFn, key = 'mcsave') {
  const raw = getFn(key);
  if (raw == null || raw === '') return { ok: true, fresh: true, state: fallbackState() };
  const r = parseSave(raw);
  if (!r.ok) {
    return { ok: false, fresh: false, error: r.error, state: fallbackState(r.lastGoodSeed) };
  }
  return { ok: true, fresh: false, state: r.state };
}

/** A safe starter state used as a fallback after a corrupt save is rejected. */
export function fallbackState(seed = 20260917) {
  return {
    version: SAVE_VERSION, seed,
    player: { x: 0, y: 96, z: 0, yaw: 0, pitch: 0, health: 20, food: 20 },
    inventory: [], time: 0, blocks: [], tiles: {}, entities: [],
  };
}

/**
 * Save state through storage setters. Refuses to silently clobber a valid existing save:
 * if the slot already holds valid data that differs, the previous save is first mirrored to
 * `<key>.bak` (not silently overwritten). Returns { saved, backedUp, slot }.
 */
export function saveGame(setFn, getFn, key, snapshot) {
  const next = serialize(snapshot);
  const existingRaw = getFn(key);
  let backedUp = false;
  if (existingRaw) {
    const ex = parseSave(existingRaw);
    if (ex.ok && ex.state.checksum !== next.checksum) {
      // valid previous save differs -> preserve it as .bak, then write new
      setFn(key + '.bak', existingRaw);
      backedUp = true;
    }
    // If existing is corrupt we still proceed to write a fresh save (nothing valid to lose),
    // but we do not delete a .bak that already exists.
  }
  setFn(key, JSON.stringify(next));
  return { saved: true, backedUp, slot: key, checksum: next.checksum };
}

// ---- Browser storage adapters (used by game.js when running in a real page) ----
export const localStorageAdapter = {
  get: (k) => { try { return window.localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { window.localStorage.setItem(k, v); } catch {} },
};
