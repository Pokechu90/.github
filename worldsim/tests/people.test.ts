import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { MINUTES_PER_DAY, MINUTES_PER_YEAR } from '../src/shared/time';

function newWorld(seed: number): World {
  const world = new World(seed);
  const spawn = world.terrain.findSpawn();
  world.populate(spawn.x, spawn.y);
  return world;
}

describe('people', () => {
  it('starts with 10 settlers in families with homes and jobs', () => {
    const world = newWorld(42);
    const npcs = world.state.npcs;
    expect(npcs.length).toBe(10);
    expect(npcs.filter((n) => n.partnerId >= 0).length).toBe(6);
    expect(npcs.every((n) => n.homeId >= 0)).toBe(true);
    expect(npcs.some((n) => n.job === 'child')).toBe(true);
    expect(world.state.settlements.length).toBe(1);
  });

  it('people eat, sleep and work through a day', () => {
    const world = newWorld(42);
    world.advance(MINUTES_PER_DAY * 2);
    const npcs = world.state.npcs;
    expect(npcs.length).toBeGreaterThanOrEqual(9);
    expect(npcs.every((n) => n.needs.hunger < 0.95)).toBe(true);
    expect(npcs.some((n) => n.memory.recent.length > 1)).toBe(true);
  });

  it('a settlement lives for 15 years: births, deaths, disease, growth', { timeout: 120_000 }, () => {
    const world = newWorld(42);
    for (let y = 0; y < 15; y++) {
      world.advance(MINUTES_PER_YEAR);
      const s = world.state.settlements[0];
      const stock = Object.entries(s.stock).filter(([, v]) => v > 0.5).map(([k, v]) => `${k}:${Math.round(v)}`).join(' ');
      console.log(`year ${y + 1}: pop ${world.state.npcs.length}, births ${world.state.stats.humanBirths}, deaths ${JSON.stringify(world.state.stats.humanDeaths)}, buildings ${world.state.buildings.length}, deer ${world.state.animals.length}, ${stock}`);
    }
    const ev = world.state.events.map((e) => e.text);
    console.log(ev.slice(-25).join('\n'));
    expect(world.state.stats.humanBirths).toBeGreaterThan(0);
  });
});
