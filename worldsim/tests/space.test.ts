import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { MINUTES_PER_YEAR } from '../src/shared/time';
import { TECHS } from '../src/sim/society/tech';
import { placeBuilding } from '../src/sim/society/settlement';
import { planetsOf, starById, starsNear, habitability } from '../src/shared/galaxy';
import { createNpc } from '../src/sim/npc/people';

describe('galaxy', () => {
  it('is deterministic and has a habitable home world', () => {
    const home = starById(42, '0,0,0')!;
    const a = planetsOf(42, home);
    const b = planetsOf(42, home);
    expect(a).toEqual(b);
    expect(a.find((p) => p.home)!.habitability).toBeGreaterThan(0.8);
    const near = starsNear(42, 0, 0, 30);
    expect(near.length).toBeGreaterThan(5);
    const all = near.flatMap((s) => planetsOf(42, s));
    console.log('stars within 30 ly:', near.length, 'planets:', all.length, 'habitable(>0.3):', all.filter((p) => habitability(p) > 0.3).length);
  });
});

describe('space programme', () => {
  it('launches probes, crewed missions and colony ships, and colonies grow', { timeout: 300_000 }, () => {
    const world = new World(42);
    const spawn = world.terrain.findSpawn();
    world.populate(spawn.x, spawn.y);
    const s = world.state.settlements[0];
    s.tech = TECHS.map((t) => t.id);
    s.stock.metal = 5000;
    s.stock.goods = 5000;
    s.stock.grain = 50000;
    placeBuilding(world, s, 'launchpad', s.x + 8, s.y + 8, 1);
    // A bigger population so colony ships can find volunteers.
    for (let i = 0; i < 80; i++) world.state.npcs.push(createNpc(world, { x: s.x, y: s.y, ageYears: 20 + (i % 20), settlementId: s.id }));
    world.rebuildIndexes();
    world.fastForward = true;
    world.focus = { x: s.x, y: s.y };
    for (let y = 0; y < 14; y++) {
      s.stock.metal = Math.max(s.stock.metal, 2000);
      s.stock.goods = Math.max(s.stock.goods, 2000);
      s.stock.grain = Math.max(s.stock.grain, 20000);
      world.advance(MINUTES_PER_YEAR);
    }
    const sp = world.state.space;
    console.log('launches', sp.launches, 'known stars', sp.knownStars.length, 'explored', sp.explored.length, 'colonies', sp.colonies.map((c) => `${c.name}@${c.planetId}:${Math.round(c.population)}`).join(', '));
    console.log(world.state.chronicle.filter((e) => e.kind === 'space').slice(-12).map((e) => e.text).join('\n'));
    expect(sp.launches).toBeGreaterThan(3);
    expect(sp.explored.length).toBeGreaterThan(3);
    expect(sp.colonies.length).toBeGreaterThan(0);
  });
});
