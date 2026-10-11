/**
 * War and realms.
 *
 * Settlements that dislike each other can go to war, for a reason:
 *  - resources: a town short of food, wood, stone or metal covets a richer neighbour's;
 *  - territory: two crowded towns too close together fight over the land between them;
 *  - revenge: a town that lost a war wants it back;
 *  - faith: very different cultures, led by traditional or warlike leaders;
 *  - conquest: a much stronger town led by a greedy, ruthless leader;
 *  - independence: a vassal rebels against its overlord.
 * The player can also stir things up: spread rumours, incite a war (choosing
 * the cause), arm one side with the weapons of its era, or broker peace.
 *
 * A war is a series of battles every few days. Strength comes from the number
 * of fighters, their era's technology, their weapons, and their realm's other
 * towns. Battles kill people (they are remembered and mourned), move the front
 * and shift the war score. The war ends with a decisive victory, exhaustion, or
 * peace talks, and the terms depend on the cause: tribute, seized fields,
 * reparations, or annexation. Annexed towns become vassals in the winner's
 * realm (chiefdom → kingdom → empire → nation), fight in its wars, pay
 * tribute and learn its knowledge, and may one day rebel.
 */
import type { Npc, ResourceType, Settlement } from '../state';
import type { World } from '../world';
import { BUILDINGS } from '../../shared/people';
import { formatDate } from '../../shared/time';
import { ageYears, fullName, isAdult, killNpc } from '../npc/people';
import { remember } from '../npc/memory';
import { totalFood } from './settlement';
import { ERAS, eraOf, shareKnowledge } from './tech';
import { population } from './work';
import { strength } from './governance';

export type WarCause = 'resources' | 'territory' | 'revenge' | 'faith' | 'conquest' | 'independence';
export const WAR_CAUSES: WarCause[] = ['resources', 'territory', 'revenge', 'faith', 'conquest'];

export interface War {
  id: number;
  name: string;
  attackerId: number;
  defenderId: number;
  cause: WarCause;
  /** What they fight over: a resource key, or a description. */
  prize: string;
  startDay: number;
  /** -1 while the war goes on. */
  endDay: number;
  /** -1..1: positive means the attacker is winning. */
  score: number;
  battles: number;
  deathsA: number;
  deathsB: number;
  nextBattleDay: number;
  /** Started by the player. */
  instigated: boolean;
  outcome: string;
  /** Where and when the last battle happened (for the map). */
  lastBattle: [number, number, number] | null;
  /** Winner's settlement id when over (-1 = no winner). */
  winnerId: number;
}

const RESOURCE_NAMES: Partial<Record<ResourceType, string>> = { grain: 'Grain', fruit: 'Orchard', meat: 'Hunting', fish: 'Fishing', wood: 'Timber', stone: 'Quarry', metal: 'Iron', tools: 'Tool', goods: 'Trade' };
const WEAPONS = ['spears and slings', 'flint axes and bows', 'bronze spears and shields', 'iron swords and catapults', 'muskets and cannon', 'rifles and artillery', 'tanks and aircraft', 'drones and missiles', 'plasma weapons'];
/** How deadly battles are in each era. */
const LETHALITY = [1, 1, 1.4, 1.8, 2.6, 3.2, 3.6, 4, 4];

function today(world: World): number {
  return Math.floor(world.state.time / 1440);
}

function live(world: World): Settlement[] {
  return world.state.settlements.filter((s) => !s.abandoned);
}

// ------------------------------------------------------------------ realms

/** The top of a settlement's realm (itself if independent). */
export function realmRoot(world: World, s: Settlement): Settlement {
  let cur = s;
  for (let i = 0; i < 8; i++) {
    const up = (cur.overlordId ?? -1) >= 0 ? world.settlement(cur.overlordId!) : undefined;
    if (!up || up.abandoned) break;
    cur = up;
  }
  return cur;
}

export function realmMembers(world: World, root: Settlement): Settlement[] {
  return live(world).filter((s) => realmRoot(world, s) === root);
}

