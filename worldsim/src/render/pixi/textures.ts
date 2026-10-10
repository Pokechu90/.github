/**
 * Procedurally drawn sprites for plants and animals, so there are no image
 * files to manage. Each picture is drawn once with vector shapes, then baked
 * into a texture and reused by thousands of sprites.
 *
 * Sizes are in "tile pixels": 16 units = one tile. Anchors are at the base
 * (where the plant meets the ground / the animal's feet).
 */
import { Graphics, type Renderer, type Texture } from 'pixi.js';
import { PLANTS } from '../../shared/species';

export const UNITS_PER_TILE = 16;

export type LeafState = 'spring' | 'summer' | 'autumn' | 'bare';

const LEAVES: Record<LeafState, number[]> = {
  spring: [0x5fae45, 0x7cc95a, 0x98dc74],
  summer: [0x2f7d2c, 0x3f9637, 0x58ad48],
  autumn: [0xb4541f, 0xd98a2b, 0xe8b33f],
  bare: [0x6b5a48, 0x7b6a58, 0x8a7a68],
};

/** A baked picture plus where its ground point sits (as a 0..1 anchor). */
export interface Baked {
  texture: Texture;
  ax: number;
  ay: number;
}

export class SpriteTextures {
  private cache = new Map<string, Baked>();

  constructor(private renderer: Renderer) {}

  plant(species: number, leaves: LeafState, fruit: boolean, dead: boolean, snowy: boolean): Baked {
    const key = `p${species}:${leaves}:${fruit}:${dead}:${snowy}`;
    return this.get(key, (g) => drawPlant(g, PLANTS[species].shape, leaves, fruit, dead, snowy));
  }

  deer(young: boolean, sleeping: boolean): Baked {
    return this.get(`deer:${young}:${sleeping}`, (g) => drawDeer(g, young, sleeping));
  }

  person(skin: number, hair: number, shirt: number, sex: string, stage: string, lying: boolean): Baked {
    return this.get(`person:${skin}:${hair}:${shirt}:${sex}:${stage}:${lying}`, (g) => drawPerson(g, skin, hair, shirt, sex, stage, lying));
  }

  carry(type: string): Baked {
    return this.get(`carry:${type}`, (g) => drawCarry(g, type));
  }

  flame(): Baked {
    return this.get('flame', (g) => drawFlame(g));
  }

  building(kind: string, site: boolean): Baked {
    return this.get(`building:${kind}:${site}`, (g) => drawBuilding(g, kind, site));
  }

  field(stage: number): Baked {
    return this.get(`field:${stage}`, (g) => drawField(g, stage));
  }

  private get(key: string, draw: (g: Graphics) => void): Baked {
    let baked = this.cache.get(key);
    if (!baked) {
      const g = new Graphics();
      draw(g);
      const b = g.getLocalBounds();
      const texture = this.renderer.generateTexture({ target: g, resolution: 4, antialias: true });
      baked = { texture, ax: -b.minX / b.width, ay: -b.minY / b.height };
      g.destroy();
      this.cache.set(key, baked);
    }
    return baked;
  }
}

