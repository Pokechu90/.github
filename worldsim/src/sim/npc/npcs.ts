/**
 * Runs everyone, every tick: needs rise, health changes, actions progress,
 * and people who finish an action (or are in urgent need) decide again.
 */
import { isNight } from '../../shared/time';
import { randInt, randRange } from '../../shared/rng';
import type { Npc } from '../state';
import type { World } from '../world';
import { decide, updateInfant } from './brain';
import { WALK_SPEED, performAction } from './actions';
import { ageYears, createNpc, rel } from './people';
import { remember } from './memory';
import { foundSettlement, placeBuilding, findBuildSpot } from '../society/settlement';

export function updateNpcs(world: World, dt: number): void {
  const night = isNight(world.state.time);
  for (const n of world.state.npcs) {
    updateNeeds(world, n, dt, night);
    n.ageDays += dt / 1440;
    if (updateInfant(world, n)) continue;
    if (world.chatting.has(n.id)) {
      n.action = { kind: 'talk', targetId: -2, timer: 30 };
      n.path = [];
      continue;
    }
    // At high speed one tick can be an hour long: let people finish several
    // short actions within it instead of wasting the rest of the hour.
    let remaining = dt;
    for (let guard = 0; remaining > 0.01 && guard < 8; guard++) {
      const step = n.action.kind === 'walk'
        ? Math.min(remaining, Math.max(0.5, walkTimeLeft(n)))
        : Math.min(remaining, Math.max(0.5, n.action.timer));
      n.action.timer -= step;
      performAction(world, n, step);
      remaining -= step;
      const urgent =
        (n.needs.hunger > 0.9 && n.action.kind !== 'eat' && n.action.then !== 'eat' && n.action.task !== 'forage-eat') ||
        (n.needs.energy > 0.95 && n.action.kind !== 'sleep' && n.action.then !== 'sleep');
      if (n.action.timer <= 0 || (urgent && n.action.timer > 30)) decide(world, n);
      else if (n.action.kind !== 'walk' && n.action.timer > remaining) {
        // Long action: spend the rest of the tick on it in one go.
        n.action.timer -= remaining;
        performAction(world, n, remaining);
        remaining = 0;
      }
    }
  }
}

function walkTimeLeft(n: Npc): number {
  let d = 0;
  let x = n.x;
  let y = n.y;
  for (let i = n.pathIndex; i < n.path.length; i += 2) {
    d += Math.hypot(n.path[i] - x, n.path[i + 1] - y);
    x = n.path[i];
    y = n.path[i + 1];
  }
  return d / WALK_SPEED + 0.01;
}

function updateNeeds(world: World, n: Npc, dt: number, night: boolean): void {
  const nd = n.needs;
  const day = dt / 1440;
  const ill = n.illness ? 1 + n.illness.severity : 1;
  const age = ageYears(n);
  const a = n.action.kind;

  nd.hunger = Math.min(1, nd.hunger + day / 1.5 * (n.pregnantDays >= 0 ? 1.2 : 1));
  if (a !== 'sleep') nd.energy = Math.min(1, nd.energy + (dt / (16 * 60)) * ill * (age > 65 ? 1.2 : 1) * (age < 8 ? 1.2 : 1));
  if (a !== 'talk') nd.social = Math.min(1, nd.social + day / 1.5 * (0.4 + n.traits.extraversion));
  if (a !== 'work' && a !== 'learn' && a !== 'play') {
    nd.purpose = Math.min(1, nd.purpose + day / 1.2 * (0.5 + n.traits.conscientiousness) * (age >= 13 ? 1 : 0.3));
  }

  // Safety: out alone in the dark, or without a home, feels unsafe.
  const home = world.building(n.homeId);
  const atHome = home && Math.hypot(home.x - n.x, home.y - n.y) < 2;
  let target = 0;
  if (night && !atHome && a !== 'sleep') target += 0.5 + n.traits.neuroticism * 0.4;
  if (n.homeId < 0) target += 0.25;
  if (n.illness) target += 0.15;
  nd.safety += (Math.min(1, target) - nd.safety) * Math.min(1, dt / 90);

  // Health: hunger hurts; otherwise the body slowly heals.
  if (nd.hunger >= 1) n.health -= dt / (8 * 1440);
  else if (!n.illness) n.health = Math.min(1, n.health + dt / (5 * 1440));
  if (nd.energy >= 1) n.health -= dt / (30 * 1440);
}

