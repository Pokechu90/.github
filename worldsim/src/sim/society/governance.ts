/**
 * Politics, culture and conflict, all emerging from people's personalities:
 *  - Each year a settlement chooses the person most respected (liked by many,
 *    socially skilled, mature) as leader.
 *  - The leader's personality and values shape the laws.
 *  - Culture is the average character of the people, plus their history.
 *  - Crime happens when hungry, unkind people see an opportunity.
 *  - Settlements that compete for land and dislike each other may raid.
 */
import { getCalendar } from '../../shared/time';
import type { Npc, Settlement } from '../state';
import type { World } from '../world';
import { ageYears, fullName, isAdult, killNpc, rel } from '../npc/people';
import { remember } from '../npc/memory';
import { totalFood } from './settlement';
import { hasTech } from './tech';
import { population } from './work';

interface Law {
  name: string;
  /** Would this leader want this law? */
  fits: (leader: Npc, s: Settlement) => boolean;
}

export const LAWS: Law[] = [
  { name: 'Food is shared equally', fits: (l) => l.traits.agreeableness > 0.6 || l.values.family > 0.7 },
  { name: 'Council of elders', fits: (l) => l.values.tradition > 0.6 },
  { name: 'Trade tax', fits: (l, s) => l.values.wealth > 0.55 && hasTech(s, 'currency') },
  { name: 'Schooling for all children', fits: (l, s) => l.values.knowledge > 0.55 && hasTech(s, 'writing') },
  { name: 'Free movement', fits: (l) => l.values.freedom > 0.6 },
  { name: 'Night watch', fits: (l) => l.traits.neuroticism > 0.6 || l.traits.conscientiousness > 0.75 },
  { name: 'Quarantine of the sick', fits: (l, s) => hasTech(s, 'medicine') && l.traits.conscientiousness > 0.55 },
  { name: 'Harsh punishments', fits: (l) => l.traits.agreeableness < 0.3 },
  { name: 'Exile for thieves', fits: (l) => l.traits.agreeableness < 0.45 && l.values.tradition > 0.5 },
];

export function governanceDaily(world: World): void {
  const cal = getCalendar(world.state.time);
  for (const s of world.state.settlements) {
    if (s.abandoned) continue;
    const leader = world.npcById(s.leaderId);
    if (!leader || leader.settlementId !== s.id || (cal.dayOfYear === 0 && world.rand() < 0.5)) chooseLeader(world, s);
    if (cal.dayOfYear === 1) updateCulture(world, s);
    crime(world, s);
  }
  diplomacyAndRaids(world);
}

function chooseLeader(world: World, s: Settlement): void {
  const people = world.residentsOf(s.id);
  const candidates = people.filter((n) => isAdult(n) && ageYears(n) >= 22);
  if (!candidates.length) {
    s.leaderId = -1;
    return;
  }
  const respect = (c: Npc) => {
    let r = 0;
    for (const o of people) r += o.relationships[c.id]?.affinity ?? 0;
    r += c.skills.social * 3 + Math.min(ageYears(c), 60) / 30;
    if (s.laws.includes('Council of elders')) r += ageYears(c) / 15;
    return r + world.rand();
  };
  const best = candidates.sort((a, b) => respect(b) - respect(a))[0];
  if (best.id === s.leaderId) return;
  s.leaderId = best.id;
  world.log(`${fullName(best)} became the leader of ${s.name}.`, 'law', best.id);
  const eventId = world.newId();
  for (const n of people) {
    remember(world, n, n === best ? `I was chosen to lead ${s.name}.` : `${best.firstName} now leads ${s.name}.`, {
      importance: n === best ? 0.9 : 0.4, feeling: n === best ? 0.7 : 0.1, about: best.id, eventId,
      share: `${fullName(best)} leads ${s.name}.`,
    });
  }
  // New leader, new laws.
  const wanted = LAWS.filter((l) => l.fits(best, s)).map((l) => l.name).slice(0, 4);
  for (const law of wanted) {
    if (!s.laws.includes(law)) world.log(`${s.name} adopted a new law: "${law}".`, 'law', best.id);
  }
  for (const law of s.laws) {
    if (!wanted.includes(law)) world.log(`${s.name} abolished the law "${law}".`, 'law', best.id);
  }
  s.laws = wanted;
}