function drawPlant(
  g: Graphics,
  shape: string,
  leafState: LeafState,
  fruit: boolean,
  dead: boolean,
  snowy: boolean,
): void {
  const shadow = () => g.ellipse(0, 0, 9, 3).fill({ color: 0x000000, alpha: 0.18 });
  const leaves = dead ? LEAVES.bare : LEAVES[leafState];

  switch (shape) {
    case 'broadleaf':
    case 'fruitTree': {
      const small = shape === 'fruitTree';
      const s = small ? 0.8 : 1;
      shadow();
      g.rect(-1.6 * s, -12 * s, 3.2 * s, 12 * s).fill(0x6b4a2b);
      if (dead || leafState === 'bare') {
        branches(g, s);
        if (snowy) g.ellipse(0, -18 * s, 8 * s, 2.5 * s).fill({ color: 0xffffff, alpha: 0.85 });
        break;
      }
      const blobs: [number, number, number][] = [
        [0, -20, 10], [-7, -15, 7], [7, -15, 7], [-4, -25, 7], [5, -24, 7],
      ];
      blobs.forEach(([x, y, r], k) => g.circle(x * s, y * s, r * s).fill(leaves[k % 2]));
      g.circle(-3 * s, -24 * s, 4 * s).fill({ color: leaves[2], alpha: 0.8 });
      if (snowy) g.ellipse(0, -28 * s, 8 * s, 3 * s).fill({ color: 0xffffff, alpha: 0.9 });
      if (fruit) {
        for (const [x, y] of [[-6, -16], [5, -19], [0, -12], [-2, -23], [7, -13]]) {
          g.circle(x * s, y * s, 1.8).fill(0xd92b2b);
        }
      }
      break;
    }
    case 'conifer': {
      shadow();
      g.rect(-1.5, -6, 3, 6).fill(0x5a3d22);
      const greens = dead ? [0x6b5d4c, 0x7a6b58, 0x857762] : [0x1f5a35, 0x2a6e3f, 0x377f4a];
      g.poly([-10, -5, 10, -5, 0, -19]).fill(greens[0]);
      g.poly([-8, -13, 8, -13, 0, -26]).fill(greens[1]);
      g.poly([-6, -20, 6, -20, 0, -32]).fill(greens[2]);
      if (snowy) {
        g.poly([-4, -13, 4, -13, 0, -19]).fill({ color: 0xffffff, alpha: 0.9 });
        g.poly([-3, -26, 3, -26, 0, -32]).fill({ color: 0xffffff, alpha: 0.95 });
      }
      break;
    }
    case 'bush': {
      g.ellipse(0, 0, 7, 2.5).fill({ color: 0x000000, alpha: 0.15 });
      const c = dead || leafState === 'bare' ? LEAVES.bare : leaves;
      g.circle(-3.5, -4.5, 4.5).fill(c[0]);
      g.circle(3.5, -4.5, 4.5).fill(c[0]);
      g.circle(0, -7, 5).fill(c[1]);
      if (snowy) g.ellipse(0, -10, 5, 2).fill({ color: 0xffffff, alpha: 0.9 });
      if (fruit) for (const [x, y] of [[-4, -5], [2, -8], [4, -4], [-1, -3], [0, -9]]) g.circle(x, y, 1.3).fill(0x5b2ca0);
      break;
    }
    case 'grain': {
      const ripe = fruit;
      const stalk = ripe ? 0xd9b44a : leafState === 'spring' ? 0x86c55a : 0x9cbf55;
      for (const dx of [-4, -1.5, 1, 3.5]) {
        g.moveTo(dx, 0).lineTo(dx + 0.8, -9).stroke({ width: 1, color: stalk });
        if (ripe) g.ellipse(dx + 0.8, -10, 1.2, 2.4).fill(0xe8c45c);
      }
      break;
    }
    case 'cactus': {
      g.ellipse(0, 0, 5, 2).fill({ color: 0x000000, alpha: 0.15 });
      const c = dead ? 0x8a7a5a : 0x4c8a3c;
      g.roundRect(-2.5, -16, 5, 16, 2.5).fill(c);
      g.roundRect(-7, -11, 3, 6, 1.5).fill(c);
      g.rect(-5, -7, 3, 2).fill(c);
      g.roundRect(4, -13, 3, 6, 1.5).fill(c);
      g.rect(2, -9, 3, 2).fill(c);
      if (fruit) for (const [x, y] of [[0, -17], [-5.5, -12], [5.5, -14]]) g.circle(x, y, 1.4).fill(0xc2185b);
      break;
    }
  }
}

function branches(g: Graphics, s: number): void {
  const c = 0x6b4a2b;
  g.moveTo(0, -11 * s).lineTo(-7 * s, -21 * s).stroke({ width: 1.6 * s, color: c });
  g.moveTo(0, -12 * s).lineTo(6 * s, -22 * s).stroke({ width: 1.6 * s, color: c });
  g.moveTo(0, -12 * s).lineTo(0, -26 * s).stroke({ width: 1.8 * s, color: c });
  g.moveTo(-4 * s, -17 * s).lineTo(-9 * s, -17 * s).stroke({ width: 1 * s, color: c });
  g.moveTo(3 * s, -17 * s).lineTo(9 * s, -19 * s).stroke({ width: 1 * s, color: c });
}

