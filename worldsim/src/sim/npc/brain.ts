/**
 * The NPC "brain": utility AI.
 *
 * Every time someone finishes what they were doing, they score each possible
 * activity from their needs, personality, values, relationships, memories,
 * the time of day and their current goal, then do the best one. Nothing is
 * scripted: an outgoing, hungry farmer and a shy, diligent healer make
 * different choices in the same situation.
 *
 * Their reasoning is turned into a short inner thought shown in the UI.
 * (Milestone 3 lets an LLM set goals and write richer thoughts for the NPCs
 * the player is watching; this rules-based brain is always the fallback.)
 */
import { JOBS } from '../../shared/people';
import { nextFloat, pick, randRange } from '../../shared/rng';
import { daylight, getCalendar, isNight } from '../../shared/time';
import type { Npc } from '../state';
import type { World } from '../world';
import { ageYears, isAdult, rel } from './people';
import { startMeal, startWork, walkTo } from './actions';
import { memoryMood } from './memory';

type Option = { kind: string; score: number; why: string };

export function decide(world: World, n: Npc): void {
  world.releaseAll(n.id);
  const time = world.state.time;
  const hour = getCalendar(time).hour;
  const night = isNight(time);
  const age = ageYears(n);
  const rng = world.state.rng;
  const t = n.traits;
  const sick = n.illness && n.illness.severity > 0.3;

  n.mood = computeMood(world, n);

  const opts: Option[] = [];
  const add = (kind: string, score: number, why: string) => opts.push({ kind, score: score + nextFloat(rng) * 0.08, why });

  // Body
  if (n.needs.hunger > 0.3) add('eat', n.needs.hunger * 1.7, n.needs.hunger > 0.75 ? 'starving' : 'hungry');
  const bedtime = hour >= 22 || hour < 5 || (age < 10 && hour >= 20);
  const sleepScore = night || bedtime
    ? 0.45 + n.needs.energy + (bedtime ? 0.4 : 0)
    : n.needs.energy > 0.8 ? n.needs.energy * 1.3 - 0.35 : 0;
  add('sleep', sleepScore, night || bedtime ? 'night' : 'tired');
  if (sick) add('rest', 0.7 + n.illness!.severity, 'sick');
  if (n.needs.safety > 0.5) add('home', n.needs.safety * 1.1, 'unsafe');

  // Work / childhood
  const workHours = hour >= 7 && hour < 18 && !night;
  if (n.job !== 'child' && age >= 13) {
    const duty = 0.3 + n.needs.purpose * 0.7 * (0.5 + t.conscientiousness) + (t.conscientiousness - 0.5) * 0.2;
    const urgency = world.settlementUrgency(n.settlementId, n.job);
    add('work', workHours ? duty + urgency : 0.05 + urgency * 0.3, urgency > 0.3 ? 'needed' : 'duty');
  } else if (age >= 3) {
    if (workHours) add('play', 0.55 + t.extraversion * 0.2, 'play');
    const school = world.settlement(n.settlementId)?.laws.includes('Schooling for all children') ? 0.3 : 0;
    if (workHours && age >= 6) add('learn', 0.35 + t.openness * 0.35 + school, 'learn');
  }

  // Social life
  const evening = hour >= 18 && hour < 22;
  const crush = bestRomance(world, n);
  add('socialize', n.needs.social * (0.4 + t.extraversion) + (evening ? 0.3 : 0) + (crush ? 0.15 : 0), crush ? 'crush' : 'lonely');

  // Curiosity
  add('wander', 0.08 + t.openness * 0.12 + n.needs.purpose * 0.1, 'curious');

  // Goals (set by rules or by the LLM) give a strong push.
  if (n.goal && n.goal.until > time) {
    const g = n.goal.kind;
    const o = opts.find((x) => x.kind === g);
    if (o) o.score += 0.35;
  } else if (n.goal) {
    n.goal = null;
  }

  opts.sort((a, b) => b.score - a.score);
  for (const o of opts) {
    if (tryOption(world, n, o.kind)) {
      n.thought = thoughtFor(world, n, o);
      return;
    }
  }
  n.action = { kind: 'idle', timer: randRange(rng, 15, 40) };
  n.thought = pick(rng, ['Hmm. Nothing to do right now.', 'I\'ll just take a breather.']);
}

