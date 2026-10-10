/**
 * The contract between the simulation (Web Worker) and the page (renderer + UI).
 *
 * The simulation never touches the screen, and the renderer never changes the
 * world. They only exchange these messages. That is what lets us swap PixiJS
 * for Three.js (or a game engine) later without touching the simulation.
 */
import type { ChatResult, DecideResult, NpcPromptContext } from './llm';

// ---------- Page -> Simulation ----------

export type SelectTarget =
  | { kind: 'animal'; id: number }
  | { kind: 'plant'; id: number; chunk: string }
  | { kind: 'npc'; id: number }
  | { kind: 'building'; id: number };

export type ToSim =
  | { type: 'init'; seed: number }
  /** Game minutes per real second. 0 = paused. */
  | { type: 'setSpeed'; speed: number }
  /** What the camera can see, in tile coordinates. `detail` = show plants & animals. */
  | { type: 'viewport'; x0: number; y0: number; x1: number; y1: number; detail: boolean }
  | { type: 'select'; target: SelectTarget | null }
  /** Ask for everything an NPC knows (to build an LLM prompt). */
  | { type: 'npcContext'; id: number; requestId: number }
  /** The player starts/stops talking to an NPC (they stop what they're doing). */
  | { type: 'chat'; id: number; active: boolean }
  | { type: 'chatResult'; id: number; playerText: string; result: ChatResult }
  /** Ask which nearby NPCs would like an LLM to decide their next goal. */
  | { type: 'focusRequest'; requestId: number; max: number }
  | { type: 'applyGoal'; id: number; result: DecideResult }

// ---------- Simulation -> Page ----------

export type FromSim =
  | { type: 'ready'; seed: number; spawn: { x: number; y: number } }
  | { type: 'snapshot'; snap: Snapshot }
  | { type: 'npcContext'; requestId: number; context: NpcPromptContext | null }
  | { type: 'focusContexts'; requestId: number; contexts: NpcPromptContext[] };

export interface ChunkTerrainView {
  biomes: Uint8Array;
  heights: Uint8Array;
  temps: Int8Array;
}

export interface ChunkView {
  key: string;
  cx: number;
  cy: number;
  /** Only sent the first time the page sees this chunk. */
  terrain?: ChunkTerrainView;
  /** Sent whenever plants visibly change (and only when detail is on). */
  plants?: PlantView[];
}

export interface PlantView {
  id: number;
  x: number;
  y: number;
  species: number;
  stage: number;
  /** 0..3: how loaded with fruit the plant looks. */
  fruit: number;
}

export interface AnimalView {
  id: number;
  species: number;
  x: number;
  y: number;
  action: string;
  young: boolean;
  facing: 1 | -1;
}

export interface NpcView {
  id: number;
  x: number;
  y: number;
  name: string;
  sex: 'female' | 'male';
  stage: 'baby' | 'child' | 'adult' | 'elder';
  skin: number;
  hair: number;
  shirt: number;
  action: string;
  facing: 1 | -1;
  carrying: string | null;
  /** Indoors (asleep at home): not drawn. */
  hidden: boolean;
  sick: boolean;
}

export interface BuildingView {
  id: number;
  kind: string;
  x: number;
  y: number;
  progress: number;
  crop: number;
  settlementId: number;
}

export interface SettlementView {
  id: number;
  name: string;
  x: number;
  y: number;
  tier: string;
  population: number;
}

export interface PersonSummary {
  id: number;
  name: string;
  age: number;
  job: string;
  settlement: string;
}

export interface WeatherView {
  cloud: number; // 0..1
  rain: number; // 0..1
  tempC: number;
  snowing: boolean;
}

export type SelectedInfo =
  | {
      kind: 'animal';
      id: number;
      x: number;
      y: number;
      title: string;
      sex: string;
      ageYears: number;
      action: string;
      needs: { label: string; value: number }[];
      notes: string[];
    }
  | {
      kind: 'plant';
      id: number;
      x: number;
      y: number;
      title: string;
      ageYears: number;
      stage: string;
      fruit: number;
      notes: string[];
    }
  | {
      kind: 'npc';
      id: number;
      x: number;
      y: number;
      title: string;
      subtitle: string;
      thought: string;
      goal: string | null;
      doing: string;
      mood: number;
      needs: { label: string; value: number }[];
      health: number;
      conditions: string[];
      traits: string[];
      values: string[];
      skills: { label: string; value: number }[];
      family: { relation: string; name: string; id: number; alive: boolean }[];
      relationships: { name: string; id: number; affinity: number; label: string }[];
      memories: { text: string; when: string; source: string | null; lasting: boolean }[];
      playerAffinity: number;
    }
  | {
      kind: 'building';
      id: number;
      x: number;
      y: number;
      title: string;
      settlement: string;
      progress: number;
      residents: { name: string; id: number }[];
      notes: string[];
    }
  | { kind: 'gone'; text: string };

export interface WorldStats {
  population: Record<string, number>;
  plants: Record<string, number>;
  births: number;
  deaths: Record<string, number>;
  chunksLoaded: number;
  /** Deer population sampled once per game day, most recent last. */
  history: number[];
  /** Human population sampled once per game day. */
  peopleHistory: number[];
  humans: number;
  humanBirths: number;
  humanDeaths: Record<string, number>;
}

export interface WorldEvent {
  time: number;
  text: string;
  /** birth, death, social, build, disease, settlement, tech, space, world... */
  kind: string;
  /** Who it's about (npc id), or -1. */
  about: number;
}

export interface Snapshot {
  time: number;
  speed: number;
  /** Real milliseconds the last simulation step took (performance meter). */
  simMs: number;
  /** True when the simulation can't keep up with the requested speed. */
  lagging: boolean;
  weather: WeatherView;
  chunks: ChunkView[];
  dropped: string[];
  animals: AnimalView[];
  npcs: NpcView[];
  /** Sent when buildings change or come into view; otherwise null (unchanged). */
  buildings: BuildingView[] | null;
  settlements: SettlementView[];
  /** Everyone in the settlement nearest the camera (sent about once a second). */
  people: PersonSummary[] | null;
  selected: SelectedInfo | null;
  stats: WorldStats;
  events: WorldEvent[];
}