function drawDeer(g: Graphics, young: boolean, sleeping: boolean): void {
  const s = young ? 0.6 : 1;
  const body = young ? 0xb07a4a : 0x9a6a40;
  g.ellipse(0, 0, 8 * s, 2.5 * s).fill({ color: 0x000000, alpha: 0.2 });
  if (sleeping) {
    g.ellipse(0, -3 * s, 8 * s, 3.5 * s).fill(body);
    g.circle(6 * s, -5 * s, 2.6 * s).fill(body);
    g.poly([5 * s, -7 * s, 4 * s, -10 * s, 6.5 * s, -7.5 * s]).fill(body);
    return;
  }
  // Legs
  for (const lx of [-5, -3, 3, 5]) g.rect(lx * s - 0.6, -6 * s, 1.2, 6 * s).fill(0x5a3b22);
  // Body, belly, tail
  g.ellipse(0, -8 * s, 7.5 * s, 3.6 * s).fill(body);
  g.ellipse(0, -6.5 * s, 5 * s, 1.5 * s).fill({ color: 0xe8d4b8, alpha: 0.7 });
  g.circle(-7.5 * s, -9 * s, 1.3 * s).fill(0xf4efe6);
  // Neck and head
  g.poly([5 * s, -10 * s, 8 * s, -15 * s, 9.5 * s, -14 * s, 7.5 * s, -8 * s]).fill(body);
  g.ellipse(10 * s, -15.5 * s, 3 * s, 2 * s).fill(body);
  g.circle(12.6 * s, -15 * s, 0.8 * s).fill(0x2a1a10);
  g.poly([8 * s, -17 * s, 7 * s, -20 * s, 9.5 * s, -17.5 * s]).fill(body);
  if (young) {
    for (const [x, y] of [[-3, -9], [0, -10], [3, -9], [-1, -7.5], [2, -7.5]]) g.circle(x * s, y * s, 0.6).fill(0xf8f0e0);
  }
}

// ------------------------------------------------------------------ people

export function drawPerson(
  g: Graphics, skin: number, hair: number, shirt: number, sex: string, stage: string, lying: boolean,
): void {
  if (stage === 'baby') {
    g.ellipse(0, 0, 3, 1.2).fill({ color: 0x000000, alpha: 0.2 });
    g.ellipse(0, -3, 2.6, 3.2).fill(0xefe6d2);
    g.circle(0, -6.5, 2).fill(skin);
    g.ellipse(0, -7.6, 1.8, 0.9).fill(hair);
    return;
  }
  const s = stage === 'child' ? 0.72 : 1;
  const hairColor = stage === 'elder' ? 0xd6d3cc : hair;
  const pants = 0x3c3a48;
  if (lying) {
    g.ellipse(0, 0, 9 * s, 2.2 * s).fill({ color: 0x000000, alpha: 0.2 });
    g.roundRect(-8 * s, -4 * s, 12 * s, 4 * s, 2 * s).fill(shirt);
    g.roundRect(-12 * s, -3.5 * s, 5 * s, 3 * s, 1.5 * s).fill(pants);
    g.circle(6.5 * s, -2.5 * s, 2.8 * s).fill(skin);
    g.ellipse(7.5 * s, -3.6 * s, 2.6 * s, 1.6 * s).fill(hairColor);
    return;
  }
  g.ellipse(0, 0, 5 * s, 1.8 * s).fill({ color: 0x000000, alpha: 0.22 });
  if (sex === 'female' && stage !== 'child') {
    // Long hair behind the head.
    g.roundRect(-3.7 * s, -19.5 * s, 7.4 * s, 9 * s, 2.5 * s).fill(hairColor);
  }
  // Legs
  g.rect(-2.6 * s, -7 * s, 2 * s, 7 * s).fill(pants);
  g.rect(0.6 * s, -7 * s, 2 * s, 7 * s).fill(pants);
  // Body (a dress flares out a little)
  if (sex === 'female') g.poly([-3.4 * s, -14 * s, 3.4 * s, -14 * s, 4.6 * s, -5 * s, -4.6 * s, -5 * s]).fill(shirt);
  else g.roundRect(-3.6 * s, -14 * s, 7.2 * s, 8 * s, 2 * s).fill(shirt);
  // Arms
  g.roundRect(-5 * s, -13.6 * s, 1.6 * s, 6.5 * s, 0.8 * s).fill(shirt);
  g.roundRect(3.4 * s, -13.6 * s, 1.6 * s, 6.5 * s, 0.8 * s).fill(shirt);
  g.circle(-4.2 * s, -6.8 * s, 0.9 * s).fill(skin);
  g.circle(4.2 * s, -6.8 * s, 0.9 * s).fill(skin);
  // Head
  g.circle(0, -17 * s, 3.2 * s).fill(skin);
  g.ellipse(-0.3 * s, -18.9 * s, 3.4 * s, 1.9 * s).fill(hairColor);
  g.circle(1.3 * s, -17 * s, 0.45 * s).fill(0x1d1d1d);
  if (stage === 'elder') g.rect(4.8 * s, -12 * s, 0.7, 12 * s).fill(0x6b4a2b); // walking stick
}

