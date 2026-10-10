/**
 * Bridges the simulation and the LLM: packs what an NPC plausibly knows into
 * a prompt context, and applies what comes back (conversation results and
 * LLM-chosen goals) to the NPC's memory, feelings and plans.
 */
import { DISEASES, JOBS, traitWord } from '../../shared/people';
import { daylight, formatDate, getCalendar } from '../../shared/time';
import type { ChatResult, DecideResult, NpcPromptContext } from '../../shared/llm';
import type { Npc } from '../state';
import type { World } from '../world';
import { ageYears, attracted, fullName, isAdult, TRAITS } from './people';
import { allMemories, remember } from './memory';
import { describeDoing } from './describe';

const EMOTION_FEEL: Record<string, number> = {
  happy: 0.4, affectionate: 0.5, amused: 0.3, surprised: 0.05, neutral: 0,
  suspicious: -0.15, annoyed: -0.3, sad: -0.3, afraid: -0.4, angry: -0.5,
};

export function buildContext(world: World, n: Npc, withGoals = false): NpcPromptContext {
  const t = world.state.time;
  const cal = getCalendar(t);
  const s = world.settlement(n.settlementId);
  const pop = s ? world.residentsOf(s.id).length : 0;
  const w = world.weatherAt(n.x, n.y);
  const nameOf = (id: number) => {
    const p = world.npcById(id);
    if (p) return fullName(p);
    return world.state.deceased.find((d) => d.id === id)?.name ?? 'someone';
  };

  const family: string[] = [];
  if (n.partnerId >= 0) family.push(`${n.married ? 'spouse' : 'partner'} ${nameOf(n.partnerId)}`);
  for (const id of [n.motherId, n.fatherId]) {
    if (id < 0) continue;
    const alive = !!world.npcById(id);
    family.push(`${id === n.motherId ? 'mother' : 'father'} ${nameOf(id)}${alive ? '' : ' (dead)'}`);
  }
  for (const id of n.childrenIds) family.push(`child ${nameOf(id)}${world.npcById(id) ? `, ${Math.floor(ageYears(world.npcById(id)!))}` : ' (dead)'}`);

  const familyIds = new Set([n.partnerId, n.motherId, n.fatherId, ...n.childrenIds]);
  const rels = Object.entries(n.relationships)
    .map(([id, r]) => ({ id: Number(id), r }))
    .filter(({ id, r }) => world.npcById(id) && !familyIds.has(id) && (Math.abs(r.affinity) > 0.25 || r.romance > 0.3))
    .sort((a, b) => Math.abs(b.r.affinity) - Math.abs(a.r.affinity))
    .slice(0, 8)
    .map(({ id, r }) => `${nameOf(id)}: ${r.romance > 0.4 ? 'in love with them' : r.affinity > 0.6 ? 'close friend' : r.affinity > 0.25 ? 'friend' : r.affinity < -0.5 ? 'rival, dislikes strongly' : 'dislikes'}`);

  const feelings: string[] = [];
  const nd = n.needs;
  if (nd.hunger > 0.75) feelings.push('starving');
  else if (nd.hunger > 0.45) feelings.push('hungry');
  if (nd.energy > 0.75) feelings.push('exhausted');
  else if (nd.energy > 0.5) feelings.push('tired');
  if (nd.social > 0.7) feelings.push('lonely');
  if (nd.safety > 0.5) feelings.push('scared');
  if (nd.purpose > 0.7) feelings.push('bored and restless');
  if (n.pregnantDays >= 0) feelings.push('pregnant');

  const mems = allMemories(n);
  const playerMems = mems.filter((m) => m.about === -2).slice(-8).map((m) => `${formatDate(m.time)}: ${m.text}`);
  const chat = n.chatLog.slice(-6).map((c) => `${c.from === 'player' ? 'Stranger' : n.firstName}: ${c.text}`);
  const news = world.state.events
    .filter((e) => e.time > t - 30 * 1440 && s && e.text.includes(s.name))
    .slice(-4)
    .map((e) => e.text);

  const pa = n.playerAffinity;
  const ctx: NpcPromptContext = {
    id: n.id,
    name: fullName(n),
    age: Math.floor(ageYears(n)),
    sex: n.sex,
    job: JOBS[n.job]?.name ?? n.job,
    settlement: s?.name ?? 'the wilds',
    settlementSize: s ? `a ${s.tier} of ${pop} people` : 'nowhere in particular',
    personality: TRAITS.map((k) => traitWord(k, n.traits[k])).filter((x): x is string => !!x),
    traitNumbers: Object.fromEntries(TRAITS.map((k) => [k, n.traits[k]])),
    values: Object.entries(n.values).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k),
    mood: n.mood > 0.5 ? 'very happy' : n.mood > 0.15 ? 'content' : n.mood > -0.15 ? 'so-so' : n.mood > -0.5 ? 'unhappy' : 'miserable',
    feelings,
    health: n.illness ? `sick with ${DISEASES[n.illness.disease].name.toLowerCase()}` : n.health < 0.5 ? 'weak' : 'healthy',
    doing: describeDoing(world, n),
    thought: n.thought,
    goal: n.goal?.text ?? null,
    family,
    relationships: rels,
    memories: mems.slice(-16).map((m) => `${formatDate(m.time)}: ${m.text}${m.heardFrom >= 0 ? ` (heard from ${nameOf(m.heardFrom)})` : ''}`),
    memoriesOfPlayer: [...playerMems, ...(chat.length ? [`Last words exchanged:\n  ${chat.join('\n  ')}`] : [])],
    playerRelation: {
      affinity: pa,
      familiarity: n.playerFamiliarity,
      label: n.playerFamiliarity < 0.05 ? 'a complete stranger to them' :
        pa > 0.5 ? 'someone they like and trust' : pa > 0.15 ? 'someone they feel friendly towards' :
        pa < -0.4 ? 'someone they dislike and distrust' : pa < -0.1 ? 'someone they are wary of' : 'an acquaintance',
    },
    world: {
      date: formatDate(t),
      timeOfDay: daylight(t) < 0.25 ? 'night' : cal.hour < 11 ? 'morning' : cal.hour < 17 ? 'afternoon' : 'evening',
      season: cal.seasonName.toLowerCase(),
      weather: w.snowing ? 'snowing' : w.rain > 0.3 ? 'raining' : w.cloud > 0.5 ? 'cloudy' : 'clear',
      technology: s ? s.tech.map((x) => world.techName(x)) : [],
      localNews: news,
    },
  };
  if (withGoals) ctx.goalOptions = goalOptions(world, n);
  return ctx;
}