export function sameRealm(world: World, a: Settlement, b: Settlement): boolean {
  return realmRoot(world, a) === realmRoot(world, b);
}

/** "Kingdom of Elderhaven", or null for a lone town. */
export function realmName(world: World, root: Settlement, members?: number): string | null {
  const n = members ?? realmMembers(world, root).length;
  if (n < 2) return null;
  const era = eraOf(root);
  if (era <= 1) return `Chiefdom of ${root.name}`;
  if (era <= 3) return n >= 4 ? `Empire of ${root.name}` : `Kingdom of ${root.name}`;
  return n >= 4 ? `${root.name} Federation` : `Nation of ${root.name}`;
}

/**
 * Fighting strength of a side: the town, its weapons, and half of its realm-mates.
 * In a civil war (rebel against overlord) the rebel fights alone, and the realm
 * fights without it.
 */
export function sideStrength(world: World, s: Settlement, enemy?: Settlement): number {
  const day = today(world);
  const own = (t: Settlement) => strength(world, t) * ((t.armedUntil ?? -1) > day ? 1.6 : 1);
  let v = own(s);
  const root = realmRoot(world, s);
  const civil = !!enemy && realmRoot(world, enemy) === root;
  if (!civil || s === root) {
    for (const m of realmMembers(world, root)) if (m !== s && m !== enemy) v += own(m) * 0.5;
  }
  return Math.max(0.1, v);
}

export function weaponsOf(s: Settlement): string {
  return WEAPONS[Math.min(WEAPONS.length - 1, eraOf(s))];
}

// ------------------------------------------------------------------ queries

export function ongoingWars(world: World): War[] {
  return world.state.wars.filter((w) => w.endDay < 0);
}

export function warsOf(world: World, s: Settlement): War[] {
  return world.state.wars.filter((w) => w.attackerId === s.id || w.defenderId === s.id);
}

export function atWar(world: World, a: Settlement, b: Settlement): War | undefined {
  return ongoingWars(world).find((w) =>
    (w.attackerId === a.id && w.defenderId === b.id) || (w.attackerId === b.id && w.defenderId === a.id));
}

/** Days since these two last made peace (Infinity if never at war). */
function daysSincePeace(world: World, a: Settlement, b: Settlement): number {
  let best = Infinity;
  for (const w of world.state.wars) {
    if (w.endDay < 0) continue;
    if ((w.attackerId === a.id && w.defenderId === b.id) || (w.attackerId === b.id && w.defenderId === a.id)) best = Math.min(best, today(world) - w.endDay);
  }
  return best;
}

/** The most convincing reason for `a` to attack `b`, or null. */
export function casusBelli(world: World, a: Settlement, b: Settlement): { cause: WarCause; prize: string } | null {
  const popA = Math.max(1, population(world, a));
  const popB = Math.max(1, population(world, b));
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  // Revenge: they beat us in a war in the last few years.
  const grudge = world.state.wars.find((w) => w.endDay >= 0 && today(world) - w.endDay < 1080 && w.winnerId === b.id &&
    (w.attackerId === a.id || w.defenderId === a.id));
  if (grudge) return { cause: 'revenge', prize: grudge.name };
  // Resources: we lack something they have plenty of.
  const wants: ResourceType[] = ['grain', 'meat', 'wood', 'stone', 'metal'];
  if (totalFood(a) / popA < 3 && totalFood(b) / popB > 6) return { cause: 'resources', prize: b.stock.grain >= b.stock.meat ? 'grain' : 'meat' };
  for (const r of wants.slice(2)) {
    if (a.stock[r] < popA * 0.3 && b.stock[r] > popB * 1.5 && (r !== 'metal' || a.tech.includes('metalwork'))) return { cause: 'resources', prize: r };
  }
  // Territory: crowded neighbours.
  if (d < 110 && popA + popB > 90) return { cause: 'territory', prize: 'the land between them' };
  // Conquest: much stronger, ruthless.
  const leader = world.npcById(a.leaderId);
  if (leader && leader.traits.agreeableness < 0.35 && leader.values.wealth > 0.55 && sideStrength(world, a, b) > 2.2 * sideStrength(world, b, a)) {
    return { cause: 'conquest', prize: b.name };
  }
  // Faith: nothing in common.
  const shared = a.culture.traits.filter((t) => b.culture.traits.includes(t)).length;
  if (shared === 0 && a.culture.name !== b.culture.name && (a.culture.traits.includes('warlike') || (leader && leader.values.tradition > 0.7))) {
    return { cause: 'faith', prize: `the ways of the ${a.culture.name}` };
  }
  return null;
}

