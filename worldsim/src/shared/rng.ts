/**
 * Seeded random numbers.
 *
 * Everything random in the world goes through these helpers so that the same
 * seed always produces the same world. The generator state is a single number
 * stored in a plain object, which means it can be saved and loaded with the
 * rest of the world.
 */

export interface Rng {
  s: number;
}

export function makeRng(seed: number): Rng {
  return { s: seed >>> 0 };
}

/** Mulberry32: tiny, fast, good enough for games. Returns [0, 1). */
export function nextFloat(r: Rng): number {
  let t = (r.s = (r.s + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(r: Rng, min: number, max: number): number {
  return min + nextFloat(r) * (max - min);
}

export function randInt(r: Rng, min: number, maxInclusive: number): number {
  return min + Math.floor(nextFloat(r) * (maxInclusive - min + 1));
}

export function chance(r: Rng, p: number): boolean {
  return nextFloat(r) < p;
}

export function pick<T>(r: Rng, items: readonly T[]): T {
  return items[Math.floor(nextFloat(r) * items.length)];
}

/** Mixes several integers into one well-scrambled 32-bit seed. */
export function hashInts(...values: number[]): number {
  let h = 0x811c9dc5;
  for (const v of values) {
    h ^= v | 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

/** Turns any text (like "my world") into a numeric seed. */
export function seedFromString(text: string): number {
  const asNumber = Number(text);
  if (text.trim() !== '' && Number.isFinite(asNumber)) return asNumber >>> 0;
  let h = 0;
  for (let i = 0; i < text.length; i++) h = hashInts(h, text.charCodeAt(i));
  return h;
}
