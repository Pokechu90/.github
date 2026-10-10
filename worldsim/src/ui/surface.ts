/**
 * Planet surface view: a map of a planet's surface, generated with the same
 * terrain code as our world but re-tuned for that planet's temperature,
 * water, atmosphere and gravity. Our own world shows its real terrain and
 * towns.
 */
import { createNoise2D } from 'simplex-noise';
import { TerrainGenerator, Biome } from '../shared/terrain';
import { describeHabitability, type Planet } from '../shared/galaxy';
import { makeRng, nextFloat } from '../shared/rng';
import { biomeColor } from '../render/palette';

const SIZE = 240;

type RGB = [number, number, number];

export function drawSurface(
  canvas: HTMLCanvasElement,
  planet: Planet,
  extra: { settlements?: { name: string; x: number; y: number }[]; colony?: { name: string; population: number } | null },
): void {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(SIZE, SIZE);
  const put = (i: number, c: RGB, shade = 1) => {
    img.data[i * 4] = Math.min(255, c[0] * shade);
    img.data[i * 4 + 1] = Math.min(255, c[1] * shade);
    img.data[i * 4 + 2] = Math.min(255, c[2] * shade);
    img.data[i * 4 + 3] = 255;
  };

  if (planet.kind !== 'rocky') {
    // Gas and ice giants: swirling cloud bands.
    const rng = makeRng(planet.seed);
    const noise = createNoise2D(() => nextFloat(rng));
    const palette: RGB[] = planet.kind === 'gas giant'
      ? [[201, 160, 112], [232, 206, 160], [170, 120, 80], [240, 226, 196]]
      : [[120, 170, 210], [160, 205, 230], [90, 140, 190], [200, 230, 245]];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const v = y / 18 + noise(x / 60, y / 14) * 1.2 + noise(x / 15, y / 6) * 0.25;
        const k = Math.abs(Math.floor(v)) % palette.length;
        put(y * SIZE + x, palette[k], 0.92 + noise(x / 9, y / 9) * 0.08);
      }
    }
  } else if (planet.home && extra.settlements?.length) {
    // Our own world: real terrain around the towns.
    const gen = new TerrainGenerator(planet.seed);
    const xs = extra.settlements.map((s) => s.x);
    const ys = extra.settlements.map((s) => s.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const span = Math.max(400, Math.max(...xs) - Math.min(...xs) + 200, Math.max(...ys) - Math.min(...ys) + 200);
    const k = span / SIZE;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const s = gen.sample(cx + (x - SIZE / 2) * k, cy + (y - SIZE / 2) * k);
        put(y * SIZE + x, biomeColor(s.biome, 1), 0.85 + Math.max(0, s.elevation) * 0.4);
      }
    }
    g.putImageData(img, 0, 0);
    g.font = '9px system-ui, sans-serif';
    for (const s of extra.settlements) {
      const px = SIZE / 2 + (s.x - cx) / k;
      const py = SIZE / 2 + (s.y - cy) / k;
      g.fillStyle = '#ffd36b';
      g.fillRect(px - 1.5, py - 1.5, 3, 3);
      g.fillStyle = '#fff';
      g.fillText(s.name, px + 3, py + 3);
    }
    return;
  } else {
    // Another rocky world, built from its own seed and climate.
    const gen = new TerrainGenerator(planet.seed);
    const seaLevel = planet.water > 0 ? -0.55 + planet.water * 1.1 : -9;
    const air = planet.atmosphere;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const s = gen.sample(x * 6, y * 6);
        const temp = planet.tempC + (s.temperature - 13) * 0.6 - Math.max(0, s.elevation) * 30;
        const i = y * SIZE + x;
        const shade = 0.8 + (s.elevation + 1) * 0.15;
        if (s.elevation < seaLevel) {
          const sea: RGB = temp < -8 ? [215, 230, 240] : air === 'toxic' ? [90, 130, 70] : [40, 90, 160];
          put(i, sea, 0.8 + (s.elevation - seaLevel) * 0.3 + 0.2);
          continue;
        }
        let c: RGB;
        if (temp < -15) c = [235, 240, 245];
        else if (air === 'breathable') {
          const biome = temp > 26 && s.moisture < 0 ? Biome.Desert : temp < 0 ? Biome.Tundra : s.moisture > 0.05 ? Biome.Forest : Biome.Grass;
          c = biomeColor(biome, 1);
        } else if (air === 'toxic') c = [190, 170, 90];
        else if (air === 'thick') c = [205, 140, 80];
        else if (temp > 150) c = [120, 90, 70];
        else c = planet.seed % 2 ? [165, 95, 70] : [150, 145, 140]; // rusty or grey rock
        put(i, c, shade);
      }
    }
  }
  g.putImageData(img, 0, 0);
  if (extra.colony) {
    g.fillStyle = '#7CFC9A';
    g.beginPath();
    g.arc(SIZE / 2, SIZE / 2, 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = '10px system-ui, sans-serif';
    g.fillText(`${extra.colony.name} (${extra.colony.population})`, SIZE / 2 + 6, SIZE / 2 + 4);
  }
}

export function planetSummary(p: Planet): string {
  return `${p.kind}, ${p.tempC}°C, gravity ${p.gravity} g, ${p.atmosphere} atmosphere, ${Math.round(p.water * 100)}% water · ${describeHabitability(p.habitability)}`;
}