// ------------------------------------------------------------------ declaring

function warName(world: World, a: Settlement, b: Settlement, cause: WarCause, prize: string): string {
  const era = Math.max(eraOf(a), eraOf(b));
  let base: string;
  if (cause === 'independence') base = `${a.name} War of Independence`;
  else if (cause === 'conquest') base = `${a.name} Conquest of ${b.name}`;
  else if (era <= 1) base = cause === 'revenge' ? `Blood Feud of ${a.name} and ${b.name}` : `Feud of ${a.name} and ${b.name}`;
  else if (era >= 5 && realmMembers(world, realmRoot(world, a)).length + realmMembers(world, realmRoot(world, b)).length >= 6) {
    const n = world.state.wars.filter((w) => / World War$/.test(w.name)).length + 1;
    return `${['First', 'Second', 'Third', 'Fourth', 'Fifth'][n - 1] ?? `${n}th`} World War`;
  } else if (cause === 'resources') base = `${RESOURCE_NAMES[prize as ResourceType] ?? 'Hunger'} War`;
  else if (cause === 'territory') base = 'Border War';
  else if (cause === 'revenge') base = 'War of Vengeance';
  else base = era >= 4 ? 'War of Ideals' : 'Holy War';
  const same = world.state.wars.filter((w) => w.name.endsWith(base)).length;
  const ordinal = ['', 'Second ', 'Third ', 'Fourth ', 'Fifth '][same] ?? `${same + 1}th `;
  return `${ordinal}${base}`;
}

const CAUSE_TEXT: Record<WarCause, (w: War, world: World) => string> = {
  resources: (w) => `over ${w.prize === 'grain' || w.prize === 'meat' ? 'food' : w.prize}`,
  territory: () => 'over the land between them',
  revenge: (w) => `to avenge ${w.prize}`,
  faith: () => 'over their beliefs and ways',
  conquest: () => 'to conquer',
  independence: () => 'for independence',
};

export function causeText(world: World, w: War): string {
  return CAUSE_TEXT[w.cause](w, world);
}

export function declareWar(world: World, a: Settlement, b: Settlement, cause: WarCause, prize: string, instigated: boolean): War {
  const day = today(world);
  const w: War = {
    id: world.newId(), name: warName(world, a, b, cause, prize), attackerId: a.id, defenderId: b.id, cause, prize,
    startDay: day, endDay: -1, score: 0, battles: 0, deathsA: 0, deathsB: 0,
    nextBattleDay: day + 3 + Math.floor(world.rand() * 6), instigated, outcome: '', lastBattle: null, winnerId: -1,
  };
  world.state.wars.push(w);
  // Realms take sides.
  for (const x of realmMembers(world, realmRoot(world, a))) for (const y of realmMembers(world, realmRoot(world, b))) {
    x.diplomacy[y.id] = -1;
    y.diplomacy[x.id] = -1;
  }
  const leader = world.npcById(a.leaderId);
  world.log(`${a.name}${leader ? `, led by ${fullName(leader)},` : ''} went to war with ${b.name} ${CAUSE_TEXT[cause](w, world)}: the ${w.name} has begun.`, 'conflict', leader?.id ?? -1);
  const ev = world.newId();
  for (const s of [a, b]) {
    const enemy = s === a ? b : a;
    for (const n of world.residentsOf(s.id)) {
      const warlike = s.culture.traits.includes('warlike') || n.traits.agreeableness < 0.3;
      remember(world, n, `We are at war with ${enemy.name}.`, { importance: 0.85, feeling: warlike ? 0.1 : -0.6, eventId: ev, share: `${a.name} and ${b.name} are at war.` });
    }
  }
  return w;
}

