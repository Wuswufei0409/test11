// W3 UI integration: crafting panel + recipe book, furnace smelting UI, and local save/load
// (C07/C08/C18). Attaches to the game handle returned by initGame(). Renders into the HUD DOM.

import { listRecipes, recipeMeta, getRecipe } from './recipes.js';
import { craftRecipe, craftFromGrid, canCraft } from './crafting.js';
import { Furnace, smeltResult, fuelSeconds } from './furnace.js';
import { itemId, itemDef, itemName } from './items.js';
import { countItem } from './inventory.js';
import { serialize, parseSave, loadGame, saveGame } from './save.js';

const PANEL_CSS = `
#w3-craft{position:absolute;top:90px;right:14px;width:330px;max-height:520px;overflow:auto;background:rgba(20,22,28,0.94);border:2px solid rgba(255,255,255,0.45);border-radius:6px;padding:10px;z-index:40;pointer-events:auto;font-size:12px}
#w3-craft h3{margin:0 0 6px;color:#ffd24a;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:4px}
#w3-craft .rec{padding:5px;border:1px solid rgba(255,255,255,0.15);margin-bottom:5px;border-radius:4px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:6px}
#w3-craft .rec.available{border-color:#6fd06f;background:rgba(111,208,111,0.12)}
#w3-craft .rec .meta{color:#9ab;font-size:10px}
#w3-craft .rec button{border:1px solid rgba(255,255,255,0.4);background:#3a4a3a;color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer}
#w3-craft .rec button:disabled{opacity:0.4;cursor:not-allowed}
#w3-craft .ing{color:#ccd}
#w3-furnace{position:absolute;top:90px;left:50%;transform:translateX(-50%);width:360px;background:rgba(20,22,28,0.95);border:2px solid rgba(255,255,255,0.45);border-radius:6px;padding:12px;z-index:40;pointer-events:auto;font-size:13px}
#w3-furnace h3{margin:0 0 6px;color:#ffd24a}
#w3-furnace .bar{height:12px;background:rgba(0,0,0,0.5);border:1px solid #555;border-radius:3px;margin:6px 0}
#w3-furnace .bar>div{height:100%;background:#ffa000}
#w3-furnace .burn{height:12px;background:rgba(0,0,0,0.5);border:1px solid #555;border-radius:3px;margin:6px 0}
#w3-furnace .burn>div{height:100%;background:#f55}
#w3-bars{position:absolute;top:8px;right:14px;display:flex;gap:8px;z-index:40}
#w3-bars button{border:1px solid rgba(255,255,255,0.5);background:rgba(30,34,42,0.9);color:#fff;border-radius:4px;padding:4px 10px;cursor:pointer;pointer-events:auto}
#w3-status{position:absolute;top:44px;right:14px;color:#ffd24a;font-size:12px;background:rgba(0,0,0,0.5);padding:3px 8px;border-radius:4px;display:none;z-index:40;pointer-events:none}
`;

export function installPanelsCss() {
  if (document.getElementById('w3-panels-css')) return;
  const s = document.createElement('style');
  s.id = 'w3-panels-css';
  s.textContent = PANEL_CSS;
  document.head.appendChild(s);
}

/** Collect the full world state snapshot for saving (C18). */
export function collectSnapshot(game) {
  const blocks = [];
  const { world } = game;
  // modified cells across loaded chunks (placed/broken by the player)
  for (const [k, c] of world.chunks) {
    const [cx, cz] = k.split(',').map(Number);
    if (!c.modified) continue;
    for (const idx of c.modified) {
      const y = Math.floor(idx / (16 * 16));
      const bz = Math.floor((idx % 256) / 16);
      const bx = idx % 16;
      blocks.push({ x: cx * 16 + bx, y, z: cz * 16 + bz, id: c.data[((y * 16) + bz) * 16 + bx] });
    }
  }
  const tiles = {};
  for (const [key, f] of (game.tileEntities || new Map())) {
    if (f.type === 'furnace') tiles[key] = { type: 'furnace', data: f.furnace.toJSON() };
    else tiles[key] = { type: 'chest', data: f.data };
  }
  const entities = (game.drops || []).map((d) => ({ id: d.itemId, count: d.count, x: d.pos.x, y: d.pos.y, z: d.pos.z }));
  return {
    seed: game.seed,
    player: { x: game.player.pos.x, y: game.player.pos.y, z: game.player.pos.z, yaw: game.player.yaw, pitch: game.player.pitch, health: game.player.health, food: game.player.food },
    inventory: game.inventory.map((s) => ({ id: s.id, count: s.count, durability: s.durability || 0 })),
    time: game.timeOfDay ?? 0,
    blocks, tiles, entities,
  };
}

/** Re-apply a saved world state into the live world (blocks + tiles + entities + inventory). */
export function applySnapshot(game, state) {
  const { world } = game;
  if (Array.isArray(state.blocks)) {
    for (const b of state.blocks) {
      if (world.getBlock(b.x, b.y, b.z) !== b.id) {
        world.setBlock(b.x, b.y, b.z, b.id);
      }
    }
    world.rebuildDirty();
  }
  // tile entities (furnaces)
  if (!game.tileEntities) game.tileEntities = new Map();
  for (const [key, t] of Object.entries(state.tiles || {})) {
    if (t.type === 'furnace') {
      const f = new Furnace();
      f.load(t.data);
      game.tileEntities.set(key, { type: 'furnace', furnace: f });
    } else {
      game.tileEntities.set(key, { type: 'chest', data: t.data });
    }
  }
  // inventory
  if (Array.isArray(state.inventory)) {
    for (let i = 0; i < game.inventory.length; i++) {
      const s = state.inventory[i];
      game.inventory[i] = s ? { id: s.id, count: s.count, durability: s.durability || 0 } : { id: 0, count: 0 };
    }
  }
  // player
  if (state.player) {
    Object.assign(game.player.pos, { x: state.player.x, y: state.player.y, z: state.player.z });
    game.player.health = state.player.health ?? 20;
    game.player.food = state.player.food ?? 20;
    game.player.yaw = state.player.yaw ?? 0;
  }
  if (typeof state.time === 'number') game.timeOfDay = state.time;
}

