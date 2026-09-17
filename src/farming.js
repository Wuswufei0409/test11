// C13 farming core (pure): till farmland, plant crops from seeds, grow across multiple ticks
// driven by time + light, and harvest into food + seeds. Deterministic and multi-tick testable.

export const FARMABLE = ['dirt', 'grass'];
export const FARMLAND = { id: 34, name: 'farmland', color: [120, 90, 50], solid: true, opaque: true };

export const CROPS = {
  wheat: { seed: 'wheat_seeds', food: 2, foodSaturation: 0.4, stages: 8, seedsDrop: [1, 3], harvest: 'wheat' },
  carrot: { seed: 'carrot', food: 3, foodSaturation: 0.6, stages: 8, seedsDrop: [1, 1], harvest: 'carrot' },
  potato: { seed: 'potato', food: 1, foodSaturation: 0.3, stages: 8, seedsDrop: [1, 1], harvest: 'potato' },
};

/** Base growth increment per tick at full light; light scales it. 1/60 stage/tick ~ 60 ticks/stage, ~480 ticks to fully mature (demoable). */
export const BASE_GROWTH = 1 / 60; // fraction of a stage per tick at full light
export const MAX_LIGHT = 15;         // blocks from a sky/block lamp

/** Light factor in [0,1]; crops need >= lightFloor to grow at all. */
export function lightFactor(light, floor = 9) {
  if (light < floor) return 0;
  return Math.min(1, (light - floor) / (MAX_LIGHT - floor));
}

/**
 * Advance a crop by `ticks` at the given light. Returns the new growth stage (0..stages).
 * Multiple ticks => multiple increments => observable growth. Time is an alias for ticks.
 */
export function growCrop(cropDef, growthStage, ticks, light) {
  const lf = lightFactor(light);
  if (lf <= 0) return growthStage;
  const inc = Math.min(cropDef.stages - growthStage, BASE_GROWTH * lf * ticks);
  return growthStage + inc;
}

export function isMature(cropDef, growthStage) {
  return growthStage >= cropDef.stages;
}

export function canTill(blockId, blockName) {
  return FARMABLE.includes(blockName);
}

export function canPlantOn(blockName) {
  return blockName === 'farmland' || FARMABLE.includes(blockName);
}

/** Harvest a mature crop -> { food: <itemId>, seeds: <count> } drop table. */
export function harvest(cropDef, rng = Math.random) {
  const food = cropDef.harvest;
  const [lo, hi] = cropDef.seedsDrop;
  const n = lo + Math.floor(rng() * (hi - lo + 1));
  return { food, seeds: n };
}
