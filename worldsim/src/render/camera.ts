/**
 * Camera maths, independent of any rendering library.
 * Position is the tile at the centre of the screen; zoom is pixels per tile.
 */
export class Camera {
  x = 0;
  y = 0;
  zoom = 16;
  width = 800;
  height = 600;
  readonly minZoom = 3;
  readonly maxZoom = 64;

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  centerOn(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: this.x + (sx - this.width / 2) / this.zoom,
      y: this.y + (sy - this.height / 2) / this.zoom,
    };
  }

  /** Pan by a distance measured in screen pixels. */
  panPixels(dx: number, dy: number): void {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  /** Zoom while keeping the point under the cursor fixed. */
  zoomAt(factor: number, sx: number, sy: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }

  /** Visible area in tile coordinates. */
  bounds(): { x0: number; y0: number; x1: number; y1: number } {
    const hw = this.width / 2 / this.zoom;
    const hh = this.height / 2 / this.zoom;
    return { x0: this.x - hw, y0: this.y - hh, x1: this.x + hw, y1: this.y + hh };
  }
}
