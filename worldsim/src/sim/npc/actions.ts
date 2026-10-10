/**
 * Carrying out what people decided to do: walking (with pathfinding), eating,
 * sleeping, talking, and every kind of work. Each job is a little loop:
 * find a target -> walk there -> work -> carry the result home -> repeat.
 */
import { CHUNK_SIZE, Biome } from '../../shared/terrain';
import { BUILDINGS, JOBS, RESOURCES } from '../../shared/people';
import { PLANTS, PlantStage } from '../../shared/species';
import { chance, nextFloat, randRange } from '../../shared/rng';
import { MINUTES_PER_DAY, daylight, getCalendar, sunTimes } from '../../shared/time';
import type { Building, Npc, NpcAction, ResourceType, SkillKey } from '../state';
import type { World } from '../world';
import { findPath } from './path';
import { ageYears, clamp01, rel } from './people';
import { remember } from './memory';
import { harvestPlant, removePlantOnTile } from '../ecology/plants';
import { takeFood } from '../society/settlement';
import { converse } from './social';

export const WALK_SPEED = 2.4; // tiles per game minute
const WORK_RADIUS = 42;
const CARRY_MAX = 10;

/** Which tasks each job tries, in order of preference. */
const JOB_TASKS: Record<string, string[]> = {
  child: [],
  forager: ['forage', 'gather', 'fish', 'chop'],
  hunter: ['hunt', 'fish', 'gather'],
  fisher: ['fish', 'gather', 'forage'],
  woodcutter: ['chop', 'quarry', 'gather'],
  builder: ['build', 'quarry', 'chop'],
  farmer: ['farm', 'forage', 'gather', 'fish'],
  crafter: ['craft', 'chop', 'quarry'],
  healer: ['heal', 'gather'],
  scholar: ['research', 'teach', 'gather'],
  trader: ['trade', 'gather'],
  elder: ['teach', 'gather'],
};

// ------------------------------------------------------------------ walking

export function walkTo(world: World, n: Npc, x: number, y: number, then: NpcAction['kind'], extra: Partial<NpcAction> = {}): boolean {
  // Long journeys (migrants, traders) may cross land nobody has seen yet.
  const far = Math.hypot(x - n.x, y - n.y);
  if (far > 40) {
    for (let d = 0; d <= far; d += CHUNK_SIZE / 2) {
      const px = n.x + ((x - n.x) / far) * d;
      const py = n.y + ((y - n.y) / far) * d;
      world.ensureChunk(Math.floor(px / CHUNK_SIZE), Math.floor(py / CHUNK_SIZE));
    }
    world.ensureChunk(Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE));
  }
  const path = findPath(world, n.x, n.y, x, y);
  if (!path) return false;
  n.path = path;
  n.pathIndex = 0;
  n.dest = Math.hypot(x - path[path.length - 2], y - path[path.length - 1]) > 0.6 ? [x, y] : null;
  const dist = Math.hypot(x - n.x, y - n.y);
  n.action = { kind: 'walk', then, timer: (dist / speed(n)) * 3 + 30, ...extra };
  return true;
}

function speed(n: Npc): number {
  let s = WALK_SPEED;
  const age = ageYears(n);
  if (age < 10) s *= 0.8;
  if (age > 65) s *= 0.75;
  if (n.illness) s *= 0.7;
  if (n.carrying && n.carrying.amount > 6) s *= 0.85;
  return s;
}

