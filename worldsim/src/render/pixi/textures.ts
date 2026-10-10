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
