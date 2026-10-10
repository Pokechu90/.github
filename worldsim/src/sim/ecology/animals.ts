/**
 * Animals (milestone 1: deer).
 *
 * Every deer has needs (hunger, thirst, tiredness) that rise over time. When it
 * finishes what it's doing, it looks at its needs and surroundings and picks
 * the most pressing thing: drink, eat grass or fruit, sleep, or wander with
 * its herd. Grass is a shared, limited resource that stops growing in winter,
 * so herds boom in good years and starve back in hard winters. No population
 * numbers are scripted; they emerge.
 *
 * Fawns are born in spring/summer after autumn mating, stay near their mother,
 * and grow up. Deer die of hunger, thirst or old age.
 */
import { CHUNK_SIZE, BIOMES } from '../../shared/terrain';
import { ANIMALS, PLANTS, PlantStage } from '../../shared/species';
import { DAYS_PER_YEAR, MINUTES_PER_DAY, getCalendar, isNight } from '../../shared/time';
import { chance, nextFloat, randInt, randRange, type Rng } from '../../shared/rng';
import type { Animal, Chunk, Plant, WalkPurpose } from '../state';
import type { World } from '../world';
import { eatFruit } from './plants';

/** Safety valve so a runaway population can never freeze the browser. */
export const MAX_ANIMALS = 4000;

export function spawnInitialAnimals(world: World, chunk: Chunk, rng: Rng, force = false): void {
  // Only fairly grassy chunks start with a herd.
  if (chunk.grassMax < 260 || (!force && !chance(rng, 0.35))) return;
  const deer = ANIMALS[0];
  const size = randInt(rng, 3, 7);
  let cx = 0;
  let cy = 0;
  for (let tries = 0; tries < 30; tries++) {
    cx = chunk.cx * CHUNK_SIZE + randInt(rng, 4, CHUNK_SIZE - 5);
    cy = chunk.cy * CHUNK_SIZE + randInt(rng, 4, CHUNK_SIZE - 5);
    if (isGrazable(world, cx, cy)) break;
  }
  if (!isGrazable(world, cx, cy)) return;
  for (let i = 0; i < size; i++) {
    const x = cx + randRange(rng, -2, 2);
    const y = cy + randRange(rng, -2, 2);
    if (!world.isWalkable(x, y)) continue;
    world.state.animals.push(
      makeAnimal(world, rng, x, y, randRange(rng, deer.adultYears, 8) * DAYS_PER_YEAR, -1),
    );
  }
}

function makeAnimal(world: World, rng: Rng, x: number, y: number, ageDays: number, motherId: number): Animal {
  const sp = ANIMALS[0];
  return {
    id: world.newId(),
    species: sp.id,
    sex: chance(rng, 0.5) ? 'female' : 'male',
    x,
    y,
    facing: chance(rng, 0.5) ? 1 : -1,
    ageDays,
    lifespanDays: randRange(rng, sp.lifespanYears[0], sp.lifespanYears[1]) * DAYS_PER_YEAR,
    hunger: randRange(rng, 0, 0.3),
    thirst: randRange(rng, 0, 0.3),
    tiredness: randRange(rng, 0, 0.3),
    health: 1,
    action: 'idle',
    purpose: 'wander',
    targetX: x,
    targetY: y,
    targetPlant: -1,
    timer: randRange(rng, 0, 30),
    pregnantDays: -1,
    motherId,
    waterX: -1,
    waterY: -1,
  };
}

/** Moves every animal forward by `dt` game minutes. */
export function updateAnimals(world: World, dt: number, focus: { x: number; y: number } | null = null): void {
  const animals = world.state.animals;
  const rng = world.state.rng;
  const night = isNight(world.state.time);

  for (let i = animals.length - 1; i >= 0; i--) {
    const a = animals[i];
    const sp = ANIMALS[a.species];
    // Far from the camera, animals are simulated once a day (updateDistantAnimalsDaily).
    if (focus && Math.hypot(a.x - focus.x, a.y - focus.y) > DETAIL_RADIUS) continue;

    // --- Body ---
    a.ageDays += dt / MINUTES_PER_DAY;
    a.hunger = Math.min(1, a.hunger + dt / (sp.hungerDays * MINUTES_PER_DAY));
    a.thirst = Math.min(1, a.thirst + dt / (sp.thirstDays * MINUTES_PER_DAY));
    if (a.action === 'sleep') a.tiredness = Math.max(0, a.tiredness - dt / 420);
    else a.tiredness = Math.min(1, a.tiredness + dt / 1080);

    if (a.hunger >= 1 || a.thirst >= 1) a.health -= dt / (3 * MINUTES_PER_DAY);
    else a.health = Math.min(1, a.health + dt / (4 * MINUTES_PER_DAY));

    // --- Death ---
    const cause =
      a.health <= 0 ? (a.thirst >= 1 ? 'thirst' : 'starvation') : a.ageDays >= a.lifespanDays ? 'old age' : null;
    if (cause) {
      world.recordDeath(cause);
      animals[i] = animals[animals.length - 1];
      animals.pop();
      continue;
    }

    // --- Pregnancy ---
    if (a.pregnantDays >= 0) {
      a.pregnantDays += dt / MINUTES_PER_DAY;
      if (a.pregnantDays >= sp.gestationDays) giveBirth(world, a);
    }

    // --- Behaviour ---
    a.timer -= dt;
    act(world, a, dt, night);
    if (a.timer <= 0) decide(world, a, night, rng);
  }
}