/** Moves along the path. Returns true on arrival. */
function stepAlongPath(world: World, n: Npc, dt: number): boolean {
  let budget = speed(n) * dt;
  while (budget > 0 && n.pathIndex < n.path.length) {
    const tx = n.path[n.pathIndex];
    const ty = n.path[n.pathIndex + 1];
    const dx = tx - n.x;
    const dy = ty - n.y;
    const d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.05) n.facing = dx > 0 ? 1 : -1;
    const step = Math.min(d, budget);
    const nx = n.x + (dx / (d || 1)) * step;
    const ny = n.y + (dy / (d || 1)) * step;
    // Never wade into a lake or the sea: stop and think again.
    if (!world.isWalkable(nx, ny) && world.isWalkable(n.x, n.y)) {
      n.path = [];
      n.dest = null;
      n.action.timer = 0;
      return false;
    }
    if (d <= budget) {
      n.x = tx;
      n.y = ty;
      budget -= d;
      n.pathIndex += 2;
    } else {
      n.x = nx;
      n.y = ny;
      budget = 0;
    }
  }
  if (n.pathIndex < n.path.length) return false;
  // Long trip planned in legs: plan the next one.
  if (n.dest) {
    const [x, y] = n.dest;
    const path = findPath(world, n.x, n.y, x, y);
    if (!path) return true; // give up here
    n.path = path;
    n.pathIndex = 0;
    n.dest = Math.hypot(x - path[path.length - 2], y - path[path.length - 1]) > 0.6 ? [x, y] : null;
    return false;
  }
  return true;
}

// ------------------------------------------------------------------ per tick

export function performAction(world: World, n: Npc, dt: number): void {
  const a = n.action;
  switch (a.kind) {
    case 'walk':
      if (stepAlongPath(world, n, dt)) arrive(world, n);
      break;
    case 'sleep':
      n.needs.energy = Math.max(0, n.needs.energy - dt / 420);
      if (n.illness) n.health = Math.min(1, n.health + dt / (3 * MINUTES_PER_DAY));
      break;
    case 'rest':
      n.needs.energy = Math.max(0, n.needs.energy - dt / 600);
      n.health = Math.min(1, n.health + dt / (4 * MINUTES_PER_DAY));
      n.needs.social = Math.max(0, n.needs.social - dt / 600);
      break;
    case 'eat':
      break; // effect applied when the meal starts
    case 'talk':
      n.needs.social = Math.max(0, n.needs.social - dt / 40);
      break;
    case 'play':
      n.needs.social = Math.max(0, n.needs.social - dt / 120);
      n.needs.purpose = Math.max(0, n.needs.purpose - dt / 120);
      if (chance(world.state.rng, dt / 10)) wiggle(world, n, 1.5);
      break;
    case 'learn':
      n.needs.purpose = Math.max(0, n.needs.purpose - dt / 120);
      learnFromParent(world, n, dt);
      break;
    case 'work':
      n.needs.purpose = Math.max(0, n.needs.purpose - dt / 240);
      doWork(world, n, dt);
      break;
    case 'wander':
    case 'idle':
    case 'migrate':
      break;
  }
}

function wiggle(world: World, n: Npc, r: number): void {
  const x = n.x + randRange(world.state.rng, -r, r);
  const y = n.y + randRange(world.state.rng, -r, r);
  if (world.isWalkable(x, y)) {
    n.facing = x > n.x ? 1 : -1;
    n.x = x;
    n.y = y;
  }
}

/** Reached the end of a walk: start whatever the walk was for. */
function arrive(world: World, n: Npc): void {
  const a = n.action;
  const rng = world.state.rng;
  if (a.task === 'deliver') finishDelivery(world, n);
  switch (a.then) {
    case 'sleep':
      n.action = { kind: 'sleep', timer: minutesUntilMorning(world, n), targetId: a.targetId };
      break;
    case 'eat':
      startMeal(world, n);
      break;
    case 'talk': {
      const other = world.npcById(a.targetId ?? -1);
      if (other && Math.hypot(other.x - n.x, other.y - n.y) < 3 && other.action.kind !== 'sleep') {
        const willing = other.needs.social > 0.15 || rel(other, n.id).affinity > 0.2 || other.traits.extraversion > 0.6;
        const busy = other.action.kind === 'work' && other.traits.conscientiousness > 0.7;
        if (willing && !busy) {
          const minutes = randRange(rng, 20, 50);
          converse(world, n, other);
          n.action = { kind: 'talk', targetId: other.id, timer: minutes };
          other.action = { kind: 'talk', targetId: n.id, timer: minutes };
          other.path = [];
          n.facing = other.x > n.x ? 1 : -1;
          other.facing = -n.facing as 1 | -1;
          break;
        }
        const r = rel(n, other.id);
        r.affinity -= 0.01;
        n.thought = `${other.firstName} doesn't feel like talking right now.`;
      }
      n.action = { kind: 'idle', timer: randRange(rng, 10, 25) };
      break;
    }
    case 'work':
      n.action = { kind: 'work', task: a.task, targetId: a.targetId, timer: workDuration(a.task ?? '') };
      break;
    case 'play':
      n.action = { kind: 'play', timer: randRange(rng, 30, 70) };
      break;
    case 'learn':
      n.action = { kind: 'learn', targetId: a.targetId, timer: randRange(rng, 40, 90) };
      break;
    case 'rest':
      n.action = { kind: 'rest', timer: randRange(rng, 60, 150) };
      break;
    case 'migrate':
      n.action = { kind: 'idle', timer: 1 };
      break;
    default:
      n.action = { kind: 'idle', timer: randRange(rng, 10, 40) };
  }
}

