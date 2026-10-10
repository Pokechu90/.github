/**
 * The world calendar. World time is stored as one number: game minutes since
 * the world began. Everything else (day, season, year, daylight) is computed
 * from it, so saving the time is trivial.
 *
 * The year is compressed to 4 seasons x 30 days = 120 days so that seasons,
 * generations and civilisation can progress in a reasonable amount of play
 * time. A day is a real 24 hours long. Change DAYS_PER_SEASON to taste.
 */

export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
export const DAYS_PER_SEASON = 30;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;
export const MINUTES_PER_YEAR = DAYS_PER_YEAR * MINUTES_PER_DAY;

export type SeasonName = (typeof SEASONS)[number];

/** The world starts at 6:00 on the first day of spring, year 1. */
export const START_TIME = 6 * MINUTES_PER_HOUR;

export interface Calendar {
  year: number; // 1-based
  season: number; // 0..3
  seasonName: SeasonName;
  dayOfSeason: number; // 1-based
  dayOfYear: number; // 0-based
  day: number; // days since the world began
  hour: number;
  minute: number;
}

export function getCalendar(time: number): Calendar {
  const day = Math.floor(time / MINUTES_PER_DAY);
  const dayOfYear = ((day % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  const season = Math.floor(dayOfYear / DAYS_PER_SEASON);
  const minuteOfDay = time - day * MINUTES_PER_DAY;
  return {
    year: Math.floor(day / DAYS_PER_YEAR) + 1,
    season,
    seasonName: SEASONS[season],
    dayOfSeason: (dayOfYear % DAYS_PER_SEASON) + 1,
    dayOfYear,
    day,
    hour: Math.floor(minuteOfDay / 60),
    minute: Math.floor(minuteOfDay % 60),
  };
}

/** Day of year as a smooth 0..1 fraction, used for seasonal curves. */
export function yearPhase(time: number): number {
  return (((time / MINUTES_PER_DAY) % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR / DAYS_PER_YEAR;
}

/** +1 at the height of summer, -1 in the depth of winter. */
export function seasonalWave(time: number): number {
  // Midsummer is day 45 of 120 (middle of the second season).
  return Math.cos(2 * Math.PI * (yearPhase(time) - 45 / DAYS_PER_YEAR));
}

/** How much warmer/colder than average it is because of the season (°C). */
export function seasonTempOffset(time: number): number {
  return 12 * seasonalWave(time);
}

/** Warmest at 15:00, coldest at 03:00 (°C). */
export function dailyTempOffset(time: number): number {
  const hour = (time % MINUTES_PER_DAY) / 60;
  return 5 * Math.cos(2 * Math.PI * ((hour - 15) / 24));
}

/** Sunrise/sunset shift with the seasons: long summer days, short winter days. */
export function sunTimes(time: number): { sunrise: number; sunset: number } {
  const w = seasonalWave(time);
  return { sunrise: 6 - 1.3 * w, sunset: 18.5 + 1.3 * w };
}

/** 1 = full daylight, 0 = full night, smooth through dawn and dusk. */
export function daylight(time: number): number {
  const hour = (time % MINUTES_PER_DAY) / 60;
  const { sunrise, sunset } = sunTimes(time);
  const ramp = 0.75; // hours of twilight on each side
  const morning = smoothstep(sunrise - ramp, sunrise + ramp, hour);
  const evening = 1 - smoothstep(sunset - ramp, sunset + ramp, hour);
  return Math.min(morning, evening);
}

export function isNight(time: number): boolean {
  return daylight(time) < 0.25;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function formatClock(time: number): string {
  const c = getCalendar(time);
  return `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`;
}

export function formatDate(time: number): string {
  const c = getCalendar(time);
  return `${c.seasonName} ${c.dayOfSeason}, Year ${c.year}`;
}
