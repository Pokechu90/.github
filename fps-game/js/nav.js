'use strict';
// Ground navigation: a 2.5D grid of standable floors built once per map, and a flow field
// toward the player that every walking bot follows. Bots can climb steps up to 0.6 m and drop
// down ledges, so they find stairs, ramps and detours around long obstacles.

const NAV = { ready: false, cell: 0.5, MAXL: 3 };
const NAV_STEP = 0.6, NAV_DROP = 3.6, NAV_CLEAR = 0.42, NAV_HEAD = 1.7;

function buildNav() {
  const half = world.half, cell = NAV.cell, n = Math.ceil(half * 2 / cell), L = NAV.MAXL;
  NAV.n = n; NAV.half = half;
  NAV.h = new Float32Array(n * n * L).fill(NaN);
  NAV.dist = new Float32Array(n * n * L).fill(Infinity);
  NAV.next = new Float32Array(n * n * L);
  NAV.busy = false;
  // bucket colliders on a coarse grid so each cell only tests nearby boxes
  const B = 8, bn = Math.ceil(half * 2 / B), buckets = Array.from({ length: bn * bn }, () => []);
  const bi = v => clamp(Math.floor((v + half) / B), 0, bn - 1);
  for (const c of world.colliders) for (let bx = bi(c.min.x - 1); bx <= bi(c.max.x + 1); bx++) for (let bz = bi(c.min.z - 1); bz <= bi(c.max.z + 1); bz++) buckets[bz * bn + bx].push(c);
  const free = (list, x, z, y0, y1) => {
    for (const c of list) if (x + NAV_CLEAR > c.min.x && x - NAV_CLEAR < c.max.x && z + NAV_CLEAR > c.min.z && z - NAV_CLEAR < c.max.z && y1 > c.min.y && y0 < c.max.y) return false;
    return true;
  };
  const floor = world.floor || 0, cand = [];
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    const x = -half + (ix + 0.5) * cell, z = -half + (iz + 0.5) * cell;
    if (Math.abs(x) > half - 1.2 || Math.abs(z) > half - 1.2) continue;
    const list = buckets[bi(z) * bn + bi(x)];
    cand.length = 0; cand.push(floor);
    for (const c of list) if (x > c.min.x && x < c.max.x && z > c.min.z && z < c.max.z && c.max.y > floor + 0.05) cand.push(c.max.y);
    cand.sort((a, b) => a - b);
    // headroom ignores anything low enough to step onto
    let k = 0, last = -Infinity;
    for (const h of cand) {
      if (k >= L || h - last < 0.05) continue;
      if (free(list, x, z, h + NAV_STEP + 0.01, h + NAV_HEAD)) { NAV.h[(iz * n + ix) * L + k] = h; k++; last = h; }
    }
  }
  NAV.ready = true; NAV.goal = -1; NAV.pending = -1; NAV.t = 0;
}

function navCellOf(x, z) {
  const ix = Math.floor((x + NAV.half) / NAV.cell), iz = Math.floor((z + NAV.half) / NAV.cell);
  if (ix < 0 || iz < 0 || ix >= NAV.n || iz >= NAV.n) return -1;
  return iz * NAV.n + ix;
}
// node (cell * MAXL + level) for a body standing at y in cell ci
function navNode(ci, y) {
  if (ci < 0) return -1;
  let best = -1, bd = Infinity;
  for (let k = 0; k < NAV.MAXL; k++) {
    const h = NAV.h[ci * NAV.MAXL + k]; if (h !== h) continue;
    const d = y - h; if (d < -0.7 || d > 2.2) continue;
    if (Math.abs(d) < bd) { bd = Math.abs(d); best = ci * NAV.MAXL + k; }
  }
  return best;
}
const NAV_NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
// can a bot go from node a (height ha) to the neighbouring node b (height hb)?
function navLink(ha, hb) { return hb - ha <= NAV_STEP && ha - hb <= NAV_DROP; }

