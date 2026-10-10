/**
 * The galaxy: stars and planets generated from the world seed, on demand,
 * forever. Space is divided into sectors (8 light-years square); each sector's
 * stars and each star's planets come from a hash of their coordinates, so the
 * same seed always gives the same sky, and only what's been discovered needs
 * to be remembered.
 *
 * Planets get physically-motivated properties: orbit, mass, gravity,
 * atmosphere, temperature (from the star's brightness, distance and
 * greenhouse effect) and water, which together decide habitability.
 */
import { hashInts, makeRng, nextFloat, randRange, type Rng } from './rng';

export const SECTOR_LY = 8;

export type StarType = 'M' | 'K' | 'G' | 'F' | 'A';

export interface Star {
  id: string;
  name: string;
  x: number; // light-years from home
  y: number;
  type: StarType;
  luminosity: number; // Sun = 1
  color: string;
  planetCount: number;
  home: boolean;
}

export type Atmosphere = 'none' | 'thin' | 'breathable' | 'toxic' | 'thick';

export interface Planet {
  id: string;
  starId: string;
  index: number;
  name: string;
  orbitAU: number;
  kind: 'rocky' | 'gas giant' | 'ice giant';
  massEarths: number;
  radiusEarths: number;
  gravity: number; // in g
  atmosphere: Atmosphere;
  tempC: number;
  water: number; // 0..1 of the surface
  habitability: number; // 0..1
  seed: number;
  home: boolean;
}

const STAR_TYPES: { type: StarType; p: number; lum: [number, number]; color: string }[] = [
  { type: 'M', p: 0.62, lum: [0.01, 0.08], color: '#ff9a6b' },
  { type: 'K', p: 0.2, lum: [0.15, 0.6], color: '#ffc38a' },
  { type: 'G', p: 0.1, lum: [0.6, 1.5], color: '#fff3c4' },
  { type: 'F', p: 0.06, lum: [1.5, 5], color: '#f4f6ff' },
  { type: 'A', p: 0.02, lum: [5, 25], color: '#c9d8ff' },
];

const SYLLABLES = ['ar', 'be', 'cor', 'del', 'en', 'fa', 'gal', 'hel', 'is', 'jun', 'ka', 'lor', 'mi', 'nor', 'os', 'pra', 'qua', 'ri', 'sol', 'tau', 'ul', 've', 'xan', 'yr', 'zen', 'ae', 'th', 'on', 'us', 'ia'];
const HOME_PLANET_NAMES = ['Ember', 'Veil', 'Home', 'Rust', 'Titan', 'Halo', 'Glacier', 'Abyss', 'Shard', 'Far'];

function name(r: Rng, parts: number): string {
  let s = '';
  for (let i = 0; i < parts; i++) s += SYLLABLES[Math.floor(nextFloat(r) * SYLLABLES.length)];
  return s[0].toUpperCase() + s.slice(1);
}

/** All stars in one sector. */
export function sectorStars(seed: number, sx: number, sy: number): Star[] {
  const r = makeRng(hashInts(seed, sx, sy, 4111));
  if (sx === 0 && sy === 0) {
    return [{ id: '0,0,0', name: name(makeRng(hashInts(seed, 5)), 2), x: 0, y: 0, type: 'G', luminosity: 1, color: '#fff3c4', planetCount: 8, home: true }];
  }
  const count = nextFloat(r) < 0.45 ? 0 : nextFloat(r) < 0.75 ? 1 : 2;
  const stars: Star[] = [];
  for (let k = 0; k < count; k++) {
    let roll = nextFloat(r);
    const t = STAR_TYPES.find((s) => (roll -= s.p) < 0) ?? STAR_TYPES[0];
    stars.push({
      id: `${sx},${sy},${k}`,
      name: name(r, 2 + (nextFloat(r) < 0.3 ? 1 : 0)),
      x: (sx + nextFloat(r)) * SECTOR_LY - SECTOR_LY / 2,
      y: (sy + nextFloat(r)) * SECTOR_LY - SECTOR_LY / 2,
      type: t.type,
      luminosity: randRange(r, t.lum[0], t.lum[1]),
      color: t.color,
      planetCount: Math.floor(randRange(r, 0, 9)),
      home: false,
    });
  }
  return stars;
}

export function starById(seed: number, id: string): Star | undefined {
  const [sx, sy] = id.split(',').map(Number);
  return sectorStars(seed, sx, sy).find((s) => s.id === id);
}

