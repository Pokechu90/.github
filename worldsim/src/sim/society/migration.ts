/**
 * Migration: how one camp becomes many villages, towns and cities.
 *
 * When a settlement is crowded, hungry, or full of restless freedom-lovers, a
 * group (usually a young family plus friends, led by someone bold) packs some
 * food and tools and walks off to found a new settlement where there is good
 * land and fresh water. Exiles and the LLM can also start a migration.
 */
import { BUILDINGS, FOODS } from '../../shared/people';
import type { Npc, ResourceType, Settlement } from '../state';
import type { World } from '../world';
import { ageYears, createNpc, fullName, isAdult, rel } from '../npc/people';
import { remember } from '../npc/memory';
import { walkTo } from '../npc/actions';
import { foundSettlement, scoutSite, totalFood } from './settlement';

const MIN_DAYS_BETWEEN = 60;

export function migrationDaily(world: World): void {
  const day = Math.floor(world.state.time / 1440);
  for (const s of world.state.settlements.slice()) {
    if (s.abandoned || day - s.lastMigrationDay < MIN_DAYS_BETWEEN) continue;
    const people = world.residentsOf(s.id);
    if (people.length < 14) continue;
    const pressure = migrationPressure(world, s);
    if (world.rand() < 0.002 + pressure * 0.02) {
      const leader = pickLeader(world, s);
      if (leader) startMigration(world, s, leader, pressure > 0.6 ? 'hunger and crowding' : 'the call of new land');
    }
  }
}

function migrationPressure(world: World, s: Settlement): number {
  const people = world.residentsOf(s.id);
  const pop = people.length;
  const homes = world.buildingsOf(s.id).filter((b) => BUILDINGS[b.kind].housing > 0 && b.progress >= 1);
  const capacity = homes.reduce((n, b) => n + BUILDINGS[b.kind].housing, 0);
  let p = 0;
  if (pop > capacity) p += Math.min(0.5, (pop - capacity) / Math.max(1, capacity));
  const foodDays = totalFood(s) / Math.max(1, pop);
  if (foodDays < 3) p += 0.4;
  // Without farming, the land around a camp only feeds so many hunter-gatherers.
  if (!s.tech.includes('agriculture') && pop > 24) p += 0.3;
  // Big places push people out to find room (towns ~ every few hundred people).
  p += Math.max(0, pop - 120) / 400;
  if (s.laws.includes('Free movement')) p += 0.15;
  return Math.min(1, p);
}

function pickLeader(world: World, s: Settlement): Npc | null {
  const adults = world.residentsOf(s.id).filter((n) => isAdult(n) && ageYears(n) < 45 && n.id !== s.leaderId);
  const score = (n: Npc) => n.values.freedom + n.traits.openness - n.values.tradition * 0.5 + (n.partnerId >= 0 ? 0.3 : 0) + world.rand() * 0.4;
  return adults.sort((a, b) => score(b) - score(a))[0] ?? null;
}

export function canMigrate(world: World, n: Npc): boolean {
  const s = world.settlement(n.settlementId);
  if (!s || !isAdult(n)) return false;
  const day = Math.floor(world.state.time / 1440);
  return world.residentsOf(s.id).length >= 10 && day - s.lastMigrationDay > 30;
}

export function requestMigration(world: World, n: Npc): void {
  const s = world.settlement(n.settlementId);
  if (s && canMigrate(world, n)) startMigration(world, s, n, `${n.firstName}'s dream of a new home`);
}