// ------------------------------------------------------------------ daily

export function warDaily(world: World): void {
  const day = today(world);
  for (const w of ongoingWars(world)) {
    const a = world.settlement(w.attackerId);
    const b = world.settlement(w.defenderId);
    if (!a || !b || a.abandoned || b.abandoned) {
      endWar(world, w, a && !a.abandoned ? a : b && !b.abandoned ? b : null, 'One side was wiped out or abandoned its home.', true);
      continue;
    }
    // Armies eat, people are afraid.
    for (const s of [a, b]) {
      const army = Math.ceil(population(world, s) * 0.15);
      const food = (['grain', 'meat', 'fish', 'fruit'] as ResourceType[]).sort((x, y) => s.stock[y] - s.stock[x])[0];
      s.stock[food] = Math.max(0, s.stock[food] - army * 0.25);
      for (const n of world.residentsOf(s.id)) n.needs.safety = Math.max(n.needs.safety, 0.25);
    }
    if (day >= w.nextBattleDay) battle(world, w, a, b);
    if (w.endDay >= 0) continue;
    // Exhaustion: long wars end in negotiated peace.
    const days = day - w.startDay;
    if (Math.abs(w.score) >= 1) endWar(world, w, w.score > 0 ? a : b, '', true);
    else if (days > 240 && world.rand() < (days - 240) / 40000 + (w.deathsA + w.deathsB > 30 ? 0.004 : 0)) {
      endWar(world, w, Math.abs(w.score) < 0.3 ? null : w.score > 0 ? a : b, 'Both sides were exhausted.', false);
    }
  }
  realmsDaily(world, day);
  // New wars, considered by each independent town about every ten days.
  for (const a of live(world)) {
    if ((a.overlordId ?? -1) >= 0 || day % 10 !== a.id % 10) continue;
    considerWar(world, a);
  }
}

function considerWar(world: World, a: Settlement): void {
  const leader = world.npcById(a.leaderId);
  if (!leader || population(world, a) < 8) return;
  if (ongoingWars(world).some((w) => w.attackerId === a.id || w.defenderId === a.id)) return;
  const aggression = (1 - leader.traits.agreeableness) * (a.culture.traits.includes('warlike') ? 1.6 : 1) * (a.culture.traits.includes('reveres the Stranger') ? 0.7 : 1);
  if (aggression < 0.45) return;
  const targets = live(world)
    .filter((b) => b !== a && !sameRealm(world, a, b) && (a.diplomacy[b.id] ?? 0) < -0.4 && Math.hypot(a.x - b.x, a.y - b.y) < 260 && daysSincePeace(world, a, b) > 720)
    .sort((x, y) => (a.diplomacy[x.id] ?? 0) - (a.diplomacy[y.id] ?? 0));
  for (const b of targets.slice(0, 3)) {
    const cb = casusBelli(world, a, b);
    if (!cb) continue;
    // Merely tense relations need a pressing reason (hunger, land, easy conquest).
    if ((a.diplomacy[b.id] ?? 0) > -0.55 && cb.cause !== 'resources' && cb.cause !== 'territory' && cb.cause !== 'conquest') continue;
    // Nobody starts a war they expect to lose badly (unless enraged).
    if (sideStrength(world, a, b) < sideStrength(world, b, a) * 0.6 && cb.cause !== 'revenge') continue;
    if (world.rand() < 0.06 * aggression) declareWar(world, a, b, cb.cause, cb.prize, false);
    return;
  }
}

function fighters(world: World, s: Settlement): Npc[] {
  return world.residentsOf(s.id).filter((n) => isAdult(n) && ageYears(n) < 50 && n.pregnantDays < 0);
}

