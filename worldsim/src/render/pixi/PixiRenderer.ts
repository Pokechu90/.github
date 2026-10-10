/**
 * The 2D renderer, built on PixiJS (WebGL).
 *
 * It only *draws* what the simulation reports in snapshots. It keeps its own
 * lightweight copies (sprites), interpolates animal movement between
 * snapshots so motion looks smooth, and recolours the land with the seasons.
 */
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { CHUNK_SIZE, chunkKey } from '../../shared/terrain';
import { PLANTS, PlantStage } from '../../shared/species';
import { getCalendar, seasonTempOffset } from '../../shared/time';
import type { AnimalView, BuildingView, ChunkTerrainView, NpcView, PlantView, SelectTarget, Snapshot } from '../../shared/protocol';
import { BUILDINGS } from '../../shared/people';
import { Camera } from '../camera';
import type { TileInfo, WorldRenderer } from '../renderer';
import { paintChunk } from '../palette';
import { SpriteTextures, UNITS_PER_TILE, makeLightTexture, type Baked, type LeafState } from './textures';
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

interface PersonGfx {
  view: NpcView;
  root: Container;
  body: Sprite;
  carry: Sprite;
  label: Text | null;
  bodyKey: string;
  x: number;
  y: number;
}

interface BuildingGfx {
  view: BuildingView;
  sprite: Sprite;
  key: string;
  flame?: Sprite;
  light?: Sprite;
}

