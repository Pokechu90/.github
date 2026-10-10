/**
 * The space age.
 *
 *  - Astronomy: with writing and mathematics people chart the planets they can
 *    see; telescopes (printing) and later instruments reveal nearby stars.
 *  - Rocketry: settlements with a launch pad send probes to every planet in
 *    the home system, revealing what they're really like.
 *  - Spaceflight: crewed missions (brave, and sometimes tragic) and
 *    interstellar probes that push the map outward.
 *  - Colonization: colony ships carry volunteers to the most habitable known
 *    worlds. Colonies grow according to how habitable their planet is, and in
 *    time send out ships of their own, so humanity keeps spreading.
 */
import { describeHabitability, planetById, planetsOf, starById, starsNear, type Planet } from '../../shared/galaxy';
import type { Settlement } from '../state';
import type { SpaceViewData } from '../../shared/protocol';
import type { World } from '../world';
import { ageYears, fullName, isAdult, killNpc } from '../npc/people';
import { remember } from '../npc/memory';
import { hasTech } from '../society/tech';
import { population } from '../society/work';

export interface Mission {
  id: number;
  kind: 'probe' | 'crewed' | 'interstellar' | 'colony';
  from: string; // settlement or colony name
  fromStar: string;
  targetStar: string;
  targetPlanet: string | null;
  launchDay: number;
  arriveDay: number;
  crew: string[];
  colonists: number;
  status: 'travelling' | 'arrived' | 'lost';
}

export interface Colony {
  id: number;
  name: string;
  planetId: string;
  foundedDay: number;
  population: number;
  founders: string[];
  parent: string;
  lastShipDay: number;
  lastProbeDay: number;
  habitability: number;
}

export interface SpaceState {
  knownStars: string[];
  /** Planets whose orbits are charted (seen, but not visited). */
  charted: string[];
  /** Planets explored up close (all details known). */
  explored: string[];
  missions: Mission[];
  colonies: Colony[];
  launches: number;
  /** Recent launches (for the rocket animation): [x, y, day]. */
  recentLaunches: [number, number, number][];
}

export function emptySpace(): SpaceState {
  return { knownStars: ['0,0,0'], charted: [], explored: [], missions: [], colonies: [], launches: 0, recentLaunches: [] };
}

const HOME_STAR = '0,0,0';
/** Light-years per game year for interstellar travel. */
function travelSpeed(s: { tech: string[] } | null): number {
  if (s && s.tech.includes('warp_drive')) return 3;
  if (s && s.tech.includes('fusion')) return 0.8;
  return 0.35;
}

export function spaceDaily(world: World): void {
  const sp = world.state.space;
  const seed = world.state.seed;
  const day = Math.floor(world.state.time / 1440);
  const home = starById(seed, HOME_STAR)!;
  const homePlanets = planetsOf(seed, home);

  // Best (most advanced) settlement leads astronomy.
  const settlements = world.state.settlements.filter((s) => !s.abandoned);
  const leading = settlements.slice().sort((a, b) => b.tech.length - a.tech.length)[0];
  if (!leading) return;

  // --- Astronomy: chart planets and stars as instruments improve.
  if (hasTech(leading, 'mathematics')) {
    for (const p of homePlanets.slice(0, 6)) addUnique(sp.charted, p.id);
  }
  if (hasTech(leading, 'printing')) {
    for (const p of homePlanets) addUnique(sp.charted, p.id);
    const reach = hasTech(leading, 'computing') ? 32 : hasTech(leading, 'electricity') ? 20 : 12;
    for (const st of starsNear(seed, 0, 0, reach)) {
      if (addUnique(sp.knownStars, st.id) && sp.knownStars.length > 1 && sp.knownStars.length % 5 === 0) {
        world.log(`Astronomers of ${leading.name} have now catalogued ${sp.knownStars.length} stars.`, 'space', -1);
      }
    }
  }
  addUnique(sp.explored, homePlanets[2].id);

  // --- Launches from settlements with a working launch pad.
  for (const s of settlements) {
    const pad = world.buildingsOf(s.id).find((b) => b.kind === 'launchpad' && b.progress >= 1);
    if (!pad || !hasTech(s, 'rocketry')) continue;
    if (day % 30 !== s.id % 30) continue; // each pad considers a launch about monthly
    tryLaunch(world, s, pad.x, pad.y, day, homePlanets);
  }

  // --- Missions in flight.
  for (const m of sp.missions) {
    if (m.status !== 'travelling' || day < m.arriveDay) continue;
    arrive(world, m, day);
  }
  if (sp.missions.length > 300) sp.missions = sp.missions.filter((m) => m.status === 'travelling').concat(sp.missions.filter((m) => m.status !== 'travelling').slice(-150));

  // --- Colonies grow, explore and send their own ships.
  for (const c of sp.colonies) colonyDaily(world, c, day);
  sp.recentLaunches = sp.recentLaunches.filter((l) => day - l[2] < 2);
}

