// Procedural 16x16 pixel-texture generator. Original, generated at runtime from the block
// registry + seed — NOT copied from any game assets. Browser only (uses DOM canvas).

import { BLOCKS, blockDef, isFluid } from './blocks.js';
import { mulberry32 } from './math.js';

const TILE = 16;

function shade([r, g, b], f) {
  return [Math.min(255, Math.round(r * f)), Math.min(255, Math.round(g * f)), Math.min(255, Math.round(b * f))];
}

function hex([r, g, b]) {
  return `rgb(${r},${g},${b})`;
}

/**
 * Draw one 16x16 tile for a block onto a target ctx at (ox, oy).
 * Deterministic per (blockId, seed) so the atlas is reproducible.
 */
function drawTile(ctx, ox, oy, block, seed) {
  const rng = mulberry32(seed ^ (block.id * 7919));
  const cols = {};
  for (const k of ['top', 'side', 'bot']) {
    const base = block[k] || block.side || block.top || [200, 200, 200];
    const variants = [0.85, 0.92, 1.0, 1.06, 1.12, 0.97];
    cols[k] = variants.map((f) => hex(shade(base, f)));
  }
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      // Prefer the chosen face, but stitch: top row uses top, bottom row uses bot, else side.
      const pool = y === 0 ? cols.top : y === TILE - 1 ? cols.bot : cols.side;
      const baseIdx = Math.floor(rng() * pool.length);
      let color = pool[baseIdx];
      // speckles / noise
      const n = rng();
      if (n > 0.82) color = pool[Math.floor(rng() * pool.length)];
      if (block.id >= 21 && block.id <= 24) {
        // ores: deposit blobs
        const d = Math.abs((x % 6) - 3) + Math.abs((y % 6) - 3);
        if (d < 2) {
          const oreCol = { 21: [40,40,40], 22: [210,170,120], 23: [240,200,80], 24: [90,220,230] }[block.id];
          color = hex(oreCol);
        }
      }
      if (block.name === 'oak_log' || block.name === 'spruce_log' || block.name === 'birch_log') {
        // bark streaks
        if ((x + (block.id === 13 ? y : 0)) % 4 < 2) color = hex(shade(block.side, 1.15));
      }
      ctx.fillStyle = color;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

/**
 * Build an atlas of all block tiles. Returns a THREE.CanvasTexture + uv lookup.
 * @param {object} THREE three namespace
 * @returns {{texture: import('three').Texture, tileSize:number, cols:number, uv(id,face):[u0,v0,u1,v1]}}
 */
export function buildAtlas(THREE, seed = 20260917) {
  const solid = BLOCKS.filter((b) => b.id > 0 && !isFluid(b.id));
  const cols = Math.ceil(Math.sqrt(solid.length));
  const rows = Math.ceil(solid.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * TILE;
  canvas.height = rows * TILE;
  const ctx = canvas.getContext('2d');
  const cellForId = new Map();
  solid.forEach((b, i) => {
    const cx = (i % cols) * TILE;
    const cy = Math.floor(i / cols) * TILE;
    drawTile(ctx, cx, cy, b, seed);
    cellForId.set(b.id, { cx, cy, col: i % cols, row: Math.floor(i / cols) });
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  function uv(id, face) {
    const cell = cellForId.get(id) || cellForId.get(3);
    const u0 = cell.col / cols;
    const v1 = 1 - cell.row / rows;
    const u1 = (cell.col + 1) / cols;
    const v0 = 1 - (cell.row + 1) / rows;
    return [u0, v0, u1, v1];
  }
  return { texture: tex, uv, cols, rows, tileSize: TILE, cellForId };
}

/** Build a small sprite texture (for hand/item preview). */
export function buildSprite(THREE, id, seed = 20260917) {
  const b = blockDef(id);
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  // draw 4x4 scaled tile of block into 32x32
  const tmp = document.createElement('canvas');
  tmp.width = TILE;
  tmp.height = TILE;
  const tctx = tmp.getContext('2d');
  drawTile(tctx, 0, 0, b, seed);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
