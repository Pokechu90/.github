/**
 * Civilisation-era work and planning: farming, crafting, research; what each
 * settlement decides to build next; everyday consumption of tools, cloth and
 * goods; and growth from camp to village, town, city and metropolis.
 */
import { BUILDINGS } from '../../shared/people';
import { chance, randRange } from '../../shared/rng';
import { getCalendar } from '../../shared/time';
import type { BuildingKind, JobKey, Npc, ResourceType, Settlement } from '../state';
import type { World } from '../world';
import { addCarry, deliver, gainSkill, walkTo } from '../npc/actions';
import { ageYears } from '../npc/people';
import { remember } from '../npc/memory';
import { canAfford, findBuildSpot, pay, placeBuilding } from './settlement';
import { currentFocus, eraOf, ERAS, hasTech, TECH_BY_ID, updateResearchDaily } from './tech';

const TIERS: { tier: Settlement['tier']; pop: number; tech: string[] }[] = [
  { tier: 'metropolis', pop: 1500, tech: ['industry'] },
  { tier: 'city', pop: 250, tech: ['metalwork', 'currency'] },
  { tier: 'town', pop: 60, tech: ['masonry', 'writing'] },
  { tier: 'village', pop: 15, tech: ['agriculture'] },
  { tier: 'camp', pop: 0, tech: [] },
];

export function population(world: World, s: Settlement): number {
  return world.residentsOf(s.id).length + Math.round(s.abstractPop);
}

// ------------------------------------------------------------------ tasks

export function tryCivTask(world: World, n: Npc, task: string): boolean {
  const s = world.settlement(n.settlementId);
  if (!s) return false;
  switch (task) {
    case 'farm': {
      if (!hasTech(s, 'agriculture')) return false;
      const doy = getCalendar(world.state.time).dayOfYear;
      const farms = world.buildingsOf(s.id).filter((b) => b.kind === 'farm' && b.progress >= 1 && !world.isReserved(b.id, n.id));
      // Priority: collect a harvest > harvest a ripe field > sow in spring > tend growing crops.
      const pickFarm =
        farms.find((f) => f.amount > 0) ??
        farms.find((f) => f.crop >= 1) ??
        (doy < 40 ? farms.find((f) => f.crop === 0) : undefined) ??
        farms.filter((f) => f.crop > 0 && f.crop < 1).sort((a, b) => a.crop - b.crop)[0];
      if (!pickFarm) return false;
      world.reserve(pickFarm.id, n.id);
      return walkTo(world, n, pickFarm.x + randRange(world.state.rng, -1, 1), pickFarm.y + randRange(world.state.rng, -1, 1), 'work', { task, targetId: pickFarm.id });
    }
    case 'craft': {
      const recipe = chooseRecipe(world, s);
      if (!recipe) return false;
      const place = world.buildingsOf(s.id).find((b) => (b.kind === 'factory' || b.kind === 'smithy' || b.kind === 'workshop') && b.progress >= 1)
        ?? world.buildingsOf(s.id).find((b) => b.kind === 'stockpile');
      if (!place) return false;
      return walkTo(world, n, place.x + 0.6, place.y + 1, 'work', { task, targetId: place.id });
    }
    case 'research': {
      if (!currentFocus(world, s)) return false;
      const place = world.buildingsOf(s.id).find((b) => (b.kind === 'lab' || b.kind === 'school' || b.kind === 'temple') && b.progress >= 1)
        ?? world.buildingsOf(s.id).find((b) => b.kind === 'campfire');
      if (!place) return false;
      return walkTo(world, n, place.x + randRange(world.state.rng, -1.5, 1.5), place.y + 1.2, 'work', { task, targetId: place.id });
    }
  }
  return world.hooks.tryTradeTask?.(world, n, task) ?? false;
}

interface Recipe {
  out: ResourceType;
  amount: number;
  inputs: Partial<Record<ResourceType, number>>;
}

function chooseRecipe(world: World, s: Settlement): Recipe | null {
  const pop = Math.max(1, population(world, s));
  const st = s.stock;
  const recipes: (Recipe & { want: number; tech: string })[] = [
    { out: 'tools', amount: 2, inputs: { wood: 2, stone: 1 }, want: pop * 0.6 - st.tools, tech: 'toolmaking' },
    { out: 'cloth', amount: 1, inputs: { grain: 2 }, want: pop * 1 - st.cloth, tech: 'weaving' },
    { out: 'metal', amount: 1, inputs: { stone: 3, wood: 2 }, want: 30 - st.metal, tech: 'metalwork' },
    { out: 'goods', amount: hasTech(s, 'industry') ? 6 : 2, inputs: { wood: 1, cloth: 1, metal: hasTech(s, 'metalwork') ? 1 : 0 }, want: pop * 1.5 - st.goods, tech: 'currency' },
  ];
  const ok = recipes
    .filter((r) => hasTech(s, r.tech) && r.want > 0 && Object.entries(r.inputs).every(([k, v]) => st[k as ResourceType] >= (v ?? 0)))
    .sort((a, b) => b.want - a.want);
  return ok[0] ?? null;
}