/** The first people: ten settlers in three families plus a grandmother. */
export function createStartingSettlement(world: World, x: number, y: number): void {
  const s = foundSettlement(world, x, y, -1);
  s.stock.fruit = 25;
  s.stock.meat = 12;
  s.stock.fish = 6;
  s.stock.wood = 20;
  world.log(`A small band of settlers made camp at ${s.name}.`, 'settlement', -1);

  const rng = world.state.rng;
  const at = () => ({ x: s.x + randRange(rng, -3, 3), y: s.y + randRange(rng, -3, 3) });
  const add = (o: Parameters<typeof createNpc>[1]) => {
    const n = createNpc(world, o);
    world.state.npcs.push(n);
    return n;
  };
  const couple = (ageA: number, ageB: number) => {
    const m = add({ ...at(), sex: 'male', ageYears: ageA, settlementId: s.id });
    const f = add({ ...at(), sex: 'female', ageYears: ageB, settlementId: s.id, lastName: m.lastName });
    m.orientation = 'opposite';
    f.orientation = 'opposite';
    m.partnerId = f.id;
    f.partnerId = m.id;
    m.married = f.married = true;
    for (const [a, b] of [[m, f], [f, m]]) {
      const r = rel(a, b.id);
      r.affinity = randRange(rng, 0.5, 0.85);
      r.familiarity = 0.9;
      r.romance = 0.8;
    }
    return [m, f] as const;
  };
  const child = (father: Npc, mother: Npc, age: number) => {
    const c = add({ ...at(), ageYears: age, settlementId: s.id, mother, father });
    for (const p of [father, mother]) {
      rel(c, p.id).affinity = 0.8;
      rel(c, p.id).familiarity = 0.9;
      rel(p, c.id).affinity = 0.85;
      rel(p, c.id).familiarity = 0.9;
    }
    return c;
  };

  const [a1, a2] = couple(34, 31);
  const k1 = child(a1, a2, 10);
  const k2 = child(a1, a2, 6);
  const [b1, b2] = couple(27, 26);
  child(b1, b2, 1);
  const [c1, c2] = couple(22, 21);
  const elder = add({ ...at(), sex: 'female', ageYears: 63, settlementId: s.id, lastName: a1.lastName });
  // The elder is the first family's grandmother.
  a1.motherId = elder.id;
  elder.childrenIds.push(a1.id);

  // Everyone has known each other a while.
  const all = world.state.npcs.filter((n) => n.settlementId === s.id);
  for (const p of all) {
    for (const q of all) {
      if (p === q) continue;
      const r = rel(p, q.id);
      r.familiarity = Math.max(r.familiarity, randRange(rng, 0.3, 0.6));
      if (r.affinity === 0) r.affinity = randRange(rng, -0.15, 0.35);
    }
    remember(world, p, `We settled here at ${s.name} to start a new life.`, { importance: 0.9, feeling: 0.5, eventId: s.id });
  }

  // Homes for each household.
  const households: Npc[][] = [[a1, a2, k1, k2], [b1, b2], [c1, c2], [elder]];
  for (const n of all) if (ageYears(n) < 3 && n.motherId === b2.id) households[1].push(n);
  for (const h of households) {
    const spot = findBuildSpot(world, s, 1) ?? { x: s.x + randInt(rng, -5, 5), y: s.y + randInt(rng, -5, 5) };
    const hut = placeBuilding(world, s, 'hut', spot.x, spot.y, 1);
    for (const n of h) n.homeId = hut.id;
  }
  world.hooks.onSettlementFounded?.(world, s);
  world.assignJobsFor(s);
}