const DETAIL_RADIUS = 110;

/** A day in the life of animals far from the camera, in one cheap step. */
export function updateDistantAnimalsDaily(world: World, focus: { x: number; y: number } | null): void {
  if (!focus) return;
  const animals = world.state.animals;
  for (let i = animals.length - 1; i >= 0; i--) {
    const a = animals[i];
    if (Math.hypot(a.x - focus.x, a.y - focus.y) <= DETAIL_RADIUS) continue;
    const sp = ANIMALS[a.species];
    a.ageDays += 1;
    const chunk = world.chunkAtTile(a.x, a.y);
    const meal = sp.grassPerMeal * (1 / sp.hungerDays);
    if (chunk && chunk.grass > meal) {
      chunk.grass -= meal;
      a.hunger = 0.2;
      a.health = Math.min(1, a.health + 0.25);
    } else {
      a.hunger = Math.min(1, a.hunger + 1 / sp.hungerDays);
      // Hungry herds drift towards greener land.
      const nx = a.x + (world.rand() - 0.5) * 16;
      const ny = a.y + (world.rand() - 0.5) * 16;
      if (world.isWalkable(nx, ny)) {
        a.x = nx;
        a.y = ny;
      }
      if (a.hunger >= 1) a.health -= 1 / 3;
    }
    a.thirst = 0.2;
    if (a.pregnantDays >= 0 && (a.pregnantDays += 1) >= sp.gestationDays) giveBirth(world, a);
    const cause = a.health <= 0 ? 'starvation' : a.ageDays >= a.lifespanDays ? 'old age' : null;
    if (cause) {
      world.recordDeath(cause);
      animals[i] = animals[animals.length - 1];
      animals.pop();
    }
  }
}

/** Once a day: mating season, and herds wandering into empty land. */
export function updateAnimalsDaily(world: World): void {
  const season = getCalendar(world.state.time).season;
  const rng = world.state.rng;
  // Animals from beyond the explored world slowly recolonise empty grassland.
  if (world.state.animals.length < MAX_ANIMALS / 2) {
    for (const chunk of world.state.chunks.values()) {
      if (chunk.grassMax < 260 || !chance(rng, 0.0004)) continue;
      if (world.animalsInChunk(chunk.cx, chunk.cy).length > 0) continue;
      spawnInitialAnimals(world, chunk, rng, true);
    }
  }
  if (world.state.animals.length >= MAX_ANIMALS) return;
  for (const a of world.state.animals) {
    const sp = ANIMALS[a.species];
    if (season !== sp.matingSeason || a.sex !== 'female' || a.pregnantDays >= 0) continue;
    if (a.ageDays < sp.adultYears * DAYS_PER_YEAR || a.hunger > 0.6 || a.health < 0.6) continue;
    const mate = world.nearbyAnimals(a.x, a.y, 14).find(
      (b) => b.sex === 'male' && b.species === a.species && b.ageDays >= sp.adultYears * DAYS_PER_YEAR,
    );
    if (mate && chance(rng, 0.2)) a.pregnantDays = 0;
  }
}

function giveBirth(world: World, mother: Animal): void {
  const sp = ANIMALS[mother.species];
  mother.pregnantDays = -1;
  // A starving mother may lose the pregnancy.
  if (mother.hunger > 0.8 || world.state.animals.length >= MAX_ANIMALS) return;
  const n = randInt(world.state.rng, sp.litter[0], sp.litter[1]);
  for (let k = 0; k < n; k++) {
    const fawn = makeAnimal(world, world.state.rng, mother.x, mother.y, 0, mother.id);
    fawn.hunger = 0;
    fawn.thirst = 0;
    world.state.animals.push(fawn);
    world.state.stats.births++;
  }
}