function addUnique(list: string[], id: string): boolean {
  if (list.includes(id)) return false;
  list.push(id);
  return true;
}

function tryLaunch(world: World, s: Settlement, x: number, y: number, day: number, homePlanets: Planet[]): void {
  const sp = world.state.space;
  const st = s.stock;
  const seed = world.state.seed;
  const busy = (planet: string) => sp.missions.some((m) => m.status === 'travelling' && m.targetPlanet === planet);

  // 1. Colony ship (the biggest undertaking).
  if (hasTech(s, 'colonization') && st.metal >= 120 && st.goods >= 80 && population(world, s) > 60 && world.rand() < 0.35) {
    const target = bestColonyTarget(world, 0, 0);
    if (target) {
      const volunteers = world.residentsOf(s.id)
        .filter((n) => isAdult(n) && ageYears(n) < 45 && n.id !== s.leaderId)
        .sort((a, b) => b.traits.openness + b.values.freedom - (a.traits.openness + a.values.freedom))
        .slice(0, 8);
      if (volunteers.length >= 4) {
        st.metal -= 120;
        st.goods -= 80;
        const extra = Math.min(s.abstractPop, 150);
        s.abstractPop -= extra;
        const star = starById(seed, target.starId)!;
        const years = Math.max(0.3, Math.hypot(star.x, star.y) / travelSpeed(s));
        const crew = volunteers.map((n) => fullName(n));
        const eventId = world.newId();
        for (const n of world.residentsOf(s.id)) {
          const going = volunteers.includes(n);
          if (!going && volunteers.some((v) => (n.relationships[v.id]?.affinity ?? 0) > 0.4 || n.childrenIds.includes(v.id))) {
            remember(world, n, `People I love left on a colony ship to ${target.name}.`, { importance: 0.9, feeling: -0.2, eventId });
          }
        }
        for (const v of volunteers) killNpc(world, v, `left for ${target.name}`, target.name);
        launch(world, s, x, y, day, { kind: 'colony', targetStar: target.starId, targetPlanet: target.id, crew, colonists: volunteers.length + extra, days: Math.round(years * 120) + 30 });
        world.log(`🚀 A colony ship left ${s.name} for ${target.name} (${describeHabitability(target.habitability).toLowerCase()}) with ${volunteers.length + Math.round(extra)} settlers, led by ${crew[0]}. Journey: ${years.toFixed(1)} years.`, 'space', -1);
        return;
      }
    }
  }
  // 2. Interstellar probe to the nearest known, unexplored star.
  if (hasTech(s, 'spaceflight') && st.metal >= 40 && st.goods >= 20 && world.rand() < 0.3) {
    const target = sp.knownStars
      .filter((id) => id !== HOME_STAR && !sp.missions.some((m) => m.targetStar === id && m.kind !== 'crewed'))
      .map((id) => starById(seed, id)!)
      .filter((star) => star && !planetsOf(seed, star).every((p) => sp.explored.includes(p.id)) && !(star.planetCount === 0 && sp.explored.includes(`${star.id}/-`)))
      .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0];
    if (target) {
      st.metal -= 40;
      st.goods -= 20;
      const years = Math.hypot(target.x, target.y) / travelSpeed(s);
      launch(world, s, x, y, day, { kind: 'interstellar', targetStar: target.id, targetPlanet: null, crew: [], colonists: 0, days: Math.round(years * 120) });
      world.log(`🛰️ ${s.name} launched an interstellar probe to the star ${target.name}, ${Math.hypot(target.x, target.y).toFixed(1)} light-years away.`, 'space', -1);
      return;
    }
  }
  // 3. Crewed mission to an explored world in the home system.
  if (hasTech(s, 'spaceflight') && st.metal >= 60 && st.goods >= 30 && world.rand() < 0.25) {
    const target = homePlanets.find((p) => !p.home && p.kind === 'rocky' && sp.explored.includes(p.id) && !busy(p.id) && !sp.missions.some((m) => m.kind === 'crewed' && m.targetPlanet === p.id));
    const crew = world.residentsOf(s.id)
      .filter((n) => isAdult(n) && ageYears(n) < 50)
      .sort((a, b) => b.skills.research + b.traits.openness - (a.skills.research + a.traits.openness))
      .slice(0, 3);
    if (target && crew.length === 3) {
      st.metal -= 60;
      st.goods -= 30;
      const names = crew.map((n) => fullName(n));
      launch(world, s, x, y, day, { kind: 'crewed', targetStar: HOME_STAR, targetPlanet: target.id, crew: names, colonists: 0, days: 60 + Math.round(Math.abs(target.orbitAU - 1) * 40) });
      for (const n of crew) remember(world, n, `I am flying to ${target.name}!`, { importance: 1, feeling: 0.8, share: `${n.firstName} is flying to ${target.name}.` });
      world.log(`👩‍🚀 ${names.join(', ')} launched from ${s.name} on a crewed mission to ${target.name}.`, 'space', crew[0].id);
      return;
    }
  }
  // 4. Probe to an unexplored planet of the home system.
  if (st.metal >= 15 && st.goods >= 8) {
    const target = homePlanets.find((p) => !sp.explored.includes(p.id) && !busy(p.id));
    if (target) {
      st.metal -= 15;
      st.goods -= 8;
      launch(world, s, x, y, day, { kind: 'probe', targetStar: HOME_STAR, targetPlanet: target.id, crew: [], colonists: 0, days: 25 + Math.round(Math.abs(target.orbitAU - 1) * 20) });
      if (world.state.space.launches === 1) world.log(`🚀 ${s.name} launched the first rocket into space! A probe is on its way to ${target.name}.`, 'space', -1);
      else world.log(`🚀 ${s.name} launched a probe to ${target.name}.`, 'space', -1);
    }
  }
}