/** Stars within a radius (light-years) of a point. */
export function starsNear(seed: number, x: number, y: number, radius: number): Star[] {
  const out: Star[] = [];
  const s0x = Math.floor((x - radius) / SECTOR_LY + 0.5) - 1;
  const s1x = Math.floor((x + radius) / SECTOR_LY + 0.5) + 1;
  const s0y = Math.floor((y - radius) / SECTOR_LY + 0.5) - 1;
  const s1y = Math.floor((y + radius) / SECTOR_LY + 0.5) + 1;
  for (let sy = s0y; sy <= s1y; sy++) {
    for (let sx = s0x; sx <= s1x; sx++) {
      for (const st of sectorStars(seed, sx, sy)) if (Math.hypot(st.x - x, st.y - y) <= radius) out.push(st);
    }
  }
  return out;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function planetsOf(seed: number, star: Star): Planet[] {
  const r = makeRng(hashInts(seed, ...star.id.split(',').map(Number), 9001));
  const planets: Planet[] = [];
  const frostLine = 2.7 * Math.sqrt(star.luminosity);
  let orbit = randRange(r, 0.25, 0.45) * Math.sqrt(star.luminosity);
  for (let i = 0; i < star.planetCount; i++) {
    const pseed = hashInts(seed, i, ...star.id.split(',').map(Number), 77);
    const home = star.home && i === 2;
    let p: Planet;
    if (home) {
      p = {
        id: `${star.id}/${i}`, starId: star.id, index: i, name: 'Our world', orbitAU: 1, kind: 'rocky',
        massEarths: 1, radiusEarths: 1, gravity: 1, atmosphere: 'breathable', tempC: 14, water: 0.6, habitability: 0.95,
        seed, home: true,
      };
      orbit = 1;
    } else {
      const outer = orbit > frostLine;
      const giant = outer ? nextFloat(r) < 0.65 : nextFloat(r) < 0.06;
      const kind: Planet['kind'] = giant ? (orbit > frostLine * 3 ? 'ice giant' : 'gas giant') : 'rocky';
      const massEarths = giant ? randRange(r, 10, 320) : Math.pow(10, randRange(r, -1.3, 0.8));
      const radiusEarths = giant ? Math.pow(massEarths, 0.5) * 0.7 : Math.pow(massEarths, 0.27);
      const gravity = massEarths / (radiusEarths * radiusEarths);
      // Atmosphere: small worlds lose theirs; Earth-sized ones in the warm zone may host life.
      const baseTemp = 278 * Math.pow(star.luminosity, 0.25) / Math.sqrt(orbit) - 273;
      let atmosphere: Atmosphere = 'none';
      if (giant) atmosphere = 'thick';
      else if (massEarths < 0.15) atmosphere = nextFloat(r) < 0.3 ? 'thin' : 'none';
      else if (massEarths > 3) atmosphere = nextFloat(r) < 0.7 ? 'thick' : 'toxic';
      else {
        const goldilocks = baseTemp > -50 && baseTemp < 45;
        const roll = nextFloat(r);
        atmosphere = goldilocks && roll < 0.38 ? 'breathable' : roll < 0.6 ? 'thin' : roll < 0.85 ? 'toxic' : 'thick';
      }
      const greenhouse = { none: 0, thin: 3, breathable: 18, toxic: 35, thick: giant ? 0 : 250 }[atmosphere];
      const tempC = baseTemp + greenhouse;
      const water = giant || atmosphere === 'none' ? 0 : tempC > -20 && tempC < 90 ? randRange(r, 0.1, 0.95) : tempC <= -20 ? randRange(r, 0, 0.5) : 0;
      p = {
        id: `${star.id}/${i}`, starId: star.id, index: i,
        name: star.home ? HOME_PLANET_NAMES[i % HOME_PLANET_NAMES.length] : `${star.name} ${ROMAN[i] ?? i + 1}`,
        orbitAU: +orbit.toFixed(2), kind, massEarths: +massEarths.toFixed(2), radiusEarths: +radiusEarths.toFixed(2),
        gravity: +gravity.toFixed(2), atmosphere, tempC: Math.round(tempC), water: +water.toFixed(2), habitability: 0, seed: pseed, home: false,
      };
      p.habitability = habitability(p);
    }
    planets.push(p);
    orbit *= randRange(r, 1.5, 2.1);
  }
  return planets;
}

export function habitability(p: Planet): number {
  if (p.kind !== 'rocky') return 0;
  const temp = Math.exp(-Math.pow((p.tempC - 15) / 30, 2));
  const grav = p.gravity < 0.3 || p.gravity > 2.5 ? 0.1 : p.gravity < 0.6 || p.gravity > 1.6 ? 0.6 : 1;
  const air = { breathable: 1, thin: 0.35, toxic: 0.15, none: 0.08, thick: 0.03 }[p.atmosphere];
  const water = 0.3 + 0.7 * Math.min(1, p.water / 0.5);
  return +(temp * grav * air * water).toFixed(2);
}

export function planetById(seed: number, id: string): Planet | undefined {
  const [starId, idx] = id.split('/');
  const star = starById(seed, starId);
  return star ? planetsOf(seed, star)[Number(idx)] : undefined;
}

export function describeHabitability(h: number): string {
  if (h >= 0.7) return 'Earth-like';
  if (h >= 0.4) return 'Habitable';
  if (h >= 0.2) return 'Marginal (needs shelters)';
  if (h > 0.05) return 'Hostile (domes only)';
  return 'Uninhabitable';
}
