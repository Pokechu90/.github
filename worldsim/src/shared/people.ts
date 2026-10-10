/**
 * Data about people and society: names, jobs, resources, buildings, diseases.
 * Pure data, shared by the simulation and the renderer/UI.
 */

export const FEMALE_NAMES = [
  'Ana', 'Mira', 'Lena', 'Sofia', 'Yara', 'Ines', 'Nora', 'Ada', 'Leila', 'Elif', 'Maya', 'Zara',
  'Amina', 'Iris', 'Hana', 'Rosa', 'Tala', 'Freya', 'Asha', 'Clara', 'Noor', 'Selin', 'Lucia',
  'Esme', 'Ruth', 'Kira', 'Vera', 'Alba', 'Nadia', 'Olga', 'Salma', 'Ilse', 'Mei', 'Aiko', 'Dina',
  'Greta', 'Hedda', 'Juno', 'Lyra', 'Petra', 'Rhea', 'Sanna', 'Thea', 'Una', 'Wren', 'Yasmin',
];
export const MALE_NAMES = [
  'Tom', 'Elias', 'Omar', 'Luca', 'Ivan', 'Karim', 'Noah', 'Aron', 'Bram', 'Davi', 'Emil', 'Felix',
  'Hugo', 'Idris', 'Jonas', 'Kai', 'Leo', 'Malik', 'Nils', 'Oskar', 'Pavel', 'Rafael', 'Samir',
  'Teo', 'Umar', 'Viktor', 'Yusuf', 'Zane', 'Anton', 'Bilal', 'Cyrus', 'Dario', 'Erik', 'Farid',
  'Goran', 'Hamid', 'Jalen', 'Kenji', 'Lars', 'Milo', 'Nikos', 'Otto', 'Rune', 'Silas', 'Tariq',
];
export const SURNAMES = [
  'Reed', 'Stone', 'Brook', 'Ash', 'Vale', 'Hart', 'Moss', 'Fen', 'Rowe', 'Thorn', 'Wells',
  'Marsh', 'Hale', 'Birch', 'Crow', 'Dale', 'Frost', 'Glen', 'Hill', 'Lark', 'Oak', 'Pike',
  'Rook', 'Shaw', 'Wolfe', 'Ford', 'Lowe', 'Rivers', 'Fields', 'Hollow',
];

const PLACE_START = ['Ash', 'Bright', 'Cold', 'Deep', 'Elder', 'Fair', 'Green', 'High', 'Iron', 'Long', 'Mill', 'North', 'Oak', 'Red', 'Silver', 'Stone', 'Sun', 'West', 'Wolf', 'Wil', 'Raven', 'Black', 'Amber', 'Thorn'];
const PLACE_END = ['ford', 'brook', 'vale', 'haven', 'field', 'wood', 'hollow', 'stead', 'mere', 'ridge', 'well', 'by', 'ton', 'holm', 'wick', 'bury', 'gate', 'moor'];

export function placeName(r: () => number): string {
  return PLACE_START[Math.floor(r() * PLACE_START.length)] + PLACE_END[Math.floor(r() * PLACE_END.length)];
}

export const RESOURCES = {
  fruit: { name: 'Fruit & greens', food: 0.45, spoilPerDay: 0.04 },
  grain: { name: 'Grain', food: 0.6, spoilPerDay: 0.002 },
  meat: { name: 'Meat', food: 0.8, spoilPerDay: 0.05 },
  fish: { name: 'Fish', food: 0.6, spoilPerDay: 0.06 },
  wood: { name: 'Wood', food: 0, spoilPerDay: 0 },
  stone: { name: 'Stone', food: 0, spoilPerDay: 0 },
  tools: { name: 'Tools', food: 0, spoilPerDay: 0.001 },
  cloth: { name: 'Cloth', food: 0, spoilPerDay: 0.001 },
  metal: { name: 'Metal', food: 0, spoilPerDay: 0 },
  goods: { name: 'Goods', food: 0, spoilPerDay: 0.001 },
} as const;
export type ResourceKey = keyof typeof RESOURCES;
export const FOODS: ResourceKey[] = ['grain', 'fruit', 'meat', 'fish'];

export const JOBS: Record<string, { name: string; skill: string; verb: string }> = {
  child: { name: 'Child', skill: 'social', verb: 'playing' },
  forager: { name: 'Forager', skill: 'foraging', verb: 'gathering food' },
  hunter: { name: 'Hunter', skill: 'hunting', verb: 'hunting' },
  fisher: { name: 'Fisher', skill: 'fishing', verb: 'fishing' },
  woodcutter: { name: 'Woodcutter', skill: 'woodcutting', verb: 'cutting wood' },
  builder: { name: 'Builder', skill: 'building', verb: 'building' },
  farmer: { name: 'Farmer', skill: 'farming', verb: 'farming' },
  crafter: { name: 'Crafter', skill: 'crafting', verb: 'crafting' },
  healer: { name: 'Healer', skill: 'medicine', verb: 'tending the sick' },
  scholar: { name: 'Scholar', skill: 'research', verb: 'researching' },
  trader: { name: 'Trader', skill: 'social', verb: 'trading' },
  elder: { name: 'Elder', skill: 'social', verb: 'teaching' },
};

