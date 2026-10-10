/** The readable town profile shown when a settlement is selected. */
import { BUILDINGS, RESOURCES } from '../../shared/people';
import { formatDate } from '../../shared/time';
import type { SelectedInfo } from '../../shared/protocol';
import type { ResourceType } from '../state';
import type { World } from '../world';
import { fullName } from '../npc/people';
import { currentFocus, eraOf, ERAS, TECH_BY_ID } from './tech';
import { population } from './work';
import { price } from './economy';

export function describeSettlement(world: World, id: number): SelectedInfo {
  const s = world.settlement(id);
  if (!s || s.abandoned) return { kind: 'gone', text: 'This settlement no longer exists.' };
  const leader = world.npcById(s.leaderId);
  const focus = currentFocus(world, s);
  const counts = new Map<string, number>();
  for (const b of world.buildingsOf(s.id)) counts.set(b.kind, (counts.get(b.kind) ?? 0) + 1);
  const parent = world.settlement(s.parentId);
  return {
    kind: 'settlement',
    id: s.id,
    x: s.x,
    y: s.y,
    title: s.name,
    subtitle: `${s.tier[0].toUpperCase()}${s.tier.slice(1)} of ${population(world, s)} · ${ERAS[eraOf(s)]} · founded ${formatDate(s.foundedDay * 1440)}${parent ? ` by people from ${parent.name}` : ''}`,
    leader: leader ? { name: fullName(leader), id: leader.id } : null,
    laws: s.laws,
    culture: `${s.culture.name}${s.culture.traits.length ? `: ${s.culture.traits.join(', ')}` : ''}`,
    tech: s.tech.map((t) => TECH_BY_ID.get(t)?.name ?? t),
    researching: focus ? { name: focus.name, progress: Math.min(1, (s.research[focus.id] ?? 0) / focus.cost), description: focus.description } : null,
    stock: (Object.keys(RESOURCES) as ResourceType[])
      .filter((k) => s.stock[k] >= 1)
      .map((k) => ({ name: RESOURCES[k].name, amount: Math.floor(s.stock[k]), price: s.tech.includes('currency') ? price(s, k) : null })),
    treasury: s.tech.includes('currency') ? Math.floor(s.treasury) : null,
    buildings: [...counts.entries()].map(([k, n]) => `${n} ${BUILDINGS[k].name.toLowerCase()}${n > 1 ? 's' : ''}`),
    neighbours: Object.entries(s.diplomacy)
      .map(([oid, v]) => ({ s: world.settlement(Number(oid)), v }))
      .filter((x) => x.s && !x.s.abandoned)
      .sort((a, b) => b.v - a.v)
      .map(({ s: o, v }) => ({ name: o!.name, id: o!.id, relation: v > 0.4 ? 'allies' : v > 0.1 ? 'friendly' : v > -0.2 ? 'neutral' : v > -0.5 ? 'tense' : 'hostile' })),
  };
}