function launch(world: World, s: Settlement, x: number, y: number, day: number, o: { kind: Mission['kind']; targetStar: string; targetPlanet: string | null; crew: string[]; colonists: number; days: number }): void {
  const sp = world.state.space;
  sp.launches++;
  sp.recentLaunches.push([x, y, day]);
  sp.missions.push({
    id: world.newId(), kind: o.kind, from: s.name, fromStar: HOME_STAR, targetStar: o.targetStar, targetPlanet: o.targetPlanet,
    launchDay: day, arriveDay: day + Math.max(1, o.days), crew: o.crew, colonists: o.colonists, status: 'travelling',
  });
  const eventId = world.newId();
  for (const n of world.residentsOf(s.id)) remember(world, n, `I watched a rocket launch from ${s.name}.`, { importance: 0.5, feeling: 0.6, eventId });
}

function arrive(world: World, m: Mission, day: number): void {
  const sp = world.state.space;
  const seed = world.state.seed;
  m.status = 'arrived';
  if (m.kind === 'probe' && m.targetPlanet) {
    const p = planetById(seed, m.targetPlanet)!;
    addUnique(sp.explored, p.id);
    world.log(`🛰️ The probe reached ${p.name}: ${p.kind}, ${p.tempC}°C, ${p.atmosphere} atmosphere, gravity ${p.gravity} g, ${Math.round(p.water * 100)}% water. ${describeHabitability(p.habitability)}.`, 'space', -1);
    return;
  }
  if (m.kind === 'crewed' && m.targetPlanet) {
    const p = planetById(seed, m.targetPlanet)!;
    if (world.rand() < 0.06) {
      m.status = 'lost';
      world.log(`💔 Tragedy: the crew of the mission to ${p.name} (${m.crew.join(', ')}) was lost.`, 'space', -1);
      for (const name of m.crew) {
        const n = world.state.npcs.find((x) => fullName(x) === name);
        if (n) killNpc(world, n, `an accident in space near ${p.name}`);
      }
      return;
    }
    world.log(`👣 ${m.crew[0]} became the first person to set foot on ${p.name}! The crew is returning with samples.`, 'space', -1);
    // The whole leading settlement gains knowledge.
    const s = world.state.settlements.find((x) => x.name === m.from);
    if (s) for (const id of Object.keys(s.research)) s.research[id] += 1500;
    for (const name of m.crew) {
      const n = world.state.npcs.find((x) => fullName(x) === name);
      if (n) remember(world, n, `I walked on ${p.name}.`, { importance: 1, feeling: 1, share: `${n.firstName} walked on ${p.name}!` });
    }
    return;
  }
  if (m.kind === 'interstellar') {
    const star = starById(seed, m.targetStar)!;
    const planets = planetsOf(seed, star);
    for (const p of planets) addUnique(sp.explored, p.id);
    addUnique(sp.explored, `${star.id}/-`);
    // From there, the probe sees further.
    for (const st of starsNear(seed, star.x, star.y, 14)) addUnique(sp.knownStars, st.id);
    const best = planets.slice().sort((a, b) => b.habitability - a.habitability)[0];
    world.log(
      `🛰️ A probe reached ${star.name} after ${((day - m.launchDay) / 120).toFixed(1)} years: ${planets.length} planets${best && best.habitability > 0.3 ? `, including ${best.name}, which looks ${describeHabitability(best.habitability).toLowerCase()}!` : '.'}`,
      'space', -1,
    );
    return;
  }
  if (m.kind === 'colony' && m.targetPlanet) {
    const p = planetById(seed, m.targetPlanet)!;
    addUnique(sp.explored, p.id);
    const existing = sp.colonies.find((c) => c.planetId === p.id);
    if (existing) {
      existing.population += m.colonists;
      world.log(`🪐 ${m.colonists} more settlers arrived at ${existing.name} on ${p.name}.`, 'space', -1);
      return;
    }
    const name = `New ${m.from}`;
    sp.colonies.push({
      id: world.newId(), name, planetId: p.id, foundedDay: day, population: m.colonists, founders: m.crew, parent: m.from,
      lastShipDay: day, lastProbeDay: day, habitability: p.habitability,
    });
    world.log(`🪐 Settlers led by ${m.crew[0] ?? 'brave pioneers'} landed on ${p.name} and founded ${name}: humanity's first home beyond ${p.starId === HOME_STAR ? 'our world' : 'our star'}!`, 'space', -1);
  }
}