export function buildCraftingPanel(game, { onCraft }) {
  const el = document.createElement('div');
  el.id = 'w3-craft';
  el.style.display = 'none';
  const title = document.createElement('h3');
  title.textContent = 'Recipe Book (Crafting)';
  el.appendChild(title);
  const list = document.createElement('div');
  el.appendChild(list);
  document.body.appendChild(el);

  function render() {
    list.innerHTML = '';
    for (const r of listRecipes()) {
      const meta = recipeMeta(r.id);
      const row = document.createElement('div');
      row.className = 'rec';
      const id = itemId(r.output.item);
      const def = itemDef(r.id) || itemDef(itemName(id));
      row.innerHTML = `<div>
        <b>${r.output.item.replace(/_/g, ' ')}</b> <span class="meta">${meta.needsWorkbench ? '3x3' : '2x2'} · +${r.output.count}</span>
        <div class="ing">${meta.inputs.join(' + ')}</div>
      </div>
      <button data-recipe="${r.id}">Craft</button>`;
      row.querySelector('button').addEventListener('click', () => onCraft(r.id, render));
      row.classList.toggle('available', canCraft(game.inventory, getRecipe(r.id)));
      list.appendChild(row);
    }
  }
  render();
  return { el, render };
}

function canAfford(game, recipeId) {
  return canCraft(game.inventory, getRecipe(recipeId));
}

export function buildFurnaceUI(game) {
  const el = document.createElement('div');
  el.id = 'w3-furnace';
  el.style.display = 'none';
  let current = null; // tile
  el.innerHTML = `
    <h3>Furnace <span id="w3-furnace-pos"></span></h3>
    <div>Fuel: <span id="w3-furnace-fuel">–</span></div>
    <div>Input: <span id="w3-furnace-input">–</span></div>
    <div>Output: <span id="w3-furnace-output">–</span></div>
    <div class="burn"><div id="w3-furnace-burn" style="width:0%"></div></div>
    <div class="bar"><div id="w3-furnace-progress" style="width:0%"></div></div>
    <button id="w3-furnace-close" style="margin-top:6px;cursor:pointer">Close</button>`;
  document.body.appendChild(el);
  el.querySelector('#w3-furnace-close').addEventListener('click', () => { el.style.display = 'none'; });

  function refresh() {
    if (!current) return;
    const f = current.furnace;
    el.querySelector('#w3-furnace-fuel').textContent = f.fuel ? `${itemName(f.fuel.id)} x${f.fuel.count}` : '–';
    el.querySelector('#w3-furnace-input').textContent = f.input ? `${itemName(f.input.id)} x${f.input.count}` : '–';
    el.querySelector('#w3-furnace-output').textContent = f.output ? `${itemName(f.output.id)} x${f.output.count}` : '–';
    const burnPct = f.progressTotal ? Math.min(100, (f.progress / f.progressTotal) * 100) : 0;
    el.querySelector('#w3-furnace-progress').style.width = burnPct + '%';
  }

  function open(key, tile) {
    current = tile;
    el.querySelector('#w3-furnace-pos').textContent = key;
    el.style.display = 'block';
    refresh();
  }
  return { el, open, refresh };
}

export function buildSaveLoadUI(game, tokens, opts = {}) {
  const bar = document.createElement('div');
  bar.id = 'w3-bars';
  const craftBtn = opts.craftPanelEl ? `<button data-act="craft">Craft</button>` : '';
  bar.innerHTML = `
    ${craftBtn}
    <button data-act="save">Save</button>
    <button data-act="load">Load</button>
    <button data-act="new">New World</button>`;
  document.body.appendChild(bar);
  const status = document.createElement('div');
  status.id = 'w3-status';
  document.body.appendChild(status);

  function flash(msg) {
    status.textContent = msg;
    status.style.display = 'block';
    setTimeout(() => { status.style.display = 'none'; }, 2600);
  }

  bar.querySelector('[data-act=craft]')?.addEventListener('click', () => {
    opts.openCraft();
  });

  bar.querySelector('[data-act=save]').addEventListener('click', () => {
    const snap = collectSnapshot(game);
    const res = saveGame(tokens.set, tokens.get, tokens.key, snap);
    flash(res.backedUp ? `Saved (previous kept in .bak)` : `Saved ✓`);
  });
  bar.querySelector('[data-act=load]').addEventListener('click', () => {
    const r = loadGame(tokens.get, tokens.key);
    if (!r.ok) { flash(`LOAD ERROR: ${r.error}`); return; }
    if (r.fresh) { flash('No save found — new world'); return; }
    applySnapshot(game, r.state);
    flash('Loaded ✓ (world restored)');
  });
  bar.querySelector('[data-act=new]').addEventListener('click', () => {
    // clear the local save and reload a fresh world (no silent overwrite: explicit intent)
    tokens.set(tokens.key, '');
    location.reload();
  });
  return { flash };
}
