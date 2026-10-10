import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { MINUTES_PER_YEAR } from '../src/shared/time';
import { deserialize, serialize } from '../src/sim/save';

function newWorld(seed: number): World {
  const world = new World(seed);
  const spawn = world.terrain.findSpawn();
  world.populate(spawn.x, spawn.y);
  return world;
}

describe('civilisation', () => {
  it('grows: technology, farms, leaders and more people over 20 years', { timeout: 300_000 }, () => {
    const world = newWorld(42);
    for (let y = 0; y < 20; y++) world.advance(MINUTES_PER_YEAR);
    const s = world.state.settlements[0];
    console.log('pop', world.state.npcs.length, 'settlements', world.state.settlements.map((x) => `${x.name}:${x.tier}`).join(','), 'tech', s.tech.join(','));
    expect(world.state.npcs.length).toBeGreaterThan(15);
    expect(s.tech).toContain('agriculture');
    expect(world.state.buildings.some((b) => b.kind === 'farm')).toBe(true);
    expect(s.leaderId).toBeGreaterThan(0);
  });

  it('saves and loads a world exactly', { timeout: 120_000 }, () => {
    const world = newWorld(7);
    world.advance(MINUTES_PER_YEAR * 2);
    const json = serialize(world);
    const copy = deserialize(json);
    expect(copy.state.npcs.length).toBe(world.state.npcs.length);
    expect(copy.state.time).toBe(world.state.time);
    expect(copy.state.chunks.size).toBe(world.state.chunks.size);
    const plants = (w: World) => [...w.state.chunks.values()].reduce((a, c) => a + c.plants.length, 0);
    expect(plants(copy)).toBe(plants(world));
    // The loaded world keeps running.
    copy.advance(MINUTES_PER_YEAR / 4);
    expect(copy.state.npcs.length).toBeGreaterThan(0);
    console.log('save size', (json.length / 1024).toFixed(0), 'KB');
  });
});
