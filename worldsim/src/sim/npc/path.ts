/**
 * Pathfinding for people: A* search over the tile grid, so they walk around
 * lakes and mountains instead of getting stuck. Long journeys are split into
 * legs of at most MAX_LEG tiles, each planned when it starts, which keeps
 * every search small and fast.
 */
import { BIOMES, Biome } from '../../shared/terrain';
import type { World } from '../world';

const MAX_LEG = 48;
const MARGIN = 16;
const MAX_NODES = 3000;
/** Remember recently failed searches (e.g. targets across a lake) for a while. */
const failed = new Map<string, number>();
let failedSweep = 0;

/** Performance counters (shown in debug output). */
export const pathStats = { calls: 0, straight: 0, searches: 0, nodes: 0, failures: 0, cached: 0, reused: 0 };

/** Recently found routes, by coarse start/goal cell: people walk the same routes every day. */
const routes = new Map<string, { pts: number[]; time: number }>();

const COST: Partial<Record<Biome, number>> = {
  [Biome.River]: 4,
  [Biome.Mountain]: 2.5,
  [Biome.Forest]: 1.3,
  [Biome.Taiga]: 1.3,
  [Biome.Swamp]: 2,
  [Biome.Tundra]: 1.2,
};

/**
 * Plans a route from (x0,y0) towards (x1,y1). Returns a flat waypoint list
 * [x, y, x, y, ...] ending at the target (or at the end of this leg), or null.
 */
export function findPath(world: World, x0: number, y0: number, x1: number, y1: number): number[] | null {
  // Long trip: aim for an intermediate point on the way.
  const dist = Math.hypot(x1 - x0, y1 - y0);
  let tx = x1;
  let ty = y1;
  if (dist > MAX_LEG) {
    tx = x0 + ((x1 - x0) / dist) * MAX_LEG;
    ty = y0 + ((y1 - y0) / dist) * MAX_LEG;
  }
  pathStats.calls++;
  if (lineClear(world, x0, y0, tx, ty)) {
    pathStats.straight++;
    return [tx, ty];
  }

  const sx = Math.floor(x0);
  const sy = Math.floor(y0);
  let gx = Math.floor(tx);
  let gy = Math.floor(ty);
  const now = world.state.time;
  const failKey = `${sx >> 2},${sy >> 2}>${gx >> 2},${gy >> 2}`;
  const failedAt = failed.get(failKey);
  if (failedAt !== undefined && now - failedAt < 1440) {
    pathStats.cached++;
    return null;
  }
  const known = routes.get(failKey);
  if (known && now - known.time < 5 * 1440 && lineClear(world, x0, y0, known.pts[0], known.pts[1])) {
    // Reuse it, but the last stretch to this exact destination must be clear too.
    const pts = known.pts.slice();
    const k = pts.length;
    const px = k >= 4 ? pts[k - 4] : x0;
    const py = k >= 4 ? pts[k - 3] : y0;
    if (lineClear(world, px, py, tx, ty)) {
      pathStats.reused++;
      pts[k - 2] = tx;
      pts[k - 1] = ty;
      return smooth(world, x0, y0, pts);
    }
  }
  pathStats.searches++;
  if (failed.size > 5000 || routes.size > 20000 || now - failedSweep > 1440) {
    failedSweep = now;
    for (const [k, t] of failed) if (now - t > 1440) failed.delete(k);
    for (const [k, r] of routes) if (now - r.time > 5 * 1440) routes.delete(k);
  }
  const fail = () => {
    pathStats.failures++;
    failed.set(failKey, now);
    return null;
  };
  // If the goal itself is water, aim for the nearest walkable tile next to it.
  if (!world.isWalkable(gx + 0.5, gy + 0.5)) {
    const alt = nearestWalkable(world, gx, gy, 4);
    if (!alt) return fail();
    [gx, gy] = alt;
  }

  const minX = Math.min(sx, gx) - MARGIN;
  const minY = Math.min(sy, gy) - MARGIN;
  const w = Math.max(sx, gx) + MARGIN - minX + 1;
  const h = Math.max(sy, gy) + MARGIN - minY + 1;
  const n = w * h;
  const g = new Float32Array(n).fill(Infinity);
  const costs = new Float32Array(n).fill(-2); // -2 = not looked up yet
  const cost = (x: number, y: number) => {
    const i = (y - minY) * w + (x - minX);
    let c = costs[i];
    if (c === -2) costs[i] = c = tileCost(world, x, y);
    return c;
  };
  const parent = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const heap = new MinHeap();
  const idx = (x: number, y: number) => (y - minY) * w + (x - minX);
  const start = idx(sx, sy);
  const goal = idx(gx, gy);
  g[start] = 0;
  heap.push(start, octile(sx, sy, gx, gy));

  let expanded = 0;
  while (heap.size > 0) {
    const cur = heap.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    pathStats.nodes++;
    if (++expanded > MAX_NODES) return fail();
    const cx = (cur % w) + minX;
    const cy = Math.floor(cur / w) + minY;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < minX || ny < minY || nx >= minX + w || ny >= minY + h) continue;
        const ni = idx(nx, ny);
        if (closed[ni]) continue;
        const c = cost(nx, ny);
        if (c < 0) continue;
        // No cutting corners diagonally past water.
        if (dx && dy && (cost(cx + dx, cy) < 0 || cost(cx, cy + dy) < 0)) continue;
        const ng = g[cur] + c * (dx && dy ? 1.414 : 1);
        if (ng < g[ni]) {
          g[ni] = ng;
          parent[ni] = cur;
          heap.push(ni, ng + octile(nx, ny, gx, gy));
        }
      }
    }
  }
  if (parent[goal] === -1 && goal !== start) return fail();

  // Walk back from the goal, then smooth out zig-zags.
  const cells: number[] = [];
  for (let c = goal; c !== -1 && c !== start; c = parent[c]) cells.push(c);
  cells.reverse();
  const pts: number[] = [];
  for (const c of cells) pts.push((c % w) + minX + 0.5, Math.floor(c / w) + minY + 0.5);
  if (gx === Math.floor(tx) && gy === Math.floor(ty)) {
    pts[pts.length - 2] = tx;
    pts[pts.length - 1] = ty;
  }
  const result = smooth(world, x0, y0, pts);
  routes.set(failKey, { pts: result, time: now });
  return result;
}