function battle(world: World, w: War, a: Settlement, b: Settlement): void {
  const day = today(world);
  const era = Math.max(eraOf(a), eraOf(b));
  w.nextBattleDay = day + (era >= 4 ? 3 : 5) + Math.floor(world.rand() * (era >= 4 ? 6 : 10));
  w.battles++;
  const ra = sideStrength(world, a, b) * (0.6 + world.rand() * 0.8);
  const rb = sideStrength(world, b, a) * (0.6 + world.rand() * 0.8) * 1.15; // defenders' advantage
  const attackerWon = ra > rb;
  const margin = Math.abs(ra - rb) / (ra + rb);
  w.score = Math.max(-1, Math.min(1, w.score + (attackerWon ? 1 : -1) * (0.08 + margin * 0.35)));
  const winner = attackerWon ? a : b;
  const loser = attackerWon ? b : a;
  const lethal = LETHALITY[Math.min(LETHALITY.length - 1, era)];
  const lossL = casualties(world, loser, Math.ceil(world.rand() * 2 * lethal * (0.5 + margin)));
  const lossW = casualties(world, winner, Math.floor(world.rand() * lethal * 0.8));
  if (attackerWon) {
    w.deathsB += lossL;
    w.deathsA += lossW;
  } else {
    w.deathsA += lossL;
    w.deathsB += lossW;
  }
  // The winner of a battle carries off some of what they fight over.
  const key = (w.cause === 'resources' ? w.prize : 'grain') as ResourceType;
  if (key in loser.stock) {
    const take = loser.stock[key] * 0.12;
    loser.stock[key] -= take;
    winner.stock[key] += take;
  }
  // The front moves towards the losing side.
  const t = 0.5 - w.score * 0.35;
  w.lastBattle = [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, day];
  world.log(`Battle in the ${w.name}: ${winner.name} defeated ${loser.name}${lossL ? ` (${lossL} killed` : ''}${lossW ? `${lossL ? ', ' : ' ('}${lossW} of their own lost)` : lossL ? ')' : ''}.`, 'battle', -1);
}

function casualties(world: World, s: Settlement, n: number): number {
  let dead = 0;
  const pool = fighters(world, s);
  // Nobody fights to the last: a battle costs at most about a fifth of a town's fighters.
  n = Math.min(n, Math.ceil(pool.length * 0.2));
  for (let i = 0; i < n && pool.length > 2; i++) {
    const victim = pool.splice(Math.floor(world.rand() * pool.length), 1)[0];
    killNpc(world, victim, 'wounds in battle');
    dead++;
  }
  // Statistical (off-screen) population suffers too.
  if (s.abstractPop > 0) {
    const lost = Math.min(s.abstractPop, s.abstractPop * 0.01 * n);
    s.abstractPop -= lost;
    dead += Math.round(lost);
  }
  return dead;
}

// ------------------------------------------------------------------ peace

export function endWar(world: World, w: War, winner: Settlement | null, why: string, decisive: boolean): void {
  const day = today(world);
  w.endDay = day;
  const a = world.settlement(w.attackerId);
  const b = world.settlement(w.defenderId);
  w.winnerId = winner?.id ?? -1;
  const loser = winner && a && b ? (winner === a ? b : a) : null;
  let terms = '';
  if (winner && loser && !loser.abandoned) terms = applyTerms(world, w, winner, loser, decisive);
  w.outcome = winner
    ? `${winner.name} won${decisive ? '' : ' on points'}. ${terms}`.trim()
    : `It ended without a winner. ${why}`.trim();
  world.log(`The ${w.name} is over after ${duration(day - w.startDay)} and ${w.deathsA + w.deathsB} deaths. ${why && winner ? `${why} ` : ''}${w.outcome}`, 'conflict', -1);
  if (a && b) {
    a.diplomacy[b.id] = -0.35;
    b.diplomacy[a.id] = -0.35;
    const ev = world.newId();
    for (const s of [a, b]) {
      const won = winner === s;
      for (const n of world.residentsOf(s.id)) {
        remember(world, n, winner ? (won ? `We won the ${w.name}!` : `We lost the ${w.name}.`) : `The ${w.name} is over at last.`, {
          importance: 0.8, feeling: won ? 0.6 : winner ? -0.6 : 0.3, eventId: ev, share: `The ${w.name} is over.`,
        });
      }
    }
  }
}

