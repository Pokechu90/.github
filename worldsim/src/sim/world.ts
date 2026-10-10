/**
 * The World: owns the state and moves time forward.
 *
 * This file (and everything under src/sim) has no idea a screen exists. It can
 * run in a Web Worker, in a unit test, or in Node on a server. That separation
 * is what keeps the game swappable between 2D, 3D, or a game engine later.
 */
import { BIOMES, Biome, CHUNK_SIZE, TerrainGenerator, chunkKey } from '../shared/terrain';
import { hashInts, makeRng } from '../shared/rng';
import { MINUTES_PER_DAY, START_TIME, getCalendar } from '../shared/time';
import { ANIMALS, PLANTS, PlantStage } from '../shared/species';
import type { WeatherView } from '../shared/protocol';
import { Climate } from './climate';
import type { Animal, Building, Chunk, JobKey, Npc, Plant, Settlement, WorldState } from './state';
import { removePlantOnTile, spawnInitialPlants, updateGrassDaily, updatePlantsDaily } from './ecology/plants';
import { spawnInitialAnimals, updateAnimals, updateAnimalsDaily } from './ecology/animals';
import { updateNpcs, createStartingSettlement } from './npc/npcs';
import { updateHealthDaily } from './npc/health';
import { updateRomanceDaily } from './npc/social';
import { assignJobs, updateLifeDaily } from './npc/life';
import { totalFood, updateSettlementDaily } from './society/settlement';

/**
 * Extension points used by later systems (economy, technology, migration,
 * space) so the core loop doesn't need to know about them.
 */
export interface WorldHooks {
  tryTask?: (world: World, n: Npc, task: string) => boolean;
  doWork?: (world: World, n: Npc, dt: number) => void;
  jobDemand?: (world: World, s: Settlement, workers: number) => Partial<Record<JobKey, number>>;
  onSettlementFounded?: (world: World, s: Settlement) => void;
  daily?: Array<(world: World) => void>;
  tick?: Array<(world: World, dt: number) => void>;
}

const HISTORY_DAYS = 360;
const MAX_EVENTS = 600;

export class World {
  readonly state: WorldState;
  readonly terrain: TerrainGenerator;
  readonly climate: Climate;

  /** Lookup tables rebuilt every tick (cheap, and never stale). */
  private animalsByChunk = new Map<string, Animal[]>();
  private animalsById = new Map<number, Animal>();
  private npcsById = new Map<number, Npc>();
  private npcsBySettlement = new Map<number, Npc[]>();
  private npcsByChunk = new Map<string, Npc[]>();
  private buildingsById = new Map<number, Building>();
  private buildingsBySettlement = new Map<number, Building[]>();
  private buildingsDirty = true;
  /** Targets (plants, animals, patients) claimed by someone: target id -> npc id. */
  private reservations = new Map<number, number>();
  /** Bumped whenever buildings change, so the renderer knows to update. */
  buildingsVersion = 0;
  readonly hooks: WorldHooks = { daily: [], tick: [] };

  constructor(seed: number) {
    this.terrain = new TerrainGenerator(seed);
    this.climate = new Climate(seed);
    this.state = {
      version: 1,
      seed,
      time: START_TIME,
      lastDay: 0,
      rng: makeRng(hashInts(seed, 12345)),
      nextId: 1,
      chunks: new Map(),
      animals: [],
      npcs: [],
      deceased: [],
      settlements: [],
      buildings: [],
      stats: { births: 0, deaths: {}, history: [], peakDeer: 0, peopleHistory: [], humanBirths: 0, humanDeaths: {} },
      events: [],
    };
    this.log(`The world was born from seed ${seed}.`, 'world');
  }

  /** Places the first settlers. Call once for a brand-new world. */
  populate(x: number, y: number): void {
    createStartingSettlement(this, x, y);
    this.rebuildIndexes();
  }

  // ---------- Time ----------

  /**
   * Advances the world by `minutes` of game time, in small steps.
   * Stops early if it runs out of real time (`budgetMs`) so the worker never
   * locks up. Returns how many game minutes were actually simulated.
   */
  advance(minutes: number, budgetMs = Infinity): number {
    const start = performance.now();
    // Bigger steps at high speed keep things fast; small steps keep motion smooth.
    const maxStep = Math.min(60, Math.max(2, minutes / 16));
    let done = 0;
    while (done < minutes) {
      const dt = Math.min(maxStep, minutes - done);
      this.tick(dt);
      done += dt;
      if (performance.now() - start > budgetMs) break;
    }
    return done;
  }

