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
import { applyChat, applyGoal, buildContext } from './npc/context';
import { ageYears } from './npc/people';
import { deserialize, serialize } from './save';
import { updateTiers } from './tiers';
import { spaceView } from './space/program';
import { applySandbox } from './sandbox';
import { MINUTES_PER_YEAR, getCalendar } from '../shared/time';

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
let lastOverview = 0;
let simMs = 0;
let lagging = false;

ctx.onmessage = (e) => {
  const msg = e.data;
  switch (msg.type) {
    case 'init': {
      world = new World(msg.seed);
      world.fastForward = speed >= MINUTES_PER_YEAR / 60 - 1;
      const spawn = world.terrain.findSpawn();
      world.populate(spawn.x, spawn.y);
      if (msg.sandbox) applySandbox(world, msg.sandbox);
      ctx.postMessage({ type: 'ready', seed: msg.seed, spawn });
      break;
    }
    case 'setSpeed': {
      speed = Math.max(0, msg.speed);
      // From one game year per real minute upwards, switch to aggregate simulation.
      const ff = speed >= MINUTES_PER_YEAR / 60 - 1;
      if (world && ff !== world.fastForward) {
        world.fastForward = ff;
        updateTiers(world);
      }
      break;
    }
    case 'viewport': {
      view.setViewport(msg);
      if (world) {
        const fx = (msg.x0 + msg.x1) / 2;
        const fy = (msg.y0 + msg.y1) / 2;
        const moved = !world.focus || Math.hypot(world.focus.x - fx, world.focus.y - fy) > 24;
        world.focus = { x: fx, y: fy };
        if (moved) updateTiers(world);
      }
      break;
    }
    case 'select':
      view.selected = msg.target;
      lastSnapshot = 0; // respond right away
      break;
    case 'npcContext': {
      const n = world?.npcById(msg.id);
      ctx.postMessage({ type: 'npcContext', requestId: msg.requestId, context: n && world ? buildContext(world, n) : null });
      break;
    }
    case 'chat':
      if (msg.active) world?.chatting.add(msg.id);
      else world?.chatting.delete(msg.id);
      break;
    case 'chatResult': {
      const n = world?.npcById(msg.id);
      if (n && world) applyChat(world, n, msg.playerText, msg.result);
      lastSnapshot = 0;
      break;
    }
    case 'focusRequest':
      ctx.postMessage({ type: 'focusContexts', requestId: msg.requestId, contexts: world ? focusContexts(world, msg.max) : [] });
      break;
    case 'spaceState':
      if (world) ctx.postMessage({ type: 'spaceState', requestId: msg.requestId, data: spaceView(world) });
      break;
    case 'save':
      if (world) ctx.postMessage({ type: 'saveData', requestId: msg.requestId, data: serialize(world), year: getCalendar(world.state.time).year });
      break;
    case 'load':
      try {
        world = deserialize(msg.data);
        view.reset();
        const home = world.state.settlements.find((s) => !s.abandoned);
        ctx.postMessage({ type: 'ready', seed: world.state.seed, spawn: home ? { x: home.x, y: home.y } : world.terrain.findSpawn() });
      } catch (err) {
        ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      }
      break;
    case 'applyGoal': {
      const n = world?.npcById(msg.id);
      if (n && world) applyGoal(world, n, msg.result);
      break;
    }
  }
};

/** NPCs near the player who could use an LLM to decide what to do next. */
function focusContexts(w: World, max: number) {
  const now = w.state.time;
  const sel = view.selected?.kind === 'npc' ? w.npcById(view.selected.id) : undefined;
  const nearby = view.focusCandidates(w);
  const list = [...(sel ? [sel] : []), ...nearby.filter((n) => n !== sel)];
  const out = [];
  for (const n of list) {
    if (out.length >= max) break;
    if (ageYears(n) < 6 || n.action.kind === 'sleep' || w.chatting.has(n.id)) continue;
    if (n.goal && n.goal.until > now) continue;
    if (now - (w.lastLlmDecision.get(n.id) ?? -1e9) < 12 * 60) continue;
    w.lastLlmDecision.set(n.id, now);
    out.push(buildContext(w, n, true));
  }
  return out;
}

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

  if (now - lastOverview > 1500) {
    lastOverview = now;
    const o = view.overview(world);
    if (o) ctx.postMessage({ type: 'overview', ...o });
  }

  if (now - lastSnapshot >= SNAPSHOT_MS) {
    lastSnapshot = now;
    ctx.postMessage({ type: 'snapshot', snap: view.build(world, speed, simMs, lagging) });
  }
}, LOOP_MS);