function applyTerms(world: World, w: War, winner: Settlement, loser: Settlement, decisive: boolean): string {
  const day = today(world);
  const popW = population(world, winner);
  const popL = population(world, loser);
  const annex = decisive && popL < popW * 0.8 && w.cause !== 'independence' && realmRoot(world, winner) !== loser;
  if (w.cause === 'independence') {
    if (winner.id === w.attackerId) {
      winner.overlordId = -1;
      winner.tribute = undefined;
      return `${winner.name} is free and independent.`;
    }
    loser.tribute = { toId: winner.id, until: day + 720, rate: 0.03 };
    return `${loser.name} must pay heavy tribute for its rebellion.`;
  }
  if ((w.cause === 'conquest' || w.cause === 'territory') && annex) {
    const root = realmRoot(world, winner);
    loser.overlordId = root.id;
    // Vassals of the loser follow their new overlord.
    for (const v of live(world)) if (v.overlordId === loser.id) v.overlordId = root.id;
    const realm = realmName(world, root) ?? root.name;
    world.log(`${loser.name} became part of the ${realm}.`, 'conflict', -1);
    return `${loser.name} was annexed into the ${realm}.`;
  }
  if (w.cause === 'territory') {
    // Fields and buildings on the far side of the town change hands.
    const taken = world.buildingsOf(loser.id)
      .filter((bd) => BUILDINGS[bd.kind].housing === 0 && bd.kind !== 'campfire' && bd.kind !== 'stockpile' && Math.hypot(bd.x - loser.x, bd.y - loser.y) > 4)
      .sort((p, q) => Math.hypot(p.x - winner.x, p.y - winner.y) - Math.hypot(q.x - winner.x, q.y - winner.y))
      .slice(0, decisive ? 5 : 2);
    for (const bd of taken) {
      bd.settlementId = winner.id;
      world.markBuildingsChanged(bd, true);
    }
    return taken.length ? `${loser.name} gave up ${taken.length} fields and buildings.` : `${loser.name} gave up its claims to the land.`;
  }
  if (w.cause === 'conquest' || w.cause === 'resources') {
    const key = (w.cause === 'resources' ? w.prize : 'grain') as ResourceType;
    const take = loser.stock[key] * 0.4;
    loser.stock[key] -= take;
    winner.stock[key] += take;
    loser.tribute = { toId: winner.id, until: day + (decisive ? 480 : 240), rate: 0.015 };
    return `${loser.name} handed over ${Math.round(take)} ${key} and must pay tribute.`;
  }
  // Revenge and faith: reparations; the loser takes on the winner's ways.
  const gold = loser.treasury * 0.4;
  loser.treasury -= gold;
  winner.treasury += gold;
  for (const k of ['grain', 'meat', 'goods'] as ResourceType[]) {
    const take = loser.stock[k] * 0.25;
    loser.stock[k] -= take;
    winner.stock[k] += take;
  }
  if (w.cause === 'faith') {
    const trait = winner.culture.traits.find((t) => !loser.culture.traits.includes(t));
    if (trait) loser.culture.traits.push(trait);
    return `${loser.name} paid reparations${trait ? ` and was made to adopt the ${winner.culture.name} way: ${trait}` : ''}.`;
  }
  return `${loser.name} paid reparations.`;
}

