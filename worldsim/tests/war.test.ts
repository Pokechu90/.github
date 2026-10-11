import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { foundSettlement } from '../src/sim/society/settlement';
import { casusBelli, declareWar, endWar, ongoingWars, realmName, realmRoot, scheme } from '../src/sim/society/war';
import { deserialize, serialize } from '../src/sim/save';
import { isAdult } from '../src/sim/npc/people';
import type { Settlement } from '../src/sim/state';

/** A world with two towns: the original camp, and a second one 60 tiles away with half the people. */
function twoTowns(seed: number): { world: World; a: Settlement; b: Settlement } {
  const world = new World(seed);
  const spawn = world.terrain.findSpawn();
  world.populate(spawn.x, spawn.y);
  const a = world.state.settlements[0];
  let b: Settlement | null = null;
  for (const [dx, dy] of [[60, 0], [-60, 0], [0, 60], [0, -60], [45, 45], [-45, -45]]) {
    if (world.isWalkable(a.x + dx, a.y + dy)) {
      b = foundSettlement(world, a.x + dx, a.y + dy, a.id);
      break;
    }
  }
  if (!b) throw new Error('no room for a second town');
  const movers = world.state.npcs.filter((n) => isAdult(n)).slice(0, 4);
  for (const n of movers) {
    n.settlementId = b.id;
    n.homeId = -1;
    n.x = b.x;
    n.y = b.y;
  }
  b.stock.grain = 30;
  world.rebuildIndexes();
  return { world, a, b };
}

describe('war', () => {
  it('the player can incite a war, which is fought in battles and ends', { timeout: 120_000 }, () => {
    const { world, a, b } = twoTowns(11);
    world.state.player.influence = 100;
    const r = scheme(world, 'incite', a.id, b.id, 'territory');
    expect(r.ok).toBe(true);
    const war = ongoingWars(world)[0];
    expect(war.instigated).toBe(true);
    expect(war.cause).toBe('territory');
    expect(a.diplomacy[b.id]).toBe(-1);
    expect(scheme(world, 'incite', a.id, b.id, 'auto').ok).toBe(false); // already at war

    for (let d = 0; d < 6 * 120 && war.endDay < 0; d++) world.advance(1440);
    console.log(war.name, '|', war.battles, 'battles', war.deathsA + war.deathsB, 'dead |', war.outcome);
    expect(war.battles).toBeGreaterThan(3);
    expect(war.endDay).toBeGreaterThan(0);
    expect(war.outcome.length).toBeGreaterThan(5);
    expect(world.state.chronicle.some((e) => e.text.includes(war.name))).toBe(true);
  });

  it('rumours, weapons and peace', () => {
    const { world, a, b } = twoTowns(12);
    world.state.player.influence = 100;
    const before = a.diplomacy[b.id] ?? 0;
    expect(scheme(world, 'rumours', a.id, b.id, '').ok).toBe(true);
    expect(a.diplomacy[b.id]).toBeLessThan(before);
    expect(scheme(world, 'arm', a.id, -1, '').ok).toBe(true);
    expect(a.armedUntil).toBeGreaterThan(0);
    expect(scheme(world, 'peace', a.id, -1, '').ok).toBe(false); // not at war
    scheme(world, 'incite', a.id, b.id, 'auto');
    expect(scheme(world, 'peace', b.id, -1, '').ok).toBe(true);
    expect(ongoingWars(world).length).toBe(0);
  });

  it('wars have causes, and conquest annexes the loser into a realm that survives saving', () => {
    const { world, a, b } = twoTowns(13);
    // A starving town next to a rich one wants its food.
    for (const k of ['grain', 'fruit', 'meat', 'fish'] as const) {
      a.stock[k] = 0;
      b.stock[k] = 0;
    }
    b.stock.grain = 400;
    expect(casusBelli(world, a, b)?.cause).toBe('resources');

    const w = declareWar(world, a, b, 'conquest', b.name, false);
    endWar(world, w, a, '', true);
    expect(b.overlordId).toBe(a.id);
    expect(realmRoot(world, b)).toBe(a);
    expect(realmName(world, a)).toMatch(new RegExp(a.name));

    // The player can push a vassal to rise against its ruler.
    world.state.player.influence = 100;
    expect(scheme(world, 'incite', b.id, a.id, 'resources').ok).toBe(true);
    expect(ongoingWars(world)[0].cause).toBe('independence');

    const copy = deserialize(serialize(world));
    const cb = copy.settlement(b.id)!;
    expect(cb.overlordId).toBe(a.id);
    expect(copy.state.wars.length).toBe(2);
    copy.advance(1440 * 3);
  });
});
