/**
 * Tiered simulation: how the world scales to thousands of people.
 *
 *  Tier A, "focus":   people the camera is looking at. Full simulation, and the
 *                     LLM may decide their goals and talk for them.
 *  Tier B, "active":  settlements near the camera. Full minute-by-minute
 *                     simulation by the rules-based brain.
 *  Tier C, "distant": everywhere else. Each settlement is simulated once a day
 *                     in aggregate: work produces goods, people eat, chat,
 *                     court, fall ill, have children and die, but nobody walks
 *                     around. When the camera comes back they wake up exactly
 *                     where their lives have got to.
 *
 * Very large cities also keep part of their population as an "abstract"
 * number (people who exist statistically) so memory stays bounded.
 */
import { CHUNK_SIZE } from '../shared/terrain';
import { getCalendar } from '../shared/time';
import type { Npc, ResourceType, Settlement, SkillKey } from './state';
import type { World } from './world';
import { ageYears } from './npc/people';
import { converse } from './npc/social';
import { gainSkill } from './npc/actions';
import { takeFood } from './society/settlement';
import { hasTech } from './society/tech';

/** Settlements within this many tiles of the camera are fully simulated. */
export const ACTIVE_RADIUS = 110;
/** Most individual people per settlement; more become abstract population. */
export const INDIVIDUAL_CAP = 260;
/** Most individual people in the whole world. */
export const GLOBAL_INDIVIDUAL_CAP = 3500;

export function updateTiers(world: World): void {
  const f = world.focus;
  world.activeSettlements.clear();
  if (world.fastForward) return;
  for (const s of world.state.settlements) {
    if (s.abandoned) continue;
    if (!f || Math.hypot(s.x - f.x, s.y - f.y) < ACTIVE_RADIUS) world.activeSettlements.add(s.id);
  }
}

export function isActiveNpc(world: World, n: Npc): boolean {
  if (world.fastForward) return world.chatting.has(n.id);
  if (!world.focus) return true;
  if (world.activeSettlements.has(n.settlementId)) return true;
  return Math.hypot(n.x - world.focus.x, n.y - world.focus.y) < ACTIVE_RADIUS;
}

/** Is this chunk close enough to anything that matters to update daily? */
export function chunkIsNear(world: World, cx: number, cy: number): boolean {
  const f = world.focus;
  if (!f) return true;
  const x = (cx + 0.5) * CHUNK_SIZE;
  const y = (cy + 0.5) * CHUNK_SIZE;
  if (Math.hypot(x - f.x, y - f.y) < ACTIVE_RADIUS) return true;
  for (const id of world.activeSettlements) {
    const s = world.settlement(id)!;
    if (Math.hypot(x - s.x, y - s.y) < 90) return true;
  }
  return false;
}

// ------------------------------------------------------------------ tier C

const JOB_OUTPUT: Record<string, { skill: SkillKey; make: (s: Settlement, winter: boolean) => [ResourceType, number][] }> = {
  forager: { skill: 'foraging', make: (_s, winter) => (winter ? [['fish', 2.5]] : [['fruit', 5]]) },
  hunter: { skill: 'hunting', make: () => [['meat', 3.5]] },
  fisher: { skill: 'fishing', make: () => [['fish', 5]] },
  woodcutter: { skill: 'woodcutting', make: (s) => (s.stock.wood > 120 ? [['stone', 3]] : [['wood', 6]]) },
  builder: { skill: 'building', make: () => [] },
  farmer: { skill: 'farming', make: (_s, winter) => (winter ? [['fish', 1.5]] : [['fruit', 2.5]]) },
  crafter: { skill: 'crafting', make: () => [] },
  scholar: { skill: 'research', make: () => [] },
  healer: { skill: 'medicine', make: () => [] },
  trader: { skill: 'social', make: () => [] },
  elder: { skill: 'social', make: () => [] },
};

