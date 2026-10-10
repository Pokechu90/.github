/**
 * Saving and loading. The world state is plain data, so a save is just JSON.
 * Terrain is NOT saved: it is regenerated from the seed when loading, which
 * keeps save files small. Plants, animals, people, buildings, settlements,
 * history and the random-number state are saved exactly.
 */
import { PLANTS } from '../shared/species';
import type { Chunk, Plant, WorldState } from './state';
import { World } from './world';

const FORMAT = 'worldsim-save';
const VERSION = 1;

interface SavedChunk {
  cx: number;
  cy: number;
  grass: number;
  fish: number;
  version: number;
  /** Plants as compact tuples: [id, species, x, y, ageDays, lifespanDays, stage, health, fruit]. */
  plants: number[][];
}

export interface SaveFile {
  format: typeof FORMAT;
  version: number;
  savedAt: string;
  seed: number;
  time: number;
  state: Omit<WorldState, 'chunks'> & { chunks: SavedChunk[] };
}

export function serialize(world: World): string {
  const s = world.state;
  const chunks: SavedChunk[] = [];
  for (const c of s.chunks.values()) {
    chunks.push({
      cx: c.cx,
      cy: c.cy,
      grass: round(c.grass),
      fish: round(c.fish),
      version: c.version,
      plants: c.plants.map((p) => [p.id, p.species, p.x, p.y, round(p.ageDays), round(p.lifespanDays), p.stage, round(p.health), round(p.fruit)]),
    });
  }
  const file: SaveFile = {
    format: FORMAT,
    version: VERSION,
    savedAt: new Date().toISOString(),
    seed: s.seed,
    time: s.time,
    state: { ...s, chunks },
  };
  return JSON.stringify(file);
}

export function deserialize(json: string): World {
  const file = JSON.parse(json) as SaveFile;
  if (file.format !== FORMAT) throw new Error('This file is not a WorldSim save.');
  if (file.version > VERSION) throw new Error('This save was made by a newer version of WorldSim.');
  const world = new World(file.seed);
  const { chunks, ...rest } = file.state;
  Object.assign(world.state, rest);
  world.state.chunks = new Map();
  for (const sc of chunks) {
    const c: Chunk = world.createChunk(sc.cx, sc.cy);
    c.grass = sc.grass;
    c.fish = sc.fish;
    c.version = sc.version;
    world.addChunk(c);
  }
  // Plants second, so tree spacing (occupancy) can be rebuilt across chunk borders.
  for (const sc of chunks) {
    const c = world.getChunk(sc.cx, sc.cy)!;
    for (const t of sc.plants) {
      const p: Plant = { id: t[0], species: t[1], x: t[2], y: t[3], ageDays: t[4], lifespanDays: t[5], stage: t[6] as Plant['stage'], health: t[7], fruit: t[8] };
      c.plants.push(p);
      world.setOccupied(p.x, p.y, PLANTS[p.species].isTree ? 2 : 1);
    }
  }
  // Older saves may lack newer fields; fill in defaults.
  for (const n of world.state.npcs) {
    n.chatLog ??= [];
    n.wealth ??= 0;
  }
  world.afterLoad();
  world.log('The world was loaded from a save.', 'world');
  return world;
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
