/**
 * Procedural terrain. Given a seed and a tile coordinate it always returns the
 * same biome, so the world can be generated piece by piece (in chunks) as the
 * player explores, forever, without ever storing the whole map.
 *
 * Layers of simplex noise:
 *   elevation   -> oceans, coasts, hills, mountains
 *   temperature -> deserts in the hot zones, tundra in the cold ones
 *   moisture    -> forests vs grassland vs desert
 *   river noise -> thin winding lines of water that run across the land
 */
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { hashInts, makeRng, nextFloat } from './rng';

export const CHUNK_SIZE = 32; // tiles per chunk side

export const Biome = {
  DeepWater: 0,
  Water: 1,
  River: 2,
  Beach: 3,
  Grass: 4,
  Forest: 5,
  Desert: 6,
  Savanna: 7,
  Tundra: 8,
  Mountain: 9,
  Snow: 10,
  Swamp: 11,
  Taiga: 12,
} as const;
export type Biome = (typeof Biome)[keyof typeof Biome];

export interface BiomeInfo {
  name: string;
  water: boolean;
  /** Can animals and people walk here? */
  walkable: boolean;
  /** How much grass grows here (0..1), food for grazing animals. */
  grass: number;
}

export const BIOMES: Record<Biome, BiomeInfo> = {
  [Biome.DeepWater]: { name: 'Deep ocean', water: true, walkable: false, grass: 0 },
  [Biome.Water]: { name: 'Shallow water', water: true, walkable: false, grass: 0 },
  [Biome.River]: { name: 'River', water: true, walkable: true, grass: 0 },
  [Biome.Beach]: { name: 'Beach', water: false, walkable: true, grass: 0.05 },
  [Biome.Grass]: { name: 'Grassland', water: false, walkable: true, grass: 1 },
  [Biome.Forest]: { name: 'Forest', water: false, walkable: true, grass: 0.5 },
  [Biome.Desert]: { name: 'Desert', water: false, walkable: true, grass: 0.02 },
  [Biome.Savanna]: { name: 'Savanna', water: false, walkable: true, grass: 0.7 },
  [Biome.Tundra]: { name: 'Tundra', water: false, walkable: true, grass: 0.25 },
  [Biome.Mountain]: { name: 'Mountain', water: false, walkable: true, grass: 0.1 },
  [Biome.Snow]: { name: 'Snowy peak', water: false, walkable: false, grass: 0 },
  [Biome.Swamp]: { name: 'Swamp', water: false, walkable: true, grass: 0.6 },
  [Biome.Taiga]: { name: 'Taiga', water: false, walkable: true, grass: 0.4 },
};

export interface TileSample {
  biome: Biome;
  /** Elevation, roughly -1 (deep sea) .. +1 (peaks). Sea level is 0. */
  elevation: number;
  /** Yearly average temperature in °C. */
  temperature: number;
  /** -1 (arid) .. +1 (wet). */
  moisture: number;
}

/** Raw terrain for one chunk. Index a tile with `ly * CHUNK_SIZE + lx`. */
export interface ChunkTerrain {
  cx: number;
  cy: number;
  biomes: Uint8Array;
  /** Elevation mapped to 0..255 (sea level = 128). */
  heights: Uint8Array;
  /** Average yearly temperature per tile, °C, rounded. */
  temps: Int8Array;
  avgTemp: number;
  avgMoisture: number;
}

export class TerrainGenerator {
  private elevation: NoiseFunction2D;
  private detail: NoiseFunction2D;
  private ridges: NoiseFunction2D;
  private temperature: NoiseFunction2D;
  private moisture: NoiseFunction2D;
  private river: NoiseFunction2D;
  private riverWarp: NoiseFunction2D;

  constructor(readonly seed: number) {
    // Each noise layer gets its own seeded generator so layers are independent.
    const layer = (n: number) => {
      const rng = makeRng(hashInts(seed, n));
      return createNoise2D(() => nextFloat(rng));
    };
    this.elevation = layer(1);
    this.detail = layer(2);
    this.ridges = layer(3);
    this.temperature = layer(4);
    this.moisture = layer(5);
    this.river = layer(6);
    this.riverWarp = layer(7);
  }

