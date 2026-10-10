/**
 * The cycle of life, run once per game day: growing up, finding work,
 * pregnancy and birth, old age, orphans being taken in, and jobs being
 * shared out according to what the settlement needs and who is good at what.
 */
import { JOBS } from '../../shared/people';
import { chance, randRange } from '../../shared/rng';
import { DAYS_PER_YEAR } from '../../shared/time';
import type { JobKey, Npc, Settlement } from '../state';
import type { World } from '../world';
import { ADULT_AGE, ELDER_AGE, WORK_AGE, ageYears, createNpc, fullName, isAdult, killNpc, rel } from './people';
import { remember } from './memory';
import { totalFood } from '../society/settlement';

const PREGNANCY_DAYS = 90;

export function updateLifeDaily(world: World): void {
  const s = world.state;
  for (const n of s.npcs.slice()) {
    const age = ageYears(n);
    const prevAge = age - 1 / DAYS_PER_YEAR;

    // Birthdays that matter.
    if (prevAge < WORK_AGE && age >= WORK_AGE) {
      remember(world, n, 'I\'m old enough to work now.', { importance: 0.5, feeling: 0.3 });
      n.job = 'forager';
    }
    if (prevAge < ADULT_AGE && age >= ADULT_AGE) remember(world, n, 'I came of age today.', { importance: 0.6, feeling: 0.5 });
    if (prevAge < ELDER_AGE && age >= ELDER_AGE) n.job = 'elder';

    // Old age.
    if (n.ageDays > n.lifespanDays && chance(s.rng, 0.15)) {
      killNpc(world, n, 'old age');
      continue;
    }
    // Starvation and exhaustion.
    if (n.health <= 0) {
      killNpc(world, n, n.needs.hunger >= 0.95 ? 'starvation' : 'exhaustion');
      continue;
    }

    // Pregnancy.
    if (n.pregnantDays >= 0) {
      n.pregnantDays += 1;
      if (n.pregnantDays >= PREGNANCY_DAYS) giveBirth(world, n);
    } else {
      tryConceive(world, n);
    }
  }
  adoptOrphans(world);
}

function tryConceive(world: World, n: Npc): void {
  if (n.sex !== 'female' || n.partnerId < 0) return;
  const age = ageYears(n);
  if (age < 17 || age > 45) return;
  const partner = world.npcById(n.partnerId);
  if (!partner || partner.sex !== 'male') return;
  // Not right after the last baby.
  const youngest = n.childrenIds.map((id) => world.npcById(id)).filter(Boolean) as Npc[];
  if (youngest.some((c) => ageYears(c) < 1.2)) return;
  const fertility = age < 30 ? 1 : age < 38 ? 0.7 : 0.3;
  const desire = (n.values.family + partner.values.family) / 2 + 0.3;
  const s = world.settlement(n.settlementId);
  const pop = s ? world.residentsOf(s.id).length : 1;
  const foodDays = s ? totalFood(s) / Math.max(1, pop) : 0;
  const security = foodDays > 4 ? 1 : foodDays > 1 ? 0.5 : 0.15;
  const married = n.married ? 1 : 0.4;
  if (chance(world.state.rng, 0.02 * fertility * desire * security * married)) {
    n.pregnantDays = 0;
    n.pregnancyFatherId = partner.id;
    const id = world.newId();
    const share = `${n.firstName} is expecting a baby with ${partner.firstName}.`;
    remember(world, n, 'I\'m expecting a baby!', { importance: 0.8, feeling: 0.8, eventId: id, share });
    remember(world, partner, `${n.firstName} is expecting our baby!`, { importance: 0.8, feeling: 0.8, about: n.id, eventId: id, share });
  }
}