function minutesUntilMorning(world: World, n: Npc): number {
  const t = world.state.time;
  const hour = (t % MINUTES_PER_DAY) / 60;
  const wake = sunTimes(t).sunrise + (n.traits.conscientiousness > 0.6 ? 0 : 0.8);
  let hours = wake - hour;
  if (hours < 0) hours += 24;
  if (daylight(t) > 0.5) hours = Math.min(hours, 1.5 + n.needs.energy * 3); // a nap
  return Math.max(30, hours * 60);
}

function workDuration(task: string): number {
  return { forage: 25, 'forage-eat': 20, gather: 75, hunt: 20, fish: 120, chop: 90, quarry: 120, build: 120, heal: 60, teach: 60, deliver: 5 }[task] ?? 90;
}

// ------------------------------------------------------------------ eating

export function startMeal(world: World, n: Npc): void {
  let relief = 0;
  // Eat what we're carrying first, if it's food.
  if (n.carrying && RESOURCES[n.carrying.type].food > 0 && n.carrying.amount >= 1) {
    while (n.needs.hunger - relief > 0.1 && n.carrying.amount >= 1) {
      n.carrying.amount -= 1;
      relief += RESOURCES[n.carrying.type].food;
    }
    if (n.carrying.amount < 0.5) n.carrying = null;
  }
  const s = world.settlement(n.settlementId);
  if (s) {
    while (n.needs.hunger - relief > 0.1) {
      const r = takeFood(s);
      if (r <= 0) break;
      relief += r;
    }
  }
  if (relief <= 0) {
    n.thought = 'The stores are empty. I need to find something to eat myself.';
    if (!forageForSelf(world, n)) n.action = { kind: 'idle', timer: 30 };
    return;
  }
  n.needs.hunger = Math.max(0, n.needs.hunger - relief);
  n.lastMealTime = world.state.time;
  n.action = { kind: 'eat', timer: 25 };
  // Feed babies in the household too.
  for (const baby of world.residentsOf(n.settlementId)) {
    if (baby.homeId === n.homeId && ageYears(baby) < 4 && baby.needs.hunger > 0.3 && s) {
      const r = takeFood(s);
      if (r > 0) baby.needs.hunger = Math.max(0, baby.needs.hunger - r * 1.5);
    }
  }
}

/** Nothing in the stores: go and eat fruit off a nearby bush. */
function forageForSelf(world: World, n: Npc): boolean {
  const plant = findFruitPlant(world, n, n.x, n.y, 25);
  if (!plant) return false;
  world.reserve(plant.id, n.id);
  return walkTo(world, n, plant.x + 0.5, plant.y + 0.9, 'work', { task: 'forage-eat', targetId: plant.id });
}

// ------------------------------------------------------------------ work