export function startMigration(world: World, from: Settlement, leader: Npc, reason: string): Settlement | null {
  const site = scoutSite(world, from.x, from.y, 60, 170);
  if (!site) return null;
  const day = Math.floor(world.state.time / 1440);
  from.lastMigrationDay = day;

  // Who goes: the leader's household, close friends, and other restless souls.
  const people = world.residentsOf(from.id);
  const group = new Set<Npc>([leader]);
  const partner = world.npcById(leader.partnerId);
  if (partner && partner.settlementId === from.id) group.add(partner);
  for (const c of [...leader.childrenIds, ...(partner?.childrenIds ?? [])]) {
    const kid = world.npcById(c);
    if (kid && kid.settlementId === from.id && !isAdult(kid)) group.add(kid);
  }
  const maxSize = Math.max(4, Math.min(14, Math.floor(people.length * 0.3)));
  const others = people
    .filter((n) => !group.has(n) && isAdult(n) && n.id !== from.leaderId)
    .map((n) => ({ n, s: n.values.freedom + (leader.relationships[n.id]?.affinity ?? 0) + (n.homeId < 0 ? 0.5 : 0) + world.rand() * 0.5 }))
    .sort((a, b) => b.s - a.s);
  for (const { n, s } of others) {
    if (group.size >= maxSize || s < 0.9) break;
    group.add(n);
    // Bring their partner and children too.
    const p = world.npcById(n.partnerId);
    if (p && p.settlementId === from.id) group.add(p);
    for (const c of n.childrenIds) {
      const kid = world.npcById(c);
      if (kid && kid.settlementId === from.id && !isAdult(kid)) group.add(kid);
    }
  }
  if ([...group].filter(isAdult).length < 2) return null;

  const to = foundSettlement(world, site.x, site.y, from.id);
  to.lastMigrationDay = day;
  // They take a share of the stores with them.
  const share = group.size / people.length;
  for (const k of [...FOODS, 'wood', 'tools', 'cloth'] as ResourceType[]) {
    const take = from.stock[k] * Math.min(0.4, share * 1.2);
    from.stock[k] -= take;
    to.stock[k] += take;
  }
  to.stock.wood += 10;
  // Big cities also send off part of their statistical population.
  if (from.abstractPop > 20) {
    const moving = from.abstractPop * 0.12;
    from.abstractPop -= moving;
    to.abstractPop += moving;
  }
  from.diplomacy[to.id] = 0.5;
  to.diplomacy[from.id] = 0.5;

  const eventId = world.newId();
  const leaveId = world.newId();
  for (const n of group) {
    n.settlementId = to.id;
    n.homeId = -1;
    n.goal = { kind: 'migrate', text: `travel to ${to.name}`, until: world.state.time + 10 * 1440, targetId: -1 };
    remember(world, n, n === leader ? `I led our group away from ${from.name} to found ${to.name}.` : `We left ${from.name} to start again at ${to.name}.`, {
      importance: 0.95, feeling: 0.3, eventId, share: `${leader.firstName} led a group from ${from.name} to found ${to.name}.`,
    });
    // Pack some food for the road.
    if (isAdult(n) && to.stock.grain + to.stock.fruit > 4) {
      const k: ResourceType = to.stock.grain > to.stock.fruit ? 'grain' : 'fruit';
      to.stock[k] -= 4;
      n.carrying = { type: k, amount: 4 };
    }
    if (!walkTo(world, n, to.x + (world.rand() - 0.5) * 4, to.y + (world.rand() - 0.5) * 4, 'idle')) {
      n.x = to.x;
      n.y = to.y;
    }
    n.action.timer = 10 * 1440;
  }
  for (const n of world.residentsOf(from.id)) {
    if (group.has(n)) continue;
    const close = [...group].some((g) => (n.relationships[g.id]?.affinity ?? 0) > 0.4 || n.childrenIds.includes(g.id));
    remember(world, n, `${leader.firstName} and ${group.size - 1} others left to found ${to.name}.`, {
      importance: close ? 0.7 : 0.35, feeling: close ? -0.3 : 0, eventId: leaveId, share: `Some of ${from.name} left to found ${to.name}.`,
    });
  }
  world.log(`🧭 ${fullName(leader)} led ${group.size} people from ${from.name} to found ${to.name} (${reason}).`, 'migration', leader.id);
  world.rebuildIndexes();
  world.assignJobsFor(to);
  world.assignJobsFor(from);
  return to;
}

