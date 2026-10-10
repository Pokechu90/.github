/**
 * Memory: a short list of recent experiences, plus a small set of long-term
 * memories that are kept when the recent list overflows. Only the important
 * things survive, so memory stays small however long someone lives.
 *
 * Memories spread: when people talk, they pass on something they know
 * (gossip), so NPCs only "know" what they saw or were told.
 */
import { chance, pick } from '../../shared/rng';
import type { MemoryEntry, Npc } from '../state';
import type { World } from '../world';

const RECENT_MAX = 24;
const LONG_TERM_MAX = 16;

export interface RememberOptions {
  importance?: number;
  feeling?: number;
  about?: number;
  eventId?: number;
  heardFrom?: number;
  /** Third-person version others can hear as gossip (omit = private). */
  share?: string | null;
}

export function remember(world: World, npc: Npc, text: string, o: RememberOptions = {}): MemoryEntry {
  const entry: MemoryEntry = {
    eventId: o.eventId ?? world.newId(),
    time: world.state.time,
    text,
    importance: o.importance ?? 0.3,
    feeling: o.feeling ?? 0,
    about: o.about ?? -1,
    heardFrom: o.heardFrom ?? -1,
    share: o.share ?? null,
  };
  // Don't remember the very same event twice.
  if (npc.memory.recent.some((m) => m.eventId === entry.eventId) || npc.memory.longTerm.some((m) => m.eventId === entry.eventId)) {
    return entry;
  }
  npc.memory.recent.push(entry);
  if (npc.memory.recent.length > RECENT_MAX) consolidate(npc);
  return entry;
}

/** Moves the oldest recent memories out; the important ones become long-term. */
function consolidate(npc: Npc): void {
  const old = npc.memory.recent.splice(0, 8);
  for (const m of old) if (m.importance >= 0.55) npc.memory.longTerm.push(m);
  if (npc.memory.longTerm.length > LONG_TERM_MAX) {
    npc.memory.longTerm.sort((a, b) => b.importance - a.importance);
    npc.memory.longTerm.length = LONG_TERM_MAX;
    npc.memory.longTerm.sort((a, b) => a.time - b.time);
  }
}

/** The speaker tells the listener something the listener doesn't know yet. */
export function gossip(world: World, speaker: Npc, listener: Npc): MemoryEntry | null {
  const known = new Set([...listener.memory.recent, ...listener.memory.longTerm].map((m) => m.eventId));
  const candidates = [...speaker.memory.recent, ...speaker.memory.longTerm].filter(
    (m) => m.share !== null && m.importance >= 0.4 && !known.has(m.eventId) && m.about !== listener.id,
  );
  if (!candidates.length || !chance(world.state.rng, 0.6)) return null;
  const m = pick(world.state.rng, candidates);
  return remember(world, listener, m.share!, {
    share: m.share,
    eventId: m.eventId,
    importance: m.importance * 0.7,
    feeling: m.feeling * 0.5,
    about: m.about,
    heardFrom: speaker.id,
  });
}

/** How memories colour mood: recent strong feelings matter most. */
export function memoryMood(world: World, npc: Npc): number {
  let sum = 0;
  const now = world.state.time;
  for (const m of npc.memory.recent) {
    const ageDays = (now - m.time) / 1440;
    if (ageDays > 20) continue;
    sum += m.feeling * m.importance * (1 - ageDays / 20);
  }
  return Math.max(-1, Math.min(1, sum * 0.5));
}

export function allMemories(npc: Npc): MemoryEntry[] {
  return [...npc.memory.longTerm, ...npc.memory.recent];
}
