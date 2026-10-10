/**
 * The complete state of the world, as plain data.
 *
 * Rule of thumb: anything that changes over time lives here. Anything that can
 * be recomputed from the seed (like terrain) is NOT saved. Keeping state as
 * plain objects makes save/load (milestone 4) a straightforward JSON export.
 */
import type { ChunkTerrain } from '../shared/terrain';
import type { Rng } from '../shared/rng';
import type { WorldEvent } from '../shared/protocol';
import type { PlantStage } from '../shared/species';

export interface Plant {
  id: number;
  species: number;
  x: number; // global tile coordinates
  y: number;
  ageDays: number;
  lifespanDays: number;
  stage: PlantStage;
  health: number; // 0..1
  fruit: number;
}

export interface Chunk {
  key: string;
  cx: number;
  cy: number;
  terrain: ChunkTerrain; // regenerated from the seed, never saved
  plants: Plant[];
  /** Per tile: 0 empty, 1 small plant, 2 tree. */
  occupied: Uint8Array;
  /** Grazing food available in the chunk, and its maximum. */
  grass: number;
  grassMax: number;
  /** Land tiles next to fresh water, where animals go to drink (tile indices). */
  shore: number[];
  /** Fish in the chunk's water, and the most it can hold. */
  fish: number;
  fishMax: number;
  /** Bumped whenever something visible changes, so the renderer knows to redraw. */
  version: number;
}

export type AnimalAction = 'idle' | 'walk' | 'graze' | 'drink' | 'eat' | 'sleep';
export type WalkPurpose = 'wander' | 'graze' | 'drink' | 'fruit' | 'follow';

export interface Animal {
  id: number;
  species: number;
  sex: 'female' | 'male';
  x: number;
  y: number;
  facing: 1 | -1;
  ageDays: number;
  lifespanDays: number;
  // Needs, 0 = fully satisfied, 1 = desperate.
  hunger: number;
  thirst: number;
  tiredness: number;
  health: number; // 0..1
  action: AnimalAction;
  purpose: WalkPurpose;
  targetX: number;
  targetY: number;
  /** Plant being walked to for fruit. */
  targetPlant: number;
  /** Minutes left in the current action before rethinking. */
  timer: number;
  /** Days pregnant, or -1. */
  pregnantDays: number;
  motherId: number;
  /** Remembered place to drink, -1 if none. */
  waterX: number;
  waterY: number;
}

// ---------------------------------------------------------------- People

export type Sex = 'female' | 'male';
export type TraitKey = 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';
export type ValueKey = 'family' | 'wealth' | 'knowledge' | 'tradition' | 'freedom';
export type SkillKey =
  | 'foraging' | 'hunting' | 'fishing' | 'woodcutting' | 'building'
  | 'farming' | 'crafting' | 'research' | 'medicine' | 'social';
export type JobKey =
  | 'child' | 'forager' | 'hunter' | 'fisher' | 'woodcutter' | 'builder'
  | 'farmer' | 'crafter' | 'healer' | 'scholar' | 'trader' | 'elder';

export type NeedKey = 'hunger' | 'energy' | 'social' | 'safety' | 'purpose';

export interface MemoryEntry {
  /** Shared id for an event several people know about (for gossip). */
  eventId: number;
  time: number;
  text: string;
  /** 0..1: how much it matters to them. */
  importance: number;
  /** -1 (awful) .. +1 (wonderful). */
  feeling: number;
  /** Who it's about, if anyone (npc id, or -2 for the player). */
  about: number;
  /** Id of the person they heard it from, or -1 if witnessed. */
  heardFrom: number;
  /** How they'd tell someone else about it (third person), or null if private. */
  share: string | null;
}

export interface Relationship {
  /** -1 (hate) .. +1 (love/close friendship). */
  affinity: number;
  /** 0 (strangers) .. 1 (know each other deeply). */
  familiarity: number;
  /** Romantic interest, 0..1. */
  romance: number;
}

export interface Illness {
  disease: string;
  daysLeft: number;
  severity: number; // 0..1
}

/** What an NPC is doing right now. */
export interface NpcAction {
  kind:
    | 'idle' | 'walk' | 'sleep' | 'eat' | 'work' | 'talk' | 'play' | 'learn'
    | 'rest' | 'wander' | 'migrate';
  /** What they're walking towards, and why. */
  then?: NpcAction['kind'];
  targetId?: number;
  task?: string;
  /** Minutes remaining. */
  timer: number;
}