/** Tribute, knowledge flowing through realms, and rebellions. */
function realmsDaily(world: World, day: number): void {
  for (const s of live(world)) {
    if (s.tribute) {
      const to = world.settlement(s.tribute.toId);
      if (!to || to.abandoned || day >= s.tribute.until) s.tribute = undefined;
      else {
        for (const k of ['grain', 'meat', 'fish', 'metal', 'goods'] as ResourceType[]) {
          const t = s.stock[k] * s.tribute.rate;
          s.stock[k] -= t;
          to.stock[k] += t;
        }
        const g = s.treasury * s.tribute.rate;
        s.treasury -= g;
        to.treasury += g;
      }
    }
    const lord = (s.overlordId ?? -1) >= 0 ? world.settlement(s.overlordId!) : undefined;
    if ((s.overlordId ?? -1) >= 0 && (!lord || lord.abandoned)) {
      s.overlordId = -1;
      continue;
    }
    if (!lord) continue;
    // A small yearly levy, shared knowledge, and slowly souring (or warming) feelings.
    const g = s.treasury * 0.003;
    s.treasury -= g;
    lord.treasury += g;
    shareKnowledge(world, lord, s, 0.01);
    const cur = s.diplomacy[lord.id] ?? 0;
    const unhappy = s.culture.name !== lord.culture.name ? -0.002 : 0.0005;
    s.diplomacy[lord.id] = Math.max(-1, Math.min(1, cur + unhappy));
    if (day % 10 === s.id % 10 && (s.diplomacy[lord.id] ?? 0) < -0.6 && !ongoingWars(world).some((w) => w.attackerId === s.id || w.defenderId === s.id)
      && strength(world, s) > strength(world, lord) * 0.7 && world.rand() < 0.15) {
      declareWar(world, s, lord, 'independence', lord.name, false);
    }
  }
}

// ------------------------------------------------------------------ the player

export const SCHEME_COST = { rumours: 5, arm: 12, peace: 15 };

export function inciteCost(_world: World, a: Settlement, b: Settlement): number {
  const hostility = Math.max(0, -(a.diplomacy[b.id] ?? 0));
  return Math.round(25 - 15 * hostility);
}

/** Why the player can't push `a` into a war with `b` right now, or null. */
export function inciteBlocked(world: World, a: Settlement, b: Settlement): string | null {
  // Within a realm, the only war you can start is a vassal rising against its ruler.
  if (sameRealm(world, a, b) && !(realmRoot(world, a) === b && a !== b)) return 'Same realm.';
  if (atWar(world, a, b)) return 'Already at war.';
  if (Math.hypot(a.x - b.x, a.y - b.y) > 450) return 'Too far away.';
  if (fighters(world, a).length < 2) return `${a.name} has nobody to fight.`;
  return null;
}

