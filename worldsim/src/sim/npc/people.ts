/**
 * People: creation (with inherited looks and personality), family helpers,
 * relationships and death.
 */
import { FEMALE_NAMES, MALE_NAMES, SURNAMES } from '../../shared/people';
import { chance, nextFloat, pick, randRange, type Rng } from '../../shared/rng';
import { DAYS_PER_YEAR } from '../../shared/time';
import type {
  Npc, Relationship, Sex, SkillKey, TraitKey, ValueKey,
} from '../state';
import type { World } from '../world';
import { remember } from './memory';

export const TRAITS: TraitKey[] = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
export const VALUES: ValueKey[] = ['family', 'wealth', 'knowledge', 'tradition', 'freedom'];
export const SKILLS: SkillKey[] = [
  'foraging', 'hunting', 'fishing', 'woodcutting', 'building',
  'farming', 'crafting', 'research', 'medicine', 'social',
];

export const ADULT_AGE = 16;
export const WORK_AGE = 13;
export const ELDER_AGE = 60;

const SKIN = [0xf3d2b3, 0xe8b98f, 0xd39b6a, 0xb37a4c, 0x8d5a34, 0x6b4226];
const HAIR = [0x1d1410, 0x3b2416, 0x6a4325, 0x9a6b3c, 0xd8b26a, 0xb5482a, 0x2a2a2a];
const SHIRTS = [0x2f6db0, 0xa83a32, 0x3d8b4f, 0xc79a2c, 0x7a4fa0, 0x8a5a33, 0x2e8c8c, 0xb35c8a, 0x5b6770];

export function ageYears(n: Npc): number {
  return n.ageDays / DAYS_PER_YEAR;
}
export function isAdult(n: Npc): boolean {
  return ageYears(n) >= ADULT_AGE;
}
export function fullName(n: { firstName: string; lastName: string }): string {
  return `${n.firstName} ${n.lastName}`;
}

export interface NewNpcOptions {
  sex?: Sex;
  ageYears: number;
  x: number;
  y: number;
  settlementId: number;
  lastName?: string;
  mother?: Npc;
  father?: Npc;
}

export function createNpc(world: World, o: NewNpcOptions): Npc {
  const rng = world.state.rng;
  const sex: Sex = o.sex ?? (chance(rng, 0.5) ? 'female' : 'male');
  const m = o.mother;
  const f = o.father;
  const inherit = (a: number | undefined, b: number | undefined) =>
    a === undefined || b === undefined ? nextFloat(rng) : clamp01((a + b) / 2 + randRange(rng, -0.18, 0.18));

  const traits = {} as Record<TraitKey, number>;
  for (const t of TRAITS) traits[t] = inherit(m?.traits[t], f?.traits[t]);
  const values = {} as Record<ValueKey, number>;
  for (const v of VALUES) values[v] = inherit(m?.values[v], f?.values[v]);
  const skills = {} as Record<SkillKey, number>;
  for (const s of SKILLS) skills[s] = 0;

  const skin = m && f ? (chance(rng, 0.5) ? m.appearance.skin : f.appearance.skin) : pick(rng, SKIN);
  const hair = m && f ? (chance(rng, 0.5) ? m.appearance.hair : f.appearance.hair) : pick(rng, HAIR);

  const lifespanYears = Math.max(42, o.ageYears + 4 + nextFloat(rng) * 6, 70 + gaussian(rng) * 11);
  const orientationRoll = nextFloat(rng);

  const npc: Npc = {
    id: world.newId(),
    firstName: pickName(world, sex, o.settlementId),
    lastName: o.lastName ?? f?.lastName ?? m?.lastName ?? pick(rng, SURNAMES),
    sex,
    orientation: orientationRoll < 0.9 ? 'opposite' : orientationRoll < 0.96 ? 'same' : 'both',
    x: o.x,
    y: o.y,
    facing: 1,
    ageDays: o.ageYears * DAYS_PER_YEAR,
    lifespanDays: lifespanYears * DAYS_PER_YEAR,
    appearance: { skin, hair, shirt: pick(rng, SHIRTS) },
    traits,
    values,
    skills,
    job: o.ageYears >= ELDER_AGE ? 'elder' : o.ageYears >= WORK_AGE ? 'forager' : 'child',
    needs: { hunger: randRange(rng, 0, 0.3), energy: randRange(rng, 0, 0.3), social: randRange(rng, 0, 0.4), safety: 0, purpose: randRange(rng, 0, 0.3) },
    health: 1,
    mood: 0.3,
    action: { kind: 'idle', timer: 0 },
    path: [],
    pathIndex: 0,
    dest: null,
    carrying: null,
    settlementId: o.settlementId,
    homeId: -1,
    motherId: m?.id ?? -1,
    fatherId: f?.id ?? -1,
    partnerId: -1,
    married: false,
    childrenIds: [],
    relationships: {},
    memory: { recent: [], longTerm: [] },
    thought: '',
    goal: null,
    pregnantDays: -1,
    pregnancyFatherId: -1,
    illness: null,
    immunity: {},
    lastMealTime: world.state.time,
    playerAffinity: 0,
    playerFamiliarity: 0,
    chatLog: [],
    wealth: 0,
  };

  // Adults created at world start get skills that fit their age and personality.
  if (o.ageYears > 6) {
    const years = Math.min(o.ageYears - 6, 30);
    for (const s of SKILLS) skills[s] = clamp01(nextFloat(rng) * 0.25 + years * 0.012 * nextFloat(rng));
    skills.research = clamp01(skills.research * (0.5 + traits.openness));
    skills.social = clamp01(skills.social * (0.5 + traits.extraversion));
  }
  if (m) m.childrenIds.push(npc.id);
  if (f) f.childrenIds.push(npc.id);
  return npc;
}

