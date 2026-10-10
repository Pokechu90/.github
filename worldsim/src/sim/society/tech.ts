/**
 * Technology. Each settlement builds up knowledge in two ways:
 *  - "learning by doing": working a skill slowly suggests related ideas
 *    (gathering wild wheat leads towards agriculture, quarrying towards masonry);
 *  - scholars, once there is writing, study on purpose.
 * Research is steered by need: a hungry village thinks about food first.
 * Knowledge spreads to other settlements through trade and migration.
 *
 * The tree runs from the stone age to rocketry, which opens up space.
 */
import type { Npc, Settlement, SkillKey } from '../state';
import type { World } from '../world';
import { totalFood } from './settlement';
import { remember } from '../npc/memory';

export interface Tech {
  id: string;
  name: string;
  era: number;
  requires: string[];
  /** Research points needed. */
  cost: number;
  /** Skills whose daily practice produces ideas for this tech. */
  inspiredBy: SkillKey[];
  description: string;
}

export const TECHS: Tech[] = [
  { id: 'fire', name: 'Fire', era: 0, requires: [], cost: 0, inspiredBy: [], description: 'Warmth, cooking and light.' },
  { id: 'toolmaking', name: 'Stone tools', era: 0, requires: ['fire'], cost: 60, inspiredBy: ['woodcutting', 'hunting', 'building'], description: 'Crafters make tools that make all work faster.' },
  { id: 'agriculture', name: 'Agriculture', era: 1, requires: ['toolmaking'], cost: 220, inspiredBy: ['foraging', 'farming'], description: 'Sow wild wheat in fields: farms and granaries.' },
  { id: 'pottery', name: 'Pottery', era: 1, requires: ['agriculture'], cost: 320, inspiredBy: ['crafting', 'building'], description: 'Storage jars: food spoils far more slowly.' },
  { id: 'herding', name: 'Animal husbandry', era: 1, requires: ['agriculture'], cost: 360, inspiredBy: ['hunting', 'farming'], description: 'Farms also raise animals for meat.' },
  { id: 'weaving', name: 'Weaving', era: 1, requires: ['agriculture'], cost: 360, inspiredBy: ['crafting', 'farming'], description: 'Cloth from flax: warmer winters, less sickness.' },
  { id: 'masonry', name: 'Masonry', era: 1, requires: ['toolmaking'], cost: 420, inspiredBy: ['building'], description: 'Stone houses, wells and temples.' },
  { id: 'writing', name: 'Writing', era: 2, requires: ['pottery', 'masonry'], cost: 1300, inspiredBy: ['research', 'social'], description: 'Records, schools and scholars. Laws can be written down.' },
  { id: 'currency', name: 'Currency', era: 2, requires: ['writing'], cost: 1700, inspiredBy: ['social'], description: 'Money, markets and traders.' },
  { id: 'medicine', name: 'Herbal medicine', era: 2, requires: ['writing'], cost: 1900, inspiredBy: ['medicine'], description: 'Healers save far more lives; childbirth is safer.' },
  { id: 'metalwork', name: 'Metalwork', era: 2, requires: ['masonry', 'currency'], cost: 2700, inspiredBy: ['crafting', 'building'], description: 'Smelting ore: metal tools and smithies.' },
  { id: 'mathematics', name: 'Mathematics', era: 3, requires: ['writing', 'currency'], cost: 3200, inspiredBy: ['research'], description: 'Better engineering and science.' },
  { id: 'engineering', name: 'Engineering', era: 3, requires: ['metalwork', 'mathematics'], cost: 5200, inspiredBy: ['building', 'research'], description: 'Bigger buildings, aqueducts, mills.' },
  { id: 'printing', name: 'Printing press', era: 3, requires: ['engineering'], cost: 7200, inspiredBy: ['research', 'crafting'], description: 'Books spread knowledge: research much faster.' },
  { id: 'industry', name: 'Industry', era: 4, requires: ['printing', 'engineering'], cost: 12000, inspiredBy: ['crafting', 'building'], description: 'Factories mass-produce goods.' },
  { id: 'germ_theory', name: 'Germ theory', era: 4, requires: ['medicine', 'printing'], cost: 10000, inspiredBy: ['medicine', 'research'], description: 'Hygiene and vaccines: diseases lose their grip.' },
  { id: 'electricity', name: 'Electricity', era: 5, requires: ['industry', 'mathematics'], cost: 18000, inspiredBy: ['research', 'crafting'], description: 'Power plants, electric light.' },
  { id: 'flight', name: 'Flight', era: 5, requires: ['electricity'], cost: 24000, inspiredBy: ['research', 'building'], description: 'Aircraft connect distant cities.' },
  { id: 'computing', name: 'Computing', era: 6, requires: ['electricity', 'mathematics'], cost: 32000, inspiredBy: ['research'], description: 'Computers and laboratories.' },
  { id: 'rocketry', name: 'Rocketry', era: 6, requires: ['computing', 'flight'], cost: 45000, inspiredBy: ['research', 'building'], description: 'Rockets and launch pads: the way to space.' },
  { id: 'spaceflight', name: 'Spaceflight', era: 7, requires: ['rocketry'], cost: 70000, inspiredBy: ['research'], description: 'Crewed ships explore other worlds.' },
  { id: 'colonization', name: 'Space colonization', era: 7, requires: ['spaceflight'], cost: 100000, inspiredBy: ['research', 'building'], description: 'Settle habitable planets.' },
];