export function startWork(world: World, n: Npc): boolean {
  const s = world.settlement(n.settlementId);
  if (!s) return false;
  if (n.carrying && n.carrying.amount >= 1) return deliver(world, n);
  for (const task of JOB_TASKS[n.job] ?? []) {
    if (tryTask(world, n, task)) return true;
  }
  return false;
}

function tryTask(world: World, n: Npc, task: string): boolean {
  const s = world.settlement(n.settlementId)!;
  switch (task) {
    case 'forage': {
      const plant = findFruitPlant(world, n, s.x, s.y, WORK_RADIUS);
      if (!plant) return false;
      world.reserve(plant.id, n.id);
      return walkTo(world, n, plant.x + 0.5, plant.y + 0.9, 'work', { task, targetId: plant.id });
    }
    case 'gather': {
      // Wild roots, greens, nuts and mushrooms: available outside winter.
      if (getCalendar(world.state.time).season === 3) return false;
      for (let i = 0; i < 8; i++) {
        const x = s.x + randRange(world.state.rng, -WORK_RADIUS * 0.6, WORK_RADIUS * 0.6);
        const y = s.y + randRange(world.state.rng, -WORK_RADIUS * 0.6, WORK_RADIUS * 0.6);
        const b = world.biomeAt(Math.floor(x), Math.floor(y));
        if (b === Biome.Grass || b === Biome.Forest || b === Biome.Savanna || b === Biome.Swamp || b === Biome.Taiga) {
          return walkTo(world, n, x, y, 'work', { task });
        }
      }
      return false;
    }
    case 'hunt': {
      const deer = world.nearbyAnimals(n.x, n.y, 30).filter((a) => Math.hypot(a.x - s.x, a.y - s.y) < WORK_RADIUS * 1.3);
      if (!deer.length) return false;
      deer.sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y));
      const target = deer.find((d) => !world.isReserved(d.id, n.id));
      if (!target) return false;
      world.reserve(target.id, n.id);
      return walkTo(world, n, target.x, target.y, 'work', { task, targetId: target.id });
    }
    case 'fish': {
      const spot = findShore(world, n, s.x, s.y, WORK_RADIUS);
      if (!spot) return false;
      return walkTo(world, n, spot.x, spot.y, 'work', { task });
    }
    case 'chop': {
      if (s.stock.wood > 80 + world.residentsOf(s.id).length * 2) return false;
      const tree = findTree(world, n, s.x, s.y, WORK_RADIUS);
      if (!tree) return false;
      world.reserve(tree.id, n.id);
      return walkTo(world, n, tree.x + 0.5, tree.y + 1.1, 'work', { task, targetId: tree.id });
    }
    case 'quarry': {
      if (s.stock.stone > 60 + world.residentsOf(s.id).length) return false;
      if (s.stock.wood < 20 && !s.tech.includes('masonry')) return false;
      const rock = findRock(world, s.x, s.y, WORK_RADIUS + 10);
      if (!rock) return false;
      return walkTo(world, n, rock.x, rock.y, 'work', { task });
    }
    case 'build': {
      const site = world.buildingsOf(s.id).find((b) => b.progress < 1);
      if (!site) return false;
      return walkTo(world, n, site.x + 0.5, site.y + 1.2, 'work', { task, targetId: site.id });
    }
    case 'heal': {
      const patient = world.residentsOf(s.id).find((p) => p.illness && !world.isReserved(p.id, n.id) && p.id !== n.id);
      if (!patient) return false;
      world.reserve(patient.id, n.id);
      return walkTo(world, n, patient.x + 0.6, patient.y, 'work', { task, targetId: patient.id });
    }
    case 'teach': {
      const kid = world.residentsOf(s.id).find((p) => ageYears(p) >= 4 && ageYears(p) < 15 && p.action.kind !== 'sleep');
      if (!kid) return false;
      return walkTo(world, n, kid.x + 0.8, kid.y, 'work', { task, targetId: kid.id });
    }
    default:
      // Tasks added by later systems (farming, crafting, research, trade).
      return world.hooks.tryTask?.(world, n, task) ?? false;
  }
}

