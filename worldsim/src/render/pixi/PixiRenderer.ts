/**
 * The 2D renderer, built on PixiJS (WebGL).
 *
 * It only *draws* what the simulation reports in snapshots. It keeps its own
 * lightweight copies (sprites), interpolates animal movement between
 * snapshots so motion looks smooth, and recolours the land with the seasons.
 */
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { CHUNK_SIZE, chunkKey } from '../../shared/terrain';
import { PLANTS, PlantStage } from '../../shared/species';
import { getCalendar, seasonTempOffset } from '../../shared/time';
import type { AnimalView, ChunkTerrainView, PlantView, SelectTarget, Snapshot } from '../../shared/protocol';
import { Camera } from '../camera';
import type { TileInfo, WorldRenderer } from '../renderer';
import { paintChunk } from '../palette';
import { SpriteTextures, UNITS_PER_TILE, type Baked, type LeafState } from './textures';
import { Atmosphere } from './atmosphere';

/** Below this zoom (pixels per tile) we only draw terrain: faster and cleaner. */
const DETAIL_ZOOM = 6;
/** How many chunk textures may be repainted per frame (avoids stutters). */
const REPAINTS_PER_FRAME = 3;

const STAGE_SCALE: Record<number, number> = {
  [PlantStage.Sprout]: 0.35,
  [PlantStage.Young]: 0.65,
  [PlantStage.Mature]: 1,
  [PlantStage.Old]: 1.05,
  [PlantStage.Dead]: 0.95,
};

interface PlantGfx {
  view: PlantView;
  sprite: Sprite;
  key: string;
}

interface ChunkGfx {
  key: string;
  cx: number;
  cy: number;
  terrain: ChunkTerrainView;
  sprite: Sprite;
  paintedFor: string;
  plants: Map<number, PlantGfx>;
}

interface AnimalGfx {
  view: AnimalView;
  sprite: Sprite;
  x: number;
  y: number;
}

export class PixiRenderer implements WorldRenderer {
  readonly camera = new Camera();
  view!: HTMLElement;

  private app = new Application();
  private worldLayer = new Container();
  private terrainLayer = new Container();
  private objectLayer = new Container();
  private marker = new Graphics();
  private atmosphere!: Atmosphere;
  private textures!: SpriteTextures;

