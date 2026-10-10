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
  stats: {
    births: number;
    deaths: Record<string, number>;
    history: number[];
    peakDeer: number;
  };
  events: WorldEvent[];
}