function smooth(world: World, x0: number, y0: number, pts: number[]): number[] {
  const out: number[] = [];
  let ax = x0;
  let ay = y0;
  let i = 0;
  while (i < pts.length) {
    // Jump to the furthest waypoint we can see in a straight line.
    let j = pts.length - 2;
    while (j > i && !lineClear(world, ax, ay, pts[j], pts[j + 1])) j -= 2;
    out.push(pts[j], pts[j + 1]);
    ax = pts[j];
    ay = pts[j + 1];
    i = j + 2;
  }
  return out;
}

/** Can you walk straight there? Wading across a narrow stream is fine. */
export function lineClear(world: World, x0: number, y0: number, x1: number, y1: number): boolean {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(dist / 0.5);
  let wet = 0;
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const b = world.biomeAt(Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t));
    if (b < 0 || !WALKABLE[b]) return false;
    if (b === Biome.River && ++wet > 6) return false;
  }
  return true;
}

const WALKABLE: boolean[] = Object.values(BIOMES).map((b) => b.walkable);

function tileCost(world: World, x: number, y: number): number {
  const b = world.biomeAt(x, y);
  if (b < 0 || !WALKABLE[b]) return -1;
  return COST[b as Biome] ?? 1;
}

function nearestWalkable(world: World, x: number, y: number, r: number): [number, number] | null {
  for (let d = 1; d <= r; d++) {
    for (let dy = -d; dy <= d; dy++) {
      for (let dx = -d; dx <= d; dx++) {
        if (tileCost(world, x + dx, y + dy) > 0) return [x + dx, y + dy];
      }
    }
  }
  return null;
}

function octile(x0: number, y0: number, x1: number, y1: number): number {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
}

class MinHeap {
  private items: number[] = [];
  private prio: number[] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: number, p: number): void {
    this.items.push(item);
    this.prio.push(p);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.prio[parent] <= this.prio[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }
  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop()!;
    const lastP = this.prio.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.prio[0] = lastP;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.prio[l] < this.prio[m]) m = l;
        if (r < this.items.length && this.prio[r] < this.prio[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.prio[a], this.prio[b]] = [this.prio[b], this.prio[a]];
  }
}
