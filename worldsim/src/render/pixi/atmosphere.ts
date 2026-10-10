/**
 * Light and weather on top of the map: night darkness, warm dawns and dusks,
 * grey overcast skies, and falling rain or snow.
 */
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { daylight } from '../../shared/time';
import type { Snapshot } from '../../shared/protocol';

interface Drop {
  x: number;
  y: number;
  speed: number;
}

export class Atmosphere {
  /** Darkening layer (goes under the lights). */
  readonly back = new Container();
  /** Rain and snow (on top of everything). */
  readonly front = new Container();
  private tint = new Sprite(Texture.WHITE);
  private precipitation = new Graphics();
  private drops: Drop[] = [];
  /** 0 = day, 1 = darkest night (lights use this). */
  darkness = 0;

  constructor() {
    // "Multiply" darkens everything underneath by the tint colour: white = no
    // change, deep blue = night.
    this.tint.blendMode = 'multiply';
    this.back.addChild(this.tint);
    this.front.addChild(this.precipitation);
  }

  update(snap: Snapshot, width: number, height: number, deltaMS: number): void {
    this.tint.width = width;
    this.tint.height = height;

    const light = daylight(snap.time);
    this.darkness = 1 - light;
    const w = snap.weather;
    // Night colour, blended with a warm glow at dawn and dusk.
    const night: [number, number, number] = [0.22, 0.27, 0.45];
    const twilight = 1 - Math.abs(light - 0.5) * 2; // peaks halfway through dawn/dusk
    let r = lerp(night[0], 1, light);
    let g = lerp(night[1], 1, light);
    let b = lerp(night[2], 1, light);
    r = lerp(r, 1, twilight * 0.35);
    g = lerp(g, 0.75, twilight * 0.35);
    b = lerp(b, 0.6, twilight * 0.35);
    // Clouds and rain make it greyer and darker.
    const gloom = w.cloud * 0.18 + w.rain * 0.15;
    r *= 1 - gloom;
    g *= 1 - gloom;
    b *= 1 - gloom * 0.7;
    this.tint.tint = (to255(r) << 16) | (to255(g) << 8) | to255(b);

    this.updatePrecipitation(w.rain, w.snowing, width, height, deltaMS);
  }

  private updatePrecipitation(rain: number, snowing: boolean, width: number, height: number, deltaMS: number): void {
    const target = Math.round(rain * (snowing ? 260 : 420));
    while (this.drops.length < target) {
      this.drops.push({ x: Math.random() * width, y: Math.random() * height, speed: 0.7 + Math.random() * 0.6 });
    }
    if (this.drops.length > target) this.drops.length = target;

    const gfx = this.precipitation;
    gfx.clear();
    if (this.drops.length === 0) return;
    const dt = deltaMS / 16.67;
    for (const d of this.drops) {
      if (snowing) {
        d.y += d.speed * 1.2 * dt;
        d.x += Math.sin((d.y + d.speed * 100) / 30) * 0.6 * dt;
        gfx.circle(d.x, d.y, 1.6 * d.speed);
      } else {
        d.y += d.speed * 14 * dt;
        d.x -= d.speed * 3 * dt;
        gfx.moveTo(d.x, d.y).lineTo(d.x + 2.5, d.y - 11);
      }
      if (d.y > height + 12) {
        d.y = -12;
        d.x = Math.random() * (width + 40);
      }
      if (d.x < -20) d.x += width + 40;
    }
    if (snowing) gfx.fill({ color: 0xffffff, alpha: 0.85 });
    else gfx.stroke({ width: 1, color: 0xb8d0f0, alpha: 0.55 });
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function to255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}
