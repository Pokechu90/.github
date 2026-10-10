/**
 * Plant life: trees, bushes, wild grain and cacti that sprout, grow, bear fruit
 * by season, spread seeds, compete for space, suffer frost, age and die.
 *
 * Plants are updated once per game day (they change slowly), which keeps them
 * cheap even with tens of thousands of them.
 */
import { CHUNK_SIZE, BIOMES } from '../../shared/terrain';
import { PLANTS, PlantStage, type PlantSpecies } from '../../shared/species';
import { DAYS_PER_YEAR, getCalendar, seasonTempOffset } from '../../shared/time';
import { chance, nextFloat, randInt, randRange, type Rng } from '../../shared/rng';
import type { Chunk, Plant } from '../state';
import type { World } from '../world';

const MAX_PLANTS_PER_CHUNK = 420;
/** Dead trees stand as snags for a while before falling and rotting away. */
const SNAG_DAYS = DAYS_PER_YEAR * 2;

/** Populates a freshly generated chunk with a mature, natural-looking mix of plants. */
export function spawnInitialPlants(world: World, chunk: Chunk, rng: Rng): void {
  const { biomes } = chunk.terrain;
  const doy = getCalendar(world.state.time).dayOfYear;
  for (const sp of PLANTS) {
    for (let i = 0; i < biomes.length; i++) {
      const density = sp.habitat[biomes[i] as keyof typeof sp.habitat] ?? 0;
      if (density <= 0 || !chance(rng, density * 0.9)) continue;
      const lx = i % CHUNK_SIZE;
      const ly = (i / CHUNK_SIZE) | 0;
      if (!localSpaceFree(chunk, lx, ly, sp.isTree)) continue;

      const lifespanDays = randRange(rng, sp.lifespanYears[0], sp.lifespanYears[1]) * DAYS_PER_YEAR;
      // Most plants start somewhere in their adult life, a few young or old.
      const ageDays = sp.annual ? doy : nextFloat(rng) * lifespanDays * 0.95;
      const plant: Plant = {
        id: world.newId(),
        species: sp.id,
        x: chunk.cx * CHUNK_SIZE + lx,
        y: chunk.cy * CHUNK_SIZE + ly,
        ageDays,
        lifespanDays,
        stage: PlantStage.Mature,
        health: 1,
        fruit: 0,
      };
      plant.stage = stageFor(sp, plant, doy);
      if (sp.fruit && plant.stage >= PlantStage.Mature && inWindow(doy, sp.fruit.fromDay, sp.fruit.toDay)) {
        plant.fruit = sp.fruit.max * randRange(rng, 0.3, 0.9);
      }
      addPlant(world, chunk, plant);
    }
  }
}