  private tick(dt: number): void {
    this.state.time += dt;
    this.rebuildIndexes();
    updateAnimals(this, dt);
    updateNpcs(this, dt);
    for (const fn of this.hooks.tick ?? []) fn(this, dt);

    const day = Math.floor(this.state.time / MINUTES_PER_DAY);
    while (this.state.lastDay < day) {
      this.state.lastDay++;
      this.daily();
    }
  }

  private daily(): void {
    const cal = getCalendar(this.state.time);
    if (cal.dayOfSeason === 1 && cal.season === 0) this.log(`Year ${cal.year} begins.`, 'world');

    for (const chunk of this.state.chunks.values()) {
      updateGrassDaily(this, chunk);
      updatePlantsDaily(this, chunk);
      chunk.fish = Math.min(chunk.fishMax, chunk.fish + chunk.fishMax * 0.06);
    }
    this.rebuildIndexes();
    updateAnimalsDaily(this);

    // People and society.
    for (const s of this.state.settlements) if (!s.abandoned) updateSettlementDaily(this, s);
    updateHealthDaily(this);
    this.rebuildIndexes();
    updateRomanceDaily(this);
    updateLifeDaily(this);
    this.rebuildIndexes();
    if (cal.dayOfSeason % 10 === 1) for (const s of this.state.settlements) if (!s.abandoned) this.assignJobsFor(s);
    for (const fn of this.hooks.daily ?? []) fn(this);
    const ph = this.state.stats.peopleHistory;
    ph.push(this.state.npcs.length + this.state.settlements.reduce((a, s) => a + s.abstractPop, 0));
    if (ph.length > HISTORY_DAYS) ph.shift();

    // Population history for the graph, plus notable milestones.
    const deer = this.state.animals.length;
    const h = this.state.stats.history;
    h.push(deer);
    if (h.length > HISTORY_DAYS) h.shift();
    if (deer > this.state.stats.peakDeer * 1.25 && deer >= 20) {
      this.state.stats.peakDeer = deer;
      this.log(`The deer population reached a new high of ${deer}.`, 'nature');
    }
  }

  // ---------- Chunks & tiles ----------

  getChunk(cx: number, cy: number): Chunk | undefined {
    return this.state.chunks.get(chunkKey(cx, cy));
  }