function giveBirth(world: World, mother: Npc): void {
  const rng = world.state.rng;
  mother.pregnantDays = -1;
  const father = world.npcById(mother.pregnancyFatherId) ?? undefined;
  const baby = createNpc(world, {
    ageYears: 0,
    x: mother.x,
    y: mother.y,
    settlementId: mother.settlementId,
    mother,
    father,
  });
  baby.homeId = mother.homeId;
  baby.needs = { hunger: 0, energy: 0, social: 0, safety: 0, purpose: 0 };
  world.state.npcs.push(baby);
  world.state.stats.humanBirths++;
  const s = world.settlement(mother.settlementId);
  world.log(`${fullName(baby)} was born to ${mother.firstName}${father ? ` and ${father.firstName}` : ''}${s ? ` in ${s.name}` : ''}.`, 'birth', baby.id);

  const eventId = world.newId();
  for (const p of [mother, father]) {
    if (!p) continue;
    remember(world, p, `Our child ${baby.firstName} was born!`, {
      importance: 0.95, feeling: 0.95, about: baby.id, eventId,
      share: `${mother.firstName}${father ? ` and ${father.firstName}` : ''} had a baby: ${baby.firstName}.`,
    });
    rel(p, baby.id).affinity = 0.9;
    rel(baby, p.id).affinity = 0.9;
  }
  for (const sibId of mother.childrenIds) {
    const sib = world.npcById(sibId);
    if (sib && sib.id !== baby.id) remember(world, sib, `I have a new sibling: ${baby.firstName}.`, { importance: 0.6, feeling: 0.5, about: baby.id });
  }

  // Childbirth was dangerous before modern medicine.
  const medicine = s?.tech.includes('medicine') ? 0.5 : 0;
  if (chance(rng, 0.012 * (1 - medicine))) killNpc(world, mother, 'complications in childbirth');
  // Twins, occasionally.
  if (chance(rng, 0.015)) {
    const twin = createNpc(world, { ageYears: 0, x: mother.x, y: mother.y, settlementId: mother.settlementId, mother, father });
    twin.homeId = baby.homeId;
    twin.lastName = baby.lastName;
    world.state.npcs.push(twin);
    world.state.stats.humanBirths++;
    world.log(`...and a twin, ${twin.firstName}!`, 'birth', twin.id);
  }
}

/** Children whose parents have died are taken in by relatives or neighbours. */
function adoptOrphans(world: World): void {
  for (const kid of world.state.npcs) {
    if (ageYears(kid) >= 14) continue;
    const parentHere = [kid.motherId, kid.fatherId].some((id) => world.npcById(id)?.settlementId === kid.settlementId);
    if (parentHere) continue;
    const town = world.residentsOf(kid.settlementId).filter((a) => isAdult(a) && ageYears(a) < 65 && a.homeId >= 0);
    if (!town.length) continue;
    // Prefer relatives (grandparents, older siblings), then the kindest couple.
    const relatives = town.filter((a) =>
      a.childrenIds.includes(kid.motherId) || a.childrenIds.includes(kid.fatherId) ||
      (a.motherId >= 0 && a.motherId === kid.motherId) || (a.fatherId >= 0 && a.fatherId === kid.fatherId));
    const pool = relatives.length ? relatives : town;
    pool.sort((a, b) => b.traits.agreeableness + b.values.family + (b.partnerId >= 0 ? 0.3 : 0) - (a.traits.agreeableness + a.values.family + (a.partnerId >= 0 ? 0.3 : 0)));
    const guardian = pool[0];
    if (kid.motherId === guardian.id || kid.fatherId === guardian.id) continue;
    const old = kid.motherId;
    kid.motherId = guardian.sex === 'female' ? guardian.id : (world.npcById(guardian.partnerId)?.id ?? -1);
    kid.fatherId = guardian.sex === 'male' ? guardian.id : (world.npcById(guardian.partnerId)?.id ?? -1);
    if (kid.motherId === old && kid.motherId >= 0) continue;
    guardian.childrenIds.push(kid.id);
    kid.homeId = guardian.homeId;
    rel(kid, guardian.id).affinity = Math.max(rel(kid, guardian.id).affinity, 0.4);
    remember(world, kid, `${guardian.firstName} took me in.`, { importance: 0.9, feeling: 0.4, about: guardian.id });
    remember(world, guardian, `I took in ${kid.firstName}, who lost their parents.`, { importance: 0.7, feeling: 0.3, about: kid.id, share: `${guardian.firstName} took in the orphan ${kid.firstName}.` });
    world.log(`${fullName(guardian)} took in the orphan ${kid.firstName}.`, 'social', kid.id);
  }
}