function tryOption(world: World, n: Npc, kind: string): boolean {
  const rng = world.state.rng;
  const s = world.settlement(n.settlementId);
  switch (kind) {
    case 'eat': {
      const pile = s && world.buildingsOf(s.id).find((b) => b.kind === 'stockpile' || b.kind === 'granary');
      if (n.carrying && n.carrying.amount >= 1 && ['fruit', 'grain', 'meat', 'fish'].includes(n.carrying.type)) {
        startMeal(world, n);
        return true;
      }
      if (!pile) {
        startMeal(world, n);
        return true;
      }
      if (Math.hypot(pile.x - n.x, pile.y - n.y) < 2) {
        startMeal(world, n);
        return true;
      }
      return walkTo(world, n, pile.x + randRange(rng, -1, 1), pile.y + 1.2, 'eat');
    }
    case 'sleep':
    case 'home': {
      const home = world.building(n.homeId);
      const fire = s && world.buildingsOf(s.id).find((b) => b.kind === 'campfire');
      const target = home ?? fire;
      if (!target) {
        n.action = { kind: 'sleep', timer: 360 };
        return true;
      }
      if (Math.hypot(target.x - n.x, target.y - n.y) < 1) {
        n.action = kind === 'sleep' ? { kind: 'sleep', timer: 420, targetId: target.id } : { kind: 'rest', timer: 60 };
        return true;
      }
      return walkTo(world, n, target.x, target.y + (home ? 0 : 1), kind === 'sleep' ? 'sleep' : 'rest', { targetId: target.id });
    }
    case 'rest': {
      const home = world.building(n.homeId);
      if (!home) {
        n.action = { kind: 'rest', timer: 120 };
        return true;
      }
      return walkTo(world, n, home.x, home.y, 'rest');
    }
    case 'work':
      return startWork(world, n);
    case 'play': {
      const fire = s && world.buildingsOf(s.id).find((b) => b.kind === 'campfire');
      const cx = fire?.x ?? n.x;
      const cy = fire?.y ?? n.y;
      return walkTo(world, n, cx + randRange(rng, -5, 5), cy + randRange(rng, -5, 5), 'play');
    }
    case 'learn': {
      const parent = world.npcById(n.motherId) ?? world.npcById(n.fatherId);
      const teacher = parent && parent.job !== 'child' && parent.settlementId === n.settlementId ? parent : null;
      if (!teacher) return false;
      return walkTo(world, n, teacher.x + 0.8, teacher.y, 'learn', { targetId: teacher.id });
    }
    case 'socialize': {
      const partner = pickConversationPartner(world, n);
      if (partner) return walkTo(world, n, partner.x + (partner.x > n.x ? -0.9 : 0.9), partner.y, 'talk', { targetId: partner.id });
      const fire = s && world.buildingsOf(s.id).find((b) => b.kind === 'campfire');
      if (!fire) return false;
      return walkTo(world, n, fire.x + randRange(rng, -2, 2), fire.y + randRange(rng, 0.8, 2), 'rest');
    }
    case 'wander': {
      const cx = s?.x ?? n.x;
      const cy = s?.y ?? n.y;
      const r = 6 + n.traits.openness * 14;
      return walkTo(world, n, cx + randRange(rng, -r, r), cy + randRange(rng, -r, r), 'idle');
    }
  }
  return false;
}

