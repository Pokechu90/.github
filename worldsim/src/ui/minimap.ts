/**
 * Minimap: everything explored so far (4x4 colour samples per chunk), towns
 * as dots, and a box showing what the camera sees. Click to jump there.
 */
import { CHUNK_SIZE } from '../shared/terrain';
import type { SettlementView } from '../shared/protocol';
import { biomeColor } from '../render/palette';
import type { Camera } from '../render/camera';

const WORLD_CELLS = 1024; // 1024 cells = 256 chunks = 8192 tiles across
const ORIGIN = WORLD_CELLS / 2;

export class Minimap {
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private world = document.createElement('canvas');
  private wg: CanvasRenderingContext2D;
  private settlements: SettlementView[] = [];
  private originChunk: { cx: number; cy: number } | null = null;
  /** Map pixels per chunk (zoom). */
  private scale = 4;

  constructor(private camera: Camera) {
    this.canvas = document.getElementById('minimap') as HTMLCanvasElement;
    this.g = this.canvas.getContext('2d')!;
    this.world.width = this.world.height = WORLD_CELLS;
    this.wg = this.world.getContext('2d')!;
    this.canvas.addEventListener('click', (e) => {
      const r = this.canvas.getBoundingClientRect();
      const mx = ((e.clientX - r.left) / r.width) * this.canvas.width;
      const my = ((e.clientY - r.top) / r.height) * this.canvas.height;
      const tilesPerPx = CHUNK_SIZE / this.scale;
      camera.centerOn(camera.x + (mx - this.canvas.width / 2) * tilesPerPx, camera.y + (my - this.canvas.height / 2) * tilesPerPx);
    });
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.scale = Math.max(1, Math.min(16, this.scale * (e.deltaY < 0 ? 1.5 : 1 / 1.5)));
    }, { passive: false });
    setInterval(() => this.draw(), 250);
  }

  reset(): void {
    this.wg.clearRect(0, 0, WORLD_CELLS, WORLD_CELLS);
    this.originChunk = null;
  }

  addChunks(chunks: { cx: number; cy: number; cells: number[] }[]): void {
    if (!chunks.length) return;
    this.originChunk ??= { cx: chunks[0].cx, cy: chunks[0].cy };
    const img = this.wg.createImageData(4, 4);
    for (const c of chunks) {
      const bx = (c.cx - this.originChunk.cx) * 4 + ORIGIN;
      const by = (c.cy - this.originChunk.cy) * 4 + ORIGIN;
      if (bx < 0 || by < 0 || bx >= WORLD_CELLS - 4 || by >= WORLD_CELLS - 4) continue;
      for (let i = 0; i < 16; i++) {
        const [r, g, b] = biomeColor(c.cells[i], 1);
        img.data[i * 4] = r;
        img.data[i * 4 + 1] = g;
        img.data[i * 4 + 2] = b;
        img.data[i * 4 + 3] = 255;
      }
      this.wg.putImageData(img, bx, by);
    }
  }

  setSettlements(s: SettlementView[]): void {
    this.settlements = s;
  }

  private draw(): void {
    const { g, canvas, camera } = this;
    const W = canvas.width;
    const H = canvas.height;
    g.fillStyle = '#0b1020';
    g.fillRect(0, 0, W, H);
    if (!this.originChunk) return;
    // Camera position in world-image cells.
    const camCx = (camera.x / CHUNK_SIZE - this.originChunk.cx) * 4 + ORIGIN;
    const camCy = (camera.y / CHUNK_SIZE - this.originChunk.cy) * 4 + ORIGIN;
    const cellPx = this.scale / 4;
    g.imageSmoothingEnabled = false;
    const sw = W / cellPx;
    const sh = H / cellPx;
    g.drawImage(this.world, camCx - sw / 2, camCy - sh / 2, sw, sh, 0, 0, W, H);
    // Towns.
    const toPx = (x: number, y: number) => [
      W / 2 + ((x - camera.x) / CHUNK_SIZE) * this.scale,
      H / 2 + ((y - camera.y) / CHUNK_SIZE) * this.scale,
    ];
    g.font = '10px system-ui, sans-serif';
    for (const s of this.settlements) {
      const [px, py] = toPx(s.x, s.y);
      if (px < -20 || py < -20 || px > W + 20 || py > H + 20) continue;
      const r = { camp: 2, village: 3, town: 4, city: 5, metropolis: 7 }[s.tier] ?? 2;
      g.fillStyle = '#ffd36b';
      g.strokeStyle = '#000';
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      if (s.tier !== 'camp' && this.scale >= 3) {
        g.fillStyle = '#fff';
        g.fillText(s.name, px + r + 2, py + 3);
      }
    }
    // What the camera sees.
    const b = camera.bounds();
    const [x0, y0] = toPx(b.x0, b.y0);
    const [x1, y1] = toPx(b.x1, b.y1);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1;
    g.strokeRect(x0, y0, Math.max(2, x1 - x0), Math.max(2, y1 - y0));
  }
}