/** Carries out the current action for `dt` minutes. */
function act(world: World, a: Animal, dt: number, night: boolean): void {
  switch (a.action) {
    case 'walk': {
      const sp = ANIMALS[a.species];
      const dx = a.targetX - a.x;
      const dy = a.targetY - a.y;
      const dist = Math.hypot(dx, dy);
      const urgent = a.purpose === 'drink' && a.thirst > 0.8;
      const step = sp.speed * (urgent ? 1.6 : 1) * dt;
      if (Math.abs(dx) > 0.05) a.facing = dx > 0 ? 1 : -1;
      if (dist <= step || dist < 0.15) {
        a.x = a.targetX;
        a.y = a.targetY;
        arrive(world, a);
      } else {
        const nx = a.x + (dx / dist) * step;
        const ny = a.y + (dy / dist) * step;
        if (world.isWalkable(nx, ny)) {
          a.x = nx;
          a.y = ny;
        } else {
          a.timer = 0; // blocked: rethink
        }
      }
      break;
    }
    case 'graze': {
      const chunk = world.chunkAtTile(a.x, a.y);
      const sp = ANIMALS[a.species];
      if (!chunk || chunk.grass <= 0 || !isGrazable(world, a.x, a.y)) {
        a.timer = 0;
        break;
      }
      const eaten = Math.min(a.hunger, dt / 90);
      a.hunger -= eaten;
      chunk.grass = Math.max(0, chunk.grass - eaten * sp.grassPerMeal);
      if (a.hunger <= 0.02) a.timer = 0;
      break;
    }
    case 'drink':
      a.thirst = Math.max(0, a.thirst - dt / 8);
      if (a.thirst <= 0) a.timer = 0;
      break;
    case 'sleep':
      if (!night && a.tiredness < 0.1) a.timer = 0;
      break;
    case 'eat':
    case 'idle':
      break;
  }
}

function arrive(world: World, a: Animal): void {
  const rng = world.state.rng;
  switch (a.purpose) {
    case 'drink':
      a.action = 'drink';
      a.timer = 20;
      a.waterX = a.x;
      a.waterY = a.y;
      break;
    case 'graze':
      a.action = 'graze';
      a.timer = randRange(rng, 40, 120);
      break;
    case 'fruit': {
      const found = world.findPlant(a.targetPlant, a.x, a.y);
      a.action = 'eat';
      a.timer = 15;
      if (found && eatFruit(found.chunk, found.plant)) a.hunger = Math.max(0, a.hunger - 0.35);
      break;
    }
    default:
      a.action = 'idle';
      a.timer = randRange(rng, 10, 50);
  }
}

/** Picks the next thing to do, based on needs and surroundings. */
function decide(world: World, a: Animal, night: boolean, rng: Rng): void {
  const young = a.ageDays < ANIMALS[a.species].adultYears * DAYS_PER_YEAR * 0.4;

  // 1. Thirst is the most urgent need.
  if (a.thirst > 0.5) {
    const water = findWater(world, a);
    if (walkTo(world, a, water.x, water.y, water.explore ? 'wander' : 'drink')) return;
  }

  // 2. Hunger: fruit is a treat, grass is the staple.
  if (a.hunger > 0.4) {
    const fruit = findFruit(world, a, 7);
    if (fruit && walkTo(world, a, fruit.x, fruit.y, 'fruit', fruit.id)) return;
    const chunk = world.chunkAtTile(a.x, a.y);
    if (chunk && chunk.grass > 1 && isGrazable(world, a.x, a.y)) {
      a.action = 'graze';
      a.timer = randRange(rng, 40, 120);
      return;
    }
    const spot = findGrazing(world, a, rng);
    if (spot && walkTo(world, a, spot.x, spot.y, 'graze')) return;
  }

  // 3. Sleep at night or when exhausted.
  if ((night && a.tiredness > 0.25) || a.tiredness > 0.85) {
    a.action = 'sleep';
    a.timer = randRange(rng, 180, 420);
    return;
  }

  // 4. Otherwise stay with the herd (or mum), nibbling and wandering.
  const mother = young && a.motherId >= 0 ? world.animalById(a.motherId) : undefined;
  let tx: number;
  let ty: number;
  if (mother) {
    tx = mother.x + randRange(rng, -1.5, 1.5);
    ty = mother.y + randRange(rng, -1.5, 1.5);
  } else {
    const herd = world.nearbyAnimals(a.x, a.y, 10);
    let hx = a.x;
    let hy = a.y;
    if (herd.length > 1) {
      hx = herd.reduce((s, b) => s + b.x, 0) / herd.length;
      hy = herd.reduce((s, b) => s + b.y, 0) / herd.length;
    }
    tx = hx + randRange(rng, -6, 6);
    ty = hy + randRange(rng, -6, 6);
  }
  if (chance(rng, 0.35) || !walkTo(world, a, tx, ty, mother ? 'follow' : 'wander')) {
    a.action = 'idle';
    a.timer = randRange(rng, 15, 60);
  }
}