function pickConversationPartner(world: World, n: Npc): Npc | null {
  const rng = world.state.rng;
  if (n.goal && n.goal.kind === 'socialize' && n.goal.targetId >= 0) {
    const t = world.npcById(n.goal.targetId);
    if (t && t.action.kind !== 'sleep' && Math.hypot(t.x - n.x, t.y - n.y) < 60) return t;
  }
  let best: Npc | null = null;
  let bestScore = -Infinity;
  for (const o of world.residentsOf(n.settlementId)) {
    if (o.id === n.id || o.action.kind === 'sleep' || ageYears(o) < 4) continue;
    const d = Math.hypot(o.x - n.x, o.y - n.y);
    if (d > 35) continue;
    const r = n.relationships[o.id];
    const score =
      (r ? r.affinity * 0.8 + r.romance * 1.2 + (1 - r.familiarity) * 0.15 * n.traits.openness : 0.1) +
      (o.partnerId === n.id ? 0.5 : 0) -
      d / 40 +
      nextFloat(rng) * 0.4 -
      (r && r.affinity < -0.3 ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}

/** Who they have a crush on (worked out once a day in social.ts), or 0. */
function bestRomance(world: World, n: Npc): number {
  if (n.partnerId >= 0) return -1;
  return world.crushes.get(n.id) ?? 0;
}

function computeMood(world: World, n: Npc): number {
  const nd = n.needs;
  const needs = (nd.hunger * 1.4 + nd.energy + nd.social * 0.8 + nd.safety + nd.purpose * 0.7) / 4.9;
  let m = 0.55 - needs * 1.3 + memoryMood(world, n);
  if (n.illness) m -= n.illness.severity * 0.5;
  if (n.partnerId >= 0) m += 0.1;
  const s = world.settlement(n.settlementId);
  if (s && s.stock.goods > 1) m += 0.08;
  if (s && s.leaderId === n.id) m += 0.1;
  m -= (n.traits.neuroticism - 0.5) * 0.3;
  return Math.max(-1, Math.min(1, m));
}

// ------------------------------------------------------------------ thoughts

function thoughtFor(world: World, n: Npc, o: Option): string {
  const rng = world.state.rng;
  const t = n.traits;
  const anxious = t.neuroticism > 0.65;
  const grief = n.memory.recent.find((m) => m.feeling < -0.7 && world.state.time - m.time < 10 * 1440 && m.about >= 0);
  if (grief && (o.kind === 'rest' || o.kind === 'wander' || o.kind === 'sleep') && nextFloat(rng) < 0.5) {
    return grief.text.includes('died') ? `I keep thinking about what happened... ${grief.text}` : grief.text;
  }
  switch (o.kind) {
    case 'eat':
      if (o.why === 'starving') return pick(rng, ['I\'m starving. I need food now.', 'My stomach hurts, I haven\'t eaten in ages.']);
      return pick(rng, ['Time for something to eat.', 'I could do with a meal.', anxious ? 'I hope there\'s still food in the stores...' : 'Let\'s see what\'s in the stores.']);
    case 'sleep':
      return o.why === 'night'
        ? pick(rng, ['It\'s late. Time for bed.', 'A long day. Sleep.', anxious ? 'I hope tomorrow is better.' : 'Tomorrow is another day.'])
        : 'I\'m exhausted, I need a nap.';
    case 'rest':
      return pick(rng, ['I feel awful. I need to lie down.', 'This sickness... I need rest.']);
    case 'home':
      return 'I don\'t feel safe out here. Home.';
    case 'work': {
      const job = JOBS[n.job];
      if (o.why === 'needed') return pick(rng, [`We need ${job.verb === 'building' ? 'more homes' : 'supplies'}. Back to ${job.verb}.`, `Everyone is counting on me. Time for ${job.verb}.`]);
      if (t.conscientiousness > 0.65) return pick(rng, [`Work won't do itself. Back to ${job.verb}.`, `I take pride in my work as a ${job.name.toLowerCase()}.`]);
      if (t.conscientiousness < 0.35) return `I suppose I should do some ${job.verb}...`;
      return `Time for ${job.verb}.`;
    }
    case 'play':
      return pick(rng, ['Let\'s play!', 'I want to go play by the fire.', 'Race you!']);
    case 'learn':
      return 'I want to learn what my parents do.';
    case 'socialize': {
      const crushId = bestRomance(world, n);
      const crush = crushId > 0 ? world.npcById(crushId) : null;
      if (crush) return pick(rng, [`I can't stop thinking about ${crush.firstName}.`, `Maybe I'll go see ${crush.firstName}...`]);
      const partner = world.npcById(n.partnerId);
      if (partner && nextFloat(rng) < 0.5) return `I miss ${partner.firstName}. Let's spend some time together.`;
      return t.extraversion > 0.6 ? pick(rng, ['I need some company!', 'I wonder what everyone\'s up to.']) : 'Maybe a quiet chat with someone.';
    }
    case 'wander':
      return t.openness > 0.6 ? pick(rng, ['I wonder what\'s beyond those trees.', 'Let\'s explore a bit.']) : 'A short walk will clear my head.';
  }
  return '...';
}

/** Babies are carried by (or stay close to) a parent and sleep when they do. */
export function updateInfant(world: World, n: Npc): boolean {
  if (ageYears(n) >= 3) return false;
  const carer = world.npcById(n.motherId) ?? world.npcById(n.fatherId) ??
    world.residentsOf(n.settlementId).find((o) => o.homeId === n.homeId && isAdult(o));
  if (carer) {
    n.x = carer.x + 0.35 * carer.facing;
    n.y = carer.y + 0.05;
    n.facing = carer.facing;
    n.action = { kind: carer.action.kind === 'sleep' ? 'sleep' : 'idle', timer: 10 };
    rel(n, carer.id).affinity = Math.min(1, rel(n, carer.id).affinity + 0.0005);
  }
  n.thought = daylight(world.state.time) > 0.5 ? 'Goo goo.' : 'Zzz...';
  return true;
}

