# test11 — Voxel Sandbox (non-official)

A **non-official** experimental project: a first-person 3D voxel sandbox survival game
implemented in pure Web technology, inspired by *Minecraft Bedrock Edition 1.4.2
(Update Aquatic phase 1)*. This is an independent, original implementation — no game
engine, no copied textures/models/audio/trademarks. All assets are generated at runtime
as original pixel art. Not affiliated with or endorsed by Mojang/Microsoft.

> **Module scope (W1):** World generation + first-person 3D voxel rendering & HUD core
> (completion criteria **02** and **03**). Subsequent modules (interaction, survival,
> mobs, oceans, saving, performance, integration) build on this base.

## Try it

```bash
npm install
npm run dev        # open http://localhost:5173
```

Click the canvas to lock the mouse, then:
- **WASD** move · **Space** jump · **Ctrl** sprint · **Shift** sneak/dive
- **Mouse** look · **Left-click** break block · **Right-click** place block
- **1-9** select hotbar block

Seed is `20260917` by default; override with `?seed=NNN`.

## Build & test

```bash
npm run build      # vite production build -> dist/
npm test           # vitest: deterministic worldgen + reproducibility + biome coverage
```

## Architecture

| Path | Responsibility |
|------|----------------|
| `src/math.js` | Deterministic PRNG + value/FBM noise (pure, testable) |
| `src/blocks.js` | Block registry (30+ types), solids/opacity/fluids |
| `src/textures.js` | Runtime-generated original 16×16 pixel-texture atlas |
| `src/worldgen.js` | Seeded chunk generation: biomes, elevation, trees, ores, water (pure) |
| `src/world.js` | Chunk storage, neighbor-aware meshing, fluids, load/unload |
| `src/renderer.js` | Three.js scene, camera, sky, fog, lights |
| `src/player.js` | Pointer-lock FPS controller, physics & AABB collision |
| `src/game.js` | Main loop, voxel raycast, block edit, hand item, HUD wiring |
| `src/hud.js` | Bedrock-inspired HUD (crosshair, hotbar, hearts/food/armor, coords, FPS) |

## World generation (C03)

Deterministic for a `seed`: value noise + FBM produce temperature/moisture/elevation
fields that select biomes — **plains, forest, desert, mountains** and **cold / warm /
shallow / deep oceans** — with trees, vegetation, ores and water depth. Same seed ⇒
identical chunks. A `terrainFingerprint(seed)` hash of fixed-coordinate height samples
proves reproducibility.

## Assets / licensing

- MIT License (see `LICENSE`). Code: original.
- Textures: procedurally generated pixel tiles at runtime (original).
- Rendering: [Three.js](https://threejs.org) (MIT). Bundler: [Vite](https://vitejs.dev) (MIT).
- This project is a non-official fan-made experiment and shares no copyrighted game assets.

## Known limitations (W1)

- Only the world/rendering/HUD core is implemented so far; interaction, survival, mobs,
  oceans content, saving and performance tuning land in later modules.
- Neighbor-chunk face culling is disabled at chunk borders (minor internal-seam overdraw).
- Water is a translucent flat layer (deeper fluid behavior is a later module).
