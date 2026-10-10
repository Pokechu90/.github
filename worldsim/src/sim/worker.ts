/**
 * Web Worker entry point: the simulation runs here, on its own CPU thread, so
 * the page stays smooth even when the world is busy.
 *
 * Loop: every 50 ms, advance the world by (speed x real time elapsed), generate
 * any chunks the camera needs, and ~15 times a second post a snapshot.
 */
import type { FromSim, ToSim } from '../shared/protocol';
import { World } from './world';
import { ViewTracker } from './snapshot';

const LOOP_MS = 50;
const SNAPSHOT_MS = 66;
/** Max real time per loop spent simulating; if exceeded, the world slows down. */
const SIM_BUDGET_MS = 30;

// The worker's global scope; typed by hand to avoid mixing DOM and worker typings.
const ctx = self as unknown as {
  postMessage(msg: FromSim): void;
  onmessage: ((e: MessageEvent<ToSim>) => void) | null;
};

let world: World | null = null;
const view = new ViewTracker();
let speed = 1;
let last = performance.now();
let lastSnapshot = 0;
let simMs = 0;
let lagging = false;

ctx.onmessage = (e) => {
  const msg = e.data;
  switch (msg.type) {
    case 'init': {
      world = new World(msg.seed);
      const spawn = world.terrain.findSpawn();
      ctx.postMessage({ type: 'ready', seed: msg.seed, spawn });
      break;
    }
    case 'setSpeed':
      speed = Math.max(0, msg.speed);
      break;
    case 'viewport':
      view.setViewport(msg);
      break;
    case 'select':
      view.selected = msg.target;
      lastSnapshot = 0; // respond right away
      break;
  }
};

setInterval(() => {
  const now = performance.now();
  const realDt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (!world) return;

  view.generateVisible(world, 12);

  if (speed > 0) {
    const wanted = speed * realDt;
    const t0 = performance.now();
    const done = world.advance(wanted, SIM_BUDGET_MS);
    simMs = performance.now() - t0;
    lagging = done < wanted * 0.95;
  } else {
    simMs = 0;
    lagging = false;
    world.rebuildIndexes();
  }

  if (now - lastSnapshot >= SNAPSHOT_MS) {
    lastSnapshot = now;
    ctx.postMessage({ type: 'snapshot', snap: view.build(world, speed, simMs, lagging) });
  }
}, LOOP_MS);