export function doCivWork(world: World, n: Npc, dt: number): void {
  const a = n.action;
  const s = world.settlement(n.settlementId);
  if (!s) return;
  const eff = (ageYears(n) < 16 ? 0.5 : 1) * (s.stock.tools > 0 ? 1.3 : 1);
  switch (a.task) {
    case 'farm': {
      const f = world.building(a.targetId ?? -1);
      if (!f) {
        n.action = { kind: 'idle', timer: 5 };
        return;
      }
      if (f.amount > 0) {
        // Carry the harvest to the stores.
        const take = Math.min(10, f.amount);
        f.amount -= take;
        addCarry(n, 'grain', take);
        world.release(f.id);
        deliver(world, n);
        return;
      }
      if (f.crop >= 1) {
        if (a.timer > dt) return;
        // Harvest: yield depends on the farmers' skill and the soil.
        f.crop = 0;
        f.amount = 160 * (0.7 + n.skills.farming * 0.6) * (hasTech(s, 'engineering') ? 1.5 : 1) * (hasTech(s, 'industry') ? 1.6 : 1);
        if (hasTech(s, 'herding')) s.stock.meat += 20;
        gainSkill(world, n, 'farming', 0.01);
        world.markBuildingsChanged(f);
        remember(world, n, 'We brought in the harvest.', { importance: 0.3, feeling: 0.5 });
        n.action = { kind: 'idle', timer: 5 };
        return;
      }
      if (f.crop === 0) {
        if (a.timer > dt) return;
        f.crop = 0.05; // sown
        gainSkill(world, n, 'farming', 0.006);
        world.markBuildingsChanged(f);
        n.action = { kind: 'idle', timer: 5 };
        return;
      }
      // Tending (weeding, watering) speeds growth a little.
      f.crop = Math.min(1, f.crop + (dt / 60) * 0.004 * (0.5 + n.skills.farming) * eff);
      gainSkill(world, n, 'farming', 0.0005 * dt / 10);
      if (a.timer <= dt) world.release(f.id);
      return;
    }
    case 'craft': {
      if (a.timer > dt) return;
      const r = chooseRecipe(world, s);
      if (r) {
        for (const [k, v] of Object.entries(r.inputs)) s.stock[k as ResourceType] -= v ?? 0;
        s.stock[r.out] += r.amount * (0.6 + n.skills.crafting * 0.8) * eff;
        gainSkill(world, n, 'crafting', 0.01);
        world.hooks.onProduced?.(world, n, r.out, r.amount);
      }
      n.action = { kind: 'idle', timer: 5 };
      return;
    }
    case 'research': {
      const focus = currentFocus(world, s);
      if (focus) {
        let pts = (dt / 60) * (0.1 + n.skills.research * 0.3) * eff;
        if (hasTech(s, 'printing')) pts *= 1.8;
        if (hasTech(s, 'computing')) pts *= 1.6;
        s.research[focus.id] = (s.research[focus.id] ?? 0) + pts;
      }
      gainSkill(world, n, 'research', 0.0008 * dt / 10);
      if (a.timer <= dt && chance(world.state.rng, 0.1) && focus) {
        remember(world, n, `I spent the day studying ${focus.name.toLowerCase()}.`, { importance: 0.2, feeling: 0.2 });
      }
      return;
    }
    default:
      world.hooks.doTradeWork?.(world, n, dt);
  }
}

// ------------------------------------------------------------------ jobs

export function civJobDemand(world: World, s: Settlement, workers: number): Partial<Record<JobKey, number>> {
  const want: Partial<Record<JobKey, number>> = {};
  const farms = world.buildingsOf(s.id).filter((b) => b.kind === 'farm' && b.progress >= 1).length;
  if (hasTech(s, 'agriculture') && farms > 0) want.farmer = Math.max(1, Math.ceil(farms * 0.5));
  if (hasTech(s, 'toolmaking')) want.crafter = Math.max(1, Math.round(workers * (hasTech(s, 'industry') ? 0.15 : 0.08)));
  if (hasTech(s, 'writing')) want.scholar = Math.max(1, Math.round(workers * (eraOf(s) >= 5 ? 0.14 : 0.07)));
  else if (workers >= 10) want.scholar = 1; // a wise woman or shaman who ponders
  const tradeJobs = world.hooks.traderDemand?.(world, s, workers) ?? 0;
  if (tradeJobs) want.trader = tradeJobs;
  // Don't take too many people from food work.
  const total = Object.values(want).reduce((a, b) => a + (b ?? 0), 0);
  if (total > workers * 0.6) {
    const k = (workers * 0.6) / total;
    for (const key of Object.keys(want) as JobKey[]) want[key] = Math.floor((want[key] ?? 0) * k);
  }
  return want;
}

// ------------------------------------------------------------------ daily

