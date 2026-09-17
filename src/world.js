// World runtime: chunk storage, neighbor-aware meshing, block get/set. Browser rendering side.

import { CHUNK, WORLD_HEIGHT, SEA_LEVEL, generateChunk, BIOMES, columnInfo, blockId } from './worldgen.js';
import { blockDef, isOpaque, isFluid, isSolid } from './blocks.js';

export const RENDER_DISTANCE = 6; // chunks (matches C19 view distance)

const FACES = [
  { dir: [1, 0, 0], corners: [[1,1,1],[1,0,1],[1,1,0],[1,0,0]], shade: 0.85, n: [1,0,0] },
  { dir: [-1, 0, 0], corners: [[0,1,0],[0,0,0],[0,1,1],[0,0,1]], shade: 0.85, n: [-1,0,0] },
  { dir: [0, 1, 0], corners: [[0,1,1],[1,1,1],[0,1,0],[1,1,0]], shade: 1.0, n: [0,1,0] },
  { dir: [0, -1, 0], corners: [[0,0,0],[1,0,0],[0,0,1],[1,0,1]], shade: 0.55, n: [0,-1,0] },
  { dir: [0, 0, 1], corners: [[0,1,1],[0,0,1],[1,1,1],[1,0,1]], shade: 0.78, n: [0,0,1] },
  { dir: [0, 0, -1], corners: [[1,1,0],[1,0,0],[0,1,0],[0,0,0]], shade: 0.78, n: [0,0,-1] },
];

function faceName() {
  return ['px','nx','py','ny','pz','nz'];
}

function vertKey(x, y, z) { return `${x},${y},${z}`; }

export class World {
  constructor(seed, THREE) {
    this.seed = seed;
    this.THREE = THREE;
    this.chunks = new Map(); // "cx,cz" -> { cx,cz,data, mesh:{opaque,water,leaves}, modified:Set }
    this.modifiedChunks = new Set();
    this.generationQueue = [];
  }

  key(cx, cz) { return cx + ',' + cz; }

  inWorld(x, y, z) {
    return y >= 0 && y < WORLD_HEIGHT;
  }

  rawGet(cx, cz, bx, y, bz) {
    const c = this.chunks.get(this.key(cx, cz));
    if (!c) return -1;
    return c.data[((y * CHUNK) + bz) * CHUNK + bx];
  }

  /** Get block id at world coords; returns 0 for unloaded/out-of-world, -1 if chunk not loaded. */
  getBlock(wx, y, wz) {
    if (y < 0) return blockId('bedrock');
    if (y >= WORLD_HEIGHT) return 0;
    const cx = Math.floor(wx / CHUNK);
    const cz = Math.floor(wz / CHUNK);
    const bx = ((wx % CHUNK) + CHUNK) % CHUNK;
    const bz = ((wz % CHUNK) + CHUNK) % CHUNK;
    const c = this.chunks.get(this.key(cx, cz));
    if (!c) return 0;
    return c.data[((y * CHUNK) + bz) * CHUNK + bx];
  }

  setBlock(wx, y, wz, idv) {
    if (y < 0 || y >= WORLD_HEIGHT) return false;
    const cx = Math.floor(wx / CHUNK);
    const cz = Math.floor(wz / CHUNK);
    const bx = ((wx % CHUNK) + CHUNK) % CHUNK;
    const bz = ((wz % CHUNK) + CHUNK) % CHUNK;
    const c = this.chunks.get(this.key(cx, cz));
    if (!c) return false;
    c.data[((y * CHUNK) + bz) * CHUNK + bx] = idv;
    c.modified.add(bx * WORLD_HEIGHT * CHUNK + y * CHUNK + bz);
    this.remeshKey(this.key(cx, cz));
    // neighboring chunk faces may be exposed
    if (bx === 0) this.remeshKey(this.key(cx - 1, cz));
    if (bx === CHUNK - 1) this.remeshKey(this.key(cx + 1, cz));
    if (bz === 0) this.remeshKey(this.key(cx, cz - 1));
    if (bz === CHUNK - 1) this.remeshKey(this.key(cx, cz + 1));
    return true;
  }

  /** Queue a chunk rebake. */
  remeshKey(k) {
    const c = this.chunks.get(k);
    if (c) this.modifiedChunks.add(k);
  }

  ensureChunk(cx, cz) {
    const k = this.key(cx, cz);
    if (this.chunks.has(k)) return;
    const gen = generateChunk(cx, cz, this.seed);
    this.chunks.set(k, gen);
    this.modifiedChunks.add(k);
  }

