/**
 * The contract between the simulation (Web Worker) and the page (renderer + UI).
 *
 * The simulation never touches the screen, and the renderer never changes the
 * world. They only exchange these messages. That is what lets us swap PixiJS
 * for Three.js (or a game engine) later without touching the simulation.
 */

// ---------- Page -> Simulation ----------

export type SelectTarget =
  | { kind: 'animal'; id: number }
  | { kind: 'plant'; id: number; chunk: string };

export type ToSim =
  | { type: 'init'; seed: number }
  /** Game minutes per real second. 0 = paused. */
  | { type: 'setSpeed'; speed: number }
  /** What the camera can see, in tile coordinates. `detail` = show plants & animals. */
  | { type: 'viewport'; x0: number; y0: number; x1: number; y1: number; detail: boolean }
  | { type: 'select'; target: SelectTarget | null };

// ---------- Simulation -> Page ----------

export type FromSim =
  | { type: 'ready'; seed: number; spawn: { x: number; y: number } }
  | { type: 'snapshot'; snap: Snapshot };

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
  | { kind: 'gone'; text: string };

export interface WorldStats {
  population: Record<string, number>;
  plants: Record<string, number>;
  births: number;
  deaths: Record<string, number>;
  chunksLoaded: number;
  /** Deer population sampled once per game day, most recent last. */
  history: number[];
}

export interface WorldEvent {
  time: number;
  text: string;
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
  selected: SelectedInfo | null;
  stats: WorldStats;
  events: WorldEvent[];
}
