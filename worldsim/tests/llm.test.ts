import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { buildContext, applyChat } from '../src/sim/npc/context';
import { chatUserPrompt, decideUserPrompt, sanitizeChat } from '../src/shared/llm';
import { offlineReply } from '../src/llm/offline';
import { MINUTES_PER_DAY } from '../src/shared/time';

function world(): World {
  const w = new World(42);
  const s = w.terrain.findSpawn();
  w.populate(s.x, s.y);
  w.advance(MINUTES_PER_DAY * 3);
  return w;
}

describe('LLM bridge', () => {
  it('builds a rich, readable character sheet', () => {
    const w = world();
    const n = w.state.npcs.find((p) => p.job !== 'child')!;
    const ctx = buildContext(w, n, true);
    const prompt = chatUserPrompt({ npc: ctx, history: [], message: 'Hello there!' });
    console.log(prompt);
    console.log(decideUserPrompt({ npc: ctx }).split('GOAL OPTIONS')[1]);
    expect(prompt).toContain(n.firstName);
    expect(ctx.goalOptions!.length).toBeGreaterThan(3);
  });

  it('remembers conversations and changes feelings', () => {
    const w = world();
    const n = w.state.npcs[0];
    const r = sanitizeChat({ reply: 'Hi.', emotion: 'happy', affinity_change: 5, remember: 'A kind stranger greeted me.', importance: 0.6, intent: 'none', new_goal: '', lied: false });
    expect(r.affinity_change).toBe(0.3);
    applyChat(w, n, 'Hello', r);
    expect(n.playerAffinity).toBeCloseTo(0.3);
    expect(n.memory.recent.some((m) => m.about === -2)).toBe(true);
    expect(buildContext(w, n).memoriesOfPlayer.join(' ')).toContain('kind stranger');
  });

  it('offline replies stay in character', () => {
    const w = world();
    const ctx = buildContext(w, w.state.npcs[0]);
    const r = offlineReply({ npc: ctx, history: [], message: 'What is your name?' });
    expect(r.reply).toContain(ctx.name.split(' ')[0]);
  });
});
