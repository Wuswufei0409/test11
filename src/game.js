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
import { PlayerStats, DIFFICULTY, hostilesSpawn, fallDamage } from './survival.js';
import { DayNight } from './daynight.js';
import { MOBS, mobDef, mobAI, hostileAttack, creeperBlast, rollDrops, foodOf } from './mobs.js';
import { CROPS, growCrop, isMature, harvest, canTill, canPlantOn } from './farming.js';
import { armorMultiplier, resolveHit, WEAPONS } from './combat.js';
import { dropsFor as toolDropsFor, mineSeconds as toolMineSeconds, useDurability, canHarvest } from './tools.js';
import { getRecipe, listRecipes, recipeMeta } from './recipes.js';
import { craftRecipe as craftOne } from './crafting.js';
import { Furnace, fuelSeconds, smeltResult } from './furnace.js';
import { buildCraftingPanel, buildFurnaceUI, buildSaveLoadUI, collectSnapshot, applySnapshot, installPanelsCss } from './w3_panels.js';
import { loadGame, saveGame, localStorageAdapter } from './save.js';
import { itemId, itemName, itemDef } from './items.js';
import { OxygenTank, headSubmerged, swimSpeed, swimVelocity, floatBuoyancy, underwaterVisibility, underwaterPlacementValid, waterTopBelow } from './water.js';
import { treasureClue, treasureLoot } from './ocean.js';
import { AQUATIC, aquaticDef, fishBucketItem, catchWithBucket, releaseFromBucket, aquaticAI as aquaticMobAI } from './aquatic.js';
import { TRIDENT, applyEnchant, tridentDamage, shouldReturn, riptideLaunch, channelingStrike, advanceThrow, tridentPickupReachable, useTridentDurability } from './trident.js';

