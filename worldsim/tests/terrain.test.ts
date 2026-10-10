import { describe, expect, it } from 'vitest';
import { BIOMES, TerrainGenerator } from '../src/shared/terrain';

describe('terrain generation', () => {
  it('is deterministic: same seed, same world', () => {
    const a = new TerrainGenerator(42).generateChunk(3, -2);
    const b = new TerrainGenerator(42).generateChunk(3, -2);
    expect(Array.from(a.biomes)).toEqual(Array.from(b.biomes));
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights));
  });

  it('different seeds give different worlds', () => {
    const a = new TerrainGenerator(1).generateChunk(0, 0);
    const b = new TerrainGenerator(2).generateChunk(0, 0);
    expect(Array.from(a.heights)).not.toEqual(Array.from(b.heights));
  });

  it('has both land and water, and a grassy spawn point', () => {
    const g = new TerrainGenerator(7);
    let water = 0;
    let land = 0;
    for (let y = -600; y < 600; y += 15) {
      for (let x = -600; x < 600; x += 15) {
        if (BIOMES[g.sample(x, y).biome].water) water++;
        else land++;
      }
    }
    expect(water).toBeGreaterThan(0);
    expect(land).toBeGreaterThan(0);
    const spawn = g.findSpawn();
    expect(BIOMES[g.sample(spawn.x, spawn.y).biome].name).toBe('Grassland');
  });
});
