/**
 * Turns an NPC's raw state into the readable profile shown in the side panel.
 */
import { BUILDINGS, DISEASES, JOBS, traitWord } from '../../shared/people';
import { formatDate } from '../../shared/time';
import type { SelectedInfo } from '../../shared/protocol';
import type { Npc, SkillKey, ValueKey } from '../state';
import type { World } from '../world';
import { ageYears, fullName, siblings, TRAITS } from './people';
import { homeResidents } from '../society/settlement';

const ACTION_WORDS: Record<string, string> = {
  idle: 'idling', walk: 'walking', sleep: 'sleeping', eat: 'eating', work: 'working', talk: 'talking',
  play: 'playing', learn: 'learning', rest: 'resting', wander: 'wandering', migrate: 'travelling',
};

const TASK_WORDS: Record<string, string> = {
  forage: 'picking fruit', 'forage-eat': 'looking for food', gather: 'gathering roots and greens', hunt: 'hunting',
  fish: 'fishing', chop: 'felling a tree', quarry: 'quarrying stone', build: 'building', heal: 'tending the sick',
  teach: 'teaching a child', deliver: 'carrying goods to the stores', farm: 'farming', craft: 'crafting',
  research: 'studying', trade: 'trading',
};

export function describeDoing(world: World, n: Npc): string {
  const a = n.action;
  const target = a.targetId !== undefined ? world.npcById(a.targetId) : undefined;
  if (a.kind === 'talk' && target) return `talking with ${target.firstName}`;
  if (a.kind === 'walk') {
    if (a.task) return `on the way: ${TASK_WORDS[a.task] ?? a.task}`;
    if (a.then === 'talk' && target) return `going to see ${target.firstName}`;
    if (a.then === 'eat') return 'going to eat';
    if (a.then === 'sleep') return 'heading home to sleep';
    if (a.then === 'migrate' || a.kind === 'walk' && n.goal?.kind === 'migrate') return 'travelling to a new home';
    return 'walking';
  }
  if (a.kind === 'work') return TASK_WORDS[a.task ?? ''] ?? 'working';
  if (a.kind === 'learn' && target) return `learning from ${target.firstName}`;
  return ACTION_WORDS[a.kind] ?? a.kind;
}