  private chunks = new Map<string, ChunkGfx>();
  private animals = new Map<number, AnimalGfx>();
  private snap: Snapshot | null = null;
  private seasonKey = '';
  private season = 0;
  private seasonTemp = 0;

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      background: '#0b1020',
      antialias: false,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
    });
    host.appendChild(this.app.canvas);
    this.view = this.app.canvas;
    this.textures = new SpriteTextures(this.app.renderer);

    this.objectLayer.sortableChildren = true;
    this.worldLayer.addChild(this.terrainLayer, this.marker, this.objectLayer);
    this.atmosphere = new Atmosphere();
    this.app.stage.addChild(this.worldLayer, this.atmosphere.container);

    this.app.ticker.add((t) => this.frame(t.deltaMS));
  }

  wantsDetail(): boolean {
    return this.camera.zoom >= DETAIL_ZOOM;
  }

  applySnapshot(snap: Snapshot): void {
    this.snap = snap;
    this.updateSeason(snap.time);

    for (const key of snap.dropped) this.dropChunk(key);
    for (const cv of snap.chunks) {
      let c = this.chunks.get(cv.key);
      if (!c && cv.terrain) c = this.addChunk(cv.key, cv.cx, cv.cy, cv.terrain);
      if (c && cv.plants) this.syncPlants(c, cv.plants);
    }

    // Animals: create, update targets, remove the ones no longer reported.
    const seen = new Set<number>();
    for (const a of snap.animals) {
      seen.add(a.id);
      let g = this.animals.get(a.id);
      if (!g) {
        const sprite = new Sprite();
        this.objectLayer.addChild(sprite);
        g = { view: a, sprite, x: a.x, y: a.y };
        this.animals.set(a.id, g);
      }
      // Teleport rather than glide if it moved very far (e.g. at high speed).
      if (Math.hypot(a.x - g.x, a.y - g.y) > 6) {
        g.x = a.x;
        g.y = a.y;
      }
      g.view = a;
      this.applyBaked(g.sprite, this.textures.deer(a.young, a.action === 'sleep'), 1);
      g.sprite.scale.x = Math.abs(g.sprite.scale.x) * a.facing;
    }
    for (const [id, g] of this.animals) {
      if (!seen.has(id)) {
        g.sprite.destroy();
        this.animals.delete(id);
      }
    }
  }

  pick(sx: number, sy: number): SelectTarget | null {
    if (!this.wantsDetail()) return null;
    const p = this.camera.screenToWorld(sx, sy);
    let best: SelectTarget | null = null;
    let bestD = 1.1;
    for (const [id, g] of this.animals) {
      const d = Math.hypot(g.x - p.x, g.y - 0.5 - p.y);
      if (d < bestD) {
        bestD = d;
        best = { kind: 'animal', id };
      }
    }
    if (best) return best;
    bestD = 1.2;
    const c = this.chunks.get(chunkKey(Math.floor(p.x / CHUNK_SIZE), Math.floor(p.y / CHUNK_SIZE)));
    for (const chunk of c ? [c, ...this.neighbours(c)] : []) {
      for (const pg of chunk.plants.values()) {
        const tall = PLANTS[pg.view.species].isTree ? 1.6 : 0.6;
        const dx = pg.view.x + 0.5 - p.x;
        const dy = pg.view.y + 0.8 - tall / 2 - p.y;
        const d = Math.hypot(dx, dy * 0.7);
        if (d < bestD) {
          bestD = d;
          best = { kind: 'plant', id: pg.view.id, chunk: chunk.key };
        }
      }
    }
    return best;
  }

  tileAt(sx: number, sy: number): TileInfo | null {
    const p = this.camera.screenToWorld(sx, sy);
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    const c = this.chunks.get(chunkKey(Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE)));
    if (!c) return null;
    const i = (y - c.cy * CHUNK_SIZE) * CHUNK_SIZE + (x - c.cx * CHUNK_SIZE);
    return { x, y, biome: c.terrain.biomes[i], tempC: c.terrain.temps[i] + this.seasonTemp };
  }

  // ---------- per frame ----------

  private frame(deltaMS: number): void {
    const cam = this.camera;
    cam.resize(this.app.screen.width, this.app.screen.height);
    this.worldLayer.scale.set(cam.zoom);
    this.worldLayer.position.set(
      Math.round(cam.width / 2 - cam.x * cam.zoom),
      Math.round(cam.height / 2 - cam.y * cam.zoom),
    );

    const detail = this.wantsDetail();
    if (!detail && this.objectLayer.visible) this.clearObjects();
    this.objectLayer.visible = detail;

    // Smoothly move animals towards their latest reported positions.
    const k = Math.min(1, deltaMS / 90);
    for (const g of this.animals.values()) {
      g.x += (g.view.x - g.x) * k;
      g.y += (g.view.y - g.y) * k;
      g.sprite.position.set(g.x, g.y);
      g.sprite.zIndex = g.y;
    }

    this.repaintStaleChunks();
    this.drawMarker();
    if (this.snap) this.atmosphere.update(this.snap, cam.width, cam.height, deltaMS);
  }

  private drawMarker(): void {
    this.marker.clear();
    const sel = this.snap?.selected;
    if (!sel || sel.kind === 'gone' || !this.wantsDetail()) return;
    let x = sel.x;
    let y = sel.y;
    if (sel.kind === 'animal') {
      const g = this.animals.get(sel.id);
      if (g) {
        x = g.x;
        y = g.y;
      }
    } else {
      x += 0.5;
      y += 0.8;
    }
    this.marker
      .ellipse(x, y, 0.9, 0.4)
      .stroke({ width: 2 / this.camera.zoom, color: 0xffe066, alpha: 0.95 });
  }

  // ---------- chunks & terrain ----------

  private addChunk(key: string, cx: number, cy: number, terrain: ChunkTerrainView): ChunkGfx {
    const sprite = new Sprite(Texture.EMPTY);
    sprite.position.set(cx * CHUNK_SIZE, cy * CHUNK_SIZE);
    this.terrainLayer.addChild(sprite);
    const c: ChunkGfx = { key, cx, cy, terrain, sprite, paintedFor: '', plants: new Map() };
    this.chunks.set(key, c);
    this.paintChunk(c);
    return c;
  }

  private paintChunk(c: ChunkGfx): void {
    const canvas = paintChunk(
      c.terrain.biomes, c.terrain.heights, c.terrain.temps, c.cx, c.cy, this.season, this.seasonTemp,
    );
    const old = c.sprite.texture;
    const tex = Texture.from(canvas);
    tex.source.scaleMode = 'nearest';
    c.sprite.texture = tex;
    // A hair larger than the chunk to hide seams between neighbours.
    c.sprite.width = CHUNK_SIZE + 0.02;
    c.sprite.height = CHUNK_SIZE + 0.02;
    if (old !== Texture.EMPTY) old.destroy(true);
    c.paintedFor = this.seasonKey;
  }

  private repaintStaleChunks(): void {
    let budget = REPAINTS_PER_FRAME;
    for (const c of this.chunks.values()) {
      if (c.paintedFor === this.seasonKey) continue;
      this.paintChunk(c);
      for (const pg of c.plants.values()) this.updatePlantSprite(c, pg);
      if (--budget <= 0) break;
    }
  }

  private dropChunk(key: string): void {
    const c = this.chunks.get(key);
    if (!c) return;
    for (const pg of c.plants.values()) pg.sprite.destroy();
    c.sprite.texture.destroy(true);
    c.sprite.destroy();
    this.chunks.delete(key);
  }

  private neighbours(c: ChunkGfx): ChunkGfx[] {
    const out: ChunkGfx[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const n = this.chunks.get(chunkKey(c.cx + dx, c.cy + dy));
        if (n) out.push(n);
      }
    }
    return out;
  }

  // ---------- plants ----------

  private syncPlants(c: ChunkGfx, plants: PlantView[]): void {
    const seen = new Set<number>();
    for (const v of plants) {
      seen.add(v.id);
      let pg = c.plants.get(v.id);
      if (!pg) {
        const sprite = new Sprite();
        sprite.position.set(v.x + 0.5, v.y + 0.8);
        sprite.zIndex = v.y + 0.8;
        this.objectLayer.addChild(sprite);
        pg = { view: v, sprite, key: '' };
        c.plants.set(v.id, pg);
      }
      pg.view = v;
      this.updatePlantSprite(c, pg);
    }
    for (const [id, pg] of c.plants) {
      if (!seen.has(id)) {
        pg.sprite.destroy();
        c.plants.delete(id);
      }
    }
  }

  private updatePlantSprite(c: ChunkGfx, pg: PlantGfx): void {
    const v = pg.view;
    const sp = PLANTS[v.species];
    const i = (v.y - c.cy * CHUNK_SIZE) * CHUNK_SIZE + (v.x - c.cx * CHUNK_SIZE);
    const temp = c.terrain.temps[i] + this.seasonTemp;
    let leaves: LeafState = 'summer';
    if (sp.deciduous) {
      if (this.season === 3 && temp < 8) leaves = 'bare';
      else if (this.season === 2 && temp < 22) leaves = 'autumn';
      else if (this.season === 0) leaves = 'spring';
    } else if (this.season === 0) {
      leaves = 'spring';
    }
    const dead = v.stage === PlantStage.Dead;
    const fruit = v.fruit >= 2;
    const snowy = temp < -1;
    const key = `${leaves}:${dead}:${fruit}:${snowy}:${v.stage}`;
    if (key === pg.key) return;
    pg.key = key;
    // Tiny per-plant size variation so forests don't look copy-pasted.
    const variation = 0.9 + ((v.id * 2654435761) % 1000) / 5000;
    this.applyBaked(pg.sprite, this.textures.plant(v.species, leaves, fruit, dead, snowy), (STAGE_SCALE[v.stage] ?? 1) * variation);
  }

  private applyBaked(sprite: Sprite, baked: Baked, scale: number): void {
    if (sprite.texture !== baked.texture) {
      sprite.texture = baked.texture;
      sprite.anchor.set(baked.ax, baked.ay);
    }
    const s = scale / UNITS_PER_TILE;
    sprite.scale.set(Math.sign(sprite.scale.x || 1) * s, s);
  }

  private clearObjects(): void {
    for (const c of this.chunks.values()) {
      for (const pg of c.plants.values()) pg.sprite.destroy();
      c.plants.clear();
    }
    for (const g of this.animals.values()) g.sprite.destroy();
    this.animals.clear();
  }

  private updateSeason(time: number): void {
    this.season = getCalendar(time).season;
    // Round to 2°C steps so the land is only repainted a few times per season.
    this.seasonTemp = Math.round(seasonTempOffset(time) / 2) * 2;
    this.seasonKey = `${this.season}:${this.seasonTemp}`;
  }
}