const CARRY_COLORS: Record<string, number> = {
  fruit: 0x6aa84f, grain: 0xe2c35c, meat: 0xb04a3a, fish: 0x8fb3c9, wood: 0x7a5230, stone: 0x9a9a9a,
  tools: 0x777777, cloth: 0xd9d0c0, metal: 0x8899aa, goods: 0xc28a3c,
};

export function drawCarry(g: Graphics, type: string): void {
  const c = CARRY_COLORS[type] ?? 0xaaaaaa;
  if (type === 'wood') {
    g.roundRect(-3.5, -2, 7, 2, 1).fill(c);
    g.roundRect(-3, -4, 7, 2, 1).fill(0x8b6038);
  } else {
    g.roundRect(-2.6, -3.8, 5.2, 3.8, 1.2).fill(0x8a6a3e); // basket
    g.circle(-1.2, -4, 1.2).fill(c);
    g.circle(1, -4.3, 1.2).fill(c);
  }
}

export function drawFlame(g: Graphics): void {
  g.poly([-3, 0, 3, 0, 0, -9]).fill(0xff8a1e);
  g.poly([-1.8, 0, 1.8, 0, 0, -6]).fill(0xffd34a);
}

export function makeLightTexture(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,200,120,1)');
  grad.addColorStop(0.35, 'rgba(255,160,70,0.45)');
  grad.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}

// ------------------------------------------------------------------ buildings

interface BuildingLook {
  wall: number;
  roof: number;
  w: number; // half width in units
  h: number; // wall height
  roofStyle: 'cone' | 'gable' | 'flat' | 'dome' | 'none';
  detail?: (g: Graphics) => void;
}

const LOOKS: Record<string, BuildingLook> = {
  hut: { wall: 0x9c7a52, roof: 0xc9a35a, w: 9, h: 9, roofStyle: 'cone' },
  house: { wall: 0xc2b8a3, roof: 0x8a3b2b, w: 11, h: 13, roofStyle: 'gable' },
  granary: { wall: 0xb08d5a, roof: 0x7a5a32, w: 9, h: 16, roofStyle: 'cone' },
  workshop: { wall: 0x8f7154, roof: 0x5a4a3a, w: 12, h: 11, roofStyle: 'gable', detail: (g) => g.rect(6, -26, 3, 8).fill(0x555555) },
  well: { wall: 0x9a9a96, roof: 0x6b4a2b, w: 5, h: 5, roofStyle: 'gable' },
  market: { wall: 0xd9c9a0, roof: 0xb3473a, w: 20, h: 8, roofStyle: 'gable', detail: (g) => { g.rect(-18, -8, 4, 8).fill(0x6b4a2b); g.rect(14, -8, 4, 8).fill(0x6b4a2b); } },
  school: { wall: 0xd8cdb5, roof: 0x3f5f8a, w: 14, h: 14, roofStyle: 'gable' },
  temple: { wall: 0xe8e1d0, roof: 0xc9a227, w: 16, h: 20, roofStyle: 'dome' },
  smithy: { wall: 0x6e6a66, roof: 0x3b3b3b, w: 11, h: 11, roofStyle: 'gable', detail: (g) => g.circle(0, -4, 2.5).fill(0xff7a1a) },
  factory: { wall: 0x8a5a48, roof: 0x4a4a4a, w: 22, h: 18, roofStyle: 'flat', detail: (g) => { g.rect(10, -36, 5, 18).fill(0x5b5b5b); g.rect(-6, -32, 4, 14).fill(0x5b5b5b); } },
  powerplant: { wall: 0x9aa3ad, roof: 0x5f6b77, w: 20, h: 16, roofStyle: 'flat', detail: (g) => g.poly([4, -16, 18, -16, 15, -40, 7, -40]).fill(0xc8cdd2) },
  lab: { wall: 0xe6eef5, roof: 0x7aa7c7, w: 14, h: 14, roofStyle: 'dome' },
  launchpad: { wall: 0x77808a, roof: 0x77808a, w: 26, h: 3, roofStyle: 'none', detail: (g) => { g.rect(-3, -46, 6, 43).fill(0xf0f0f0); g.poly([-3, -46, 3, -46, 0, -54]).fill(0xd03030); g.rect(8, -40, 2, 37).fill(0x555555); } },
};