export interface Npc {
  id: number;
  firstName: string;
  lastName: string;
  sex: Sex;
  /** Attracted to: 'opposite' | 'same' | 'both'. */
  orientation: 'opposite' | 'same' | 'both';
  x: number;
  y: number;
  facing: 1 | -1;
  ageDays: number;
  lifespanDays: number;
  appearance: { skin: number; hair: number; shirt: number };
  traits: Record<TraitKey, number>;
  values: Record<ValueKey, number>;
  skills: Record<SkillKey, number>;
  job: JobKey;
  /** Need deficits: 0 = satisfied, 1 = desperate. */
  needs: Record<NeedKey, number>;
  health: number;
  mood: number; // -1..1
  action: NpcAction;
  /** Waypoints [x0, y0, x1, y1, ...] for the current walk. */
  path: number[];
  pathIndex: number;
  /** Final destination of a long walk that is planned leg by leg. */
  dest: [number, number] | null;
  carrying: { type: ResourceType; amount: number } | null;
  settlementId: number;
  homeId: number;
  motherId: number;
  fatherId: number;
  partnerId: number;
  married: boolean;
  childrenIds: number[];
  relationships: Record<number, Relationship>;
  memory: { recent: MemoryEntry[]; longTerm: MemoryEntry[] };
  thought: string;
  /** A longer-term intention, set by rules or (later) by the LLM. */
  goal: { kind: string; text: string; until: number; targetId: number } | null;
  pregnantDays: number;
  pregnancyFatherId: number;
  illness: Illness | null;
  /** Disease name -> game day until which they're immune. */
  immunity: Record<string, number>;
  /** Accumulated food eaten today etc., used for simple bookkeeping. */
  lastMealTime: number;
  /** How the NPC feels about the player (-1..1), and how well they know them. */
  playerAffinity: number;
  playerFamiliarity: number;
  /** Personal money (once the settlement uses currency). */
  wealth: number;
  /** The last few lines exchanged with the player, so later chats continue naturally. */
  chatLog: { from: 'player' | 'npc'; text: string; time: number }[];
}

/** A person who has died: kept for family trees and history. */
export interface DeceasedNpc {
  id: number;
  name: string;
  sex: Sex;
  bornDay: number;
  diedDay: number;
  cause: string;
  motherId: number;
  fatherId: number;
  partnerId: number;
  childrenIds: number[];
}

// ---------------------------------------------------------------- Society

export type ResourceType = 'fruit' | 'grain' | 'meat' | 'fish' | 'wood' | 'stone' | 'tools' | 'cloth' | 'metal' | 'goods';

export type BuildingKind =
  | 'campfire' | 'stockpile' | 'hut' | 'house' | 'farm' | 'workshop'
  | 'granary' | 'market' | 'school' | 'temple' | 'smithy' | 'well'
  | 'factory' | 'powerplant' | 'lab' | 'launchpad';

export interface Building {
  id: number;
  kind: BuildingKind;
  x: number;
  y: number;
  settlementId: number;
  /** 0..1 while under construction, 1 when finished. */
  progress: number;
  /** For farms: crop growth 0..1. */
  crop: number;
  /** Stored goods waiting to be collected (e.g. a harvested field). */
  amount: number;
}

export interface Settlement {
  id: number;
  name: string;
  x: number;
  y: number;
  foundedDay: number;
  tier: 'camp' | 'village' | 'town' | 'city' | 'metropolis';
  stock: Record<ResourceType, number>;
  /** Shared knowledge: technology ids this settlement has discovered. */
  tech: string[];
  /** Progress points towards each technology being researched. */
  research: Record<string, number>;
  laws: string[];
  culture: { name: string; traits: string[] };
  /** Money held by the settlement treasury (once currency exists). */
  treasury: number;
  /** Prices of goods, driven by supply and demand. */
  prices: Partial<Record<ResourceType, number>>;
  /** Abstract (off-screen) population that isn't simulated as individuals. */
  abstractPop: number;
  parentId: number;
  /** Set when the settlement is abandoned or destroyed. */
  abandoned: boolean;
  /** Relations with other settlements: id -> -1..1. */
  diplomacy: Record<number, number>;
  /** Current leader (npc id) or -1. */
  leaderId: number;
  /** Day of the last migration out of here, raid, etc. (for pacing). */
  lastMigrationDay: number;
  lastRaidDay: number;
  raids: number;
}

export interface WorldState {
  version: 1;
  seed: number;
  /** Game minutes since the world began. */
  time: number;
  /** Last whole day that daily updates ran for. */
  lastDay: number;
  rng: Rng;
  nextId: number;
  chunks: Map<string, Chunk>;
  animals: Animal[];
  npcs: Npc[];
  deceased: DeceasedNpc[];
  settlements: Settlement[];
  buildings: Building[];
  stats: {
    births: number;
    deaths: Record<string, number>;
    history: number[];
    peakDeer: number;
    /** Human population sampled once per game day. */
    peopleHistory: number[];
    humanBirths: number;
    humanDeaths: Record<string, number>;
  };
  events: WorldEvent[];
  /** Important events kept for the long-term history (techs, towns, wars...). */
  chronicle: WorldEvent[];
}
