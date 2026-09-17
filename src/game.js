// Game bootstrap: world + player + input + raycast block interaction + hand item + main loop.

import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { createRenderer, onResize } from './renderer.js';
import { buildHUD, HUD_CSS } from './hud.js';
import { buildAtlas, buildSprite } from './textures.js';
import { blockDef, blockId, isSolid, isFluid, BLOCKS } from './blocks.js';
import { SEA_LEVEL, columnInfo, findSafeSpawn } from './worldgen.js';

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
  player.pitch = -0.62; // look down enough that sky + green voxel landscape both fill the frame
  const hud = buildHUD();
  hud.setSeed(seed);

  const style = document.createElement('style');
  style.textContent = HUD_CSS;
  document.head.appendChild(style);

  // inventory hotbar with block/colored icons
  const menuBlocks = BLOCKS.filter((b) => b.solid && b.hardness >= 0).slice(0, 9);
  const hotbar = menuBlocks.map((b) => ({ item: b.id, count: 64, color: `rgb(${b.side})` }));

  // menu overlay / pointer lock
  const overlay = document.createElement('div');
  overlay.id = 'menu-overlay';
  overlay.innerHTML = `<div class="inner"><h1>test11 — Voxel Sandbox (W1 render core)</h1>
    <p>Non-official experiment inspired by Minecraft Bedrock 1.4.2 (Update Aquatic phase 1).</p>
    <p>WASD move · Space jump · Shift sneak/sprint-down · Mouse look</p>
    <p>Left-click break · Right-click place · 1-9 select hotbar</p>
    <p style="color:#ffd24a">Click to start</p></div>`;
  document.body.appendChild(overlay);
  const lockMouse = () => renderer.domElement.requestPointerLock();
  overlay.addEventListener('click', lockMouse);

  let selected = 0;
  const select = (i) => { selected = ((i % 9) + 9) % 9; hud.selectSlot(selected); };

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
  const handTex = buildSprite(THREE, hotbar[0].item, seed);
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
  document.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    const dir = player.forward();
    const eye = { x: player.pos.x, y: player.pos.y + 1.62, z: player.pos.z };
    const hit = raycast(eye, dir);
    if (e.button === 0 && hit && hit.dist < 5) {
      const def = blockDef(hit.block.id);
      if (world.getBlock(hit.block.x, hit.block.y, hit.block.z) !== 0) {
        const cur = hud.hotbar[selected] || { item: 0 };
        world.setBlock(hit.block.x, hit.block.y, hit.block.z, 0);
        // give player the block
        const given = hotbar.find((s) => s.item === hit.block.id);
        if (given) given.count = Math.min(given.count + 1, 999);
      }
    } else if (e.button === 2 && hit && hit.dist < 5) {
      const st = hotbar[selected];
      if (st && st.item !== 0 && st.count > 0) {
        const px = hit.prev.x, py = hit.prev.y, pz = hit.prev.z;
        const target = world.getBlock(px, py, pz);
        if (target === 0 && !(Math.abs(px - Math.floor(player.pos.x)) === 0 && Math.abs(py - Math.floor(player.pos.y)) === 0 && Math.abs(pz - Math.floor(player.pos.z)) === 0)) {
          world.setBlock(px, py, pz, st.item);
          st.count--;
        }
      }
    }
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    overlay.style.display = document.pointerLockElement === renderer.domElement ? 'none' : 'flex';
  });

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

    camera.position.set(player.pos.x, player.pos.y + 1.62, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0);

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
    hud.setHotbar(hotbar, selected);
    hud.setHearts(player.health);
    hud.setFood(player.food);

    fpsAcc += dt; fpsFrames++;
    if (fpsAcc >= 0.5) { fpsVal = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }
    hud.setFps(fpsVal);

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => onResize(renderer, camera, container));
  requestAnimationFrame(loop);

  return { world, player, scene, camera, renderer, select, spawn, hotbar, hand, meshGroup };
}
