/**
 * Species definitions: pure data, shared by the simulation (behaviour) and the
 * renderer (which picture to draw). To add a new plant or animal, add an entry
 * here, then teach the renderer how to draw it in render/pixi/textures.ts.
 */
import { Biome } from './terrain';

export const PlantStage = {
  Seed: 0,
  Sprout: 1,
  Young: 2,
  Mature: 3,
  Old: 4,
  Dead: 5,
} as const;
export type PlantStage = (typeof PlantStage)[keyof typeof PlantStage];
export const PLANT_STAGE_NAMES = ['Seed', 'Sprout', 'Young', 'Mature', 'Old', 'Dead'];

export type PlantShape = 'broadleaf' | 'conifer' | 'fruitTree' | 'bush' | 'grain' | 'cactus';

export interface PlantSpecies {
  id: number;
  name: string;
  shape: PlantShape;
  /** Trees need a free tile around them; small plants can grow side by side. */
  isTree: boolean;
  deciduous: boolean;
  /** Annuals sprout in spring, ripen, drop seeds and die back each year. */
  annual: boolean;
  matureYears: number;
  lifespanYears: [number, number];
  /** Which season (0=spring..3=winter) seeds are spread in. */
  spreadSeason: number;
  /** Chance per day, per mature plant, of dropping a seed in that season. */
  spreadChance: number;
  spreadRadius: number;
  fruit?: { name: string; max: number; fromDay: number; toDay: number };
  /** Below this °C the plant takes frost damage. */
  minTemp: number;
  /** Where it grows and how densely (share of tiles, 0..1). */
  habitat: Partial<Record<Biome, number>>;
}

export const PLANTS: PlantSpecies[] = [
  {
    id: 0, name: 'Oak', shape: 'broadleaf', isTree: true, deciduous: true, annual: false,
    matureYears: 10, lifespanYears: [70, 150], spreadSeason: 2, spreadChance: 0.01, spreadRadius: 5,
    minTemp: -30,
    habitat: { [Biome.Forest]: 0.22, [Biome.Grass]: 0.025, [Biome.Swamp]: 0.08, [Biome.Savanna]: 0.015 },
  },
  {
    id: 1, name: 'Pine', shape: 'conifer', isTree: true, deciduous: false, annual: false,
    matureYears: 8, lifespanYears: [60, 130], spreadSeason: 1, spreadChance: 0.012, spreadRadius: 6,
    minTemp: -45,
    habitat: { [Biome.Taiga]: 0.24, [Biome.Tundra]: 0.02, [Biome.Mountain]: 0.05, [Biome.Forest]: 0.04 },
  },
  {
    id: 2, name: 'Apple tree', shape: 'fruitTree', isTree: true, deciduous: true, annual: false,
    matureYears: 5, lifespanYears: [30, 70], spreadSeason: 2, spreadChance: 0.008, spreadRadius: 4,
    fruit: { name: 'apples', max: 12, fromDay: 50, toDay: 88 },
    minTemp: -30,
    habitat: { [Biome.Forest]: 0.02, [Biome.Grass]: 0.012 },
  },
  {
    id: 3, name: 'Berry bush', shape: 'bush', isTree: false, deciduous: true, annual: false,
    matureYears: 2, lifespanYears: [8, 20], spreadSeason: 1, spreadChance: 0.015, spreadRadius: 3,
    fruit: { name: 'berries', max: 20, fromDay: 36, toDay: 68 },
    minTemp: -35,
    habitat: { [Biome.Forest]: 0.06, [Biome.Grass]: 0.02, [Biome.Taiga]: 0.05, [Biome.Tundra]: 0.02 },
  },
  {
    id: 4, name: 'Wild wheat', shape: 'grain', isTree: false, deciduous: false, annual: true,
    matureYears: 0, lifespanYears: [1, 1], spreadSeason: 2, spreadChance: 0.15, spreadRadius: 2,
    fruit: { name: 'grain', max: 5, fromDay: 50, toDay: 80 },
    minTemp: -40,
    habitat: { [Biome.Grass]: 0.05, [Biome.Savanna]: 0.07 },
  },
  {
    id: 5, name: 'Cactus', shape: 'cactus', isTree: false, deciduous: false, annual: false,
    matureYears: 6, lifespanYears: [40, 100], spreadSeason: 1, spreadChance: 0.004, spreadRadius: 4,
    fruit: { name: 'prickly pears', max: 3, fromDay: 35, toDay: 58 },
    minTemp: -8,
    habitat: { [Biome.Desert]: 0.035, [Biome.Savanna]: 0.005 },
  },
];

export interface AnimalSpecies {
  id: number;
  name: string;
  /** Walking speed in tiles per game minute. */
  speed: number;
  lifespanYears: [number, number];
  adultYears: number;
  gestationDays: number;
  litter: [number, number];
  /** Season (0..3) when adults mate. */
  matingSeason: number;
  /** Days without food/water before the need is maxed out. */
  hungerDays: number;
  thirstDays: number;
  /** How many grass units one full meal consumes. */
  grassPerMeal: number;
}

export const ANIMALS: AnimalSpecies[] = [
  {
    id: 0, name: 'Deer', speed: 2.2, lifespanYears: [10, 16], adultYears: 1.5, gestationDays: 75,
    litter: [1, 2], matingSeason: 2, hungerDays: 1.4, thirstDays: 0.8, grassPerMeal: 3,
  },
];