function doWork(world: World, n: Npc, dt: number): void {
  const a = n.action;
  const task = a.task ?? '';
  const rng = world.state.rng;
  const s = world.settlement(n.settlementId);
  const skillOf = (k: SkillKey) => n.skills[k];
  const efficiency = ageYears(n) < 16 ? 0.5 : ageYears(n) > 65 ? 0.6 : 1;
  const tools = s && s.stock.tools > 0 ? 1.3 : 1;

  switch (task) {
    case 'forage':
    case 'forage-eat': {
      if (a.timer > dt) return; // harvesting takes a while; resolve at the end
      const found = world.findPlant(a.targetId ?? -1, n.x, n.y - 0.9);
      const got = found ? harvestPlant(found.chunk, found.plant) : null;
      world.release(a.targetId ?? -1);
      if (got) {
        const amount = got.amount * (0.7 + skillOf('foraging') * 0.6);
        gainSkill(world, n, 'foraging', 0.004);
        if (task === 'forage-eat') {
          const portions = amount / 1;
          n.needs.hunger = Math.max(0, n.needs.hunger - portions * RESOURCES[got.resource].food);
          n.lastMealTime = world.state.time;
          n.action = { kind: 'eat', timer: 20 };
          return;
        }
        addCarry(n, got.resource, amount);
      }
      // Keep picking nearby if there's room in the basket.
      if (task === 'forage' && (!n.carrying || n.carrying.amount < CARRY_MAX * 0.7)) {
        const next = findFruitPlant(world, n, n.x, n.y, 8);
        if (next && (!n.carrying || n.carrying.type === (PLANTS[next.species].shape === 'grain' ? 'grain' : 'fruit'))) {
          world.reserve(next.id, n.id);
          if (walkTo(world, n, next.x + 0.5, next.y + 0.9, 'work', { task, targetId: next.id })) return;
        }
      }
      if (n.carrying) deliver(world, n);
      else n.action = { kind: 'idle', timer: 5 };
      return;
    }
    case 'hunt': {
      const deer = world.animalById(a.targetId ?? -1);
      if (!deer) {
        world.release(a.targetId ?? -1);
        n.action = { kind: 'idle', timer: 5 };
        return;
      }
      const d = Math.hypot(deer.x - n.x, deer.y - n.y);
      if (d > 4) {
        // It moved: chase (re-plan).
        if (!walkTo(world, n, deer.x, deer.y, 'work', { task, targetId: deer.id })) n.action = { kind: 'idle', timer: 10 };
        return;
      }
      if (a.timer > dt) return;
      const p = (0.18 + skillOf('hunting') * 0.45) * tools * efficiency;
      gainSkill(world, n, 'hunting', 0.006);
      if (chance(rng, p)) {
        world.killAnimal(deer, 'hunted');
        world.release(deer.id);
        addCarry(n, 'meat', 14 + skillOf('hunting') * 8);
        remember(world, n, 'I brought down a deer.', { importance: 0.3, feeling: 0.4 });
        deliver(world, n);
      } else if (chance(rng, 0.02)) {
        n.health = Math.max(0.1, n.health - 0.3);
        remember(world, n, 'I was hurt while hunting.', { importance: 0.5, feeling: -0.6, share: `${n.firstName} was hurt while hunting.` });
        world.release(deer.id);
        n.action = { kind: 'idle', timer: 60 };
      } else {
        n.action = { ...a, timer: 20 }; // try again
        if (chance(rng, 0.3)) {
          world.release(deer.id);
          n.action = { kind: 'idle', timer: 10 };
        }
      }
      return;
    }
    case 'fish': {
      const chunk = world.chunkAtTile(n.x, n.y);
      if (chunk) {
        const stock = chunk.fishMax > 0 ? Math.min(1, chunk.fish / (chunk.fishMax * 0.3)) : 0;
        const caught = (dt / 60) * (0.6 + skillOf('fishing') * 1.0) * stock * tools * efficiency;
        chunk.fish = Math.max(0, chunk.fish - caught);
        addCarry(n, 'fish', caught);
        gainSkill(world, n, 'fishing', 0.0008 * dt / 10);
      }
      if (a.timer <= dt) deliver(world, n);
      return;
    }
    case 'chop': {
      if (a.timer > dt) return;
      const found = world.findPlant(a.targetId ?? -1, n.x, n.y - 1.1);
      world.release(a.targetId ?? -1);
      if (found) {
        const dead = found.plant.stage === PlantStage.Dead;
        removePlantOnTile(world, found.chunk, found.plant.x, found.plant.y);
        addCarry(n, 'wood', (dead ? 5 : 9) * (0.6 + skillOf('woodcutting') * 0.6) * tools * efficiency);
        gainSkill(world, n, 'woodcutting', 0.006);
        deliver(world, n);
      } else {
        n.action = { kind: 'idle', timer: 5 };
      }
      return;
    }
    case 'gather': {
      if (a.timer > dt) return;
      const chunk = world.chunkAtTile(n.x, n.y);
      const richness = chunk ? 0.5 + 0.5 * (chunk.grass / Math.max(1, chunk.grassMax)) : 0.5;
      addCarry(n, 'fruit', (1.0 + skillOf('foraging') * 1.0) * richness * efficiency * (a.timer + 75) / 75);
      gainSkill(world, n, 'foraging', 0.004);
      deliver(world, n);
      return;
    }
    case 'quarry': {
      if (a.timer > dt) return;
      addCarry(n, 'stone', (3 + skillOf('building') * 4) * tools * efficiency);
      gainSkill(world, n, 'building', 0.004);
      deliver(world, n);
      return;
    }
    case 'build': {
      const site = world.building(a.targetId ?? -1);
      if (!site || site.progress >= 1) {
        n.action = { kind: 'idle', timer: 5 };
        return;
      }
      const info = BUILDINGS[site.kind];
      site.progress = Math.min(1, site.progress + ((dt / 60) / Math.max(1, info.work)) * (0.6 + skillOf('building') * 0.8) * tools * efficiency);
      gainSkill(world, n, 'building', 0.0006 * dt / 10);
      if (site.progress >= 1) finishBuilding(world, site, n);
      world.markBuildingsChanged(site);
      return;
    }
    case 'heal': {
      const patient = world.npcById(a.targetId ?? -1);
      if (a.timer > dt) return;
      world.release(a.targetId ?? -1);
      if (patient?.illness) {
        patient.illness.daysLeft = Math.max(0, patient.illness.daysLeft - (0.5 + skillOf('medicine')));
        patient.health = Math.min(1, patient.health + 0.1);
        rel(patient, n.id).affinity = Math.min(1, rel(patient, n.id).affinity + 0.08);
        remember(world, patient, `${n.firstName} cared for me while I was sick.`, { importance: 0.4, feeling: 0.5, about: n.id });
        gainSkill(world, n, 'medicine', 0.01);
      }
      n.action = { kind: 'idle', timer: 10 };
      return;
    }
    case 'teach': {
      const kid = world.npcById(a.targetId ?? -1);
      if (kid && Math.hypot(kid.x - n.x, kid.y - n.y) < 4) {
        const job = JOBS[n.job === 'elder' ? bestSkillJob(n) : n.job];
        const skill = (job?.skill ?? 'foraging') as SkillKey;
        kid.skills[skill] = clamp01(kid.skills[skill] + (dt / 60) * 0.004 * (0.5 + kid.traits.openness));
        kid.needs.purpose = Math.max(0, kid.needs.purpose - dt / 200);
        n.needs.social = Math.max(0, n.needs.social - dt / 200);
        if (a.timer <= dt) {
          rel(kid, n.id).affinity = Math.min(1, rel(kid, n.id).affinity + 0.03);
          remember(world, kid, `${n.firstName} taught me about ${skill}.`, { importance: 0.2, feeling: 0.2, about: n.id });
        }
      }
      return;
    }
    default:
      world.hooks.doWork?.(world, n, dt);
  }
}