/** One day passes for every plant in the chunk. */
export function updatePlantsDaily(world: World, chunk: Chunk): void {
  const time = world.state.time;
  const cal = getCalendar(time);
  const rng = world.state.rng;
  const centre = (CHUNK_SIZE / 2) | 0;
  const weather = world.weatherAt(chunk.cx * CHUNK_SIZE + centre, chunk.cy * CHUNK_SIZE + centre);
  // Daily updates run at midnight, so this is roughly the night's low.
  const tempOffset = weather.tempC - chunk.terrain.temps[centre * CHUNK_SIZE + centre];
  let changed = false;

  for (let i = chunk.plants.length - 1; i >= 0; i--) {
    const p = chunk.plants[i];
    const sp = PLANTS[p.species];
    const before = { stage: p.stage, fruit: fruitLevel(sp, p) };
    p.ageDays += 1;

    // Dead trees eventually fall and rot, freeing the space.
    if (p.stage === PlantStage.Dead) {
      if (p.ageDays > p.lifespanDays + SNAG_DAYS) {
        removePlantAt(world, chunk, i);
        changed = true;
      }
      continue;
    }

    // Seeds wait in the soil until spring, and don't last forever.
    if (p.stage === PlantStage.Seed) {
      if (cal.season === 0 && chance(rng, 0.12)) {
        p.stage = PlantStage.Sprout;
        p.ageDays = sp.annual ? cal.dayOfYear : 0;
      } else if (!sp.annual && p.ageDays > DAYS_PER_YEAR * 2) {
        removePlantAt(world, chunk, i);
        changed = true;
        continue;
      } else if (sp.annual && cal.season === 3 && cal.dayOfSeason === 15 && chance(rng, 0.35)) {
        removePlantAt(world, chunk, i); // seed eaten or rotted over winter
        changed = true;
        continue;
      }
      if (p.stage !== before.stage) changed = true;
      continue;
    }

    // Frost damage and slow recovery.
    const localTemp = chunkTileTemp(chunk, p) + tempOffset;
    if (localTemp < sp.minTemp) p.health -= 0.06;
    else p.health = Math.min(1, p.health + 0.02);

    // Annuals: drop seeds in autumn, then die back to a seed over winter.
    if (sp.annual) {
      if (cal.season === 2 && p.stage === PlantStage.Mature && chance(rng, sp.spreadChance)) {
        trySpread(world, sp, p);
      }
      if (cal.season === 3) p.stage = PlantStage.Seed;
      else p.stage = stageFor(sp, p, cal.dayOfYear);
    } else {
      if (p.health <= 0 || p.ageDays >= p.lifespanDays) {
        if (sp.isTree) {
          p.stage = PlantStage.Dead;
          p.ageDays = Math.max(p.ageDays, p.lifespanDays);
          p.fruit = 0;
        } else {
          removePlantAt(world, chunk, i);
          changed = true;
          continue;
        }
      } else {
        p.stage = stageFor(sp, p, cal.dayOfYear);
        if (
          p.stage >= PlantStage.Mature &&
          cal.season === sp.spreadSeason &&
          chance(rng, sp.spreadChance * p.health)
        ) {
          trySpread(world, sp, p);
        }
      }
    }

    // Fruit ripens in its season (faster with rain), then falls and rots.
    if (sp.fruit && p.stage !== PlantStage.Dead) {
      const f = sp.fruit;
      if ((p.stage === PlantStage.Mature || p.stage === PlantStage.Old) && inWindow(cal.dayOfYear, f.fromDay, f.toDay)) {
        const perDay = (f.max / (f.toDay - f.fromDay)) * 1.6 * p.health * (1 + weather.rain * 0.5);
        p.fruit = Math.min(f.max, p.fruit + perDay);
      } else if (p.fruit > 0) {
        p.fruit = p.fruit < 0.5 ? 0 : p.fruit * 0.75;
      }
    }

    if (p.stage !== before.stage || fruitLevel(sp, p) !== before.fruit) changed = true;
  }

  if (changed) chunk.version++;
}

/** Grazing food regrows when it is warm enough, faster with rain. */
export function updateGrassDaily(world: World, chunk: Chunk): void {
  const centre = (CHUNK_SIZE / 2) | 0;
  const w = world.weatherAt(chunk.cx * CHUNK_SIZE + centre, chunk.cy * CHUNK_SIZE + centre);
  const temp = chunk.terrain.avgTemp + seasonTempOffset(world.state.time);
  let rate = 0;
  if (temp > 4 && temp < 34) rate = 0.07 * Math.min(1, (temp - 4) / 10);
  rate *= 1 + w.rain;
  chunk.grass = Math.min(chunk.grassMax, chunk.grass + chunk.grassMax * rate);
}

/** Food value an animal gets from eating one piece of this plant's fruit. */
export function eatFruit(chunk: Chunk, plant: Plant): boolean {
  if (plant.fruit < 1) return false;
  const sp = PLANTS[plant.species];
  const before = fruitLevel(sp, plant);
  plant.fruit -= 1;
  if (fruitLevel(sp, plant) !== before) chunk.version++;
  return true;
}

