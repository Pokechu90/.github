/**
 * Colours for the 2D map. Vegetation changes with the seasons; cold places get
 * snow, and lakes freeze, when the seasonal temperature drops low enough.
 */
import { Biome, CHUNK_SIZE } from '../shared/terrain';

type RGB = [number, number, number];

const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

// [spring, summer, autumn, winter]
const SEASONAL: Partial<Record<Biome, RGB[]>> = {
  [Biome.Grass]: [hex(0x72b84c), hex(0x63a83f), hex(0xa4a050), hex(0x8f8d62)],
  [Biome.Forest]: [hex(0x3f8a38), hex(0x367b31), hex(0x6e7633), hex(0x5c6446)],
  [Biome.Savanna]: [hex(0xb7b45e), hex(0xc4ab52), hex(0xb59f55), hex(0xab9d68)],
  [Biome.Taiga]: [hex(0x3f6c48), hex(0x3a6642), hex(0x4a6844), hex(0x4f6751)],
  [Biome.Tundra]: [hex(0x9aa68b), hex(0xa1ad8a), hex(0xa29b80), hex(0xb3b7ab)],
  [Biome.Swamp]: [hex(0x4f7340), hex(0x4a6c3a), hex(0x66683a), hex(0x5a5f45)],
};

const FIXED: Record<number, RGB> = {
  [Biome.DeepWater]: hex(0x1d4a86),
  [Biome.Water]: hex(0x3473bd),
  [Biome.River]: hex(0x4689d0),
  [Biome.Beach]: hex(0xe3d39c),
  [Biome.Desert]: hex(0xddc285),
  [Biome.Mountain]: hex(0x8a8276),
  [Biome.Snow]: hex(0xeef2f7),
};

const SNOW: RGB = hex(0xedf1f6);
const ICE: RGB = hex(0xc9dfee);

export function biomeColor(biome: number, season: number): RGB {
  return SEASONAL[biome as Biome]?.[season] ?? FIXED[biome] ?? [255, 0, 255];
}

/** Pixels per tile in the terrain textures. */
export const TERRAIN_RES = 4;

/**
 * Paints one chunk of terrain into a canvas, with hill shading and a little
 * per-pixel texture so it doesn't look flat.
 */
export function paintChunk(
  biomes: Uint8Array,
  heights: Uint8Array,
  temps: Int8Array,
  cx: number,
  cy: number,
  season: number,
  seasonTemp: number,
): HTMLCanvasElement {
  const size = CHUNK_SIZE * TERRAIN_RES;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(size, size);
  const data = img.data;

  for (let ty = 0; ty < CHUNK_SIZE; ty++) {
    for (let tx = 0; tx < CHUNK_SIZE; tx++) {
      const i = ty * CHUNK_SIZE + tx;
      const b = biomes[i];
      const t = temps[i] + seasonTemp;
      const isWater = b === Biome.Water || b === Biome.River || b === Biome.DeepWater;
      let base: RGB = biomeColor(b, season);
      if (isWater && b !== Biome.DeepWater && t < -6) base = ICE;
      else if (!isWater && t < -1) base = mix(base, SNOW, Math.min(1, (-1 - t) / 3));

      // Hill shading: light comes from the north-west.
      // At the chunk's top/left edge, use the slope towards the south-east
      // instead, so neighbouring chunks blend without visible seams.
      let slope = 0;
      if (tx > 0 && ty > 0) slope = heights[i] - heights[i - CHUNK_SIZE - 1];
      else if (tx < CHUNK_SIZE - 1 && ty < CHUNK_SIZE - 1) slope = heights[i + CHUNK_SIZE + 1] - heights[i];
      let shade = 1 + slope * (isWater ? 0.01 : 0.035);
      if (isWater) shade *= 0.85 + (heights[i] / 128) * 0.15; // deeper = darker
      shade = Math.max(0.6, Math.min(1.35, shade));

      for (let py = 0; py < TERRAIN_RES; py++) {
        for (let px = 0; px < TERRAIN_RES; px++) {
          const gx = (cx * CHUNK_SIZE + tx) * TERRAIN_RES + px;
          const gy = (cy * CHUNK_SIZE + ty) * TERRAIN_RES + py;
          const grain = 1 + (hash(gx, gy) - 0.5) * (isWater ? 0.04 : 0.1);
          const o = ((ty * TERRAIN_RES + py) * size + tx * TERRAIN_RES + px) * 4;
          data[o] = clamp(base[0] * shade * grain);
          data[o + 1] = clamp(base[1] * shade * grain);
          data[o + 2] = clamp(base[2] * shade * grain);
          data[o + 3] = 255;
        }
      }
    }
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