function bestSkillJob(n: Npc): string {
  const best = (Object.entries(n.skills) as [SkillKey, number][]).sort((a, b) => b[1] - a[1])[0][0];
  return Object.entries(JOBS).find(([, j]) => j.skill === best)?.[0] ?? 'forager';
}

function finishBuilding(world: World, site: Building, builder: Npc): void {
  const s = world.settlement(site.settlementId);
  world.log(`A new ${BUILDINGS[site.kind].name.toLowerCase()} was finished in ${s?.name ?? 'the wilds'}.`, 'build', builder.id);
  const eventId = world.newId();
  for (const n of world.residentsOf(site.settlementId)) {
    if (Math.hypot(n.x - site.x, n.y - site.y) < 12 || n.id === builder.id) {
      remember(world, n, `We finished building a ${BUILDINGS[site.kind].name.toLowerCase()}.`, { importance: 0.35, feeling: 0.4, eventId, share: null });
    }
  }
}

export function addCarry(n: Npc, type: ResourceType, amount: number): void {
  if (n.carrying && n.carrying.type !== type) return; // hands full
  if (!n.carrying) n.carrying = { type, amount: 0 };
  n.carrying.amount = Math.min(CARRY_MAX * 1.5, n.carrying.amount + amount);
}

export function deliver(world: World, n: Npc): boolean {
  const s = world.settlement(n.settlementId);
  const pile = s && world.buildingsOf(s.id).find((b) => b.kind === 'stockpile' || b.kind === 'granary');
  if (!s || !pile || !n.carrying) {
    n.action = { kind: 'idle', timer: 5 };
    return false;
  }
  if (Math.hypot(pile.x - n.x, pile.y - n.y) < 1.8) {
    world.hooks.onDelivered?.(world, n, n.carrying.type, n.carrying.amount);
    s.stock[n.carrying.type] += n.carrying.amount;
    n.carrying = null;
    n.action = { kind: 'idle', timer: 5 };
    return true;
  }
  if (!walkTo(world, n, pile.x + 0.4, pile.y + 1, 'idle')) {
    // Can't reach the stockpile: drop it in anyway (it's "nearby enough").
    s.stock[n.carrying.type] += n.carrying.amount;
    n.carrying = null;
    return false;
  }
  n.action.task = 'deliver';
  return true;
}