/** The best known world to settle, by habitability and closeness. */
function bestColonyTarget(world: World, fromX: number, fromY: number): Planet | null {
  const sp = world.state.space;
  const seed = world.state.seed;
  let best: Planet | null = null;
  let bestScore = 0;
  for (const id of sp.explored) {
    if (id.endsWith('/-')) continue;
    const p = planetById(seed, id);
    if (!p || p.home || p.habitability < 0.25) continue;
    if (sp.colonies.some((c) => c.planetId === id && c.population > 50)) continue;
    if (sp.missions.some((m) => m.kind === 'colony' && m.status === 'travelling' && m.targetPlanet === id)) continue;
    const star = starById(seed, p.starId)!;
    const score = p.habitability / (1 + Math.hypot(star.x - fromX, star.y - fromY) / 10);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

function colonyDaily(world: World, c: Colony, day: number): void {
  const sp = world.state.space;
  const seed = world.state.seed;
  const p = planetById(seed, c.planetId)!;
  // Terraforming slowly improves the planet.
  const leading = world.state.settlements.find((s) => !s.abandoned && s.tech.includes('terraforming'));
  if (leading && c.habitability < 0.9) c.habitability = Math.min(0.9, c.habitability + 0.02 / 120);
  // Domes (fusion) and terraforming help marginal worlds.
  const techBonus = (leading ? 0.004 : 0) + (world.state.settlements.some((s) => s.tech.includes('fusion')) ? 0.004 : 0);
  const growth = (0.035 * c.habitability - 0.008 + techBonus) / 120;
  c.population = Math.max(0, c.population * (1 + growth));
  if (c.population < 2) {
    if (c.population > 0) world.log(`💔 The colony ${c.name} on ${p.name} has failed.`, 'space', -1);
    c.population = 0;
    return;
  }
  const star = starById(seed, p.starId)!;
  // Colonies explore their neighbourhood...
  if (c.population > 300 && day - c.lastProbeDay > 240) {
    c.lastProbeDay = day;
    const target = starsNear(seed, star.x, star.y, 20)
      .filter((st) => !sp.explored.includes(`${st.id}/-`) && !sp.missions.some((m) => m.targetStar === st.id))
      .sort((a, b) => Math.hypot(a.x - star.x, a.y - star.y) - Math.hypot(b.x - star.x, b.y - star.y))[0];
    if (target) {
      for (const st of starsNear(seed, star.x, star.y, 20)) addUnique(sp.knownStars, st.id);
      const years = Math.hypot(target.x - star.x, target.y - star.y) / travelSpeed(leading ?? null);
      sp.missions.push({
        id: world.newId(), kind: 'interstellar', from: c.name, fromStar: star.id, targetStar: target.id, targetPlanet: null,
        launchDay: day, arriveDay: day + Math.round(years * 120), crew: [], colonists: 0, status: 'travelling',
      });
      world.log(`🛰️ The colony ${c.name} launched a probe towards ${target.name}.`, 'space', -1);
    }
  }
  // ...and, once large, found colonies of their own. This never has to end.
  if (c.population > 900 && day - c.lastShipDay > 600) {
    const target = bestColonyTarget(world, star.x, star.y);
    if (target) {
      c.lastShipDay = day;
      const tStar = starById(seed, target.starId)!;
      const years = Math.max(0.3, Math.hypot(tStar.x - star.x, tStar.y - star.y) / travelSpeed(leading ?? null));
      const settlers = Math.round(c.population * 0.1);
      c.population -= settlers;
      sp.missions.push({
        id: world.newId(), kind: 'colony', from: c.name, fromStar: star.id, targetStar: target.starId, targetPlanet: target.id,
        launchDay: day, arriveDay: day + Math.round(years * 120) + 30, crew: [], colonists: settlers, status: 'travelling',
      });
      world.log(`🚀 ${c.name} sent ${settlers} settlers to ${target.name}.`, 'space', -1);
    }
  }
}

export function spaceStats(world: World): { planetsKnown: number; colonies: number } | null {
  const sp = world.state.space;
  if (!sp.charted.length && sp.knownStars.length <= 1) return null;
  return {
    planetsKnown: new Set([...sp.charted, ...sp.explored.filter((id) => !id.endsWith('/-'))]).size,
    colonies: sp.colonies.filter((c) => c.population > 0).length,
  };
}

/** Everything the star map needs (the client regenerates star/planet details from the seed). */
export function spaceView(world: World): SpaceViewData {
  const sp = world.state.space;
  const day = Math.floor(world.state.time / 1440);
  return {
    seed: world.state.seed,
    day,
    knownStars: sp.knownStars,
    charted: sp.charted,
    explored: sp.explored,
    missions: sp.missions.filter((m) => m.status === 'travelling' || day - m.arriveDay < 360).slice(-80),
    colonies: sp.colonies.map((c) => ({ name: c.name, planetId: c.planetId, population: Math.round(c.population), foundedDay: c.foundedDay, founders: c.founders, parent: c.parent, habitability: c.habitability })),
    launches: sp.launches,
    settlements: world.state.settlements.filter((s) => !s.abandoned).map((s) => ({ name: s.name, x: s.x, y: s.y, tier: s.tier, population: population(world, s) })),
  };
}