export function scheme(world: World, action: string, aId: number, bId: number, causeIn: string): { ok: boolean; text: string } {
  const a = world.settlement(aId);
  const b = world.settlement(bId);
  const p = world.state.player;
  const pay = (cost: number) => {
    if (p.influence < cost) return false;
    p.influence -= cost;
    return true;
  };
  if (!a || a.abandoned) return { ok: false, text: 'That town is gone.' };
  const day = today(world);

  if (action === 'arm') {
    if (!pay(SCHEME_COST.arm)) return { ok: false, text: `Not enough influence (needs ${SCHEME_COST.arm}).` };
    a.armedUntil = day + 240;
    world.log(`${a.name} found a hoard of ${weaponsOf(a)}. Its fighters are twice as dangerous for two years.`, 'gift', -1);
    const ev = world.newId();
    for (const n of world.residentsOf(a.id)) remember(world, n, `The stranger armed us with ${weaponsOf(a)}.`, { importance: 0.6, feeling: 0.3, about: -2, eventId: ev, share: `${a.name} has new weapons.` });
    return { ok: true, text: `${a.name} is armed with ${weaponsOf(a)}.` };
  }
  if (action === 'peace') {
    const wars = ongoingWars(world).filter((w) => w.attackerId === a.id || w.defenderId === a.id);
    if (!wars.length) return { ok: false, text: `${a.name} is not at war.` };
    if (!pay(SCHEME_COST.peace)) return { ok: false, text: `Not enough influence (needs ${SCHEME_COST.peace}).` };
    for (const w of wars) endWar(world, w, null, 'The Stranger brokered a peace.', false);
    for (const n of world.residentsOf(a.id)) n.playerAffinity = Math.min(1, n.playerAffinity + 0.1);
    return { ok: true, text: `Peace was made.` };
  }
  if (!b || b.abandoned || b === a) return { ok: false, text: 'Pick another town.' };
  if (action === 'rumours') {
    if (!pay(SCHEME_COST.rumours)) return { ok: false, text: `Not enough influence (needs ${SCHEME_COST.rumours}).` };
    a.diplomacy[b.id] = Math.max(-1, (a.diplomacy[b.id] ?? 0) - 0.35);
    b.diplomacy[a.id] = Math.max(-1, (b.diplomacy[a.id] ?? 0) - 0.2);
    const ev = world.newId();
    for (const n of world.residentsOf(a.id)) {
      remember(world, n, `I heard ${b.name} is plotting against us.`, { importance: 0.45, feeling: -0.4, eventId: ev, share: `People say ${b.name} is plotting against ${a.name}.` });
    }
    return { ok: true, text: `Rumours about ${b.name} are spreading in ${a.name}.` };
  }
  if (action === 'incite') {
    const blocked = inciteBlocked(world, a, b);
    if (blocked) return { ok: false, text: blocked };
    const cost = inciteCost(world, a, b);
    if (!pay(cost)) return { ok: false, text: `Not enough influence (needs ${cost}).` };
    const natural = casusBelli(world, a, b);
    const rebellion = sameRealm(world, a, b);
    const cause: WarCause = rebellion ? 'independence' : (WAR_CAUSES as string[]).includes(causeIn) ? (causeIn as WarCause) : natural?.cause ?? 'territory';
    const prize = cause === 'resources'
      ? (['metal', 'stone', 'wood', 'grain', 'meat'] as ResourceType[]).sort((x, y) => b.stock[y] - b.stock[x])[0]
      : cause === natural?.cause ? natural.prize
      : cause === 'revenge' ? 'old wrongs' : cause === 'conquest' ? b.name : cause === 'faith' ? 'their beliefs' : 'the land between them';
    const w = declareWar(world, a, b, cause, prize, true);
    // Sometimes word gets out that the Stranger was behind it.
    if (world.rand() < 0.25) {
      world.log(`Word got out that the Stranger stirred up the ${w.name}.`, 'conflict', -1);
      for (const s of [a, b]) for (const n of world.residentsOf(s.id)) {
        n.playerAffinity = Math.max(-1, n.playerAffinity - 0.3);
        remember(world, n, `The stranger started the ${w.name}!`, { importance: 0.8, feeling: -0.7, about: -2, share: `The stranger started the ${w.name}.` });
      }
    }
    return { ok: true, text: `The ${w.name} has begun.` };
  }
  return { ok: false, text: 'Unknown action.' };
}

// ------------------------------------------------------------------ views

export function describeWarFor(world: World, w: War, s: Settlement) {
  const ours = w.attackerId === s.id;
  const enemy = world.settlement(ours ? w.defenderId : w.attackerId);
  return {
    id: w.id,
    name: w.name,
    enemy: enemy?.name ?? 'a lost town',
    enemyId: enemy?.id ?? -1,
    cause: `${ours ? 'We attacked' : 'They attacked'} ${causeText(world, w)}`,
    since: formatDate(w.startDay * 1440),
    score: ours ? w.score : -w.score,
    battles: w.battles,
    ourDeaths: ours ? w.deathsA : w.deathsB,
    theirDeaths: ours ? w.deathsB : w.deathsA,
    instigated: w.instigated,
    ongoing: w.endDay < 0,
    outcome: w.outcome,
  };
}

function duration(days: number): string {
  if (days < 30) return `${Math.max(1, days)} days`;
  if (days < 120) return `${Math.round(days / 30)} season${days >= 45 ? 's' : ''}`;
  const years = Math.round(days / 12) / 10;
  return `${years} year${years === 1 ? '' : 's'}`;
}

export function eraName(s: Settlement): string {
  return ERAS[eraOf(s)];
}