export function describeNpc(world: World, n: Npc): SelectedInfo {
  const age = ageYears(n);
  const s = world.settlement(n.settlementId);
  const job = JOBS[n.job]?.name ?? n.job;

  const traits = TRAITS.map((t) => traitWord(t, n.traits[t])).filter((w): w is string => !!w);
  const values = (Object.entries(n.values) as [ValueKey, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => VALUE_WORDS[k]);
  const skills = (Object.entries(n.skills) as [SkillKey, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .filter(([, v]) => v > 0.02)
    .map(([k, v]) => ({ label: k[0].toUpperCase() + k.slice(1), value: v }));

  const conditions: string[] = [];
  if (n.illness) conditions.push(`Sick: ${DISEASES[n.illness.disease].name} (${Math.ceil(n.illness.daysLeft)} days left)`);
  if (n.pregnantDays >= 0) conditions.push(`Pregnant (${Math.floor(n.pregnantDays / 30) + 1} of 3 months)`);
  if (n.homeId < 0) conditions.push('Homeless');
  if (n.carrying) conditions.push(`Carrying ${n.carrying.amount.toFixed(1)} ${n.carrying.type}`);

  return {
    kind: 'npc',
    id: n.id,
    x: n.x,
    y: n.y,
    title: fullName(n),
    subtitle: `${n.sex === 'female' ? 'Woman' : 'Man'}${age < 16 ? ' (child)' : ''}, ${Math.floor(age)} · ${job}${s ? ` · ${s.name}` : ''}`,
    thought: n.thought,
    goal: n.goal ? n.goal.text : null,
    doing: describeDoing(world, n),
    mood: n.mood,
    needs: [
      { label: 'Hunger', value: n.needs.hunger },
      { label: 'Tiredness', value: n.needs.energy },
      { label: 'Loneliness', value: n.needs.social },
      { label: 'Fear', value: n.needs.safety },
      { label: 'Boredom', value: n.needs.purpose },
    ],
    health: n.health,
    conditions,
    traits,
    values,
    skills,
    family: family(world, n),
    relationships: relationships(world, n),
    memories: [...n.memory.longTerm.map((m) => ({ m, lasting: true })), ...n.memory.recent.slice(-10).map((m) => ({ m, lasting: false }))]
      .reverse()
      .map(({ m, lasting }) => ({
        text: m.text,
        when: formatDate(m.time),
        source: m.heardFrom >= 0 ? nameOf(world, m.heardFrom) : null,
        lasting,
      })),
    playerAffinity: n.playerAffinity,
  };
}

const VALUE_WORDS: Record<ValueKey, string> = {
  family: 'family', wealth: 'prosperity', knowledge: 'knowledge', tradition: 'tradition', freedom: 'freedom',
};

function nameOf(world: World, id: number): string {
  const n = world.npcById(id);
  if (n) return n.firstName;
  return world.state.deceased.find((d) => d.id === id)?.name.split(' ')[0] ?? 'someone';
}

function family(world: World, n: Npc): { relation: string; name: string; id: number; alive: boolean }[] {
  const out: { relation: string; name: string; id: number; alive: boolean }[] = [];
  const add = (relation: string, id: number) => {
    if (id < 0) return;
    const live = world.npcById(id);
    if (live) out.push({ relation, name: fullName(live), id, alive: true });
    else {
      const dead = world.state.deceased.find((d) => d.id === id);
      if (dead) out.push({ relation, name: dead.name, id, alive: false });
    }
  };
  add(n.married ? (otherSex(world, n.partnerId) === 'female' ? 'Wife' : 'Husband') : 'Partner', n.partnerId);
  add('Mother', n.motherId);
  add('Father', n.fatherId);
  for (const c of n.childrenIds) add(otherSex(world, c) === 'female' ? 'Daughter' : 'Son', c);
  for (const sib of siblings(world, n)) add(sib.sex === 'female' ? 'Sister' : 'Brother', sib.id);
  return out;
}

function otherSex(world: World, id: number): string | undefined {
  return world.npcById(id)?.sex ?? world.state.deceased.find((d) => d.id === id)?.sex;
}

function relationships(world: World, n: Npc) {
  return Object.entries(n.relationships)
    .map(([id, r]) => ({ id: Number(id), r }))
    .filter(({ id, r }) => world.npcById(id) && (Math.abs(r.affinity) > 0.25 || r.romance > 0.3))
    .sort((a, b) => Math.abs(b.r.affinity) + b.r.romance - (Math.abs(a.r.affinity) + a.r.romance))
    .slice(0, 6)
    .map(({ id, r }) => ({
      name: fullName(world.npcById(id)!),
      id,
      affinity: r.affinity,
      label:
        n.partnerId === id ? 'partner' :
        r.romance > 0.4 ? 'in love' :
        r.affinity > 0.6 ? 'close friend' :
        r.affinity > 0.25 ? 'friend' :
        r.affinity < -0.5 ? 'rival' : 'dislikes',
    }));
}

export function describeBuilding(world: World, id: number): SelectedInfo {
  const b = world.building(id);
  if (!b) return { kind: 'gone', text: 'This building is gone.' };
  const s = world.settlement(b.settlementId);
  const info = BUILDINGS[b.kind];
  const notes: string[] = [];
  if (b.progress < 1) notes.push(`Under construction: ${Math.round(b.progress * 100)}%`);
  if (b.kind === 'stockpile' || b.kind === 'granary') {
    if (s) for (const [k, v] of Object.entries(s.stock)) if (v >= 1) notes.push(`${k}: ${Math.floor(v)}`);
  }
  if (b.kind === 'farm') notes.push(`Crop: ${Math.round(b.crop * 100)}% grown`);
  return {
    kind: 'building',
    id: b.id,
    x: b.x,
    y: b.y,
    title: info.name,
    settlement: s?.name ?? '',
    progress: b.progress,
    residents: homeResidents(world, b.id).map((r) => ({ name: fullName(r), id: r.id })),
    notes,
  };
}