  updateAround(px, pz) {
    const pcx = Math.floor(px / CHUNK);
    const pcz = Math.floor(pz / CHUNK);
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++)
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++)
        this.ensureChunk(pcx + dx, pcz + dz);
    // unload far chunks
    for (const k of [...this.chunks.keys()]) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.abs(cx - pcx) > RENDER_DISTANCE + 2 || Math.abs(cz - pcz) > RENDER_DISTANCE + 2) {
        const c = this.chunks.get(k);
        if (c.mesh) { c.mesh.dispose(); }
        this.chunks.delete(k);
      }
    }
  }

  /** Rebuild dirty chunk meshes. Returns number rebuilt. */
  rebuildDirty() {
    let rebuilt = 0;
    for (const k of this.modifiedChunks) {
      this.buildMesh(k);
      rebuilt++;
    }
    this.modifiedChunks.clear();
    return rebuilt;
  }

  buildMesh(k) {
    const THREE = this.THREE;
    const c = this.chunks.get(k);
    if (!c) return;
    if (c.mesh) { c.mesh.dispose(); c.mesh = null; }
    const [cx, cz] = k.split(',').map(Number);
    const baseX = cx * CHUNK;
    const baseZ = cz * CHUNK;
    const positions = [];
    const normals = [];
    const uvs = [];
    const colors = [];
    const indices = [];
    let vert = 0;

    for (let bx = 0; bx < CHUNK; bx++) {
      for (let bz = 0; bz < CHUNK; bz++) {
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          const idv = c.data[((y * CHUNK) + bz) * CHUNK + bx];
          if (idv === 0) continue;
          const def = blockDef(idv);
          if (isFluid(idv)) continue; // fluid handled separately
          const wx = baseX + bx, wz = baseZ + bz;
          const isOpaqueBlk = isOpaque(idv);
          const cell = this.atlas.cellForId.get(idv) || this.atlas.cellForId.get(3);
          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nx = wx + face.dir[0], ny = y + face.dir[1], nz = wz + face.dir[2];
            const neighbor = this.getBlock(nx, ny, nz);
            if (neighbor === -1) continue; // unloaded neighbor: skip (avoids seam flicker)
            if (neighbor !== 0 && isOpaque(neighbor)) continue; // hidden
            if (neighbor !== 0 && isFluid(neighbor) && !isFluid(idv)) {
              // keep face against water only for solid
            }
            // choose tile face: py -> top, ny -> bot else side; for log use side for all x/z
            const uv = face.dir[1] === 1 ? this.atlas.uv(idv, 'top')
                    : face.dir[1] === -1 ? this.atlas.uv(idv, 'bot')
                    : this.atlas.uv(idv, 'side');
            const shade = face.shade;
            const cornerIdx = [];
            for (const cpos of face.corners) {
              const vx = bx + cpos[0];
              const vy = y + cpos[1];
              const vz = bz + cpos[2];
              positions.push(vx, vy, vz);
              normals.push(...face.n);
              // uv: corners order maps to simple 0/1
              const u = cpos[0] === 0 ? uv[2] : uv[0];
              const v = cpos[2] === 0 ? uv[1] : uv[3];
              uvs.push(u, v);
              const cc = 0.75 + shade * 0.25;
              colors.push(cc, cc, cc);
              cornerIdx.push(vert++);
            }
            // two triangles
            indices.push(cornerIdx[0], cornerIdx[1], cornerIdx[2], cornerIdx[1], cornerIdx[3], cornerIdx[2]);
          }
        }
      }
    }

    // fluid (water) pass: only a flat-ish top + sides against air
    const wPos = [], wCol = [], wNrm = [], wIdx = [];
    for (let bx = 0; bx < CHUNK; bx++) {
      for (let bz = 0; bz < CHUNK; bz++) {
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          const idv = c.data[((y * CHUNK) + bz) * CHUNK + bx];
          if (!isFluid(idv)) continue;
          const wx = baseX + bx, wz = baseZ + bz;
          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nx = wx + face.dir[0], ny = y + face.dir[1], nz = wz + face.dir[2];
            const neighbor = this.getBlock(nx, ny, nz);
            if (f === 2 && neighbor === 0) { /* top face exposed to air */ }
            else if (f !== 2 && (neighbor === 0 || (!isFluid(neighbor) && !isSolid(neighbor)))) { /* side/edge */ }
            else continue;
            const cc = 0.62 + face.shade * 0.28;
            const b0 = wPos.length / 3;
            for (const cpos of face.corners) {
              wPos.push(bx + cpos[0], y + cpos[1], bz + cpos[2]);
              wCol.push(cc, cc, cc);
              wNrm.push(face.n[0], face.n[1], face.n[2]);
            }
            wIdx.push(b0, b0 + 1, b0 + 2, b0 + 1, b0 + 3, b0 + 2);
          }
        }
      }
    }

    const group = new (this.THREE.Group)();
    group.name = k;

    if (positions.length) {
      const THREE = this.THREE;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.setIndex(indices);
      const mat = new THREE.MeshLambertMaterial({ map: this.atlas.texture, vertexColors: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(baseX, 0, baseZ);
      group.add(mesh);
    }

    if (wPos.length) {
      const THREE = this.THREE;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(wNrm, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(wCol, 3));
      geo.setIndex(wIdx);
      const mat = new THREE.MeshLambertMaterial({
        color: 0x3f6fd0, transparent: true, opacity: 0.7,
        side: this.THREE.DoubleSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(baseX, 0, baseZ);
      mesh.renderOrder = 5;
      group.add(mesh);
    }

    c.mesh = { group, dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); } }); } };
    this.meshGroup && this.meshGroup.add(group);
  }
}