/** Concrete goals the simulation knows how to pursue. */
function goalOptions(world: World, n: Npc): string[] {
  const opts = ['eat something', 'go home and sleep', 'rest at home', `get on with my work as a ${JOBS[n.job]?.name.toLowerCase() ?? 'worker'}`, 'explore the surroundings'];
  const people = Object.entries(n.relationships)
    .map(([id, r]) => ({ p: world.npcById(Number(id)), r }))
    .filter((x) => x.p && x.p.settlementId === n.settlementId)
    .sort((a, b) => b.r.affinity + b.r.romance - (a.r.affinity + a.r.romance))
    .slice(0, 4);
  for (const { p, r } of people) {
    opts.push(`spend time with ${fullName(p!)}`);
    if (n.partnerId < 0 && isAdult(n) && attracted(n, p!) && r.romance > 0.15) opts.push(`court ${fullName(p!)}`);
  }
  if (isAdult(n) && world.hooks.canMigrate?.(world, n)) opts.push('leave and found a new settlement');
  return opts;
}

/** Applies the LLM's (or offline) chat answer to the NPC. */
export function applyChat(world: World, n: Npc, playerText: string, r: ChatResult): void {
  const t = world.state.time;
  n.chatLog.push({ from: 'player', text: playerText.slice(0, 300), time: t }, { from: 'npc', text: r.reply.slice(0, 300), time: t });
  if (n.chatLog.length > 12) n.chatLog.splice(0, n.chatLog.length - 12);
  n.playerAffinity = Math.max(-1, Math.min(1, n.playerAffinity + r.affinity_change));
  n.playerFamiliarity = Math.min(1, n.playerFamiliarity + 0.08);
  n.needs.social = Math.max(0, n.needs.social - 0.15);
  const feel = (EMOTION_FEEL[r.emotion] ?? 0) + r.affinity_change;
  n.mood = Math.max(-1, Math.min(1, n.mood + feel * 0.3));
  if (r.remember) {
    remember(world, n, r.remember, {
      about: -2,
      importance: Math.max(0.25, r.importance),
      feeling: Math.max(-1, Math.min(1, feel)),
      share: r.intent === 'tell_others' || r.importance > 0.6
        ? `${n.firstName} met a strange traveller who said: "${playerText.slice(0, 80)}"`
        : null,
    });
  }
  if (r.lied) remember(world, n, 'I didn\'t tell the stranger the truth.', { about: -2, importance: 0.35, feeling: -0.05 });
  if (r.intent === 'change_goal' && r.new_goal) setGoalFromText(world, n, r.new_goal, 12, 'stranger');
  if (r.intent === 'avoid_player') n.playerAffinity = Math.min(n.playerAffinity, -0.2);
}

/** Applies an LLM decision to an NPC near the player. */
export function applyGoal(world: World, n: Npc, d: DecideResult): void {
  setGoalFromText(world, n, d.goal, d.hours, d.target_name);
  if (d.thought) n.thought = `🧠 ${d.thought}`;
}

function setGoalFromText(world: World, n: Npc, text: string, hours: number, targetName: string): void {
  const g = text.toLowerCase();
  const target = world.residentsOf(n.settlementId).find(
    (p) => (targetName && fullName(p).toLowerCase() === targetName.toLowerCase()) || g.includes(fullName(p).toLowerCase()),
  );
  let kind = 'wander';
  if (/eat|food|hungry|meal/.test(g)) kind = 'eat';
  else if (/sleep|bed/.test(g)) kind = 'sleep';
  else if (/rest|home/.test(g)) kind = 'home';
  else if (/work|hunt|fish|forag|build|chop|farm|craft|heal|teach|research|trade/.test(g)) kind = 'work';
  else if (/court|spend time|talk|visit|see |friend/.test(g)) kind = 'socialize';
  else if (/found|leave|new settlement|migrat/.test(g)) kind = 'migrate';
  n.goal = { kind, text: text.slice(0, 80), until: world.state.time + Math.max(1, hours) * 60, targetId: target?.id ?? -1 };
  if (kind === 'migrate') world.hooks.requestMigration?.(world, n);
}
