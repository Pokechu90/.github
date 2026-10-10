/**
 * Weather. Clouds and rain are a noise field that slowly drifts across the map
 * with the wind, so storms are regional: it can pour in one valley while the
 * next one is sunny, and you can watch a rain front move in.
 *
 * Seasons change how wet it is; local climate (deserts vs swamps) shifts the
 * rain threshold; temperature comes from the land, the season and the hour.
 */
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { hashInts, makeRng, nextFloat } from '../shared/rng';
import { dailyTempOffset, getCalendar, seasonTempOffset } from '../shared/time';
import type { WeatherView } from '../shared/protocol';

// How wet each season is, added to the cloud cover (spring rains, dry summer).
const SEASON_WETNESS = [0.08, -0.06, 0.05, 0.02];

export class Climate {
  private clouds: NoiseFunction2D;

  constructor(seed: number) {
    const rng = makeRng(hashInts(seed, 99));
    this.clouds = createNoise2D(() => nextFloat(rng));
  }

  /**
   * @param baseTemp yearly average temperature of the location (°C)
   * @param moisture how wet the local climate is (-1..1)
   */
  weatherAt(x: number, y: number, time: number, baseTemp: number, moisture: number): WeatherView {
    const hours = time / 60;
    // The wind blows weather east at ~9 tiles per hour.
    const wx = x / 240 - hours * 0.038;
    const wy = y / 240 + hours * 0.006;
    const n =
      0.5 +
      0.5 * (this.clouds(wx, wy) * 0.7 + this.clouds(wx * 2.7 + 31, wy * 2.7 - 17) * 0.3);
    const season = getCalendar(time).season;
    const wet = SEASON_WETNESS[season] + moisture * 0.18;

    const cloud = clamp01((n - 0.38 + wet) / 0.3);
    const rain = clamp01((n - 0.6 + wet) / 0.18);
    const tempC = baseTemp + seasonTempOffset(time) + dailyTempOffset(time) - cloud * 1.5 - rain * 2;
    return { cloud, rain, tempC, snowing: rain > 0.05 && tempC < 0.5 };
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