  sample(x: number, y: number): TileSample {
    // Continents: big, slow shapes plus smaller detail.
    const continent = fbm(this.elevation, x, y, 5, 1 / 420);
    const hills = fbm(this.detail, x, y, 3, 1 / 70);
    let e = continent * 0.9 + hills * 0.22 + 0.1;

    // Mountain ranges: sharp ridges that only rise on solid land.
    const ridge = 1 - Math.abs(this.ridges(x / 260, y / 260));
    const inland = clamp01((continent + 0.05) / 0.35);
    e += Math.pow(ridge, 5) * 0.6 * inland;

    // Temperature: a slow climate pattern, colder the higher you go.
    const temperature = fbm(this.temperature, x, y, 2, 1 / 1100) * 36 + 14 - Math.max(0, e) * 24;
    const moisture = fbm(this.moisture, x, y, 3, 1 / 320);

    return { biome: this.pickBiome(x, y, e, temperature, moisture), elevation: e, temperature, moisture };
  }

  private pickBiome(x: number, y: number, e: number, t: number, m: number): Biome {
    if (e < -0.2) return Biome.DeepWater;
    if (e < 0) return Biome.Water;

    // Rivers follow the zero-lines of a warped noise field. They are wider in
    // the lowlands and do not climb into the mountains.
    if (e < 0.55) {
      const wx = x + this.riverWarp(x / 90, y / 90) * 28;
      const wy = y + this.riverWarp(y / 90 + 50, x / 90) * 28;
      const r = Math.abs(fbm(this.river, wx, wy, 2, 1 / 380));
      const width = 0.01 + 0.012 * clamp01(1 - e * 2);
      if (r < width) return Biome.River;
    }

    if (e > 0.75) return Biome.Snow;
    if (e > 0.56) return Biome.Mountain;
    if (e < 0.02 && t > 2) return Biome.Beach;
    if (t < -12) return Biome.Snow;
    if (t < -2) return Biome.Tundra;
    if (t > 22 && m < -0.1) return Biome.Desert;
    if (t > 19 && m < 0.1) return Biome.Savanna;
    if (m > 0.42 && e < 0.12 && t > 6) return Biome.Swamp;
    if (m > 0.04) return t < 5 ? Biome.Taiga : Biome.Forest;
    return Biome.Grass;
  }

  generateChunk(cx: number, cy: number): ChunkTerrain {
    const n = CHUNK_SIZE * CHUNK_SIZE;
    const biomes = new Uint8Array(n);
    const heights = new Uint8Array(n);
    const temps = new Int8Array(n);
    let tSum = 0;
    let mSum = 0;
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const s = this.sample(cx * CHUNK_SIZE + lx, cy * CHUNK_SIZE + ly);
        const i = ly * CHUNK_SIZE + lx;
        biomes[i] = s.biome;
        heights[i] = Math.max(0, Math.min(255, Math.round(128 + s.elevation * 127)));
        temps[i] = Math.max(-127, Math.min(127, Math.round(s.temperature)));
        tSum += s.temperature;
        mSum += s.moisture;
      }
    }
    return { cx, cy, biomes, heights, temps, avgTemp: tSum / n, avgMoisture: mSum / n };
  }

  /** Searches outward from the origin for a pleasant grassy place to start. */
  findSpawn(): { x: number; y: number } {
    for (let radius = 0; radius < 4000; radius += 24) {
      const steps = Math.max(1, Math.floor((radius * 2 * Math.PI) / 24));
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const x = Math.round(Math.cos(a) * radius);
        const y = Math.round(Math.sin(a) * radius);
        if (this.isNiceSpawn(x, y)) return { x, y };
      }
    }
    return { x: 0, y: 0 };
  }

  private isNiceSpawn(x: number, y: number): boolean {
    const here = this.sample(x, y);
    // Temperate grassland: mild winters, warm summers.
    if (here.biome !== Biome.Grass || here.temperature < 10 || here.temperature > 18) return false;
    let land = 0;
    let water = 0;
    let trees = 0;
    for (let dy = -12; dy <= 12; dy += 4) {
      for (let dx = -12; dx <= 12; dx += 4) {
        const b = this.sample(x + dx, y + dy).biome;
        if (BIOMES[b].water) water++;
        else land++;
        if (b === Biome.Forest) trees++;
      }
    }
    // Mostly land, with some water and forest nearby.
    return land > 34 && water >= 1 && trees >= 2;
  }
}

export function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export function tileToChunk(t: number): number {
  return Math.floor(t / CHUNK_SIZE);
}

/** Fractal noise: several octaves of simplex added together, result in -1..1. */
function fbm(noise: NoiseFunction2D, x: number, y: number, octaves: number, freq: number): number {
  let amp = 1;
  let sum = 0;
  let norm = 0;
  let f = freq;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x * f, y * f) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