export const TECH_BY_ID = new Map(TECHS.map((t) => [t.id, t]));

export const ERAS = ['Stone Age', 'Neolithic', 'Ancient', 'Classical', 'Industrial', 'Electric', 'Information', 'Space'];

export function hasTech(s: Settlement | undefined, id: string): boolean {
  return !!s && s.tech.includes(id);
}

export function eraOf(s: Settlement): number {
  return s.tech.reduce((m, id) => Math.max(m, TECH_BY_ID.get(id)?.era ?? 0), 0);
}

export function available(s: Settlement): Tech[] {
  return TECHS.filter((t) => !s.tech.includes(t.id) && t.requires.every((r) => s.tech.includes(r)));
}

/** Which tech the settlement is thinking hardest about right now. */
export function currentFocus(world: World, s: Settlement): Tech | null {
  const options = available(s);
  if (!options.length) return null;
  const pop = world.residentsOf(s.id).length + s.abstractPop;
  const hungry = totalFood(s) / Math.max(1, pop) < 6;
  const sick = world.residentsOf(s.id).filter((n) => n.illness).length > pop * 0.1;
  const score = (t: Tech) => {
    let v = -t.cost / 100 + (s.research[t.id] ?? 0) / t.cost * 2;
    if (hungry && ['agriculture', 'pottery', 'herding'].includes(t.id)) v += 3;
    if (sick && ['medicine', 'germ_theory', 'weaving'].includes(t.id)) v += 2;
    return v;
  };
  return options.sort((a, b) => score(b) - score(a))[0];
}

/** Called when someone works at a skill: practice gives ideas. */
export function practice(world: World, n: Npc, skill: SkillKey, hours: number): void {
  const s = world.settlement(n.settlementId);
  if (!s) return;
  for (const t of available(s)) {
    if (!t.inspiredBy.includes(skill)) continue;
    // Curious, skilled people have more ideas.
    const ideas = hours * 0.012 * (0.3 + n.traits.openness) * (0.3 + n.skills[skill]);
    s.research[t.id] = (s.research[t.id] ?? 0) + ideas;
  }
}

/** Once a day: scholars and the general population add to research; discoveries happen. */
export function updateResearchDaily(world: World, s: Settlement): void {
  const focus = currentFocus(world, s);
  if (!focus) return;
  const people = world.residentsOf(s.id);
  let points = (people.length + s.abstractPop) * 0.005; // everyday tinkering (scholars add theirs as they work)
  if (hasTech(s, 'printing')) points *= 1.8;
  if (hasTech(s, 'computing')) points *= 1.6;
  if (world.buildingsOf(s.id).some((b) => b.kind === 'school' && b.progress >= 1)) points *= 1.3;
  if (world.buildingsOf(s.id).some((b) => b.kind === 'lab' && b.progress >= 1)) points *= 1.5;
  s.research[focus.id] = (s.research[focus.id] ?? 0) + points;

  for (const t of available(s)) {
    if ((s.research[t.id] ?? 0) >= t.cost) discover(world, s, t, null);
  }
}

export function discover(world: World, s: Settlement, t: Tech, from: Settlement | null): void {
  if (s.tech.includes(t.id)) return;
  s.tech.push(t.id);
  delete s.research[t.id];
  const how = from ? ` (learned from ${from.name})` : '';
  world.log(`${s.name} discovered ${t.name}${how}! ${t.description}`, 'tech', -1);
  // The most likely inventor remembers it.
  const people = world.residentsOf(s.id);
  const inventor = people
    .filter((n) => n.job !== 'child')
    .sort((a, b) => b.skills.research + b.traits.openness - (a.skills.research + a.traits.openness))[0];
  const eventId = world.newId();
  const inventorEvent = world.newId();
  for (const n of people) {
    const me = n === inventor && !from;
    remember(world, n, me ? `I figured out ${t.name.toLowerCase()}!` : `We learned ${t.name.toLowerCase()}.`, {
      importance: me ? 0.85 : 0.4, feeling: 0.5, eventId: me ? inventorEvent : eventId,
      share: `${s.name} learned ${t.name.toLowerCase()}.`,
    });
  }
  world.hooks.onTech?.forEach((fn) => fn(world, s, t.id));
}

/** Contact between settlements can pass knowledge on. */
export function shareKnowledge(world: World, from: Settlement, to: Settlement, chance: number): void {
  const candidates = from.tech.filter((id) => !to.tech.includes(id) && TECH_BY_ID.get(id)!.requires.every((r) => to.tech.includes(r)));
  if (!candidates.length || world.rand() > chance) return;
  const id = candidates[Math.floor(world.rand() * candidates.length)];
  discover(world, to, TECH_BY_ID.get(id)!, from);
}
