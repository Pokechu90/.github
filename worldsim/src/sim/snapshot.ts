/**
 * Decides what the page needs to see and packages it into a Snapshot.
 *
 * The world can be huge; the page only ever receives the chunks around the
 * camera. Terrain is sent once per chunk, plants only when they visibly
 * change, and animals (which move) every snapshot.
 */
import { CHUNK_SIZE, chunkKey } from '../shared/terrain';
import { ANIMALS, PLANTS, PLANT_STAGE_NAMES } from '../shared/species';
import { DAYS_PER_YEAR } from '../shared/time';
import type { ChunkView, SelectTarget, SelectedInfo, Snapshot } from '../shared/protocol';
import { fruitLevel } from './ecology/plants';
import type { World } from './world';

/** Chunks of margin kept loaded around the visible area. */
const MARGIN = 1;
/** Cap on chunk payloads per snapshot, so messages stay small. */
const MAX_CHUNKS_PER_SNAPSHOT = 24;

export interface Viewport {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  detail: boolean;
}

export class ViewTracker {
  private viewport: Viewport = { x0: 0, y0: 0, x1: 0, y1: 0, detail: true };
  private sentTerrain = new Set<string>();
  private sentPlants = new Map<string, number>();
  selected: SelectTarget | null = null;

  setViewport(v: Viewport): void {
    if (!v.detail) this.sentPlants.clear();
    this.viewport = v;
  }

  /** Visible chunk coordinates, nearest to the centre of the screen first. */
  visibleChunks(): [number, number][] {
    const v = this.viewport;
    const cx0 = Math.floor(v.x0 / CHUNK_SIZE) - MARGIN;
    const cy0 = Math.floor(v.y0 / CHUNK_SIZE) - MARGIN;
    const cx1 = Math.floor(v.x1 / CHUNK_SIZE) + MARGIN;
    const cy1 = Math.floor(v.y1 / CHUNK_SIZE) + MARGIN;
    const mx = (cx0 + cx1) / 2;
    const my = (cy0 + cy1) / 2;
    const out: [number, number][] = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) out.push([cx, cy]);
    out.sort((a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my));
    return out;
  }

  /** Generates missing visible chunks, nearest first, within a time budget. */
  generateVisible(world: World, budgetMs: number): void {
    const start = performance.now();
    for (const [cx, cy] of this.visibleChunks()) {
      if (world.getChunk(cx, cy)) continue;
      world.ensureChunk(cx, cy);
      if (performance.now() - start > budgetMs) break;
    }
  }

  build(world: World, speed: number, simMs: number, lagging: boolean): Snapshot {
    const visible = this.visibleChunks();
    const visibleKeys = new Set(visible.map(([cx, cy]) => chunkKey(cx, cy)));
    const chunks: ChunkView[] = [];

    for (const [cx, cy] of visible) {
      if (chunks.length >= MAX_CHUNKS_PER_SNAPSHOT) break;
      const chunk = world.getChunk(cx, cy);
      if (!chunk) continue;
      const needTerrain = !this.sentTerrain.has(chunk.key);
      const needPlants = this.viewport.detail && this.sentPlants.get(chunk.key) !== chunk.version;
      if (!needTerrain && !needPlants) continue;

      const view: ChunkView = { key: chunk.key, cx, cy };
      if (needTerrain) {
        const t = chunk.terrain;
        view.terrain = { biomes: t.biomes, heights: t.heights, temps: t.temps };
        this.sentTerrain.add(chunk.key);
      }
      if (needPlants) {
        view.plants = chunk.plants
          .filter((p) => p.stage !== 0)
          .map((p) => ({
            id: p.id,
            x: p.x,
            y: p.y,
            species: p.species,
            stage: p.stage,
            fruit: fruitLevel(PLANTS[p.species], p),
          }));
        this.sentPlants.set(chunk.key, chunk.version);
      }
      chunks.push(view);
    }

    const dropped: string[] = [];
    for (const key of this.sentTerrain) {
      if (!visibleKeys.has(key)) {
        dropped.push(key);
        this.sentTerrain.delete(key);
        this.sentPlants.delete(key);
      }
    }

    const animals: Snapshot['animals'] = [];
    if (this.viewport.detail) {
      for (const key of visibleKeys) {
        for (const a of world.animalsInChunk(key)) {
          animals.push({
            id: a.id,
            species: a.species,
            x: a.x,
            y: a.y,
            action: a.action,
            young: a.ageDays < ANIMALS[a.species].adultYears * DAYS_PER_YEAR * 0.5,
            facing: a.facing,
          });
        }
      }
    }

    const v = this.viewport;
    const census = world.census();
    const s = world.state;
    return {
      time: s.time,
      speed,
      simMs,
      lagging,
      weather: world.weatherAt((v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2),
      chunks,
      dropped,
      animals,
      selected: this.describeSelected(world),
      stats: {
        population: census.population,
        plants: census.plants,
        births: s.stats.births,
        deaths: { ...s.stats.deaths },
        chunksLoaded: s.chunks.size,
        history: s.stats.history.slice(),
      },
      events: s.events.slice(-8),
    };
  }

  private describeSelected(world: World): SelectedInfo | null {
    const sel = this.selected;
    if (!sel) return null;
    if (sel.kind === 'animal') {
      const a = world.animalById(sel.id);
      if (!a) return { kind: 'gone', text: 'This animal has died.' };
      const sp = ANIMALS[a.species];
      const ageYears = a.ageDays / DAYS_PER_YEAR;
      const notes: string[] = [];
      if (a.pregnantDays >= 0) notes.push(`Pregnant (${Math.round(a.pregnantDays)} of ${sp.gestationDays} days)`);
      if (ageYears < sp.adultYears) notes.push('Still growing up');
      if (a.waterX >= 0) notes.push(`Remembers water at (${Math.round(a.waterX)}, ${Math.round(a.waterY)})`);
      return {
        kind: 'animal',
        id: a.id,
        x: a.x,
        y: a.y,
        title: `${sp.name} #${a.id}`,
        sex: a.sex,
        ageYears,
        action: a.action === 'walk' ? `walking (${a.purpose})` : a.action,
        needs: [
          { label: 'Hunger', value: a.hunger },
          { label: 'Thirst', value: a.thirst },
          { label: 'Tiredness', value: a.tiredness },
          { label: 'Health', value: a.health },
        ],
        notes,
      };
    }
    const chunk = world.state.chunks.get(sel.chunk);
    const p = chunk?.plants.find((q) => q.id === sel.id);
    if (!p) return { kind: 'gone', text: 'This plant is gone.' };
    const sp = PLANTS[p.species];
    const notes: string[] = [];
    if (sp.fruit) notes.push(`Bears ${sp.fruit.name} (${Math.floor(p.fruit)}/${sp.fruit.max} ripe)`);
    if (p.health < 0.7) notes.push('Damaged by frost');
    return {
      kind: 'plant',
      id: p.id,
      x: p.x,
      y: p.y,
      title: sp.name,
      ageYears: p.ageDays / DAYS_PER_YEAR,
      stage: PLANT_STAGE_NAMES[p.stage],
      fruit: p.fruit,
      notes,
    };
  }
}