function updateCulture(world: World, s: Settlement): void {
  const people = world.residentsOf(s.id).filter(isAdult);
  if (people.length < 3) return;
  const avg = (f: (n: Npc) => number) => people.reduce((a, n) => a + f(n), 0) / people.length;
  const traits: string[] = [];
  if (avg((n) => n.traits.agreeableness) > 0.56) traits.push('hospitable');
  if (avg((n) => n.traits.conscientiousness) > 0.56) traits.push('industrious');
  if (avg((n) => n.traits.extraversion) > 0.56) traits.push('festive');
  if (avg((n) => n.traits.openness) > 0.56) traits.push('inventive');
  if (avg((n) => n.traits.neuroticism) < 0.44) traits.push('stoic');
  if (avg((n) => n.values.tradition) > 0.58) traits.push('devout');
  if (avg((n) => n.values.freedom) > 0.58) traits.push('freedom-loving');
  if (avg((n) => n.values.wealth) > 0.58) traits.push('mercantile');
  if (people.filter((n) => n.job === 'fisher').length > people.length * 0.25) traits.push('seafaring');
  if (people.filter((n) => n.job === 'farmer').length > people.length * 0.3) traits.push('farming');
  if (s.raids >= 2) traits.push('warlike');
  s.culture.traits = traits.slice(0, 4);
}

function crime(world: World, s: Settlement): void {
  const people = world.residentsOf(s.id);
  if (people.length < 6) return;
  const hungry = totalFood(s) / people.length < 2;
  for (const thief of people) {
    if (!isAdult(thief) || thief.traits.agreeableness > 0.3) continue;
    const temptation = (hungry ? 0.02 : 0.002) * (1 - thief.traits.conscientiousness) * (s.laws.includes('Harsh punishments') ? 0.3 : 1);
    if (world.rand() > temptation) continue;
    const victims = people.filter((v) => v !== thief && isAdult(v) && v.partnerId !== thief.id);
    const victim = victims[Math.floor(world.rand() * victims.length)];
    if (!victim) return;
    const loot = Math.min(victim.wealth * 0.5, 20);
    victim.wealth -= loot;
    thief.wealth += loot;
    const caught = world.rand() < 0.5;
    remember(world, thief, caught ? `I was caught stealing from ${victim.firstName}.` : `I stole from ${victim.firstName}. Nobody saw.`, {
      importance: 0.6, feeling: caught ? -0.5 : 0.1, about: victim.id,
    });
    if (!caught) {
      remember(world, victim, 'Someone stole from me!', { importance: 0.5, feeling: -0.5, share: `Someone robbed ${victim.firstName}.` });
      continue;
    }
    rel(victim, thief.id).affinity = Math.max(-1, rel(victim, thief.id).affinity - 0.5);
    remember(world, victim, `${thief.firstName} stole from me!`, { importance: 0.7, feeling: -0.6, about: thief.id, share: `${thief.firstName} was caught stealing from ${victim.firstName}.` });
    if (s.laws.includes('Exile for thieves')) {
      world.log(`${fullName(thief)} was exiled from ${s.name} for theft.`, 'law', thief.id);
      world.hooks.exile?.(world, thief);
    } else {
      world.log(`${fullName(thief)} was caught stealing in ${s.name}.`, 'law', thief.id);
    }
    return; // at most one incident a day
  }
}