/** People's names appear above them when zoomed in this far. */
const NAME_ZOOM = 22;

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

  private lightLayer = new Container();
  private labelLayer = new Container();
  private lightTexture!: Texture;
  private chunks = new Map<string, ChunkGfx>();
  private animals = new Map<number, AnimalGfx>();
  private people = new Map<number, PersonGfx>();
  private buildings = new Map<number, BuildingGfx>();
  private townLabels = new Map<number, Text>();
  private time = 0;
  private rockets: { sprite: Sprite; flame: Sprite; t: number; x: number; y: number }[] = [];
  private launchesSeen = new Set<string>();
  /** Id of the person the camera follows, if any. */
  follow: number | null = null;
  private snap: Snapshot | null = null;
  private detailShown = true;
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
    this.lightTexture = Texture.from(makeLightTexture());
    this.lightLayer.blendMode = 'add';
    this.app.stage.addChild(this.worldLayer, this.atmosphere.back, this.lightLayer, this.labelLayer, this.atmosphere.front);

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

    for (const [x, y] of snap.launches) {
      const key = `${x.toFixed(1)},${y.toFixed(1)},${Math.floor(snap.time / 1440)}`;
      if (this.launchesSeen.has(key)) continue;
      this.launchesSeen.add(key);
      this.launchRocket(x, y);
    }
    this.syncPeople(snap.npcs);
    if (snap.buildings) this.syncBuildings(snap.buildings);
    this.syncTownLabels(snap);
  }

  /** A rocket lifts off from a launch pad (purely visual). */
  private launchRocket(x: number, y: number): void {
    const g = new Graphics();
    g.rect(-3, -40, 6, 40).fill(0xf0f0f0);
    g.poly([-3, -40, 3, -40, 0, -50]).fill(0xd03030);
    g.poly([-3, -6, -7, 0, -3, 0]).fill(0x888888);
    g.poly([3, -6, 7, 0, 3, 0]).fill(0x888888);
    const sprite = new Sprite(this.app.renderer.generateTexture({ target: g, resolution: 4 }));
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(1 / UNITS_PER_TILE);
    const flame = new Sprite();
    this.applyBaked(flame, this.textures.flame(), 2);
    flame.rotation = Math.PI;
    this.worldLayer.addChild(flame, sprite);
    this.rockets.push({ sprite, flame, t: 0, x, y: y - 0.4 });
  }

  private updateRockets(deltaMS: number): void {
    for (const r of this.rockets) {
      r.t += deltaMS / 1000;
      const rise = r.t * r.t * 6; // accelerating upwards (tiles)
      r.sprite.position.set(r.x, r.y - rise);
      r.flame.position.set(r.x, r.y - rise + 0.05);
      r.flame.scale.y = (-(1.5 + Math.sin(r.t * 40) * 0.4)) / UNITS_PER_TILE * 2;
    }
    for (const r of this.rockets.filter((x) => x.t > 6)) {
      r.sprite.destroy({ texture: true });
      r.flame.destroy();
    }
    this.rockets = this.rockets.filter((x) => x.t <= 6);
  }

  private syncPeople(npcs: NpcView[]): void {
    const seen = new Set<number>();
    for (const v of npcs) {
      seen.add(v.id);
      let g = this.people.get(v.id);
      if (!g) {
        const root = new Container();
        const body = new Sprite();
        const carry = new Sprite();
        root.addChild(body, carry);
        this.objectLayer.addChild(root);
        g = { view: v, root, body, carry, label: null, bodyKey: '', x: v.x, y: v.y };
        this.people.set(v.id, g);
      }
      if (Math.hypot(v.x - g.x, v.y - g.y) > 6) {
        g.x = v.x;
        g.y = v.y;
      }
      g.view = v;
      const lying = v.action === 'sleep' || (v.action === 'rest' && v.sick);
      const key = `${v.skin}:${v.hair}:${v.shirt}:${v.sex}:${v.stage}:${lying}`;
      if (key !== g.bodyKey) {
        g.bodyKey = key;
        this.applyBaked(g.body, this.textures.person(v.skin, v.hair, v.shirt, v.sex, v.stage, lying), 1);
      }
      g.body.scale.x = Math.abs(g.body.scale.x) * v.facing;
      g.body.tint = v.sick ? 0xc8e0b0 : 0xffffff;
      g.root.visible = !v.hidden;
      if (v.carrying && !lying) {
        const b = this.textures.carry(v.carrying);
        this.applyBaked(g.carry, b, 1);
        g.carry.position.set(0.22 * v.facing, -0.42);
        g.carry.visible = true;
      } else {
        g.carry.visible = false;
      }
    }
    for (const [id, g] of this.people) {
      if (!seen.has(id)) {
        g.root.destroy({ children: true });
        g.label?.destroy();
        this.people.delete(id);
      }
    }
  }

  private syncBuildings(list: BuildingView[]): void {
    const seen = new Set<number>();
    for (const v of list) {
      seen.add(v.id);
      let g = this.buildings.get(v.id);
      if (!g) {
        const sprite = new Sprite();
        sprite.position.set(v.x, v.y);
        this.objectLayer.addChild(sprite);
        g = { view: v, sprite, key: '' };
        this.buildings.set(v.id, g);
        if (v.kind === 'campfire') {
          g.flame = new Sprite();
          this.applyBaked(g.flame, this.textures.flame(), 1);
          g.flame.position.set(v.x, v.y - 0.1);
          g.flame.zIndex = v.y + 0.01;
          this.objectLayer.addChild(g.flame);
        }
        if (v.kind === 'campfire' || v.kind === 'house' || v.kind === 'hut' || v.kind === 'smithy') {
          g.light = new Sprite(this.lightTexture);
          g.light.anchor.set(0.5);
          const r = v.kind === 'campfire' ? 9 : 4;
          g.light.width = g.light.height = r;
          g.light.position.set(v.x, v.y - 0.3);
          this.lightLayer.addChild(g.light);
        }
      }
      g.view = v;
      const site = v.progress < 1;
      const key = v.kind === 'farm' ? `farm:${Math.min(4, Math.floor(v.crop * 5))}` : `${v.kind}:${site}`;
      if (key !== g.key) {
        g.key = key;
        const baked = v.kind === 'farm' ? this.textures.field(Math.min(4, Math.floor(v.crop * 5))) : this.textures.building(v.kind, site);
        this.applyBaked(g.sprite, baked, 1);
      }
      g.sprite.alpha = site ? 0.55 + v.progress * 0.45 : 1;
      // Fields lie flat under everything else.
      g.sprite.zIndex = v.kind === 'farm' ? -1e6 : v.y;
    }
    for (const [id, g] of this.buildings) {
      if (!seen.has(id)) {
        g.sprite.destroy();
        g.flame?.destroy();
        g.light?.destroy();
        this.buildings.delete(id);
      }
    }
  }

  private syncTownLabels(snap: Snapshot): void {
    const seen = new Set<number>();
    for (const s of snap.settlements) {
      seen.add(s.id);
      let t = this.townLabels.get(s.id);
      if (!t) {
        t = new Text({
          text: '',
          style: { fontFamily: 'system-ui, sans-serif', fontSize: 14, fontWeight: '600', fill: 0xffffff, stroke: { color: 0x0b1020, width: 4 } },
          resolution: 2,
        });
        t.anchor.set(0.5, 1);
        this.labelLayer.addChild(t);
        this.townLabels.set(s.id, t);
      }
      t.text = `${s.name} · ${s.tier} · ${s.population}`;
      (t as Text & { wx?: number; wy?: number }).wx = s.x;
      (t as Text & { wx?: number; wy?: number }).wy = s.y;
    }
    for (const [id, t] of this.townLabels) {
      if (!seen.has(id)) {
        t.destroy();
        this.townLabels.delete(id);
      }
    }
  }

  pick(sx: number, sy: number): SelectTarget | null {
    const p = this.camera.screenToWorld(sx, sy);
    if (!this.wantsDetail()) {
      // Zoomed out: clicking a town label selects nothing but recentres there.
      for (const s of this.snap?.settlements ?? []) {
        if (Math.hypot(s.x - p.x, s.y - p.y) < 30 / this.camera.zoom + 4) return { kind: 'settlement', id: s.id };
      }
      return null;
    }
    let best: SelectTarget | null = null;
    let bestD = 0.9;
    for (const [id, g] of this.people) {
      if (!g.root.visible) continue;
      const d = Math.hypot(g.x - p.x, g.y - 0.6 - p.y);
      if (d < bestD) {
        bestD = d;
        best = { kind: 'npc', id };
      }
    }
    if (best) return best;
    bestD = 1.1;
    for (const [id, g] of this.animals) {
      const d = Math.hypot(g.x - p.x, g.y - 0.5 - p.y);
      if (d < bestD) {
        bestD = d;
        best = { kind: 'animal', id };
      }
    }
    if (best) return best;
    for (const [id, g] of this.buildings) {
      const size = BUILDINGS[g.view.kind]?.size ?? 1;
      const dx = Math.abs(g.view.x - p.x);
      const dy = g.view.y - p.y;
      if (g.view.kind === 'farm' ? dx < 1.5 && Math.abs(dy) < 1.5 : dx < 0.6 + size * 0.4 && dy > -0.3 && dy < 1.2 + size * 0.5) {
        return { kind: 'building', id };
      }
    }
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
    this.time += deltaMS;
    cam.resize(this.app.screen.width, this.app.screen.height);
    const followed = this.follow !== null ? this.people.get(this.follow) : undefined;
    if (followed) cam.centerOn(cam.x + (followed.x - cam.x) * 0.15, cam.y + (followed.y - 0.5 - cam.y) * 0.15);
    for (const layer of [this.worldLayer, this.lightLayer]) {
      layer.scale.set(cam.zoom);
      layer.position.set(Math.round(cam.width / 2 - cam.x * cam.zoom), Math.round(cam.height / 2 - cam.y * cam.zoom));
    }

    const detail = this.wantsDetail();
    if (!detail && this.detailShown) this.clearObjects();
    this.detailShown = detail;

    // People walk smoothly between snapshots.
    const kp = Math.min(1, deltaMS / 90);
    const showNames = cam.zoom >= NAME_ZOOM;
    for (const g of this.people.values()) {
      g.x += (g.view.x - g.x) * kp;
      g.y += (g.view.y - g.y) * kp;
      g.root.position.set(g.x, g.y);
      g.root.zIndex = g.y + 0.001;
      if (showNames && g.root.visible && g.view.stage !== 'baby') {
        if (!g.label) {
          g.label = new Text({ text: g.view.name, style: { fontFamily: 'system-ui, sans-serif', fontSize: 11, fill: 0xffffff, stroke: { color: 0x000000, width: 3 } }, resolution: 2 });
          g.label.anchor.set(0.5, 1);
          this.labelLayer.addChild(g.label);
        }
        g.label.visible = true;
        g.label.position.set((g.x - cam.x) * cam.zoom + cam.width / 2, (g.y - (g.view.stage === 'child' ? 0.95 : 1.3) - cam.y) * cam.zoom + cam.height / 2);
      } else if (g.label) {
        g.label.visible = false;
      }
    }
    // Town names when zoomed out.
    for (const t of this.townLabels.values()) {
      const w = t as Text & { wx?: number; wy?: number };
      t.visible = cam.zoom < 14;
      t.position.set(((w.wx ?? 0) - cam.x) * cam.zoom + cam.width / 2, ((w.wy ?? 0) - 2 - cam.y) * cam.zoom + cam.height / 2);
    }
    // Firelight flickers at night.
    const dark = this.atmosphere.darkness;
    this.lightLayer.visible = dark > 0.05;
    for (const g of this.buildings.values()) {
      if (g.flame) {
        const f = 0.85 + Math.sin(this.time / 90 + g.view.id) * 0.1 + Math.sin(this.time / 37 + g.view.id * 3) * 0.06;
        g.flame.scale.set(f / UNITS_PER_TILE, (f + 0.1) / UNITS_PER_TILE);
      }
      if (g.light) {
        const lit = g.view.kind === 'campfire' ? 0.9 : g.view.progress >= 1 ? 0.45 : 0;
        g.light.alpha = dark * lit * (0.85 + Math.sin(this.time / 120 + g.view.id) * 0.1);
      }
    }

    // Smoothly move animals towards their latest reported positions.
    const k = Math.min(1, deltaMS / 90);
    for (const g of this.animals.values()) {
      g.x += (g.view.x - g.x) * k;
      g.y += (g.view.y - g.y) * k;
      g.sprite.position.set(g.x, g.y);
      g.sprite.zIndex = g.y;
    }

    this.repaintStaleChunks();
    this.updateRockets(deltaMS);
    this.drawMarker();
    if (this.snap) this.atmosphere.update(this.snap, cam.width, cam.height, deltaMS);
  }

  private drawMarker(): void {
    this.marker.clear();
    const sel = this.snap?.selected;
    if (!sel || sel.kind === 'gone' || !this.wantsDetail()) return;
    let x = sel.x;
    let y = sel.y;
    if (sel.kind === 'npc') {
      const g = this.people.get(sel.id);
      if (g) {
        x = g.x;
        y = g.y;
      }
    } else if (sel.kind === 'building') {
      y += 0.1;
    } else if (sel.kind === 'animal') {
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

  /** Forget everything drawn (e.g. after loading another world). */
  reset(): void {
    this.clearObjects();
    for (const key of [...this.chunks.keys()]) this.dropChunk(key);
    for (const g of this.buildings.values()) {
      g.sprite.destroy();
      g.flame?.destroy();
      g.light?.destroy();
    }
    this.buildings.clear();
    for (const t of this.townLabels.values()) t.destroy();
    this.townLabels.clear();
    this.follow = null;
  }

  private clearObjects(): void {
    for (const c of this.chunks.values()) {
      for (const pg of c.plants.values()) pg.sprite.destroy();
      c.plants.clear();
    }
    for (const g of this.animals.values()) g.sprite.destroy();
    this.animals.clear();
    for (const g of this.people.values()) {
      g.root.destroy({ children: true });
      g.label?.destroy();
    }
    this.people.clear();
  }

  private updateSeason(time: number): void {
    this.season = getCalendar(time).season;
    // Round to 2°C steps so the land is only repainted a few times per season.
    this.seasonTemp = Math.round(seasonTempOffset(time) / 2) * 2;
    this.seasonKey = `${this.season}:${this.seasonTemp}`;
  }
}