function pickName(world: World, sex: Sex, settlementId: number): string {
  const list = sex === 'female' ? FEMALE_NAMES : MALE_NAMES;
  const used = new Set(world.state.npcs.filter((n) => n.settlementId === settlementId).map((n) => n.firstName));
  for (let i = 0; i < 12; i++) {
    const name = pick(world.state.rng, list);
    if (!used.has(name)) return name;
  }
  return pick(world.state.rng, list);
}

/** The relationship from a to b (created on first contact). */
export function rel(a: Npc, bId: number): Relationship {
  let r = a.relationships[bId];
  if (!r) a.relationships[bId] = r = { affinity: 0, familiarity: 0, romance: 0 };
  return r;
}

export function areCloseKin(a: Npc, b: Npc): boolean {
  if (a.id === b.motherId || a.id === b.fatherId || b.id === a.motherId || b.id === a.fatherId) return true;
  const sharedParent =
    (a.motherId >= 0 && a.motherId === b.motherId) || (a.fatherId >= 0 && a.fatherId === b.fatherId);
  return sharedParent;
}

export function siblings(world: World, n: Npc): Npc[] {
  return world.state.npcs.filter(
    (o) => o.id !== n.id && ((n.motherId >= 0 && o.motherId === n.motherId) || (n.fatherId >= 0 && o.fatherId === n.fatherId)),
  );
}

/** Could `a` be romantically attracted to `b`? */
export function attracted(a: Npc, b: Npc): boolean {
  if (!isAdult(a) || !isAdult(b) || areCloseKin(a, b)) return false;
  if (Math.abs(a.ageDays - b.ageDays) > 15 * DAYS_PER_YEAR) return false;
  const same = a.sex === b.sex;
  if (a.orientation === 'opposite' && same) return false;
  if (a.orientation === 'same' && !same) return false;
  return true;
}

/** How well two personalities get along, 0..1. */
export function compatibility(a: Npc, b: Npc): number {
  let diff = 0;
  for (const t of TRAITS) diff += Math.abs(a.traits[t] - b.traits[t]);
  let vdiff = 0;
  for (const v of VALUES) vdiff += Math.abs(a.values[v] - b.values[v]);
  const kindness = (a.traits.agreeableness + b.traits.agreeableness) / 2;
  return clamp01(1 - diff / 5 - vdiff / 8 + (kindness - 0.5) * 0.5);
}

/** Removes a person from the world, records them, and lets everyone grieve. */
export function killNpc(world: World, npc: Npc, cause: string): void {
  const s = world.state;
  const idx = s.npcs.indexOf(npc);
  if (idx < 0) return;
  s.npcs.splice(idx, 1);
  s.deceased.push({
    id: npc.id,
    name: fullName(npc),
    sex: npc.sex,
    bornDay: Math.floor((s.time / 1440) - npc.ageDays),
    diedDay: Math.floor(s.time / 1440),
    cause,
    motherId: npc.motherId,
    fatherId: npc.fatherId,
    partnerId: npc.partnerId,
    childrenIds: npc.childrenIds.slice(),
  });
  if (s.deceased.length > 5000) s.deceased.splice(0, 1000);
  s.stats.humanDeaths[cause] = (s.stats.humanDeaths[cause] ?? 0) + 1;

  const age = Math.floor(ageYears(npc));
  const eventId = world.newId();
  const settlement = world.settlement(npc.settlementId);
  world.log(`${fullName(npc)} died of ${cause} at age ${age}${settlement ? ` in ${settlement.name}` : ''}.`, 'death', npc.id);

  for (const other of s.npcs) {
    const r = other.relationships[npc.id];
    const family =
      other.partnerId === npc.id || other.motherId === npc.id || other.fatherId === npc.id ||
      npc.childrenIds.includes(other.id) || areCloseKin(other, npc);
    if (!family && (!r || r.familiarity < 0.3)) continue;
    const closeness = family ? 1 : Math.max(0, r?.affinity ?? 0);
    if (closeness <= 0.1 && !(r && r.affinity < -0.4)) continue;
    const text = r && r.affinity < -0.4 && !family
      ? `${npc.firstName}, whom I disliked, died of ${cause}.`
      : `${fullName(npc)} died of ${cause}. I miss them.`;
    remember(world, other, text, {
      share: `${fullName(npc)} died of ${cause}.`,
      importance: family ? 0.95 : 0.4 + closeness * 0.4,
      feeling: r && r.affinity < -0.4 && !family ? 0 : -0.5 - closeness * 0.5,
      about: npc.id,
      eventId,
    });
    if (other.partnerId === npc.id) {
      other.partnerId = -1;
      other.married = false;
    }
    delete other.relationships[npc.id];
  }
}

export function gaussian(r: Rng): number {
  const u = Math.max(1e-9, nextFloat(r));
  const v = nextFloat(r);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