/** Starts walking to a point if there's a clear straight path. */
function walkTo(world: World, a: Animal, x: number, y: number, purpose: WalkPurpose, plantId = -1): boolean {
  if (!clearPath(world, a.x, a.y, x, y)) return false;
  a.action = 'walk';
  a.purpose = purpose;
  a.targetX = x;
  a.targetY = y;
  a.targetPlant = plantId;
  // Give up if it takes far longer than expected.
  a.timer = (Math.hypot(x - a.x, y - a.y) / ANIMALS[a.species].speed) * 3 + 10;
  return true;
}

function clearPath(world: World, x0: number, y0: number, x1: number, y1: number): boolean {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(dist / 0.7);
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    if (!world.isWalkable(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}

function isGrazable(world: World, x: number, y: number): boolean {
  const b = world.biomeAt(Math.floor(x), Math.floor(y));
  return b >= 0 && BIOMES[b as keyof typeof BIOMES].grass >= 0.2;
}

/** Nearest drinking spot: the remembered one, or the closest shore nearby. */
function findWater(world: World, a: Animal): { x: number; y: number; explore: boolean } {
  let best: { x: number; y: number; explore: boolean } | null = null;
  let bestD = Infinity;
  if (a.waterX >= 0 || a.waterY >= 0) {
    const d = Math.hypot(a.waterX - a.x, a.waterY - a.y);
    if (d < 40) {
      best = { x: a.waterX, y: a.waterY, explore: false };
      bestD = d * 1.3; // prefer something closer if there is one
    }
  }
  const ccx = Math.floor(a.x / CHUNK_SIZE);
  const ccy = Math.floor(a.y / CHUNK_SIZE);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const c = world.getChunk(ccx + dx, ccy + dy);
      if (!c) continue;
      for (const i of c.shore) {
        const x = c.cx * CHUNK_SIZE + (i % CHUNK_SIZE) + 0.5;
        const y = c.cy * CHUNK_SIZE + ((i / CHUNK_SIZE) | 0) + 0.5;
        const d = Math.hypot(x - a.x, y - a.y);
        if (d < bestD && clearPath(world, a.x, a.y, x, y)) {
          bestD = d;
          best = { x, y, explore: false };
        }
      }
    }
  }
  if (best) return best;
  // No water in sight: head off in a random direction to explore.
  const ang = nextFloat(world.state.rng) * Math.PI * 2;
  return { x: a.x + Math.cos(ang) * 14, y: a.y + Math.sin(ang) * 14, explore: true };
}

function findFruit(world: World, a: Animal, radius: number): Plant | null {
  const chunk = world.chunkAtTile(a.x, a.y);
  if (!chunk) return null;
  let best: Plant | null = null;
  let bestD = radius;
  for (const p of chunk.plants) {
    if (p.fruit < 1 || p.stage === PlantStage.Dead) continue;
    // Deer can reach bushes, grain and windfall apples, not cactus fruit.
    if (PLANTS[p.species].shape === 'cactus') continue;
    const d = Math.hypot(p.x + 0.5 - a.x, p.y + 0.5 - a.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Picks a grassy spot, preferring whichever nearby chunk has the most food. */
function findGrazing(world: World, a: Animal, rng: Rng): { x: number; y: number } | null {
  const ccx = Math.floor(a.x / CHUNK_SIZE);
  const ccy = Math.floor(a.y / CHUNK_SIZE);
  let bestChunk: Chunk | undefined;
  let bestGrass = 1;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const c = world.getChunk(ccx + dx, ccy + dy);
      if (c && c.grass > bestGrass) {
        bestGrass = c.grass;
        bestChunk = c;
      }
    }
  }
  if (!bestChunk) return null;
  for (let tries = 0; tries < 8; tries++) {
    // Head towards the better chunk, but not further than ~12 tiles at a time.
    const tx = bestChunk.cx * CHUNK_SIZE + randRange(rng, 0, CHUNK_SIZE);
    const ty = bestChunk.cy * CHUNK_SIZE + randRange(rng, 0, CHUNK_SIZE);
    const d = Math.hypot(tx - a.x, ty - a.y);
    const k = d > 12 ? 12 / d : 1;
    const x = a.x + (tx - a.x) * k;
    const y = a.y + (ty - a.y) * k;
    if (isGrazable(world, x, y) && clearPath(world, a.x, a.y, x, y)) return { x, y };
  }
  return null;
}