export function fruitLevel(sp: PlantSpecies, p: Plant): number {
  if (!sp.fruit || p.fruit < 0.5) return 0;
  return Math.min(3, Math.ceil((p.fruit / sp.fruit.max) * 3));
}

function stageFor(sp: PlantSpecies, p: Plant, dayOfYear: number): PlantStage {
  if (sp.annual) {
    // Wheat sprouts in spring, stands green in early summer and ripens late summer.
    if (dayOfYear >= 90) return PlantStage.Seed;
    if (dayOfYear < 12) return PlantStage.Sprout;
    if (dayOfYear < 45) return PlantStage.Young;
    return PlantStage.Mature;
  }
  const matureDays = sp.matureYears * DAYS_PER_YEAR;
  if (p.ageDays < matureDays * 0.15) return PlantStage.Sprout;
  if (p.ageDays < matureDays) return PlantStage.Young;
  if (p.ageDays < p.lifespanDays * 0.8) return PlantStage.Mature;
  return PlantStage.Old;
}

/** Drops a seed somewhere nearby; it only takes root if the spot suits it. */
function trySpread(world: World, sp: PlantSpecies, parent: Plant): void {
  const rng = world.state.rng;
  const x = parent.x + randInt(rng, -sp.spreadRadius, sp.spreadRadius);
  const y = parent.y + randInt(rng, -sp.spreadRadius, sp.spreadRadius);
  const chunk = world.chunkAtTile(x, y);
  if (!chunk || chunk.plants.length >= MAX_PLANTS_PER_CHUNK) return;
  const biome = world.biomeAt(x, y);
  const density = sp.habitat[biome as keyof typeof sp.habitat] ?? 0;
  if (density <= 0 || BIOMES[biome as keyof typeof BIOMES].water) return;
  if (!world.spaceFree(x, y, sp.isTree)) return;
  // Crowding: don't exceed the natural density of this habitat.
  if (world.countPlantsAround(x, y, 2, sp.isTree) >= Math.max(1, Math.round(density * 25))) return;

  addPlant(world, chunk, {
    id: world.newId(),
    species: sp.id,
    x,
    y,
    ageDays: 0,
    lifespanDays: randRange(rng, sp.lifespanYears[0], sp.lifespanYears[1]) * DAYS_PER_YEAR,
    stage: PlantStage.Seed,
    health: 1,
    fruit: 0,
  });
  chunk.version++;
}

function addPlant(world: World, chunk: Chunk, plant: Plant): void {
  chunk.plants.push(plant);
  world.setOccupied(plant.x, plant.y, PLANTS[plant.species].isTree ? 2 : 1);
}

function removePlantAt(world: World, chunk: Chunk, index: number): void {
  const p = chunk.plants[index];
  world.setOccupied(p.x, p.y, 0);
  chunk.plants[index] = chunk.plants[chunk.plants.length - 1];
  chunk.plants.pop();
}

/** Spacing check that only looks inside one chunk (used during generation). */
function localSpaceFree(chunk: Chunk, lx: number, ly: number, isTree: boolean): boolean {
  if (chunk.occupied[ly * CHUNK_SIZE + lx] !== 0) return false;
  if (!isTree) return true;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = lx + dx;
      const ny = ly + dy;
      if (nx < 0 || ny < 0 || nx >= CHUNK_SIZE || ny >= CHUNK_SIZE) continue;
      if (chunk.occupied[ny * CHUNK_SIZE + nx] === 2) return false;
    }
  }
  return true;
}

function chunkTileTemp(chunk: Chunk, p: Plant): number {
  const lx = p.x - chunk.cx * CHUNK_SIZE;
  const ly = p.y - chunk.cy * CHUNK_SIZE;
  return chunk.terrain.temps[ly * CHUNK_SIZE + lx];
}

function inWindow(day: number, from: number, to: number): boolean {
  return day >= from && day <= to;
}
