/**
 * Background "deep thinking" for NPCs near the player: every few seconds, if
 * there's spare LLM budget, ask the simulation who could use a decision, ask
 * the LLM what that person wants to do next, and hand the goal back.
 * Distant NPCs never use the LLM; the rules-based brain always runs anyway.
 */
import type { SimClient } from '../bridge/simClient';
import type { BrainClient } from './brainClient';

export function startThinking(sim: SimClient, brain: BrainClient, isPaused: () => boolean): void {
  let busy = false;
  setInterval(async () => {
    if (busy || isPaused() || !brain.canThink()) return;
    busy = true;
    try {
      const { contexts } = await sim.request({ type: 'focusRequest', max: 1, requestId: 0 }, 'focusContexts');
      for (const npc of contexts) {
        const result = await brain.decide({ npc });
        if (result) sim.send({ type: 'applyGoal', id: npc.id, result });
      }
    } finally {
      busy = false;
    }
  }, 4000);
}