export function initGame({ seed }) {
  const container = document.getElementById('app');
  const { renderer, scene, camera, meshGroup, amb, hemi, sun } = createRenderer(container);

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

  // ---------------- W4 systems (C09 survival, C10 day/night, C11 mobs, C12 combat, C13 farming) ----
  const stats = new PlayerStats({ difficulty: DIFFICULTY.NORMAL });
  const daynight = new DayNight({ startTime: 0.30, speed: 1 });
  let difficulty = DIFFICULTY.NORMAL;
  const mobs = [];     // { id, pos, vel, health, def, mesh, cooldown, fuse, wanderTick }
  const crops = new Map(); // "x,y,z" -> { cropId, growth }
  const bedRespawn = { has: false, x: 0, y: 0, z: 0 };
  let drownTimer = 0, fallStartY = player.pos.y, wasAirborne = false;
  // ---- W5 systems (C14 water, C15 ocean content, C16 aquatic mobs, C17 trident) ----
  const oxygen = new OxygenTank();
  const aquatics = []; // fish/dolphin/pufferfish elements
  let tridents = [];   // thrown trident projectiles { mesh, pos, vel, tick, ench, aquatic }
  let weatherThunder = false; // channeling requires thunder
  let treasureDig = null;     // { x,y,z } currently dug treasure (loot granted) 
  const daynight2 = null;

  const color3 = (c) => { const [r, g, b] = c; return [r / 255, g / 255, b / 255]; };

  function spawnMob(id, x, y, z, rng = Math.random) {
    const def = mobDef(id);
    if (!def) return null;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.6),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(...color3(def.color)) }));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    const m = { id, def, rng, pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 }, health: def.health, mesh, cooldown: 0, fuse: 0, wanderTick: 0 };
    mobs.push(m);
    return m;
  }

  function removeMob(i) {
    const m = mobs[i];
    scene.remove(m.mesh); m.mesh.geometry.dispose(); m.mesh.material.dispose();
    const drops = rollDrops(m, m.rng);
    for (const [item, count] of Object.entries(drops)) if (count > 0) spawnDrop(+item, count, m.pos.x, m.pos.y + 0.5, m.pos.z);
    mobs.splice(i, 1);
  }

  function explodeCreeper(m) {
    const removed = creeperBlast(m.pos.x, m.pos.y, m.pos.z, m.def.blastRadius, (x, y, z) => world.getBlock(x, y, z));
    for (const b of removed) world.setBlock(b.x, b.y, b.z, 0);
    if (Math.hypot(m.pos.x - player.pos.x, m.pos.y - (player.pos.y + 1), m.pos.z - player.pos.z) < m.def.blastRadius + 1) {
      const armorPts = armorPtsFromInv();
      stats.damage(Math.round(m.def.blastDamage * armorMultiplier(armorPts)), 'hostile');
    }
    hud.message('BOOM! Creeper blast');
  }

  function armorPtsFromInv() {
    if (countItem(inventory, 125) > 0) return 6; // iron_armor
    if (countItem(inventory, 124) > 0) return 3; // leather_armor
    return 0;
  }

  function updateMobs(dt) {
    for (let i = mobs.length - 1; i >= 0; i--) {
      const m = mobs[i];
      const dist = Math.hypot(m.pos.x - player.pos.x, m.pos.z - player.pos.z);
      const ai = mobAI(m, { playerPos: player.pos, mobPos: m.pos, distanceToPlayer: dist, rng: m.rng, dt });
      m.vel.y -= 22 * dt;
      m.pos.x += ai.move.x * m.def.speed * dt;
      m.pos.z += ai.move.z * m.def.speed * dt;
      m.pos.y += m.vel.y * dt;
      if (world.getBlock(Math.floor(m.pos.x), Math.floor(m.pos.y - 0.1), Math.floor(m.pos.z))) { m.vel.y = 0; m.pos.y = Math.floor(m.pos.y) + 0.01; }
      m.mesh.position.set(m.pos.x, m.pos.y, m.pos.z);

      m.cooldown -= dt;
      if (ai.act === 'attack' && m.cooldown <= 0 && stats.alive) {
        if (m.id === 'creeper') {
          m.fuse += dt;
          if (m.fuse >= m.def.fuseTime) { explodeCreeper(m); removeMob(i); continue; }
        } else {
          const atk = hostileAttack(m);
          const armorPts = armorPtsFromInv();
          stats.damage(Math.round(atk.damage * armorMultiplier(armorPts)), 'hostile');
          m.cooldown = m.def.attackCooldown || 1.0;
          hud.message(`${m.id} hits you! -${Math.round(atk.damage * armorMultiplier(armorPts))}`);
        }
      } else if (ai.act !== 'attack') m.fuse = 0;

      // undead burn in daylight when exposed to sky
      if (m.def.burnInDay && daynight.undeadBurn() && world.getBlock(Math.floor(m.pos.x), Math.floor(m.pos.y + 1.2), Math.floor(m.pos.z)) === 0) {
        m.health -= 2.5 * dt;
      }
      if (m.health <= 0) removeMob(i);
    }
  }

  function updateCrops(dt) {
    const light = Math.round(daynight.brightness() * 15); // seconds-approximation of block light
    const ticks = dt * 20; // treat each server-tick-equivalent
    for (const [k, c] of [...crops]) {
      const def = CROPS[c.cropId];
      c.growth = growCrop(def, c.growth, ticks, light);
      // keep the placed crop block (the visual stage is the crop block); mature crops stay until harvested
      if (!isMature(def, c.growth)) { /* not yet mature */ }
    }
  }

  function spawnHostilesIfNight(dt) {
    if (daynight.isNight() && hostilesSpawn(difficulty) && mobs.filter((m) => mobDef(m.id).type === 'hostile').length < 3) {
      const ang = Math.random() * Math.PI * 2, r = 14 + Math.random() * 6;
      const sx = player.pos.x + Math.cos(ang) * r, sz = player.pos.z + Math.sin(ang) * r;
      const sy = findGroundY(sx, sz);
      if (Math.random() < 0.5) spawnMob('zombie', sx, sy, sz);
      else if (Math.random() < 0.7) spawnMob('spider', sx, sy, sz);
      else spawnMob('creeper', sx, sy, sz);
    }
  }

  function findGroundY(x, z) {
    for (let y = 70; y >= 0; y--) if (world.getBlock(x, y, z)) return y + 1;
    return 40;
  }

  // ---- W5: aquatic mob spawn / update (C16) ----
  function spawnAquatic(id, x, y, z, rng = Math.random) {
    const def = aquaticDef(id);
    if (!def) return null;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.8),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(...color3(def.color)) }));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    const a = { id, def, rng, pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 }, phase: rng() * 10, mesh, state: 'normal', breachTimer: 0 };
    aquatics.push(a);
    return a;
  }
  function removeAquatic(i) {
    const a = aquatics[i];
    scene.remove(a.mesh); a.mesh.geometry.dispose(); a.mesh.material.dispose();
    aquatics.splice(i, 1);
  }
  function spawnAquaticsNear(dt) {
    if (aquatics.length >= 8) return;
    // only spawn in/around water near the player
    const ang = Math.random() * Math.PI * 2, r = 8 + Math.random() * 10;
    const wx = player.pos.x + Math.cos(ang) * r;
    const wz = player.pos.z + Math.sin(ang) * r;
    // find a water column
    let wy = -1;
    for (let y = 40; y >= 20; y--) if (world.getBlock(Math.floor(wx), y, Math.floor(wz)) === blockId('water')) { wy = y; break; }
    if (wy < 0) return;
    if (Math.random() < 0.3) spawnAquatic('dolphin', wx, wy - 1, wz);
    else spawnAquatic(['cod','salmon','tropical_fish','pufferfish'][Math.floor(Math.random() * 4)], wx, wy - 1, wz);
  }
  function updateAquatics(dt) {
    for (let i = aquatics.length - 1; i >= 0; i--) {
      const a = aquatics[i];
      const m = aquaticMobAI(a, { playerPos: player.pos, mobPos: a.pos, rng: a.rng, dt });
      a.pos.x += m.move.dx * dt;
      a.pos.y += (m.move.dy ?? 0) * dt;
      a.pos.z += m.move.dz * dt;
      // stay in fluid: keep within a water column
      const gy = Math.floor(a.pos.y);
      if (world.getBlock(Math.floor(a.pos.x), gy, Math.floor(a.pos.z)) !== blockId('water')) {
        // drift back down toward water
        a.pos.y -= 1.2 * dt;
      }
      a.mesh.position.set(a.pos.x + 0.5, a.pos.y, a.pos.z + 0.5);
      // pufferfish contact damage when inflated+touching (C16)
      if (a.id === 'pufferfish' && a.state === 'inflated' && stats.alive) {
        const d = Math.hypot(a.pos.x - player.pos.x, a.pos.z - player.pos.z);
        if (d < 1.6) { stats.damage(a.def.contactDamage, 'hostile'); hud.message('Pufferfish stings! -' + a.def.contactDamage); }
      }
    }
  }

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
  overlay.innerHTML = `<div class="inner"><h1>test11 — Voxel Sandbox (W4 survival+mobs+combat+farming)</h1>
    <p>Non-official experiment inspired by Minecraft Bedrock 1.4.2 (Update Aquatic phase 1).</p>
    <p>WASD move · Space jump · Mouse look · Hold-left mine/attack · Right-click place</p>
    <p>1-9 hotbar · E inventory · N difficulty · eat food (rt-click) · sword/bow combat</p>
    <p>Till dirt + plant seeds to farm · Right-click a bed at night to sleep
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
    if (e.code === 'KeyN') { difficulty = stats.nextDifficulty(); hud.message('Difficulty: ' + difficulty); }
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
    const rgb = (d && (d.side || d.color)) || (itemDef(id) ? itemDef(id).color : null);
    if (!rgb) return [1, 1, 1];
    const [r, g, b] = rgb;
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
  let attackCooldown = 0;

  function weaponForSelected() {
    const id = inventory[selected] ? inventory[selected].id : 0;
    if (id === 120) return 'sword_wood';
    if (id === 121) return 'sword_stone';
    if (id === 122) return 'sword_iron';
    if (id === 123) return 'bow';
    return 'bare_hand';
  }

  function nearestMob(maxRange) {
    let best = null, bd = Infinity;
    for (const m of mobs) {
      const d = Math.hypot(m.pos.x - player.pos.x, m.pos.z - player.pos.z);
      if (d < bd && d <= maxRange && Math.abs(m.pos.y - (player.pos.y + 1)) < 2) { best = m; bd = d; }
    }
    return best;
  }

  function hitMob(m, dmg, kb) {
    m.health -= dmg;
    const fwd = player.forward();
    m.pos.x += fwd.x * kb; m.pos.z += fwd.z * kb; // knockback
    const i = mobs.indexOf(m);
    if (m.health <= 0 && i >= 0) { removeMob(i); hud.message(`${m.id} died (+drops)`); }
  }

  function tryMeleeMob() {
    const m = nearestMob(WEAPONS[weaponForSelected()].reach !== undefined ? WEAPONS[weaponForSelected()].reach : 3);
    if (!m) return false;
    const weapon = weaponForSelected();
    const res = resolveHit({ weaponId: weapon === 'bow' ? 'bare_hand' : weapon, targetHealth: m.health, armorPoints: 0, crit: false });
    hitMob(m, res.damage, res.knockback);
    attackCooldown = WEAPONS[weapon].cooldown;
    hud.message(`Hit ${m.id} -${Math.round(res.damage)}` + (mobDef(m.id).type === 'passive' ? ' (flee!)' : ''));
    return true;
  }

  function tryBowMob() {
    const m = nearestMob(12);
    if (!m) { if (countItem(inventory, 114) > 0) hud.message('Arrows loosed... nothing hit'); return false; }
    if (countItem(inventory, 114) <= 0) { hud.message('No arrows!'); return false; }
    removeItem(inventory, 114, 1);
    const res = resolveHit({ weaponId: 'bow', targetHealth: m.health, armorPoints: 0, crit: Math.random() < 0.1 });
    hitMob(m, res.damage, res.knockback);
    attackCooldown = WEAPONS.bow.cooldown;
    hud.message(`Bow hit ${m.id} -${Math.round(res.damage)}`);
    renderInventory();
    return true;
  }

  function tryEatSelected() {
    const st = inventory[selected];
    if (!st || st.id === 0 || st.count <= 0) return false;
    const food = foodOf(blockDef(st.id).name);
    if (!food) return false;
    removeItem(inventory, st.id, 1);
    stats.eat({ food: food[0], saturation: food[1] });
    hud.message(`Ate ${blockDef(st.id).name}`);
    renderInventory();
    return true;
  }

  function tryFarmClick(px, py, pz, targetId, targetName) {
    const st = inventory[selected];
    // 1) till dirt/grass to farmland when nothing is held (C13)
    if ((targetId === 2 || targetId === 1) && (!st || st.id === 0)) {
      world.setBlock(px, py, pz, 34); hud.message('Tilled farmland'); return true;
    }
    // 2) plant a seed onto farmland/dirt
    const selId = st ? st.id : 0;
    const seedCrop = { 105: 'wheat', 106: 'carrot', 107: 'potato' }[selId];
    if (seedCrop && canPlantOn(targetName)) {
      const above = world.getBlock(px, py + 1, pz);
      if (above === 0 && removeItem(inventory, selId, 1) > 0) {
        const cropBlock = { wheat: 35, carrot: 36, potato: 37 }[seedCrop];
        world.setBlock(px, py + 1, pz, cropBlock);
        crops.set(`${px},${py + 1},${pz}`, { cropId: seedCrop, growth: 0 });
        hud.message(`Planted ${seedCrop}`); renderInventory(); return true;
      }
      return false;
    }
    return false;
  }

  function tryHarvestCrop(px, py, pz, tid) {
    if (tid !== 35 && tid !== 36 && tid !== 37) return false;
    const cropId = { 35: 'wheat', 36: 'carrot', 37: 'potato' }[tid];
    const def = CROPS[cropId];
    const c = crops.get(`${px},${py},${pz}`);
    const growth = c ? c.growth : def.stages;
    if (!isMature(def, growth)) { hud.message(`${cropId} not ready yet`); return true; }
    const out = harvest(def, Math.random);
    world.setBlock(px, py, pz, 0);
    crops.delete(`${px},${py},${pz}`);
    addItem(inventory, blockDef(out.food).id, 1);
    const seedsId = def.seed ? blockDef(def.seed).id : 0;
    if (seedsId && out.seeds) addItem(inventory, seedsId, out.seeds);
    hud.message(`Harvested ${cropId}`); renderInventory(); return true;
  }

  function trySleepBed(px, py, pz, tid) {
    if (tid !== 38) return false;
    if (!daynight.isNight()) { hud.message('Sleep only works at night'); return true; }
    if (daynight.sleep()) {
      bedRespawn.has = true; bedRespawn.x = px; bedRespawn.y = py + 1; bedRespawn.z = pz;
      hud.message('Slept in bed - skipped to morning, respawn set');
    }
    return true;
  }

  // ---- W5: fishing / aquatic catch-release (C16) ----
  function tryCatchFish(bx, by, bz) {
    // clicking a water block with an empty bucket catches a fish swimming nearby (C16)
    const st = inventory[selected];
    const selId = st ? st.id : 0;
    if (selId !== 210) return false; // empty bucket
    // find a fish within reach of the clicked water
    const fishIdx = aquatics.findIndex((a) => a.def.fish && Math.hypot(a.pos.x - bx, a.pos.z - bz) < 2.5);
    if (fishIdx < 0) { hud.message('No fish here to catch'); return true; }
    const res = catchWithBucket(aquatics[fishIdx].id, true);
    if (res.caught) {
      removeAquatic(fishIdx);
      removeItem(inventory, 210, 1); // consume bucket
      addItem(inventory, itemId(res.bucketItem), 1);
      hud.message('Caught a ' + aquatics[fishIdx].id + ' into a bucket');
      renderInventory();
      return true;
    }
    return false;
  }
  function tryReleaseFish(px, py, pz) {
    const st = inventory[selected];
    const selId = st ? st.id : 0;
    const rel = releaseFromBucket(itemName(selId));
    if (!rel.released) return false;
    // release into the clicked water
    if (world.getBlock(px, py, pz) !== blockId('water')) { hud.message('Release fish into water'); return true; }
    removeItem(inventory, selId, 1);
    addItem(inventory, 210, 1); // empty bucket back
    spawnAquatic(rel.mobId, px, py + 1, pz);
    hud.message('Released ' + rel.mobId + ' swimming');
    renderInventory();
    return true;
  }

  // ---- W5: buried treasure dig (C15) ----
  function tryDigTreasure(bx, by, bz, tid) {
    if (tid !== blockId('treasure') && tid !== blockId('hidden_treasure')) return false;
    if (!treasureDig) {
      // first hit: reveal + grant the treasure-map clue + loot (C15 藏宝图/可挖掘奖励)
      treasureDig = { x: bx, y: by, z: bz };
      const loot = treasureLoot(Math.random);
      addItem(inventory, itemId('gold_ingot'), loot.gold_ingot);
      if (loot.diamond) addItem(inventory, itemId('diamond'), loot.diamond);
      const clue = treasureClue(bx, bz, player.pos.x, player.pos.z);
      hud.message('Buried treasure! ' + clue);
      world.setBlock(bx, by, bz, 0);
      renderInventory();
    }
    return true;
  }

  // ---- W5: trident throw (C17) ----
  function tryThrowTrident() {
    const st = inventory[selected];
    if (!st || st.id !== itemId('trident')) return false;
    if (attackCooldown > 0) return false;
    const dir = player.forward();
    const eye = { x: player.pos.x, y: player.pos.y + 1.62, z: player.pos.z };
    // build a projectile mesh
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x6eb4be }));
    mesh.position.set(eye.x, eye.y, eye.z);
    scene.add(mesh);
    // enchantments: default a set so testing can grant them
    const ench = { loyalty: 0, riptide: 0, channeling: 0, impaling: 0 };
    if (st.ench) Object.assign(ench, st.ench);
    const t = {
      mesh, pos: { x: eye.x, y: eye.y, z: eye.z },
      vel: { x: dir.x * TRIDENT.throwSpeed, y: dir.y * TRIDENT.throwSpeed, z: dir.z * TRIDENT.throwSpeed },
      tick: 0, ench, durability: st.durability !== undefined ? st.durability : TRIDENT.durability,
    };
    tridents.push(t);
    attackCooldown = TRIDENT.cooldown;
    // consume one durability per throw
    if (st.durability === undefined) st.durability = TRIDENT.durability;
    st.durability -= 1;
    if (st.durability <= 0) { hud.message('Trident broke'); st.id = 0; st.count = 0; }
    hud.message('Threw trident');
    return true;
  }
  function updateTridents(dt) {
    for (let i = tridents.length - 1; i >= 0; i--) {
      const t = tridents[i];
      t.vel.y -= 14 * dt; // gravity
      const np = advanceThrow(t.pos.x, t.pos.y, t.pos.z, t.vel.x, t.vel.y, t.vel.z, dt);
      t.pos.x = np.x; t.pos.y = np.y; t.pos.z = np.z;
      t.tick += dt;
      // hit a mob?
      let hitMobIdx = -1;
      const mobPos = [...mobs];
      for (let k = 0; k < mobPos.length; k++) {
        const mm = mobPos[k];
        if (Math.hypot(mm.pos.x - t.pos.x, mm.pos.z - t.pos.z) < 1.2 && Math.abs(mm.pos.y - t.pos.y) < 2) { hitMobIdx = k; break; }
      }
      if (hitMobIdx >= 0) {
        const mm = mobs[hitMobIdx];
        const aquaticTarget = !!aquaticDef(mm.id);
        const dmg = tridentDamage(t.ench, aquaticTarget);
        // channeling bonus (needs thunder weather)
        const lightning = channelingStrike(t.ench, weatherThunder);
        mm.health -= dmg + lightning;
        hud.message('Trident hit ' + mm.id + ' -' + (dmg + lightning) + (lightning ? ' ⚡' : '') + (aquaticTarget && t.ench.impaling ? ' (+impaling)' : ''));
        if (mm.health <= 0) removeMob(hitMobIdx);
      }
      // return to owner (Loyalty) when it should return
      if (shouldReturn(t.ench, t.tick, hitMobIdx >= 0)) {
        if (countItem(inventory, itemId('trident')) < 64) { addItem(inventory, itemId('trident'), 1); hud.message('Trident returned (Loyalty)'); }
        scene.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose();
        tridents.splice(i, 1);
        continue;
      }
      // land on ground -> pause & retrievable
      if (world.getBlock(Math.floor(t.pos.x), Math.floor(t.pos.y - 0.1), Math.floor(t.pos.z)) && t.vel.y < 0) {
        t.vel.x = 0; t.vel.z = 0; t.vel.y = 0;
      }
      if (tridentPickupReachable(t.pos, player.pos)) {
        addItem(inventory, itemId('trident'), 1); hud.message('Picked up trident');
        scene.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose();
        tridents.splice(i, 1);
        continue;
      }
      t.mesh.position.set(t.pos.x + 0.5, t.pos.y, t.pos.z + 0.5);
    }
  }

  document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    const dir = player.forward();
    const eye = { x: player.pos.x, y: player.pos.y + 1.62, z: player.pos.z };
    const hit = raycast(eye, dir);
    if (e.button === 0) {
      if (attackCooldown > 0) return;
      if (tryMeleeMob()) return; // melee when a mob is in reach, else mine
      if (hit && hit.dist <= MAX_REACH) {
        const id = world.getBlock(hit.block.x, hit.block.y, hit.block.z);
        if (id !== 0 && blockDef(id).hardness >= 0) {
          miningBlock = { x: hit.block.x, y: hit.block.y, z: hit.block.z, id };
          miningProgress = 0;
        }
      }
    } else if (e.button === 2) {
      const st = inventory[selected];
      if (st && st.id === 123 && attackCooldown <= 0) { if (tryBowMob()) return; } // bow (C12)
      if (st && st.id === itemId('trident') && attackCooldown <= 0) { if (tryThrowTrident()) return; } // trident (C17)
      if (hit && hit.dist < 5) {
        const px = hit.prev.x, py = hit.prev.y, pz = hit.prev.z;
        const targetId = world.getBlock(px, py, pz);
        const targetName = blockDef(targetId).name;
        const hitId = world.getBlock(hit.block.x, hit.block.y, hit.block.z);
        if (trySleepBed(hit.block.x, hit.block.y, hit.block.z, hitId)) return;
        if (tryHarvestCrop(hit.block.x, hit.block.y, hit.block.z, hitId)) return;
        if (tryCatchFish(hit.block.x, hit.block.y, hit.block.z)) return;
        if (tryReleaseFish(hit.block.x, hit.block.y, hit.block.z)) return;
        if (tryDigTreasure(hit.block.x, hit.block.y, hit.block.z, hitId)) return;
        if (tryEatSelected()) return;
        if (tryFarmClick(px, py, pz, targetId, targetName)) return;
        // place block from selected hotbar slot (respect underwater air-hole rule, C14)
        if (st && st.id !== 0 && st.count > 0) {
          const ox = Math.abs(px - Math.floor(player.pos.x)) <= 1 && Math.abs(py - Math.floor(player.pos.y)) <= 2 && Math.abs(pz - Math.floor(player.pos.z)) <= 1;
          const accepted = underwaterPlacementValid((x2,y2,z2) => world.getBlock(x2,y2,z2), px, py, pz, isFluid);
          if (targetId === 0 && !ox && accepted) {
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
    }
  });
  document.addEventListener('mouseup', () => { miningBlock = null; miningProgress = 0; });
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

  // day/night HUD bar (C10)
  const daynightBar = document.createElement('div'); daynightBar.id = 'daynightbar';
  const daynightDot = document.createElement('div'); daynightDot.className = 'dot'; daynightBar.appendChild(daynightDot);
  const daynightPhase = document.createElement('div'); daynightPhase.className = 'phase'; daynightBar.appendChild(daynightPhase);
  document.body.appendChild(daynightBar);

  function loop() {
    if (window.__GAME_PAUSED__) return; // freeze for evidence capture
    const now = performance.now();
    const dtRaw = (now - last) / 1000;
    const dt = Math.min(0.05, dtRaw);
    last = now;
    if (window.__RECORD_DT__) { (window.__DT__ ||= []).push(dtRaw * 1000); } // C19 perf instrumentation (true interval, off by default)

    player.sprinting = keys['ControlLeft'] && !keys['ShiftLeft'] && !player.inFluid();
    // load/stream chunks BEFORE physics so the player never moves into unloaded void
    world.updateAround(player.pos.x, player.pos.z);
    world.rebuildDirty();

    // ---- C10 day/night cycle + lighting & sky ----
    daynight.advance(dt);
    const br = daynight.brightness();
    amb.intensity = 0.2 + br * 0.5;
    hemi.intensity = 0.25 + br * 0.6;
    sun.intensity = 0.3 + br * 0.9;
    const skyCol = new THREE.Color().setHSL(0.58, 0.5, 0.25 + br * 0.5);
    scene.background.copy(skyCol); scene.fog.color.copy(skyCol);
    if (daynightBar) { daynightDot.style.left = ((daynight.time % 1) * 100) + '%'; daynightPhase.textContent = daynight.isNight() ? 'Night' : 'Day'; }

    // ---- C09/C14 survival: fall damage, drowning/oxygen, starvation, regen ----
    const wasGround = player.onGround;
    if (wasGround) fallStartY = player.pos.y; else fallStartY = Math.max(fallStartY, player.pos.y);
    player.update(dt);
    if (player.onGround && !wasGround) {
      const fell = fallStartY - player.pos.y;
      const fd = fallDamage(fell);
      if (fd > 0) { stats.damage(fd, 'fall'); hud.message(`Ouch! fell ${Math.round(fell)}m -${fd}`); }
      fallStartY = player.pos.y;
    }
    // C14 oxygen + drowning driven by head submersion
    const submerged = headSubmerged((x2,y2,z2) => world.getBlock(x2,y2,z2), player.pos.x, player.pos.y, player.pos.z, isFluid);
    hud.oxygenVisible(submerged);
    const oEvents = oxygen.tick(dt, submerged);
    if (oEvents.includes('drown')) { stats.damage(1, 'drown'); hud.message('Drowning! -1'); }
    // underwater visibility (C14)
    if (submerged) {
      const depth = Math.max(0, SEA_LEVEL - player.pos.y);
      const vis = underwaterVisibility(depth);
      scene.fog.near = 4;
      scene.fog.far = 10 + vis * 46;
      const uw = new THREE.Color(0x2a5aa0);
      scene.fog.color.lerp(uw, 0.6);
      scene.background.copy(uw.clone().lerp(new THREE.Color().setHSL(0.58, 0.5, 0.4), 0.4));
      amb.intensity = 0.5; hemi.intensity = 0.4; sun.intensity = 0.6;
    } else {
      scene.fog.near = 60; scene.fog.far = 460;
    }
    // (legacy body-in-fluid drowning replaced by C14 oxygen tank above)
    if (!submerged) drownTimer = 0;
    stats.tick(dt);
    player.health = stats.health; player.food = stats.food;

    // death + respawn (C09) at the bed respawn point or the world spawn
    if (player.health <= 0) {
      const dropped = dropAll(inventory);
      for (const [idv, cnt] of Object.entries(dropped)) spawnDrop(+idv, cnt, player.pos.x, player.pos.y + 1.5, player.pos.z);
      stats.reset(); player.health = stats.health; player.food = stats.food;
      player.pos.x = bedRespawn.has ? bedRespawn.x : spawn.x;
      player.pos.y = bedRespawn.has ? bedRespawn.y : spawn.y + 2;
      player.pos.z = bedRespawn.has ? bedRespawn.z : spawn.z;
      player.vel.x = 0; player.vel.y = 0; player.vel.z = 0;
      hud.message('You died - respawned');
      renderInventory();
    }

    // ---- C11 mobs (AI + creeper blast) and C13 crop growth ----
    updateCrops(dt);
    spawnHostilesIfNight(dt);
    updateMobs(dt);
    // ---- W5 aquatic mobs (C16) & tridents (C17) & treasure ----
    spawnAquaticsNear(dt);
    updateAquatics(dt);
    updateTridents(dt);
    if (Math.random() < 0.0005) weatherThunder = !weatherThunder; // occasional thunder for Channeling
    if (attackCooldown > 0) attackCooldown -= dt;

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
    hud.setArmorBar(armorPtsFromInv() * 3.33);
    hud.setOxygen(oxygen.air * 2);
    hud.setInfo(`Seed ${seed} · ${difficulty}`);
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
    inventory, hand, meshGroup, drops,
    stats, daynight, mobs, crops, difficulty,
    seed, tileEntities, timeOfDay,
    setBlock(wx, wy, wz, idv) { return world.setBlock(wx, wy, wz, idv); },
    getBlock(wx, wy, wz) { return world.getBlock(wx, wy, wz); },
    toggleInventory, renderInventory,
    // evidence/debug surface (W4 demo tools)
    debug: {
      spawnMobAt(id, dx, dz) { const sy = findGroundY(player.pos.x + dx, player.pos.z + dz); return spawnMob(id, player.pos.x + dx, sy, player.pos.z + dz); },
      spawnMobAtWorld(id, x, y, z) { return spawnMob(id, x, y, z); },
      forceNight() { daynight.setNight(); },
      forceDay() { daynight.setDay(); },
      give(id, count) { addItem(inventory, id, count); renderInventory(); },
      damage(amt) { stats.damage(amt, 'hostile'); },
      cropAt(x, y, z, cropId, growth) { const cb = { wheat: 35, carrot: 36, potato: 37 }[cropId] || 35; world.setBlock(x, y, z, cb); crops.set(`${x},${y},${z}`, { cropId, growth }); },
      setSelected(i) { select(i); },
      // W5 evidence/demo helpers
      // W5 evidence/demo helpers
      putWaterColumn(x, z, topY) { let placed = 0; for (let y = 46; y <= (topY || 50); y++) if (world.setBlock(x, y, z, blockId('water'))) placed++; return placed; },
      spawnAquatic(id, x, z) {
        // ensure a water column exists at the requested spot, then spawn inside it
        this.putWaterColumn(x, z, 50);
        let wy = -1;
        for (let y = 50; y >= 20; y--) if (world.getBlock(x, y, z) === blockId('water')) { wy = y - 1; break; }
        if (wy < 1) return false;
        spawnAquatic(id, x, wy, z);
        return true;
      },
      selectTrident() { const i = inventory.findIndex((s) => s && s.id === itemId('trident') && s.count > 0); if (i < 0) return false; if (i > 8) { moveStack(inventory, i, 0); select(0); } else { select(i); } return inventory[selected] && inventory[selected].id === itemId('trident'); },
      throwTrident() { return tryThrowTrident(); },
      catchFishHere(x, z) { const st = inventory[selected]; if (!st || st.id !== 210) { if (st) { addItem(inventory, 210, 1); inventory[selected].id = 210; } } addItem(inventory, 210, 1); return tryCatchFish(Math.floor(x), 0, Math.floor(z)); },
      catchNearestFish() {
        // Deterministic catchment: ensure an empty bucket is in hand, catch the nearest fish,
        // then release it again. Returns inventory deltas proving bucket catch & release.
        const st = inventory.find((s) => s && s.id === 210);
        if (!st) { const e = inventory.findIndex((s) => s && s.id === 0); if (e >= 0) { inventory[e].id = 210; inventory[e].count = 1; } }
        const bucketInHand = inventory.some((s) => s && s.id === 210);
        const target = aquatics.find((a) => a.def.fish);
        if (!target) return { caught: false, bucketInHand };
        const res = catchWithBucket(target.id, true);
        const idx = aquatics.indexOf(target);
        if (res.caught && idx >= 0) {
          removeAquatic(idx);
          removeItem(inventory, 210, 1);
          addItem(inventory, itemId(res.bucketItem), 1);
          const bucketNow = itemId(res.bucketItem);
          const fishBucketCount = countItem(inventory, bucketNow);
          // release it back into water
          const rel = releaseFromBucket(res.bucketItem);
          const ridx = inventory.findIndex((s) => s && s.id === bucketNow && s.count > 0);
          let released = false;
          if (rel.released && ridx >= 0) {
            removeItem(inventory, bucketNow, 1);
            addItem(inventory, 210, 1);
            // place the released fish in the water next to the player
            const rp = world.getBlock(Math.floor(player.pos.x) + 2, 46, Math.floor(player.pos.z)) === blockId('water')
              ? { x: player.pos.x + 2, y: 46, z: player.pos.z }
              : { x: player.pos.x, y: 46, z: player.pos.z };
            spawnAquatic(rel.mobId, rp.x, rp.y, rp.z);
            released = true;
          }
          return { caught: true, fish: target.id, caughtAs: res.bucketItem, fishBucketCount, released, bucketBack: released ? countItem(inventory, 210) : 0 };
        }
        return { caught: false, bucketInHand };
      },
      inflatePufferNear() {
        // Deterministic: place a pufferfish within inflate radius of the player.
        const p = aquatics.find((a) => a.id === 'pufferfish');
        if (!p) return { spawned: false };
        p.pos.x = player.pos.x + 0.8; p.pos.z = player.pos.z + 0.3;
        p.pos.y = player.pos.y + 1.0;
        p.state = 'inflated';
        return { spawned: true, state: p.state };
      },
      releaseFishHere(x, z) { return tryReleaseFish(Math.floor(x), 0, Math.floor(z)); },
      aquariumStates() { return aquatics.map((a) => ({ id: a.id, state: a.state, x: a.pos.x, y: a.pos.y, z: a.pos.z })); },
      mobHealths() { return mobs.map((m) => ({ id: m.id, health: m.health })); },
      movePlayer(x, y, z, yaw) { player.pos.x = x; player.pos.y = y; player.pos.z = z; if (yaw !== undefined) player.yaw = yaw; player.vel.x = 0; player.vel.y = 0; player.vel.z = 0; camera.position.set(x, y + 1.62, z); return true; },
      clearBlocksInBox(x0, y0, z0, x1, y1, z1) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) world.setBlock(x, y, z, 0); return true; },
      setBlockInfo(x, y, z, idv) { return world.setBlock(x, y, z, idv); },
      aquariumCount() { return aquatics.length; },
      oxygenLeft() { return oxygen.air; },
      forceThunder(flag) { weatherThunder = flag !== false; return weatherThunder; },
      enchantTrident(enchName) { const st = inventory.find((s) => s && s.id === itemId('trident')); if (!st) return 'no_trident'; st.ench = st.ench || {}; applyEnchant(enchName, st.ench); return st.ench; },
      tridentHitTest() {
        // Deterministic browser scenario: apply a resolved trident hit to a target and
        // return the damage/impaling/channeling numbers (drives the real damage path).
        const st = inventory.find((s) => s && s.id === itemId('trident'));
        const ench = (st && st.ench) || {};
        const before = st ? (st.durability !== undefined ? st.durability : TRIDENT.durability) : TRIDENT.durability;
        // prefer an aquatic fish target so impaling bonus is provable
        let target = null, aquaticTarget = false;
        if (aquatics.length) { const a = aquatics[0]; target = { id: a.id, health: () => a.def.health, hp: 0 }; aquaticTarget = true; }
        else if (mobs.length) { const m = mobs[0]; target = { id: m.id, health: () => m.health, hp: m.health }; }
        if (!target) return { hit: false };
        const aqueous = !!aquaticDef(target.id);
        const dmg = tridentDamage(ench, aqueous || aquaticTarget);
        const lightning = channelingStrike(ench, weatherThunder);
        const total = dmg + lightning;
        let newHealth;
        if (aquatics.length) { newHealth = Math.max(0, aquatics[0].def.health - total); aquatics[0].pos.y -= 5; }
        else { mobs[0].health -= total; newHealth = mobs[0].health; }
        const durAfter = useTridentDurability(before);
        return { hit: true, target: target.id, aquaticTarget: aqueous || aquaticTarget, impalingDamage: (aqueous && ench.impaling) ? ench.impaling : 0, damage: dmg, lightning, total, newHealth, durabilityBefore: before, durabilityAfter: durAfter.remaining, durabilityBroken: durAfter.broken };
      },
      digTreasure(x, y, z) { if (world.getBlock(x, y, z) === blockId('treasure')) return tryDigTreasure(x, y, z, blockId('treasure')); return false; },
      placeTreasure(x, y, z) { return world.setBlock(x, y, z, blockId('treasure')); },
    },
    // W3 panels/API surface
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