  chunkAtTile(x: number, y: number): Chunk | undefined {
    return this.getChunk(Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE));
  }

  /** Returns the chunk, generating terrain, plants and animals if it's new. */
  ensureChunk(cx: number, cy: number): Chunk {
    const existing = this.getChunk(cx, cy);
    if (existing) return existing;

    const terrain = this.terrain.generateChunk(cx, cy);
    let grassMax = 0;
    let water = 0;
    const shore: number[] = [];
    for (let i = 0; i < terrain.biomes.length; i++) {
      const info = BIOMES[terrain.biomes[i] as Biome];
      grassMax += info.grass;
      if (info.water) water++;
      if (!info.water && info.walkable && touchesFreshWater(terrain.biomes, i)) shore.push(i);
    }
    const chunk: Chunk = {
      key: chunkKey(cx, cy),
      cx,
      cy,
      terrain,
      plants: [],
      occupied: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
      grass: grassMax * 0.8,
      grassMax,
      shore,
      fish: water * 0.5,
      fishMax: water * 0.5,
      version: 0,
    };
    this.state.chunks.set(chunk.key, chunk);

    // Chunk contents depend only on the seed and position, not on when or in
    // what order the player explores.
    const rng = makeRng(hashInts(this.state.seed, cx, cy, 777));
    spawnInitialPlants(this, chunk, rng);
    spawnInitialAnimals(this, chunk, rng);
    return chunk;
  }

  /** Biome at a tile, or -1 if that part of the world hasn't been generated yet. */
  biomeAt(x: number, y: number): number {
    const c = this.chunkAtTile(x, y);
    if (!c) return -1;
    return c.terrain.biomes[this.localIndex(c, x, y)];
  }

  isWalkable(x: number, y: number): boolean {
    const b = this.biomeAt(Math.floor(x), Math.floor(y));
    return b >= 0 && BIOMES[b as Biome].walkable;
  }

  weatherAt(x: number, y: number): WeatherView {
    const c = this.chunkAtTile(x, y);
    if (!c) return this.climate.weatherAt(x, y, this.state.time, 12, 0);
    const temp = c.terrain.temps[this.localIndex(c, x, y)];
    return this.climate.weatherAt(x, y, this.state.time, temp, c.terrain.avgMoisture);
  }

  setOccupied(x: number, y: number, value: number): void {
    const c = this.chunkAtTile(x, y);
    if (c) c.occupied[this.localIndex(c, x, y)] = value;
  }

  /** Is this tile free to plant on? Trees also need a free ring around them. */
  spaceFree(x: number, y: number, isTree: boolean): boolean {
    const c = this.chunkAtTile(x, y);
    if (!c || c.occupied[this.localIndex(c, x, y)] !== 0) return false;
    if (!isTree) return true;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const n = this.chunkAtTile(x + dx, y + dy);
        if (n && n.occupied[this.localIndex(n, x + dx, y + dy)] === 2) return false;
      }
    }
    return true;
  }

  countPlantsAround(x: number, y: number, r: number, trees: boolean): number {
    let n = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const c = this.chunkAtTile(x + dx, y + dy);
        if (!c) continue;
        const o = c.occupied[this.localIndex(c, x + dx, y + dy)];
        if (trees ? o === 2 : o !== 0) n++;
      }
    }
    return n;
  }

  findPlant(id: number, x: number, y: number): { chunk: Chunk; plant: Plant } | null {
    const chunk = this.chunkAtTile(x, y);
    const plant = chunk?.plants.find((p) => p.id === id);
    return chunk && plant ? { chunk, plant } : null;
  }

  private localIndex(c: Chunk, x: number, y: number): number {
    return (Math.floor(y) - c.cy * CHUNK_SIZE) * CHUNK_SIZE + (Math.floor(x) - c.cx * CHUNK_SIZE);
  }

  // ---------- Animals ----------

  animalById(id: number): Animal | undefined {
    return this.animalsById.get(id);
  }

  nearbyAnimals(x: number, y: number, radius: number): Animal[] {
    const out: Animal[] = [];
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = this.animalsByChunk.get(chunkKey(cx + dx, cy + dy));
        if (!list) continue;
        for (const a of list) if (Math.hypot(a.x - x, a.y - y) <= radius) out.push(a);
      }
    }
    return out;
  }

  animalsInChunk(key: string): Animal[] {
    return this.animalsByChunk.get(key) ?? [];
  }

  rebuildIndexes(): void {
    this.animalsByChunk.clear();
    this.animalsById.clear();
    for (const a of this.state.animals) {
      const key = chunkKey(Math.floor(a.x / CHUNK_SIZE), Math.floor(a.y / CHUNK_SIZE));
      let list = this.animalsByChunk.get(key);
      if (!list) this.animalsByChunk.set(key, (list = []));
      list.push(a);
      this.animalsById.set(a.id, a);
    }
    this.npcsById.clear();
    this.npcsBySettlement.clear();
    this.npcsByChunk.clear();
    for (const n of this.state.npcs) {
      this.npcsById.set(n.id, n);
      let list = this.npcsBySettlement.get(n.settlementId);
      if (!list) this.npcsBySettlement.set(n.settlementId, (list = []));
      list.push(n);
      const key = chunkKey(Math.floor(n.x / CHUNK_SIZE), Math.floor(n.y / CHUNK_SIZE));
      let cl = this.npcsByChunk.get(key);
      if (!cl) this.npcsByChunk.set(key, (cl = []));
      cl.push(n);
    }
    if (this.buildingsDirty) {
      this.buildingsDirty = false;
      this.buildingsById.clear();
      this.buildingsBySettlement.clear();
      for (const b of this.state.buildings) {
        this.buildingsById.set(b.id, b);
        let list = this.buildingsBySettlement.get(b.settlementId);
        if (!list) this.buildingsBySettlement.set(b.settlementId, (list = []));
        list.push(b);
      }
    }
  }

  /** Removes an animal (hunted, eaten by a predator...). */
  killAnimal(a: Animal, cause: string): void {
    const i = this.state.animals.indexOf(a);
    if (i < 0) return;
    this.state.animals.splice(i, 1);
    this.animalsById.delete(a.id);
    this.recordDeath(cause);
  }

  // ---------- People & settlements ----------

  npcById(id: number): Npc | undefined {
    return this.npcsById.get(id);
  }

  residentsOf(settlementId: number): Npc[] {
    return this.npcsBySettlement.get(settlementId) ?? [];
  }

  npcsInChunk(key: string): Npc[] {
    return this.npcsByChunk.get(key) ?? [];
  }

  settlement(id: number): Settlement | undefined {
    return this.state.settlements.find((s) => s.id === id);
  }

  building(id: number): Building | undefined {
    if (this.buildingsDirty) this.rebuildIndexes();
    return this.buildingsById.get(id);
  }

  buildingsOf(settlementId: number): Building[] {
    if (this.buildingsDirty) this.rebuildIndexes();
    return this.buildingsBySettlement.get(settlementId) ?? [];
  }

  markBuildingsChanged(_b?: Building): void {
    this.buildingsDirty = true;
    this.buildingsVersion++;
  }

  removeBuilding(b: Building): void {
    const i = this.state.buildings.indexOf(b);
    if (i >= 0) this.state.buildings.splice(i, 1);
    for (const n of this.state.npcs) if (n.homeId === b.id) n.homeId = -1;
    this.markBuildingsChanged(b);
  }

  removePlantAt(x: number, y: number): void {
    const c = this.chunkAtTile(x, y);
    if (c) removePlantOnTile(this, c, x, y);
  }

  reserve(targetId: number, npcId: number): void {
    this.reservations.set(targetId, npcId);
  }

  isReserved(targetId: number, npcId: number): boolean {
    const by = this.reservations.get(targetId);
    return by !== undefined && by !== npcId && this.npcsById.has(by);
  }

  release(targetId: number): void {
    this.reservations.delete(targetId);
  }

  releaseAll(npcId: number): void {
    for (const [t, by] of this.reservations) if (by === npcId) this.reservations.delete(t);
  }

  assignJobsFor(s: Settlement): void {
    this.rebuildIndexes();
    assignJobs(this, s);
  }

  /** How badly the settlement needs this job done right now (0..0.6). */
  settlementUrgency(settlementId: number, job: string): number {
    const s = this.settlement(settlementId);
    if (!s) return 0;
    const pop = this.residentsOf(settlementId).length;
    const foodDays = totalFood(s) / Math.max(1, pop);
    if (['forager', 'hunter', 'fisher', 'farmer'].includes(job)) return foodDays < 3 ? 0.6 : foodDays < 8 ? 0.3 : 0;
    if (job === 'builder') return this.buildingsOf(settlementId).some((b) => b.progress < 1) ? 0.3 : 0;
    if (job === 'healer') return this.residentsOf(settlementId).some((n) => n.illness) ? 0.4 : 0;
    return 0;
  }

  // ---------- Bookkeeping ----------

  newId(): number {
    return this.state.nextId++;
  }

  recordDeath(cause: string): void {
    const d = this.state.stats.deaths;
    d[cause] = (d[cause] ?? 0) + 1;
  }

  log(text: string, kind = 'world', about = -1): void {
    this.state.events.push({ time: this.state.time, text, kind, about });
    if (this.state.events.length > MAX_EVENTS) this.state.events.shift();
  }

  /** Counts for the stats panel. */
  census(): { population: Record<string, number>; plants: Record<string, number> } {
    const population: Record<string, number> = {};
    for (const a of this.state.animals) {
      const name = ANIMALS[a.species].name;
      population[name] = (population[name] ?? 0) + 1;
    }
    const plants: Record<string, number> = {};
    for (const c of this.state.chunks.values()) {
      for (const p of c.plants) {
        if (p.stage === PlantStage.Seed || p.stage === PlantStage.Dead) continue;
        const name = PLANTS[p.species].name;
        plants[name] = (plants[name] ?? 0) + 1;
      }
    }
    return { population, plants };
  }
}

/** True if a tile is next to water. (Salt vs fresh water isn't modelled yet.) */
function touchesFreshWater(biomes: Uint8Array, i: number): boolean {
  const x = i % CHUNK_SIZE;
  const y = (i / CHUNK_SIZE) | 0;
  const check = (nx: number, ny: number) => {
    if (nx < 0 || ny < 0 || nx >= CHUNK_SIZE || ny >= CHUNK_SIZE) return false;
    const b = biomes[ny * CHUNK_SIZE + nx];
    return b === Biome.River || b === Biome.Water;
  };
  return check(x - 1, y) || check(x + 1, y) || check(x, y - 1) || check(x, y + 1);
}