/**
 * Shares out jobs. Each settlement works out how many people it needs for
 * each kind of work; people are matched to jobs by skill and personality,
 * and keep their job unless it's no longer needed.
 */
export function assignJobs(world: World, s: Settlement): void {
  const people = world.residentsOf(s.id);
  const workers = people.filter((n) => ageYears(n) >= WORK_AGE && ageYears(n) < ELDER_AGE);
  if (!workers.length) return;
  const pop = people.length;
  const food = totalFood(s);
  const foodDays = food / Math.max(1, pop);
  const sites = world.buildingsOf(s.id).filter((b) => b.progress < 1).length;
  const sick = people.filter((n) => n.illness).length;

  const want: Partial<Record<JobKey, number>> = {};
  const W = workers.length;
  want.healer = pop >= 8 ? Math.max(1, Math.round(pop / 25)) : sick > 1 ? 1 : 0;
  want.builder = sites > 0 ? Math.max(1, Math.round(W * 0.15)) : W > 8 ? 1 : 0;
  want.woodcutter = Math.max(1, Math.round(W * (s.stock.wood < 30 ? 0.18 : 0.1)));
  for (const [job, n] of Object.entries(world.hooks.jobDemand?.(world, s, W) ?? {})) want[job as JobKey] = n;
  let assigned = Object.values(want).reduce((a, b) => a + (b ?? 0), 0);
  // Everyone else gathers food; more of them when food is short.
  const foodWorkers = Math.max(1, W - assigned);
  if (foodDays < 15) {
    // Pull people off non-food jobs if starving.
    if (foodDays < 4) want.woodcutter = Math.min(want.woodcutter ?? 0, 1);
  }
  const hasFarms = (want.farmer ?? 0) > 0;
  want.hunter = Math.max(hasFarms ? 0 : 1, Math.round(foodWorkers * 0.3));
  want.fisher = Math.round(foodWorkers * 0.3);
  want.forager = Math.max(0, foodWorkers - (want.hunter ?? 0) - (want.fisher ?? 0));
  assigned = Object.values(want).reduce((a, b) => a + (b ?? 0), 0);

  // Keep current jobs where possible.
  const filled: Partial<Record<JobKey, number>> = {};
  const unassigned: Npc[] = [];
  for (const n of workers) {
    const j = n.job;
    if (j !== 'child' && j !== 'elder' && (filled[j] ?? 0) < (want[j] ?? 0)) filled[j] = (filled[j] ?? 0) + 1;
    else unassigned.push(n);
  }
  // Give the rest the open job that suits them best.
  for (const n of unassigned) {
    let best: JobKey = 'forager';
    let bestScore = -Infinity;
    for (const [job, count] of Object.entries(want) as [JobKey, number][]) {
      if ((filled[job] ?? 0) >= count) continue;
      const skill = n.skills[JOBS[job].skill as keyof Npc['skills']] ?? 0;
      const score = skill + personalityFit(n, job) + randRange(world.state.rng, 0, 0.15);
      if (score > bestScore) {
        bestScore = score;
        best = job;
      }
    }
    if (n.job !== best && n.job !== 'child' && ageYears(n) >= ADULT_AGE) {
      remember(world, n, `I became a ${JOBS[best].name.toLowerCase()}.`, { importance: 0.45, feeling: 0.1 });
    }
    n.job = best;
    filled[best] = (filled[best] ?? 0) + 1;
  }
}

function personalityFit(n: Npc, job: JobKey): number {
  const t = n.traits;
  const v = n.values;
  switch (job) {
    case 'hunter': return (1 - t.agreeableness) * 0.2 + v.freedom * 0.2;
    case 'healer': return t.agreeableness * 0.3 + v.knowledge * 0.1;
    case 'builder': return t.conscientiousness * 0.25;
    case 'scholar': return t.openness * 0.3 + v.knowledge * 0.3;
    case 'trader': return t.extraversion * 0.25 + v.wealth * 0.3;
    case 'farmer': return v.tradition * 0.2 + t.conscientiousness * 0.15;
    case 'crafter': return t.conscientiousness * 0.15 + t.openness * 0.15;
    case 'fisher': return (1 - t.extraversion) * 0.15;
    default: return 0.05;
  }
}
