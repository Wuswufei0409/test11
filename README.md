# test11 — Voxel Sandbox (non-official)

A **non-official** experimental project: a first-person 3D voxel sandbox survival game
implemented in pure Web technology, inspired by *Minecraft Bedrock Edition 1.4.2
(Update Aquatic phase 1)*. This is an independent, original implementation — no game
engine, no copied textures/models/audio/trademarks. All assets are generated at runtime
as original pixel art. Not affiliated with or endorsed by Mojang/Microsoft.

> **Module scope:** W1 — world generation + first-person 3D voxel rendering & HUD core
> (completion criteria **02/03**); W2 — player controls + mine/place + inventory (**04/05/06**);
> **W3 — crafting, tool tiers, furnace smelting and local save/load (07/08/18)**; later
> modules (survival, mobs, oceans, performance, integration) build on this base.

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

## W3 — Crafting, tools, furnace & local save (C07/C08/C18)

### Supported recipes (C07)
Config-driven 2x2/3x3 crafting (`src/recipes.js`). 2×2 (in the player grid, no workbench):
**oak_planks** (log→4), **stick** (2 planks→4), **crafting_table**, **torch** (coal+stick→4),
**sponge** (underwater representative, 2×2 sand). 3×3 (need the **crafting_table** workbench):
**chest**, **furnace**, **boat**, **bucket** (3 iron_ingot V), **bread** (3 wheat), and the full
**wood → stone → iron** tool set — **pickaxe**, **axe**, **shovel**, **sword** (12 tools).
A **Recipe Book** panel (inventory `E` → right-top **Craft** button) lists every recipe with
its grid size, ingredients and a one-click Craft.

### Tool tiers & mining (C08)
`src/items.js` + `src/tools.js`. Tools have **tier** (wood/stone/iron), **kind**, **speed**
multiplier, **durability** and a **harvest** level. Iron > stone > wood in speed and harvest.
**Wrong-tool restriction:** soft blocks (dirt/sand/logs/planks) drop by hand, but stone and
ores require the matching tool tiers — coal needs a wood+ pickaxe, iron/gold a stone+
pickaxe, diamond an iron pickaxe — otherwise the block breaks with **no drop**.
**Ore drops:** coal → coal, iron → raw iron, gold → raw gold, diamond → diamond.

### Furnace smelting (C08)
`src/furnace.js`. `iron_ore_raw → iron_ingot`, `gold_ore_raw → gold_ingot`, `cobblestone → stone`,
`sand → glass`, `coal_ore → coal`. Fuel: coal (80 s) > planks/logs (15 s) > stick (5 s).
Place a **furnace**, right-click it to open the smelting panel; items smelt over time.

### Local save/load (C18)
`src/save.js`. Saves **seed / position / health+food / inventory / time-of-day / modified
blocks / chest+furnace tile state / entity key state** to `localStorage`, auto-saves every
10 s and on page close, and **continues on reopen**. Corrupt saves are detected by a
checksum and produce a **clear error + safe fallback** (a fresh world) — the loader never
writes over a broken/valid save, and saving a changed world **backups the previous valid
save to `mcsave.bak`** instead of silently clobbering it. UI: top-right **Save / Load / New**.

## Build & test