export interface BuildingInfo {
  name: string;
  /** Resources needed to build it. */
  cost: Partial<Record<ResourceKey, number>>;
  /** Builder-hours of work. */
  work: number;
  /** People who can live here. */
  housing: number;
  /** Footprint radius in tiles (kept clear of other buildings). */
  size: number;
  tech?: string;
}

export const BUILDINGS: Record<string, BuildingInfo> = {
  campfire: { name: 'Campfire', cost: {}, work: 0, housing: 0, size: 1 },
  stockpile: { name: 'Stockpile', cost: {}, work: 0, housing: 0, size: 1 },
  hut: { name: 'Hut', cost: { wood: 12 }, work: 16, housing: 5, size: 1 },
  house: { name: 'House', cost: { wood: 20, stone: 10 }, work: 40, housing: 6, size: 1, tech: 'masonry' },
  farm: { name: 'Farm field', cost: { wood: 4 }, work: 10, housing: 0, size: 2, tech: 'agriculture' },
  granary: { name: 'Granary', cost: { wood: 20, stone: 6 }, work: 30, housing: 0, size: 1, tech: 'agriculture' },
  workshop: { name: 'Workshop', cost: { wood: 18, stone: 4 }, work: 30, housing: 0, size: 1, tech: 'toolmaking' },
  well: { name: 'Well', cost: { stone: 12 }, work: 20, housing: 0, size: 1, tech: 'masonry' },
  market: { name: 'Market', cost: { wood: 25, stone: 15 }, work: 50, housing: 0, size: 2, tech: 'currency' },
  school: { name: 'School', cost: { wood: 25, stone: 20 }, work: 60, housing: 0, size: 1, tech: 'writing' },
  temple: { name: 'Temple', cost: { stone: 40 }, work: 80, housing: 0, size: 2, tech: 'masonry' },
  smithy: { name: 'Smithy', cost: { wood: 15, stone: 20 }, work: 50, housing: 0, size: 1, tech: 'metalwork' },
  factory: { name: 'Factory', cost: { stone: 40, metal: 30 }, work: 120, housing: 0, size: 2, tech: 'industry' },
  powerplant: { name: 'Power plant', cost: { stone: 50, metal: 50 }, work: 160, housing: 0, size: 2, tech: 'electricity' },
  lab: { name: 'Laboratory', cost: { stone: 40, metal: 30, goods: 20 }, work: 140, housing: 0, size: 1, tech: 'computing' },
  launchpad: { name: 'Launch pad', cost: { stone: 80, metal: 120, goods: 60 }, work: 300, housing: 0, size: 3, tech: 'rocketry' },
};

export interface DiseaseInfo {
  name: string;
  /** Chance per hour of close contact with someone sick. */
  contagion: number;
  /** Chance per person per day of catching it out of nowhere. */
  spontaneous: number;
  days: [number, number];
  /** Chance per day of dying while sick (before medicine/age modifiers). */
  lethality: number;
  /** Days of immunity after recovering. */
  immunityDays: number;
  /** How much it saps energy and hunger. */
  severity: number;
}

export const DISEASES: Record<string, DiseaseInfo> = {
  cold: { name: 'Common cold', contagion: 0.02, spontaneous: 0.0015, days: [4, 8], lethality: 0.0004, immunityDays: 90, severity: 0.2 },
  fever: { name: 'Fever', contagion: 0.012, spontaneous: 0.0005, days: [6, 14], lethality: 0.006, immunityDays: 240, severity: 0.5 },
  dysentery: { name: 'Dysentery', contagion: 0.006, spontaneous: 0.0002, days: [5, 12], lethality: 0.01, immunityDays: 120, severity: 0.6 },
  pox: { name: 'Pox', contagion: 0.025, spontaneous: 0.00002, days: [10, 20], lethality: 0.012, immunityDays: 100000, severity: 0.7 },
  plague: { name: 'Plague', contagion: 0.03, spontaneous: 0.000004, days: [8, 16], lethality: 0.04, immunityDays: 100000, severity: 0.9 },
};

/** Describes a 0..1 personality trait in words. */
export function traitWord(trait: string, v: number): string | null {
  const words: Record<string, [string, string]> = {
    openness: ['traditional', 'curious'],
    conscientiousness: ['carefree', 'diligent'],
    extraversion: ['quiet', 'outgoing'],
    agreeableness: ['stubborn', 'kind'],
    neuroticism: ['calm', 'anxious'],
  };
  const w = words[trait];
  if (!w) return null;
  if (v < 0.3) return w[0];
  if (v > 0.7) return w[1];
  return null;
}