function diplomacyAndRaids(world: World): void {
  const day = Math.floor(world.state.time / 1440);
  const live = world.state.settlements.filter((s) => !s.abandoned);
  for (const a of live) {
    for (const b of live) {
      if (a.id >= b.id) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 300) continue;
      // Neighbours compete for land and game; different cultures distrust each other.
      const shared = a.culture.traits.filter((t) => b.culture.traits.includes(t)).length;
      const drift = (d < 120 ? -0.0025 : 0) + (shared - 1) * 0.0008 + (a.culture.name === b.culture.name ? 0.001 : -0.0005);
      for (const [x, y] of [[a, b], [b, a]] as const) {
        const cur = x.diplomacy[y.id] ?? 0;
        x.diplomacy[y.id] = Math.max(-1, Math.min(1, cur + drift - cur * 0.002));
      }
    }
  }
  // Raids: a hostile, hungry or greedy settlement led by a hard leader may attack.
  for (const a of live) {
    const leader = world.npcById(a.leaderId);
    if (!leader || leader.traits.agreeableness > 0.4 || day - a.lastRaidDay < 90) continue;
    const pop = population(world, a);
    const needy = totalFood(a) / Math.max(1, pop) < 3 || leader.values.wealth > 0.65;
    if (!needy) continue;
    const target = live
      .filter((b) => b !== a && (a.diplomacy[b.id] ?? 0) < -0.45 && Math.hypot(a.x - b.x, a.y - b.y) < 220)
      .sort((x, y) => (a.diplomacy[x.id] ?? 0) - (a.diplomacy[y.id] ?? 0))[0];
    if (!target || world.rand() > 0.02) continue;
    raid(world, a, target, leader);
  }
}

function strength(world: World, s: Settlement): number {
  const fighters = world.residentsOf(s.id).filter((n) => isAdult(n) && ageYears(n) < 55 && !n.illness);
  let v = fighters.reduce((sum, n) => sum + 0.5 + n.skills.hunting, 0) + s.abstractPop * 0.4;
  if (hasTech(s, 'metalwork')) v *= 1.5;
  if (hasTech(s, 'industry')) v *= 2;
  return v;
}

function raid(world: World, a: Settlement, b: Settlement, leader: Npc): void {
  const day = Math.floor(world.state.time / 1440);
  a.lastRaidDay = day;
  a.raids++;
  const sa = strength(world, a) * (0.7 + world.rand() * 0.6);
  const sb = strength(world, b) * (0.8 + world.rand() * 0.6) * 1.2; // defenders' advantage
  const win = sa > sb;
  const eventA = world.newId();
  const eventB = world.newId();
  let deathsB = 0;
  let deathsA = 0;
  if (win) {
    for (const k of ['grain', 'fruit', 'meat', 'fish', 'goods', 'tools', 'metal'] as const) {
      const take = b.stock[k] * 0.3;
      b.stock[k] -= take;
      a.stock[k] += take;
    }
    deathsB = Math.floor(world.rand() * 3);
  } else {
    deathsA = 1 + Math.floor(world.rand() * 2);
  }
  const casualties = (s: Settlement, n: number) => {
    const fighters = world.residentsOf(s.id).filter((p) => isAdult(p) && ageYears(p) < 55);
    for (let i = 0; i < n && fighters.length; i++) {
      const victim = fighters.splice(Math.floor(world.rand() * fighters.length), 1)[0];
      killNpc(world, victim, s === a ? 'wounds from a raid' : 'a raid');
    }
  };
  casualties(b, deathsB);
  casualties(a, deathsA);
  world.log(
    win
      ? `⚔️ ${a.name}, led by ${fullName(leader)}, raided ${b.name} and carried off food and goods${deathsB ? ` (${deathsB} killed)` : ''}.`
      : `⚔️ ${a.name} raided ${b.name} but was driven off${deathsA ? ` (${deathsA} raiders died)` : ''}.`,
    'conflict', leader.id,
  );
  for (const n of world.residentsOf(b.id)) {
    remember(world, n, `${a.name} attacked us!`, { importance: 0.8, feeling: -0.8, eventId: eventB, share: `${a.name} attacked ${b.name}.` });
  }
  for (const n of world.residentsOf(a.id)) {
    remember(world, n, win ? `We raided ${b.name} and won.` : `Our raid on ${b.name} failed.`, {
      importance: 0.7, feeling: win ? 0.2 : -0.5, eventId: eventA, share: `${a.name} raided ${b.name}.`,
    });
  }
  a.diplomacy[b.id] = -1;
  b.diplomacy[a.id] = -1;
}
