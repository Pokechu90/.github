import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { MINUTES_PER_DAY, MINUTES_PER_YEAR, getCalendar } from '../src/shared/time';
import { CHUNK_SIZE } from '../src/shared/terrain';

function worldAroundSpawn(seed: number, radius = 3): World {
  const world = new World(seed);
  const spawn = world.terrain.findSpawn();
  const cx = Math.floor(spawn.x / CHUNK_SIZE);
  const cy = Math.floor(spawn.y / CHUNK_SIZE);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) world.ensureChunk(cx + dx, cy + dy);
  }
  return world;
}

describe('ecology', () => {
  it('starts with plants and deer', () => {
    const world = worldAroundSpawn(42);
    const census = world.census();
    expect(Object.values(census.plants).reduce((a, b) => a + b, 0)).toBeGreaterThan(100);
    expect(world.state.animals.length).toBeGreaterThan(0);
  });

  it('time and seasons advance', () => {
    const world = worldAroundSpawn(42, 1);
    world.advance(MINUTES_PER_DAY * 31);
    expect(getCalendar(world.state.time).seasonName).toBe('Summer');
  });

  it('runs for 8 years without blowing up: deer live, breed and die', { timeout: 60_000 }, () => {
    const world = worldAroundSpawn(42);
    const startDeer = world.state.animals.length;
    for (let year = 0; year < 8; year++) world.advance(MINUTES_PER_YEAR);
    const s = world.state.stats;
    const deaths = Object.values(s.deaths).reduce((a, b) => a + b, 0);
    console.log('start deer', startDeer, 'end deer', world.state.animals.length, 'births', s.births, 'deaths', s.deaths);
    console.log('history (every 60 days):', s.history.filter((_, i) => i % 60 === 0).join(' '));
    console.log('plants', world.census().plants);
    expect(s.births).toBeGreaterThan(0);
    expect(deaths).toBeGreaterThan(0);
    expect(world.state.animals.length).toBeLessThan(4000);
    for (const a of world.state.animals) {
      expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true);
      expect(world.isWalkable(a.x, a.y)).toBe(true);
    }
  });
});