/** Called when a delivery walk ends. */
export function finishDelivery(world: World, n: Npc): void {
  const s = world.settlement(n.settlementId);
  if (s && n.carrying) {
    world.hooks.onDelivered?.(world, n, n.carrying.type, n.carrying.amount);
    s.stock[n.carrying.type] += n.carrying.amount;
    n.carrying = null;
  }
}

export function gainSkill(world: World, n: Npc, skill: SkillKey, amount: number): void {
  // Learning slows as you master something; curious people learn faster.
  const v = n.skills[skill];
  n.skills[skill] = clamp01(v + amount * (1 - v) * (0.6 + n.traits.openness * 0.8));
  // Practice also gives the settlement ideas (roughly 0.004 skill = 1 hour of work).
  world.hooks.onPractice?.(world, n, skill, amount * 250);
}

function learnFromParent(world: World, n: Npc, dt: number): void {
  const teacher = world.npcById(n.action.targetId ?? -1);
  if (!teacher) return;
  if (Math.hypot(teacher.x - n.x, teacher.y - n.y) > 2) {
    // Tag along.
    const dx = teacher.x - n.x;
    const dy = teacher.y - n.y;
    const d = Math.hypot(dx, dy);
    const step = Math.min(d - 1, speed(n) * dt);
    if (step > 0 && world.isWalkable(n.x + (dx / d) * step, n.y + (dy / d) * step)) {
      n.x += (dx / d) * step;
      n.y += (dy / d) * step;
      n.facing = dx > 0 ? 1 : -1;
    }
    return;
  }
  const skill = (JOBS[teacher.job]?.skill ?? 'foraging') as SkillKey;
  gainSkill(world, n, skill, 0.0005 * dt / 10);
}