// Dijkstra outward from the player's node; distances are "cost to reach the player"
const navHeap = { k: new Int32Array(0), p: new Float32Array(0), n: 0 };
function heapPush(node, pri) {
  const H = navHeap; let i = H.n++;
  while (i > 0) { const pa = (i - 1) >> 1; if (H.p[pa] <= pri) break; H.k[i] = H.k[pa]; H.p[i] = H.p[pa]; i = pa; }
  H.k[i] = node; H.p[i] = pri;
}
function heapPop() {
  const H = navHeap, top = H.k[0], last = --H.n, lk = H.k[last], lp = H.p[last];
  let i = 0;
  while (true) { let c = 2 * i + 1; if (c >= H.n) break; if (c + 1 < H.n && H.p[c + 1] < H.p[c]) c++; if (H.p[c] >= lp) break; H.k[i] = H.k[c]; H.p[i] = H.p[c]; i = c; }
  H.k[i] = lk; H.p[i] = lp;
  return top;
}
// the flood is time-sliced: it fills NAV.next a few thousand nodes per frame, then swaps it in,
// so recomputing the field never causes a frame hitch
function navFloodStart(goal) {
  const size = NAV.n * NAV.n * NAV.MAXL;
  if (navHeap.k.length < size * 2) { navHeap.k = new Int32Array(size * 2); navHeap.p = new Float32Array(size * 2); }
  NAV.next.fill(Infinity);
  navHeap.n = 0; NAV.next[goal] = 0; heapPush(goal, 0);
  NAV.pending = goal; NAV.busy = true;
}
function navFloodStep(budget) {
  const n = NAV.n, L = NAV.MAXL, dist = NAV.next;
  while (navHeap.n && budget-- > 0) {
    const pri = navHeap.p[0], node = heapPop();
    if (pri > dist[node]) continue;
    const ci = (node / L) | 0, ix = ci % n, iz = (ci / n) | 0, h = NAV.h[node];
    for (const [dx, dz, cost] of NAV_NB) {
      const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= n || jz >= n) continue;
      const cj = jz * n + jx;
      // diagonal moves need both side cells open so paths don't cut wall corners
      if (dx && dz && (navNode(iz * n + jx, h + 0.3) < 0 || navNode(jz * n + ix, h + 0.3) < 0)) continue;
      for (let k = 0; k < L; k++) {
        const nb = cj * L + k, hb = NAV.h[nb]; if (hb !== hb) continue;
        // the flood runs from the player outward, so the bot walks from nb to node
        if (!navLink(hb, h)) continue;
        const nd = pri + cost * NAV.cell + Math.max(0, h - hb) * 0.5;
        if (nd < dist[nb]) { dist[nb] = nd; heapPush(nb, nd); }
      }
    }
  }
  if (!navHeap.n) {
    const t = NAV.dist; NAV.dist = NAV.next; NAV.next = t;
    NAV.goal = NAV.pending; NAV.busy = false;
  }
}
// refresh the field when the player reaches a new standable node
function updateNav(dt, budget = 5000) {
  if (!NAV.ready) return;
  if (NAV.busy) { navFloodStep(budget); return; }
  NAV.t -= dt;
  if (NAV.t > 0) return;
  NAV.t = 0.2;
  const node = navNode(navCellOf(player.pos.x, player.pos.z), player.pos.y + 0.1);
  if (node < 0 || node === NAV.goal) return;
  navFloodStart(node);
  navFloodStep(budget);
}
// next waypoint for a body: follows the field a few cells ahead and returns its centre, or null
function navNext(pos, out) {
  if (!NAV.ready || NAV.goal < 0) return null;
  const L = NAV.MAXL, n = NAV.n;
  let node = navNode(navCellOf(pos.x, pos.z), pos.y + 0.1);
  if (node < 0 || NAV.dist[node] === Infinity) {
    // standing in a cell the grid rejected (hugging a wall): take the best nearby node
    const ci = navCellOf(pos.x, pos.z); if (ci < 0) return null;
    const ix = ci % n, iz = (ci / n) | 0; let bd = Infinity; node = -1;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= n || jz >= n) continue;
      const nb = navNode(jz * n + jx, pos.y + 0.1); if (nb >= 0 && NAV.dist[nb] < bd) { bd = NAV.dist[nb]; node = nb; }
    }
    if (node < 0) return null;
  }
  for (let step = 0; step < 6; step++) {
    const ci = (node / L) | 0, ix = ci % n, iz = (ci / n) | 0, h = NAV.h[node];
    let best = node, bd = NAV.dist[node];
    for (const [dx, dz] of NAV_NB) {
      const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= n || jz >= n) continue;
      if (dx && dz && (navNode(iz * n + jx, h + 0.3) < 0 || navNode(jz * n + ix, h + 0.3) < 0)) continue;
      for (let k = 0; k < L; k++) {
        const nb = (jz * n + jx) * L + k, hb = NAV.h[nb]; if (hb !== hb || !navLink(h, hb)) continue;
        if (NAV.dist[nb] < bd) { bd = NAV.dist[nb]; best = nb; }
      }
    }
    if (best === node) break;
    node = best;
    // only look further ahead while the path stays on one level, so steps are taken in order
    if (Math.abs(NAV.h[node] - h) > 0.05) break;
  }
  const ci = (node / L) | 0;
  return out.set(-NAV.half + ((ci % n) + 0.5) * NAV.cell, NAV.h[node], -NAV.half + (((ci / n) | 0) + 0.5) * NAV.cell);
}