export function drawBuilding(g: Graphics, kind: string, underConstruction: boolean): void {
  if (kind === 'campfire') {
    g.ellipse(0, 0, 8, 3.2).fill({ color: 0x000000, alpha: 0.15 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.circle(Math.cos(a) * 5, Math.sin(a) * 2.2 - 1, 1.4).fill(0x8d8d8d);
    }
    g.roundRect(-4, -2.5, 8, 1.6, 0.8).fill(0x5a3d22);
    g.roundRect(-3, -3.3, 6, 1.6, 0.8).fill(0x6b4a2b);
    return;
  }
  if (kind === 'stockpile') {
    g.ellipse(0, 0, 11, 3.5).fill({ color: 0x000000, alpha: 0.18 });
    g.rect(-9, -7, 7, 7).fill(0x8b6038);
    g.rect(-9, -7, 7, 1).fill(0x6b4a2b);
    g.rect(-1, -6, 6, 6).fill(0x9c7040);
    g.ellipse(7, -2.5, 3.2, 2.6).fill(0xb89a62);
    g.ellipse(-4, -9.5, 3, 2.5).fill(0xc9b27a);
    return;
  }
  if (kind === 'farm') {
    // Drawn per-crop by the renderer (see drawField); this is the base.
    return;
  }
  const L = LOOKS[kind] ?? LOOKS.hut;
  g.ellipse(0, 0, L.w + 3, 3.5).fill({ color: 0x000000, alpha: 0.2 });
  if (underConstruction) {
    // A wooden frame.
    const c = 0x8b6038;
    g.rect(-L.w, -L.h, 1.5, L.h).fill(c);
    g.rect(L.w - 1.5, -L.h, 1.5, L.h).fill(c);
    g.rect(-1, -L.h - 6, 1.5, L.h + 6).fill(c);
    g.rect(-L.w, -L.h, L.w * 2, 1.5).fill(c);
    g.moveTo(-L.w, -L.h).lineTo(0, -L.h - 6).lineTo(L.w, -L.h).stroke({ width: 1.2, color: c });
    g.rect(-L.w - 2, -1.5, L.w * 2 + 4, 1.5).fill(0x6b5a48);
    return;
  }
  if (L.roofStyle !== 'none') g.rect(-L.w, -L.h, L.w * 2, L.h).fill(L.wall);
  else g.rect(-L.w, -L.h, L.w * 2, L.h).fill(L.wall);
  switch (L.roofStyle) {
    case 'cone':
      g.poly([-L.w - 3, -L.h + 1, L.w + 3, -L.h + 1, 0, -L.h - L.w * 1.4]).fill(L.roof);
      g.moveTo(-L.w * 0.5, -L.h - 1).lineTo(0, -L.h - L.w * 1.3).stroke({ width: 0.6, color: 0x9a7a40 });
      g.moveTo(L.w * 0.5, -L.h - 1).lineTo(0, -L.h - L.w * 1.3).stroke({ width: 0.6, color: 0x9a7a40 });
      break;
    case 'gable':
      g.poly([-L.w - 2, -L.h + 1, L.w + 2, -L.h + 1, L.w - 2, -L.h - 8, -L.w + 2, -L.h - 8]).fill(L.roof);
      break;
    case 'flat':
      g.rect(-L.w - 1, -L.h - 2, L.w * 2 + 2, 3).fill(L.roof);
      break;
    case 'dome':
      g.ellipse(0, -L.h, L.w * 0.8, L.w * 0.7).fill(L.roof);
      break;
  }
  // Door and windows.
  if (L.roofStyle !== 'none') {
    g.roundRect(-2.2, -7, 4.4, 7, 1.5).fill(0x4a3322);
    if (L.w >= 10) {
      g.rect(-L.w + 3, -L.h + 3, 3, 3).fill(0x35302a);
      g.rect(L.w - 6, -L.h + 3, 3, 3).fill(0x35302a);
    }
  }
  L.detail?.(g);
}

/** A farm field: tilled rows with crops at a growth stage (0..4). */
export function drawField(g: Graphics, stage: number): void {
  g.rect(-24, -24, 48, 48).fill(0x7a5a3a);
  const crop = [0x7a5a3a, 0x7fb04a, 0x5f9a3a, 0xc9b043, 0xe0c35a][stage];
  for (let r = -20; r <= 20; r += 6) {
    g.rect(-22, r - 1, 44, 2).fill(0x5e4329);
    if (stage > 0) for (let c = -20; c <= 20; c += 4) g.circle(c, r - 2, stage === 1 ? 0.9 : 1.6).fill(crop);
  }
}