/** One day in a distant settlement, in aggregate. */
export function distantSettlementDaily(world: World, s: Settlement): void {
  const cal = getCalendar(world.state.time);
  const winter = cal.season === 3;
  const people = world.residentsOf(s.id);
  const tools = s.stock.tools > 0 ? 1.3 : 1;
  let builderHours = 0;
  let researchHours = 0;
  let crafts = 0;

  for (const n of people) {
    n.ageDays += 1;
    // Stay put near home: travellers arrive, traders sell their cargo.
    if (n.carrying) {
      s.stock[n.carrying.type] += n.carrying.amount;
      n.carrying = null;
    }
    if (Math.hypot(n.x - s.x, n.y - s.y) > 20) {
      const home = world.building(n.homeId);
      n.x = (home?.x ?? s.x) + (world.rand() - 0.5) * 2;
      n.y = (home?.y ?? s.y) + 1 + world.rand();
    }
    n.path = [];
    n.dest = null;
    n.action = { kind: 'idle', timer: 0 };
    n.goal = n.goal?.kind === 'migrate' ? null : n.goal;

    // Work.
    const age = ageYears(n);
    if (age >= 13 && n.job !== 'child') {
      const job = JOB_OUTPUT[n.job];
      const eff = (age < 16 ? 0.5 : age > 65 ? 0.6 : 1) * tools * (0.6 + (job ? n.skills[job.skill] : 0) * 0.6) * (n.illness ? 0.4 : 1);
      if (job) {
        for (const [res, amount] of job.make(s, winter)) s.stock[res] += amount * eff;
        gainSkill(world, n, job.skill, 0.02);
      }
      if (n.job === 'builder') builderHours += 8 * eff;
      if (n.job === 'scholar') researchHours += 8 * eff * (0.4 + n.skills.research * 1.2) * (hasTech(s, 'writing') ? 1 : 0.5);
      if (n.job === 'crafter') crafts += 2 * eff;
      if (n.job === 'healer') for (const p of people) if (p.illness) p.illness.daysLeft -= 0.3 * n.skills.medicine;
      if (n.job === 'trader' && world.rand() < 0.15) world.hooks.abstractTrade?.(world, s);
    } else if (age >= 4) {
      const parent = world.npcById(n.motherId) ?? world.npcById(n.fatherId);
      if (parent && JOB_OUTPUT[parent.job]) gainSkill(world, n, JOB_OUTPUT[parent.job].skill, 0.008);
    }

    // Eat.
    let relief = 0;
    while (n.needs.hunger - relief > 0.15) {
      const r = takeFood(s);
      if (r <= 0) break;
      relief += r;
    }
    n.needs.hunger = Math.max(0, n.needs.hunger - relief);
    if (relief === 0) n.needs.hunger = Math.min(1, n.needs.hunger + 0.67);
    if (n.needs.hunger >= 1) n.health -= 0.15;
    else if (!n.illness) n.health = Math.min(1, n.health + 0.2);
    n.needs.energy = 0.2;
    n.needs.safety = 0;
    n.needs.purpose = 0.2;
  }

  // Building, crafting, farming and research in bulk.
  for (const site of world.buildingsOf(s.id)) {
    if (builderHours <= 0) break;
    if (site.progress >= 1) continue;
    const need = (1 - site.progress) * world.buildingWork(site.kind);
    const used = Math.min(need, builderHours);
    site.progress = Math.min(1, site.progress + used / Math.max(1, world.buildingWork(site.kind)));
    builderHours -= used;
    if (site.progress >= 1) world.markBuildingsChanged(site);
  }
  if (builderHours > 0) s.stock.stone += builderHours * 0.3;
  for (let i = 0; i < Math.round(crafts); i++) world.hooks.abstractCraft?.(world, s);
  for (const f of world.buildingsOf(s.id)) {
    if (f.kind !== 'farm' || f.progress < 1) continue;
    if (f.crop === 0 && cal.dayOfYear < 40) f.crop = 0.05;
    if (f.crop >= 1) {
      f.crop = 0;
      s.stock.grain += 160 * (hasTech(s, 'engineering') ? 1.5 : 1) * (hasTech(s, 'industry') ? 1.6 : 1);
      if (hasTech(s, 'herding')) s.stock.meat += 20;
    }
    if (f.amount > 0) {
      s.stock.grain += f.amount;
      f.amount = 0;
    }
  }
  if (researchHours > 0) world.hooks.abstractResearch?.(world, s, researchHours);

  // Social life: a handful of conversations a day keep friendships, rivalries
  // and romances developing, and gossip flowing.
  const talkers = people.filter((n) => ageYears(n) >= 4);
  const chats = Math.ceil(talkers.length / 4);
  for (let i = 0; i < chats && talkers.length > 1; i++) {
    const a = talkers[Math.floor(world.rand() * talkers.length)];
    let b = talkers[Math.floor(world.rand() * talkers.length)];
    // People mostly talk to those they like (or love).
    const liked = Object.entries(a.relationships).filter(([, r]) => r.affinity > 0.2 || r.romance > 0.2);
    if (liked.length && world.rand() < 0.6) b = world.npcById(Number(liked[Math.floor(world.rand() * liked.length)][0])) ?? b;
    if (a !== b && b.settlementId === a.settlementId) converse(world, a, b);
  }
  for (const n of people) n.needs.social = 0.3;
}

/** Statistical births, deaths, work and food for a city's abstract population. */
export function abstractPopulationDaily(world: World, s: Settlement): void {
  if (s.abstractPop <= 0) return;
  const p = s.abstractPop;
  // Food: they eat like everyone else.
  let need = p * 0.67;
  let guard = 0;
  while (need > 0 && guard++ < 10000) {
    const r = takeFood(s);
    if (r <= 0) break;
    need -= r;
  }
  const fed = need <= 0;
  // Work: most adults produce food, some materials and crafts.
  const workers = p * 0.6;
  let foodMult = 1;
  if (hasTech(s, 'agriculture')) foodMult = 1.4;
  if (hasTech(s, 'engineering')) foodMult = 1.7;
  if (hasTech(s, 'industry')) foodMult = 2.3;
  s.stock.grain += workers * 0.65 * 3 * foodMult;
  s.stock.fish += workers * 0.1 * 3;
  s.stock.wood += workers * 0.1 * 5;
  s.stock.stone += workers * 0.08 * 3;
  if (hasTech(s, 'toolmaking')) s.stock.tools += workers * 0.02;
  if (hasTech(s, 'currency')) s.stock.goods += workers * 0.03 * (hasTech(s, 'industry') ? 3 : 1);
  world.hooks.abstractResearch?.(world, s, workers * 0.07 * 8);
  // Births and deaths (per year: ~3.5% births, ~2.2% deaths, more when hungry).
  const sick = world.residentsOf(s.id).filter((n) => n.illness).length / Math.max(1, world.residentsOf(s.id).length);
  const births = (p * 0.035 * (fed ? 1 : 0.3)) / 120;
  const deaths = (p * (0.022 + (fed ? 0 : 0.2) + sick * 0.3)) / 120;
  s.abstractPop = Math.max(0, p + births - deaths);
  if (!fed && world.rand() < 0.02) world.log(`Famine stalks the poorer districts of ${s.name}.`, 'disease', -1);
}

/** Called at birth: should this baby be an individual or abstract population? */
export function birthIsAbstract(world: World, s: Settlement | undefined): boolean {
  if (!s) return false;
  return world.residentsOf(s.id).length >= INDIVIDUAL_CAP || world.state.npcs.length >= GLOBAL_INDIVIDUAL_CAP;
}