// ------------------------------------------------------------------ searches

function findFruitPlant(world: World, n: Npc, cx: number, cy: number, radius: number) {
  let best = null as null | { id: number; x: number; y: number; species: number };
  let bestD = Infinity;
  forChunksInRadius(world, cx, cy, radius, (chunk) => {
    for (const p of chunk.plants) {
      if (p.fruit < 2 || p.stage === PlantStage.Dead) continue;
      if (world.isReserved(p.id, n.id)) continue;
      const dc = Math.hypot(p.x - cx, p.y - cy);
      if (dc > radius) continue;
      const d = Math.hypot(p.x - n.x, p.y - n.y) - p.fruit * 0.3; // prefer loaded plants
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
  });
  return best as null | { id: number; x: number; y: number; species: number };
}

function findTree(world: World, n: Npc, cx: number, cy: number, radius: number) {
  let best = null as null | { id: number; x: number; y: number };
  let bestD = Infinity;
  forChunksInRadius(world, cx, cy, radius, (chunk) => {
    for (const p of chunk.plants) {
      const sp = PLANTS[p.species];
      if (!sp.isTree || sp.fruit) continue; // don't fell fruit trees
      if (p.stage < PlantStage.Mature) continue;
      if (world.isReserved(p.id, n.id)) continue;
      const dc = Math.hypot(p.x - cx, p.y - cy);
      if (dc > radius || dc < 5) continue; // leave the trees right in the village
      // Dead trees first, then the closest.
      const d = Math.hypot(p.x - n.x, p.y - n.y) - (p.stage === PlantStage.Dead ? 15 : 0);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
  });
  return best as null | { id: number; x: number; y: number };
}

function findShore(world: World, n: Npc, cx: number, cy: number, radius: number): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  forChunksInRadius(world, cx, cy, radius, (chunk) => {
    if (chunk.fishMax <= 0 || chunk.fish < chunk.fishMax * 0.1) return;
    for (let k = 0; k < chunk.shore.length; k += 3) {
      const i = chunk.shore[k];
      const x = chunk.cx * CHUNK_SIZE + (i % CHUNK_SIZE) + 0.5;
      const y = chunk.cy * CHUNK_SIZE + ((i / CHUNK_SIZE) | 0) + 0.5;
      if (Math.hypot(x - cx, y - cy) > radius) continue;
      const d = Math.hypot(x - n.x, y - n.y) + nextFloat(world.state.rng) * 6;
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  });
  return best;
}

const rockCache = new Map<number, { x: number; y: number } | null>();
function findRock(world: World, cx: number, cy: number, radius: number): { x: number; y: number } | null {
  const key = Math.floor(cx) * 100003 + Math.floor(cy);
  if (rockCache.has(key)) return rockCache.get(key)!;
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (let dy = -radius; dy <= radius; dy += 2) {
    for (let dx = -radius; dx <= radius; dx += 2) {
      const x = Math.floor(cx) + dx;
      const y = Math.floor(cy) + dy;
      if (world.biomeAt(x, y) !== Biome.Mountain) continue;
      // Stand on a walkable neighbour.
      const d = Math.hypot(dx, dy);
      if (d < bestD && d <= radius) {
        bestD = d;
        best = { x: x + 0.5, y: y + 0.5 };
      }
    }
  }
  rockCache.set(key, best);
  return best;
}

export function forChunksInRadius(world: World, cx: number, cy: number, radius: number, fn: (c: import('../state').Chunk) => void): void {
  const c0x = Math.floor((cx - radius) / CHUNK_SIZE);
  const c1x = Math.floor((cx + radius) / CHUNK_SIZE);
  const c0y = Math.floor((cy - radius) / CHUNK_SIZE);
  const c1y = Math.floor((cy + radius) / CHUNK_SIZE);
  for (let y = c0y; y <= c1y; y++) for (let x = c0x; x <= c1x; x++) {
    const c = world.getChunk(x, y);
    if (c) fn(c);
  }
}

