// Game bootstrap: world + player + input + raycast block interaction + hand item + main loop.

import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { createRenderer, onResize } from './renderer.js';
import { buildHUD, HUD_CSS } from './hud.js';
import { buildAtlas, buildSprite } from './textures.js';
import { blockDef, blockId, isSolid, isFluid, BLOCKS } from './blocks.js';
import { SEA_LEVEL, columnInfo, findSafeSpawn } from './worldgen.js';
import { createInventory, addItem, removeItem, countItem, moveStack, splitStack, dropAll, HOTBAR, SLOTS } from './inventory.js';
import { mineTime as mineTimeFor } from './mining.js';
import { dropsFor as toolDropsFor, mineSeconds as toolMineSeconds, useDurability, canHarvest } from './tools.js';
import { getRecipe, listRecipes, recipeMeta } from './recipes.js';
import { craftRecipe as craftOne } from './crafting.js';
import { Furnace, fuelSeconds, smeltResult } from './furnace.js';
import { buildCraftingPanel, buildFurnaceUI, buildSaveLoadUI, collectSnapshot, applySnapshot, installPanelsCss } from './w3_panels.js';
import { loadGame, saveGame, localStorageAdapter } from './save.js';
import { itemId, itemName } from './items.js';

export function initGame({ seed }) {
  const container = document.getElementById('app');
  const { renderer, scene, camera, meshGroup } = createRenderer(container);

  const atlas = buildAtlas(THREE, seed);
  const world = new World(seed, THREE);
  world.atlas = atlas;
  world.meshGroup = meshGroup;

  // spawn on safe land near origin (robust: origin may be in an ocean basin)
  const spawn = findSafeSpawn(seed);

  const player = new Player(world, spawn);
  // mild downward pitch: frame sky over low voxel terrain AND keep a reachable non-water block
  // in the crosshair so the first-person label is visible (C02); avoids pointing up into fog.
  player.pitch = 0.35;
  const hud = buildHUD();
  hud.setSeed(seed);

  const style = document.createElement('style');
  style.textContent = HUD_CSS;
  document.head.appendChild(style);

  // inventory: 36 slots (9 hotbar + 27 storage), all empty; block/color matches for display
  const inventory = createInventory();
  const blockColor = (id) => { const d = blockDef(id); return d ? `rgb(${d.side})` : 'transparent'; };
  // seed a few starter blocks into the hotbar so the loop is immediately usable (C05/C06)
  const starters = BLOCKS.filter((b) => b.solid && b.hardness >= 0).slice(0, 9);
  starters.forEach((b, i) => { inventory[i] = { id: b.id, count: 5, color: blockColor(b.id) }; });

  // menu overlay / pointer lock
  const overlay = document.createElement('div');
  overlay.id = 'menu-overlay';
  overlay.innerHTML = `<div class="inner"><h1>test11 — Voxel Sandbox (W2 controls+interaction)</h1>
    <p>Non-official experiment inspired by Minecraft Bedrock 1.4.2 (Update Aquatic phase 1).</p>
    <p>WASD move · Space jump · Shift sneak/sprint-down · Ctrl sprint · Mouse look · swim in water</p>
    <p>Hold left-click mine (by hardness) · Right-click place · 1-9 hotbar · E inventory</p>
    <p style="color:#ffd24a">Click to start</p></div>`;
  document.body.appendChild(overlay);
  const lockMouse = () => renderer.domElement.requestPointerLock();
  overlay.addEventListener('click', lockMouse);

  let selected = 0;
  const select = (i) => { selected = ((i % 9) + 9) % 9; hud.selectSlot(selected); };

  // ---- W3: block-tile entities (furnaces), time-of-day, W3 panels ----
  const tileEntities = new Map(); // "x,y,z" -> { type:'furnace', furnace: Furnace }
  let timeOfDay = 0;
  let furnaceUIEl = null;
  let craftPanel = null;
  installPanelsCss();
  const saveTokens = {
    key: 'mcsave',
    get: (k) => localStorageAdapter.get(k),
    set: (k, v) => localStorageAdapter.set(k, v),
  };
  // Tool-aware helper for the currently selected hand item.
  const selectedTool = () => {
    const st = inventory[selected];
    if (st && st.id !== 0) return st;
    return null;
  };

  // raycast-voxel (DDA)
  function raycast(origin, dir, maxDist = 6) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = Math.abs(1 / (dir.x || 1e-9));
    const tDeltaY = Math.abs(1 / (dir.y || 1e-9));
    const tDeltaZ = Math.abs(1 / (dir.z || 1e-9));
    let tMaxX = dir.x !== 0 ? ((dir.x > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX) : Infinity;
    let tMaxY = dir.y !== 0 ? ((dir.y > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY) : Infinity;
    let tMaxZ = dir.z !== 0 ? ((dir.z > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ) : Infinity;
    let prevX = x, prevY = y, prevZ = z;
    let t = 0;
    const EPS = 1e-6;
    const seen = new Set();
    while (t <= maxDist) {
      const key = `${x},${y},${z}`;
      if (!seen.has(key)) {
        seen.add(key);
        const blk = world.getBlock(x, y, z);
        if (blk !== 0) {
          return { block: { x, y, z, id: blk, name: blockDef(blk).name }, prev: { x: prevX, y: prevY, z: prevZ }, dist: t };
        }
      }
      prevX = x; prevY = y; prevZ = z;
      if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; }
      else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; }
    }
    return null;
  }

  // hand item mesh
  const handTex = buildSprite(THREE, inventory[0].id, seed);
  const handMat = new THREE.MeshLambertMaterial({ map: handTex, transparent: true });
  const handGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  const hand = new THREE.Mesh(handGeo, handMat);
  hand.position.set(0.65, -0.45, -0.8);
  camera.add(hand);
  scene.add(camera);

  // block highlight box
  const hlGeo = new THREE.BoxGeometry(1.001, 1.001, 1.001);
  const hlMat = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true });
  const highlight = new THREE.Mesh(hlGeo, hlMat);
  highlight.visible = false;
  scene.add(highlight);

  // input
  const keys = player.keys;
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'ShiftLeft') { player.sneaking = true; player.sprinting = false; }
    if (e.code === 'KeyW' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); }
    if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= 9) select(n - 1); }
    if (e.code === 'KeyE') { toggleInventory(); }
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'ShiftLeft') { player.sneaking = false; }
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === renderer.domElement) {
      player.yaw -= e.movementX * 0.0022;
      player.pitch -= e.movementY * 0.0022;
      player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch));
    }
  });
  // ---- drop-item entities (C05) ----
  const drops = []; // { mesh, itemId, count, pos, vel }
  const DROP_LIFETIME = 150; // seconds
  function spawnDrop(itemId, count, x, y, z) {
    if (!count || count <= 0) return;
    const size = 0.2;
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(...blockColor3(itemId)) });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    scene.add(m);
    drops.push({ mesh: m, itemId, count, pos: { x, y, z }, vel: { x: (Math.random() - 0.5) * 1.5, y: 2, z: (Math.random() - 0.5) * 1.5 }, life: DROP_LIFETIME });
  }
  function blockColor3(id) {
    const d = blockDef(id);
    if (!d) return [1, 1, 1];
    const [r, g, b] = d.side;
    return [r / 255, g / 255, b / 255];
  }
  function updateDrops(dt) {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.life -= dt;
      if (d.life <= 0) { scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); drops.splice(i, 1); continue; }
      d.vel.y -= 22 * dt;
      d.pos.x += d.vel.x * dt; d.pos.y += d.vel.y * dt; d.pos.z += d.vel.z * dt;
      // land on solid ground
      if (d.vel.y < 0 && world.getBlock(Math.floor(d.pos.x), Math.floor(d.pos.y - 0.1), Math.floor(d.pos.z))) {
        d.vel.y = 0; d.pos.y = Math.floor(d.pos.y) + 0.15;
        d.vel.x *= 0.8; d.vel.z *= 0.8;
      }
      d.mesh.position.set(d.pos.x, d.pos.y, d.pos.z);
      // pickup when the player walks within reach (C05 掉落拾取)
      const dx = d.pos.x - player.pos.x, dy = d.pos.y - (player.pos.y + 1.0), dz = d.pos.z - player.pos.z;
      if (dx * dx + dy * dy + dz * dz < 2.5) {
        const before = countItem(inventory, d.itemId);
        const room = inventory.some((s) => (s.id === 0) || (s.id === d.itemId && s.count < 64));
        if (room) {
          const addedAny = addItem(inventory, d.itemId, d.count);
          if (addedAny > 0) {
            scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); drops.splice(i, 1);
          }
        }
      }
    }
  }

  // hardness-based mining state
  let miningBlock = null, miningProgress = 0;
  const MAX_REACH = 5;
  const mineTime = mineTimeFor;

  document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    const dir = player.forward();
    const eye = { x: player.pos.x, y: player.pos.y + 1.62, z: player.pos.z };
    const hit = raycast(eye, dir);
    if (e.button === 0) {
      if (hit && hit.dist <= MAX_REACH) {
        const id = world.getBlock(hit.block.x, hit.block.y, hit.block.z);
        if (id !== 0 && blockDef(id).hardness >= 0) {
          miningBlock = { x: hit.block.x, y: hit.block.y, z: hit.block.z, id };
          miningProgress = 0;
        }
      }
    } else if (e.button === 2 && hit && hit.dist < 5) {
      const st = inventory[selected];
      if (st && st.id !== 0 && st.count > 0) {
        const px = hit.prev.x, py = hit.prev.y, pz = hit.prev.z;
        const target = world.getBlock(px, py, pz);
        const ox = Math.abs(px - Math.floor(player.pos.x)) <= 1 && Math.abs(py - Math.floor(player.pos.y)) <= 2 && Math.abs(pz - Math.floor(player.pos.z)) <= 1;
        if (target === 0 && !ox) {
          const placed = world.setBlock(px, py, pz, st.id);
          if (placed) {
            st.count--;
            if (st.id === blockId('furnace')) {
              tileEntities.set(`${px},${py},${pz}`, { type: 'furnace', furnace: new Furnace() });
            }
          }
          if (st.count <= 0) { st.id = 0; st.count = 0; }
        }
      }
    }
  });
  document.addEventListener('mouseup', () => { miningBlock = null; miningProgress = 0; });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    overlay.style.display = document.pointerLockElement === renderer.domElement ? 'none' : 'flex';
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    overlay.style.display = document.pointerLockElement === renderer.domElement ? 'none' : 'flex';
  });

  // ---- inventory panel UI (C06: 背包堆叠/拆分/交换) ----
  const invPanel = hud.invPanel();
  let invOpen = false;
  let panelRender = () => {};
  function renderInventory() {
    invPanel.innerHTML = '<div class="inv-title">Inventory (E to close, click move · right-click split)</div>';
    for (let r = 0; r < 4; r++) { // 4 rows x 9 = 36 slots
      const row = document.createElement('div'); row.className = 'row';
      for (let c = 0; c < 9; c++) {
        const i = r * 9 + c;
        const cell = document.createElement('div');
        cell.className = 'inv-slot';
        const st = inventory[i];
        if (st && st.id !== 0 && st.count > 0) {
          cell.classList.add('has');
          cell.innerHTML = `<span class="ic" style="background:${blockColor(st.id)}"></span><span class="ct">${st.count}</span><span class="idx">${i < HOTBAR ? 'H' + (i + 1) : i}</span>`;
        } else {
          cell.innerHTML = `<span class="idx">${i < HOTBAR ? 'H' + (i + 1) : i}</span>`;
        }
        cell.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          if (ev.button === 2) {
            // split half into the selected hotbar slot (or first empty)
            const target = inventory.findIndex((s, k) => s !== st && (s.id === 0));
            const to = target >= 0 ? target : selected;
            splitStack(inventory, i, to);
            renderInventory();
          } else if (ev.button === 0) {
            // swap with the selected hotbar slot (拾取/交换)
            moveStack(inventory, i, selected);
            renderInventory();
          }
        });
        row.appendChild(cell);
      }
      invPanel.appendChild(row);
    }
  }
  panelRender = renderInventory;
  function toggleInventory() {
    invOpen = !invOpen;
    invPanel.style.display = invOpen ? 'block' : 'none';
    renderInventory();
    if (invOpen) document.exitPointerLock();
  }

  // per-frame state
  let last = performance.now();
  let fpsAcc = 0, fpsFrames = 0, fpsVal = 60;
  let highlightTarget = null;

  function loop() {
    if (window.__GAME_PAUSED__) return; // freeze for evidence capture
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    player.sprinting = keys['ControlLeft'] && !keys['ShiftLeft'] && !player.inFluid();
    // load/stream chunks BEFORE physics so the player never moves into unloaded void
    world.updateAround(player.pos.x, player.pos.z);
    world.rebuildDirty();
    player.update(dt);

    // death drops (C06): dropping inventory as world items, then respawning at spawn
    if (player.health <= 0) {
      const dropped = dropAll(inventory);
      for (const [idv, cnt] of Object.entries(dropped)) spawnDrop(+idv, cnt, player.pos.x, player.pos.y + 1.5, player.pos.z);
      player.health = 20; player.food = 20;
      player.pos.x = spawn.x; player.pos.y = spawn.y + 2; player.pos.z = spawn.z;
      player.vel.x = 0; player.vel.y = 0; player.vel.z = 0;
      renderInventory();
    }

    camera.position.set(player.pos.x, player.pos.y + 1.62, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0);

    // tool-aware mining tick (hold to break; uses tool speed/durability and ore drops - C08)
    if (miningBlock) {
      const cur = world.getBlock(miningBlock.x, miningBlock.y, miningBlock.z);
      if (cur === 0 || cur !== miningBlock.id) { miningBlock = null; miningProgress = 0; }
      else {
        const toolStack = selectedTool();
        const toolName = toolStack ? itemName(toolStack.id) : null;
        const mt = toolMineSeconds(cur, toolName);
        if (mt !== Infinity) {
          miningProgress += dt;
          if (miningProgress >= mt) {
            const bx = miningBlock.x, by = miningBlock.y, bz = miningBlock.z;
            world.setBlock(bx, by, bz, 0);
            tileEntities.delete(`${bx},${by},${bz}`); // furnace/chest tile removed with block
            // drops honour the tool: raw ores only with the correct tool+tier (C08)
            const toolId = toolStack ? toolStack.id : null;
            const dropList = toolDropsFor(cur, toolId ? itemName(toolId) : null);
            if (dropList.length === 0) {
              // wrong tool / wrong tier — no drop (C08 error-tool restriction)
            }
            for (const dl of dropList) {
              spawnDrop(dl.id, dl.count, bx + 0.5, by + 0.5, bz + 0.5);
            }
            if (toolStack) useDurability(toolStack); // tool durability (C08)
            miningBlock = null; miningProgress = 0;
          }
        }
      }
    }
    // tick furnace tiles (smelting progresses over time - C08)
    for (const tile of tileEntities.values()) {
      if (tile.type === 'furnace') tile.furnace.tick(dt);
    }
    furnaceUIEl && furnaceUIEl.refresh();
    updateDrops(dt);

    // block highlight + label
    const dir = player.forward();
    const eye = { x: player.pos.x, y: player.pos.y + 1.62, z: player.pos.z };
    const hit = raycast(eye, dir);
    if (hit && hit.dist < 5) {
      highlight.visible = true;
      highlight.position.set(hit.block.x + 0.5, hit.block.y + 0.5, hit.block.z + 0.5);
      const name = blockDef(hit.block.id).name;
      if (!highlightTarget || highlightTarget.x !== hit.block.x || highlightTarget.y !== hit.block.y || highlightTarget.z !== hit.block.z) {
        highlightTarget = hit.block;
        hud.setBlock(name);
      }
    } else {
      highlight.visible = false;
      hud.setBlock('');
    }

    // hand sway
    hand.rotation.x = Math.sin(now * 0.004) * 0.03;
    hand.rotation.y += 0.01;

    hud.setCoords(player.pos);
    hud.setStats && hud.setStats(player);
    hud.setHotbar(inventory, selected);
    hud.setHearts(player.health);
    hud.setFood(player.food);
    // mining progress indicator (crack overlay text)
    if (miningBlock) {
      const mt = mineTime(world.getBlock(miningBlock.x, miningBlock.y, miningBlock.z));
      const frac = mt === Infinity ? 0 : Math.min(1, miningProgress / mt);
      hud.setMining(frac, miningBlock ? true : false);
    } else hud.setMining(0, false);

    fpsAcc += dt; fpsFrames++;
    if (fpsAcc >= 0.5) { fpsVal = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }
    hud.setFps(fpsVal);

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => onResize(renderer, camera, container));

  // ---- W3: define the game handle, then build panels against it ----
  const gameHandle = {
    world, player, scene, camera, renderer, select, spawn,
    inventory, hand, meshGroup, drops, seed,
    tileEntities, timeOfDay,
    setBlock(wx, wy, wz, idv) { return world.setBlock(wx, wy, wz, idv); },
    getBlock(wx, wy, wz) { return world.getBlock(wx, wy, wz); },
    toggleInventory, renderInventory,
    openCraft: null, craftPanel: null, furnaceUI: null, saveLoadUI: null,
    craft(recipeId) { return craftOne(this.inventory, getRecipe(recipeId)); },
    give(name, count) { return addItem(this.inventory, itemId(name), count); },
    placeFurnace(x, y, z) {
      this.setBlock(x, y, z, blockId('furnace'));
      const f = new Furnace();
      this.tileEntities.set(`${x},${y},${z}`, { type: 'furnace', furnace: f });
      return f;
    },
    openFurnaceTile(key) {
      const tile = this.tileEntities.get(key);
      if (tile && this.furnaceUI) this.furnaceUI.open(key, tile);
      return !!tile;
    },
    demoSmelt() {
      const f = new Furnace();
      f.input = { id: itemId('iron_ore_raw'), count: 1 };
      f.fuel = { id: itemId('coal'), count: 1 };
      for (let t = 0; t < 120; t += 0.1) f.tick(0.1);
      return { input: f.input, output: f.output, lit: f.isLit };
    },
    itemId: (n) => itemId(n),
    getSnapshot() { return collectSnapshot(this); },
    applySnapshot(s) { return applySnapshot(this, s); },
    save() { return saveGame(saveTokens.set, saveTokens.get, saveTokens.key, collectSnapshot(this)); },
    load() { const r = loadGame(saveTokens.get, saveTokens.key); if (r.ok && !r.fresh) { applySnapshot(this, r.state); } return r; },
    doesSaveExist() { const raw = saveTokens.get(saveTokens.key); return !!raw; },
    rawSave() { return saveTokens.get(saveTokens.key); },
    autoSave: () => autoSave(),
  };
  const openCraft = () => {
    if (!gameHandle.craftPanel) return;
    const el = gameHandle.craftPanel.el;
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
    gameHandle.craftPanel.render();
  };
  gameHandle.craftPanel = buildCraftingPanel(gameHandle, {
    onCraft: (recipeId) => {
      const r = craftOne(gameHandle.inventory, getRecipe(recipeId));
      hud.setHotbar(gameHandle.inventory, selected);
      if (gameHandle.renderInventory) gameHandle.renderInventory();
      gameHandle.craftPanel.render();
      return r;
    },
  });
  gameHandle.furnaceUI = buildFurnaceUI(gameHandle);
  furnaceUIEl = gameHandle.furnaceUI;
  gameHandle.saveLoadUI = buildSaveLoadUI(gameHandle, saveTokens, { craftPanelEl: gameHandle.craftPanel.el, openCraft });
  gameHandle.openCraft = openCraft;

  // boot-time load: continue a previously saved world (C18 关页重开可继续)
  const boot = loadGame(saveTokens.get, saveTokens.key);
  if (boot.ok && !boot.fresh) {
    applySnapshot(gameHandle, boot.state);
  }
  // auto-save every 10s and on page close (never silent: back-ups a differing valid save)
  let lastAuto = (Date.now() / 1000) | 0;
  const autoSave = () => {
    const now = (Date.now() / 1000) | 0;
    if (now - lastAuto >= 10) { lastAuto = now; saveGame(saveTokens.set, saveTokens.get, saveTokens.key, collectSnapshot(gameHandle)); }
  };
  window.addEventListener('beforeunload', () => {
    try { saveGame(saveTokens.set, saveTokens.get, saveTokens.key, collectSnapshot(gameHandle)); } catch {}
  });

  requestAnimationFrame(() => { autoSave(); });
  requestAnimationFrame(loop);
  return gameHandle;
}