/** Thrown out: join another settlement that will have them, or start alone. */
export function exile(world: World, n: Npc): void {
  const home = world.settlement(n.settlementId);
  const others = world.state.settlements
    .filter((s) => !s.abandoned && s !== home && (s.diplomacy[home?.id ?? -1] ?? 0) > -0.5)
    .sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y));
  const dest = others[0];
  // Their partner and young children go with them.
  const family = [n, world.npcById(n.partnerId), ...n.childrenIds.map((c) => world.npcById(c))].filter(
    (p): p is Npc => !!p && p.settlementId === n.settlementId && (p === n || p.id === n.partnerId || !isAdult(p)),
  );
  if (dest) {
    for (const p of family) {
      p.settlementId = dest.id;
      p.homeId = -1;
      walkTo(world, p, dest.x + 1, dest.y + 1, 'idle');
      p.action.timer = 10 * 1440;
    }
    remember(world, n, `I was thrown out of ${home?.name ?? 'my home'} and went to ${dest.name}.`, { importance: 0.9, feeling: -0.8 });
    for (const o of world.residentsOf(dest.id)) rel(o, n.id).affinity = Math.min(rel(o, n.id).affinity, -0.1);
    return;
  }
  if (home && family.filter(isAdult).length >= 1) startMigration(world, home, n, 'exile');
}

/**
 * Newcomers: the world beyond the map has other bands of people. Travellers
 * and families sometimes arrive and settle, more often in prosperous places
 * and where single people are looking for partners. This also keeps small
 * groups from running out of unrelated partners.
 */
export function immigrationDaily(world: World): void {
  for (const s of world.state.settlements) {
    if (s.abandoned) continue;
    const people = world.residentsOf(s.id);
    if (!people.length || people.length > 400) continue;
    const prosperity = Math.min(1, totalFood(s) / Math.max(1, people.length) / 20);
    const singles = people.filter((n) => isAdult(n) && n.partnerId < 0 && ageYears(n) < 45).length;
    const p = 0.0015 + prosperity * 0.002 + Math.min(4, singles) * 0.001;
    if (world.rand() > p) continue;
    arriveNewcomers(world, s);
  }
}

function arriveNewcomers(world: World, s: Settlement): void {
  const ang = world.rand() * Math.PI * 2;
  let x = s.x + Math.cos(ang) * 25;
  let y = s.y + Math.sin(ang) * 25;
  if (!world.isWalkable(x, y)) {
    x = s.x + 2;
    y = s.y + 2;
  }
  const add = (o: Parameters<typeof createNpc>[1]) => {
    const n = createNpc(world, o);
    world.state.npcs.push(n);
    return n;
  };
  const family = world.rand() < 0.4;
  let names: string;
  let first: Npc;
  if (family) {
    const m = add({ x, y, sex: 'male', ageYears: 20 + world.rand() * 15, settlementId: s.id });
    const f = add({ x, y, sex: 'female', ageYears: 18 + world.rand() * 14, settlementId: s.id, lastName: m.lastName });
    m.orientation = f.orientation = 'opposite';
    m.partnerId = f.id;
    f.partnerId = m.id;
    m.married = f.married = true;
    rel(m, f.id).affinity = rel(f, m.id).affinity = 0.7;
    rel(m, f.id).romance = rel(f, m.id).romance = 0.8;
    const kids = Math.floor(world.rand() * 3);
    for (let i = 0; i < kids; i++) {
      const k = add({ x, y, ageYears: world.rand() * 10, settlementId: s.id, mother: f, father: m });
      rel(k, m.id).affinity = rel(k, f.id).affinity = 0.8;
    }
    first = m;
    names = `the ${m.lastName} family (${2 + kids})`;
  } else {
    first = add({ x, y, ageYears: 17 + world.rand() * 18, settlementId: s.id });
    names = `a traveller, ${fullName(first)},`;
  }
  const newcomers = world.state.npcs.filter((n) => n.settlementId === s.id && n.memory.recent.length === 0);
  for (const n of newcomers) {
    n.skills.foraging = Math.max(n.skills.foraging, 0.2);
    remember(world, n, `We arrived in ${s.name} after a long journey and decided to stay.`, { importance: 0.9, feeling: 0.5, share: `Newcomers arrived in ${s.name}.` });
    walkTo(world, n, s.x + (world.rand() - 0.5) * 6, s.y + (world.rand() - 0.5) * 6, 'idle');
    // Shared knowledge from the wider world: the newcomers may know something new.
  }
  world.log(`${names[0].toUpperCase()}${names.slice(1)} arrived in ${s.name} and decided to stay.`, 'migration', first.id);
  world.rebuildIndexes();
}
