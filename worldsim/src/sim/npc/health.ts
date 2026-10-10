/**
 * Disease. People can catch illnesses out of the blue (more likely when
 * hungry, cold, very young or old, or crowded), and pass them on to the
 * people they live with and meet. Survivors become immune for a while
 * (or for life, for the pox and plague). Healers and medicine help.
 *
 * Outbreaks are emergent: a crowded, hungry town in winter can be hit hard.
 */
import { DISEASES } from '../../shared/people';
import { chance, nextFloat, randInt } from '../../shared/rng';
import { getCalendar } from '../../shared/time';
import type { Npc } from '../state';
import type { World } from '../world';
import { ageYears, fullName, killNpc } from './people';
import { remember } from './memory';
import { homeResidents } from '../society/settlement';

const outbreakLogged = new Map<string, number>();

/** Daily health update for everyone. */
export function updateHealthDaily(world: World): void {
  const s = world.state;
  const day = Math.floor(s.time / 1440);
  const winter = getCalendar(s.time).season === 3;
  const rng = s.rng;

  // 1. Spread: each sick person can infect housemates and a few others in town.
  const sick = s.npcs.filter((n) => n.illness);
  for (const carrier of sick) {
    const d = DISEASES[carrier.illness!.disease];
    const contacts = homeResidents(world, carrier.homeId).filter((n) => n.id !== carrier.id);
    const town = world.residentsOf(carrier.settlementId);
    for (let k = 0; k < 3 && town.length; k++) contacts.push(town[randInt(rng, 0, town.length - 1)]);
    for (const other of contacts) {
      if (other.id === carrier.id || other.illness) continue;
      const s = world.settlement(carrier.settlementId);
      const quarantine = s?.laws.includes('Quarantine of the sick') ? 0.4 : 1;
      const hours = (other.homeId === carrier.homeId ? 10 : 1.5) * quarantine;
      const p = 1 - Math.pow(1 - d.contagion * susceptibility(world, other, winter), hours);
      if (chance(rng, p)) infect(world, other, carrier.illness!.disease, carrier);
    }
  }

  // 2. New cases appearing on their own.
  for (const n of s.npcs) {
    if (n.illness) continue;
    for (const [key, d] of Object.entries(DISEASES)) {
      const crowd = world.settlement(n.settlementId);
      const crowdFactor = crowd ? 1 + Math.min(4, world.residentsOf(crowd.id).length / 80) : 1;
      if (chance(rng, d.spontaneous * susceptibility(world, n, winter) * crowdFactor)) {
        infect(world, n, key, null);
        break;
      }
    }
  }

  // 3. Course of illness: recover, or die.
  for (const n of s.npcs.slice()) {
    const ill = n.illness;
    if (!ill) continue;
    const d = DISEASES[ill.disease];
    const age = ageYears(n);
    let risk = d.lethality;
    if (age < 3) risk *= 3;
    else if (age > 60) risk *= 1 + (age - 60) / 8;
    if (n.needs.hunger > 0.7) risk *= 2;
    risk *= 1 - medicineLevel(world, n) * 0.6;
    if (chance(rng, risk)) {
      killNpc(world, n, d.name.toLowerCase());
      continue;
    }
    ill.daysLeft -= 1;
    n.health = Math.max(0.05, n.health - d.severity * 0.04);
    if (ill.daysLeft <= 0) {
      n.illness = null;
      n.immunity[ill.disease] = day + d.immunityDays;
      remember(world, n, `I recovered from ${d.name.toLowerCase()}.`, { importance: d.severity * 0.6, feeling: 0.3 });
    }
  }
}

function susceptibility(world: World, n: Npc, winter: boolean): number {
  let f = 1;
  const age = ageYears(n);
  if (age < 4) f *= 1.8;
  if (age > 60) f *= 1.6;
  if (n.needs.hunger > 0.6) f *= 1.7;
  if (winter) f *= (world.settlement(n.settlementId)?.stock.cloth ?? 0) > 1 ? 1.15 : 1.5;
  if (n.homeId < 0) f *= 1.3;
  return f;
}

export function infect(world: World, n: Npc, disease: string, from: Npc | null): void {
  const day = Math.floor(world.state.time / 1440);
  if (n.illness || (n.immunity[disease] ?? -1) > day) return;
  const d = DISEASES[disease];
  n.illness = { disease, daysLeft: randInt(world.state.rng, d.days[0], d.days[1]), severity: d.severity * (0.6 + nextFloat(world.state.rng) * 0.6) };
  remember(world, n, from ? `I caught ${d.name.toLowerCase()}, probably from ${from.firstName}.` : `I fell ill with ${d.name.toLowerCase()}.`, {
    share: `${n.firstName} is sick with ${d.name.toLowerCase()}.`,
    importance: 0.3 + d.severity * 0.5,
    feeling: -0.3 - d.severity * 0.5,
    about: from?.id ?? -1,
  });

  // Log outbreaks once per disease per settlement per season.
  const s = world.settlement(n.settlementId);
  if (!s) return;
  const sickHere = world.residentsOf(s.id).filter((p) => p.illness?.disease === disease).length;
  const key = `${s.id}:${disease}`;
  const last = outbreakLogged.get(key) ?? -999;
  const serious = d.lethality >= 0.005;
  if (serious && sickHere >= Math.max(3, world.residentsOf(s.id).length * 0.15) && day - last > 60) {
    outbreakLogged.set(key, day);
    world.log(`An outbreak of ${d.name.toLowerCase()} is spreading in ${s.name} (${sickHere} sick).`, 'disease', n.id);
  } else if (sickHere === 1 && (d.lethality >= 0.02) && day - last > 30) {
    outbreakLogged.set(key, day);
    world.log(`${fullName(n)} of ${s.name} has fallen ill with ${d.name.toLowerCase()}.`, 'disease', n.id);
  }
}

/** 0..1: how well the sick person is being treated. */
function medicineLevel(world: World, n: Npc): number {
  const s = world.settlement(n.settlementId);
  if (!s) return 0;
  let level = 0;
  for (const h of world.residentsOf(s.id)) if (h.job === 'healer') level = Math.max(level, h.skills.medicine);
  if (s.tech.includes('medicine')) level = Math.min(1, level + 0.3);
  if (s.tech.includes('germ_theory')) level = Math.min(1, level + 0.4);
  return level;
}