```bash
npm run build            # vite production build -> dist/
npm test                 # vitest: worldgen + inventory + mining + crafting + tools + furnace + save
node scripts/w3_evidence.cjs   # headless-browser evidence (needs a dev server on :5201) -> evidence/*.png
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
| `src/items.js` | Item + tool registry (block items, raw mats, 12 tools) |
| `src/recipes.js` | Config-driven 2×2/3×3 recipe table + recipe book (C07) |
| `src/crafting.js` | Crafting execution (grid match, one-click craft) |
| `src/tools.js` | Tool tiers, mining speed, durability, ore drops (C08) |
| `src/furnace.js` | Furnace smelting + fuel model |
| `src/save.js` | Local save/load with checksum, corrupt fallback, no-silent-overwrite (C18) |
| `src/w3_panels.js` | Crafting/furnace/save-load UI wiring |
| `src/water.js` | C14 water core: oxygen/drowning, buoyancy, swim speed, underwater visibility, placement rules |
| `src/ocean.js` | C15 ocean content: coral, kelp, seagrass, icebergs, shipwrecks, ruins, buried treasure + clues |
| `src/aquatic.js` | C16 aquatic mobs: dolphin/cod/salmon/tropical fish/pufferfish, bucket catch/release |
| `src/trident.js` | C17 trident: throw/retrieve/durability/damage + Loyalty/Riptide/Channeling/Impaling |

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

## I1 — Integration, public deploy, performance & evidence (C01/C19/C20)

**Public HTTPS** (no login, no install): <https://wuswufei0409.github.io/test11/>  — served from `main` via GitHub Actions (Pages). Asserted non-official/independent.

## W5 — Water, oceans, aquatic life & trident (C14/C15/C16/C17)

Fresh module on top of the integrated W1–I1 baseline, **now fully unit-tested (131 tests) and browser-verified**.

**C14 water core** (`src/water.js`): a head-submersion **oxygen tank** drives a HUD oxygen bar and **drowning** (periodic drown damage at zero air, refills in air); sprint-swimming is faster than normal swim; a **1×1 waterway is passable**; dropped items **float up and bob at the surface**; underwater **visibility fog** deepens with depth; and placing a solid block underwater obeys an **air-hole rule** (no leaky pocket).

**C15 ocean content** (`src/ocean.js` + `src/worldgen.js`): deterministic **coral reefs, kelp beds, seagrass, icebergs, shipwrecks, underwater ruins and buried treasure** generated into ocean biomes, plus a **treasure clue** (bearing + distance) leading to a **diggable gold/diamond reward**.

**C16 aquatic mobs** (`src/aquatic.js`): **dolphin / cod / salmon / tropical fish / pufferfish** with drift/swim/bob AI; fish can be **caught with a water bucket and released** back into water; **pufferfish inflate near the player** and sting on contact.

**C17 trident** (`src/trident.js`): a throwable **trident** with **retrieve-on-loyalty, durability, and damage** and three+ enchantments — **Loyalty** (returns to thrower), **Riptide** (launches in water), **Channeling** (lightning on thunder) and **Impaling** (bonus vs aquatic).

Run the W5 evidence harness:
```bash
node scripts/smoke_w5.cjs   # needs a dev/preview server on :5202 -> evidence/w5_underwater.png
```

**How to run**
```bash
npm install
npm test             # core logic (world, worldgen, crafting, tools, furnace, save, survival, mobs, combat, farming, day/night, inventory, mining, player)
npm run build        # production build -> dist/
node scripts/health_check.mjs      # deploy health check on the built artifact
node scripts/fixed_seed_smoke.mjs  # C03 seed determinism (fingerprint reproducible)
node scripts/verify_c01.cjs        # C01: first-open within 60s, refresh no white-screen, no blocking errors (needs a running server)
node scripts/perf.cjs <url> <sec>  # C19 headless perf benchmark (view distance 6, 30 mobs)
```

**Performance (C19)** — headless Chromium (SwiftShader WebGL), view distance 6 chunks, 30 active entities,
fixed seed `20260917`, 1280x720. Raw sample data + methodology in `evidence/perf_raw.json`; summary in the
final report (`evidence/final_report.md`).

**CI (C20)** — `.github/workflows/ci.yml` runs build + core-logic tests + fixed-seed smoke on every push/PR.
Deploy `.github/workflows/pages.yml` builds, health-checks, and publishes to GitHub Pages.

## Architecture
- `src/worldgen.js` seeded terrain (biomes, chunk gen, terrain footprint, safe spawn)
- `src/world.js` chunk store/collision (RENDER_DISTANCE=6)
- `src/renderer.js` + `src/textures.js` voxel meshing, fog, sky, first-person hand, generated pixel textures
- `src/game.js` game loop, input, raycast, mining/placing, drops, HUD wiring, integration seam
- `src/{inventory,crafting,recipes,tools,furnace,save,items}.js` inventory, crafting (`2x2/3x3` + recipe book), tool tiers (C07/C08), smelting, local save (C18)
- `src/{survival,daynight,mobs,combat,farming}.js` survival/day-night/mobs/combat/farming (C09–C13)
- Rendering/animation via **Three.js** (allowed render library; no game engine).

## Assets & license
All textures/geometry are **original, generated at runtime** (procedural pixel colors) — no Minecraft assets,
textures, models, audio or trademarks are copied. This is an independent, **non-official** educational/experimental
project not affiliated with Mojang/Microsoft. Code is MIT (`LICENSE`).

## Known limitations (honest)
- Water is a translucent flat layer; deep water physics remain for a later module (C14–C17 underwater/ocean content pending).
- The wrong-tool restriction (C08) is enforced in `tools.js` for drops; pickaxe-tier gating is the main enforcement.
- Armor is a single aggregate bonus (no per-slot armor), creeper blast is a spherical attenuation (no blast-resistance).
- Under headless SwiftShader (CPU-only GL) the game runs at software FPS (~20); C19 threshold assumes the designated benchmark machine.