export function civDaily(world: World): void {
  const cal = getCalendar(world.state.time);
  for (const s of world.state.settlements) {
    if (s.abandoned) continue;
    const pop = population(world, s);
    if (pop === 0) {
      abandon(world, s);
      continue;
    }
    growFarms(world, s, cal.season);
    consume(world, s, pop);
    planBuildings(world, s, pop);
    updateResearchDaily(world, s);
    updateTier(world, s, pop);
  }
}

function growFarms(world: World, s: Settlement, season: number): void {
  for (const f of world.buildingsOf(s.id)) {
    if (f.kind !== 'farm' || f.progress < 1) continue;
    if (season === 3) {
      // Frost kills unharvested crops; stored harvest rots slowly in the field.
      if (f.crop > 0 && f.crop < 1) f.crop = 0;
      f.amount *= 0.9;
      continue;
    }
    if (f.crop > 0 && f.crop < 1) {
      const w = world.weatherAt(f.x, f.y);
      const warm = w.tempC > 4 ? 1 : 0.2;
      f.crop = Math.min(1, f.crop + 0.024 * warm * (1 + w.rain * 0.4));
      world.markBuildingsChanged(f);
    }
  }
}

function consume(world: World, s: Settlement, pop: number): void {
  const st = s.stock;
  const workers = world.residentsOf(s.id).filter((n) => n.job !== 'child').length + s.abstractPop * 0.6;
  st.tools = Math.max(0, st.tools - workers * 0.01);
  if (hasTech(s, 'weaving')) st.cloth = Math.max(0, st.cloth - pop * 0.008);
  st.goods = Math.max(0, st.goods - pop * 0.01);
}

const PLAN: { kind: BuildingKind; when: (world: World, s: Settlement, pop: number, count: number) => boolean }[] = [
  { kind: 'farm', when: (_w, s, pop, c) => hasTech(s, 'agriculture') && c < Math.ceil(pop / 4) },
  { kind: 'workshop', when: (_w, s, pop, c) => hasTech(s, 'toolmaking') && pop >= 10 && c < 1 + Math.floor(pop / 120) },
  { kind: 'granary', when: (_w, s, pop, c) => hasTech(s, 'pottery') && pop >= 15 && c < 1 + Math.floor(pop / 150) },
  { kind: 'well', when: (_w, s, pop, c) => hasTech(s, 'masonry') && pop >= 20 && c < 1 + Math.floor(pop / 60) },
  { kind: 'school', when: (_w, s, pop, c) => hasTech(s, 'writing') && pop >= 25 && c < 1 + Math.floor(pop / 200) },
  { kind: 'market', when: (_w, s, pop, c) => hasTech(s, 'currency') && pop >= 35 && c < 1 + Math.floor(pop / 300) },
  { kind: 'temple', when: (_w, s, pop, c) => hasTech(s, 'masonry') && pop >= 45 && c < 1 + Math.floor(pop / 400) },
  { kind: 'smithy', when: (_w, s, pop, c) => hasTech(s, 'metalwork') && c < 1 + Math.floor(pop / 200) },
  { kind: 'factory', when: (_w, s, pop, c) => hasTech(s, 'industry') && c < 1 + Math.floor(pop / 150) },
  { kind: 'powerplant', when: (_w, s, pop, c) => hasTech(s, 'electricity') && c < 1 + Math.floor(pop / 500) },
  { kind: 'lab', when: (_w, s, pop, c) => hasTech(s, 'computing') && c < 1 + Math.floor(pop / 300) },
  { kind: 'launchpad', when: (_w, s, _pop, c) => hasTech(s, 'rocketry') && c < 1 },
];

function planBuildings(world: World, s: Settlement, pop: number): void {
  const buildings = world.buildingsOf(s.id);
  if (buildings.filter((b) => b.progress < 1).length >= 2 + Math.floor(pop / 80)) return;
  for (const p of PLAN) {
    const count = buildings.filter((b) => b.kind === p.kind).length;
    if (!p.when(world, s, pop, count) || !canAfford(s, p.kind)) continue;
    const size = BUILDINGS[p.kind].size;
    const spot = findBuildSpot(world, s, size, size + 3);
    if (!spot) continue;
    pay(s, p.kind);
    placeBuilding(world, s, p.kind, spot.x, spot.y, 0);
    return; // one new project a day
  }
}

function updateTier(world: World, s: Settlement, pop: number): void {
  const next = TIERS.find((t) => pop >= t.pop && t.tech.every((x) => hasTech(s, x)))!;
  const order = TIERS.map((t) => t.tier).reverse();
  if (order.indexOf(next.tier) > order.indexOf(s.tier)) {
    s.tier = next.tier;
    world.log(`${s.name} has grown into a ${next.tier} of ${pop} people (${ERAS[eraOf(s)]}).`, 'settlement', -1);
  }
}

function abandon(world: World, s: Settlement): void {
  s.abandoned = true;
  world.log(`${s.name} has been abandoned.`, 'settlement', -1);
  for (const b of world.buildingsOf(s.id).slice()) world.removeBuilding(b);
}

export function techName(id: string): string {
  return TECH_BY_ID.get(id)?.name ?? id;
}
