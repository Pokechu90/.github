/**
 * Conversations and relationships between NPCs. Each chat changes how two
 * people feel about each other (depending on how well their personalities
 * and values fit), passes on gossip, and can spark friendship, rivalry or
 * romance. Couples form, marry and sometimes split up.
 */
import { chance, hashInts, randRange } from '../../shared/rng';
import type { Npc } from '../state';
import type { World } from '../world';
import { attracted, compatibility, fullName, isAdult, rel } from './people';
import { gossip, remember } from './memory';

const announcedRivals = new Set<string>();

/** Fixed "spark" between two people (some pairs just click). */
function chemistry(a: Npc, b: Npc): number {
  const h = hashInts(Math.min(a.id, b.id), Math.max(a.id, b.id), 4242);
  return (h % 1000) / 1000;
}

export function converse(world: World, a: Npc, b: Npc): void {
  const rng = world.state.rng;
  const ra = rel(a, b.id);
  const rb = rel(b, a.id);
  const firstMeeting = ra.familiarity < 0.05;
  const compat = compatibility(a, b);
  const moods = (a.mood + b.mood) * 0.02;
  const delta = (compat - 0.45) * 0.12 + randRange(rng, -0.04, 0.05) + moods;

  ra.affinity = clamp(ra.affinity + delta * (1.1 - a.traits.agreeableness * 0.3), -1, 1);
  rb.affinity = clamp(rb.affinity + delta * (1.1 - b.traits.agreeableness * 0.3), -1, 1);
  ra.familiarity = Math.min(1, ra.familiarity + 0.04);
  rb.familiarity = Math.min(1, rb.familiarity + 0.04);
  a.needs.social = Math.max(0, a.needs.social - 0.4);
  b.needs.social = Math.max(0, b.needs.social - 0.4);

  if (firstMeeting && isAdult(a)) {
    remember(world, a, `I got to know ${fullName(b)}.`, { importance: 0.2, feeling: delta > 0 ? 0.2 : -0.1, about: b.id });
  }

  // Arguments: unfriendly, stubborn people clash.
  if (delta < -0.035 && chance(rng, 1 - (a.traits.agreeableness + b.traits.agreeableness) / 2)) {
    const id = world.newId();
    const share = `${a.firstName} and ${b.firstName} had an argument.`;
    remember(world, a, `I argued with ${b.firstName}.`, { importance: 0.42, feeling: -0.4, about: b.id, eventId: id, share });
    remember(world, b, `I argued with ${a.firstName}.`, { importance: 0.42, feeling: -0.4, about: a.id, eventId: id, share });
    ra.affinity -= 0.05;
    rb.affinity -= 0.05;
    const pair = `${Math.min(a.id, b.id)}:${Math.max(a.id, b.id)}`;
    if (ra.affinity < -0.5 && rb.affinity < -0.5 && !announcedRivals.has(pair)) {
      announcedRivals.add(pair);
      world.log(`${fullName(a)} and ${fullName(b)} have become bitter rivals.`, 'social', a.id);
    }
  }

  // Friendship milestone.
  if (ra.affinity > 0.6 && ra.familiarity > 0.5 && ra.affinity - delta <= 0.6) {
    remember(world, a, `${b.firstName} has become a close friend.`, { importance: 0.55, feeling: 0.6, about: b.id, share: `${a.firstName} and ${b.firstName} are close friends.` });
  }

  // Romance between attracted, single adults (or bonding between partners).
  if (a.partnerId === b.id) {
    ra.affinity = Math.min(1, ra.affinity + 0.03);
    rb.affinity = Math.min(1, rb.affinity + 0.03);
  } else if (a.partnerId < 0 && b.partnerId < 0 && attracted(a, b) && attracted(b, a)) {
    const spark = chemistry(a, b);
    const before = ra.romance;
    ra.romance = Math.min(1, ra.romance + 0.06 * spark * (ra.affinity + 0.6));
    rb.romance = Math.min(1, rb.romance + 0.06 * spark * (rb.affinity + 0.6));
    if (before < 0.4 && ra.romance >= 0.4) {
      remember(world, a, `I think I'm falling for ${b.firstName}.`, { importance: 0.6, feeling: 0.6, about: b.id });
    }
  }

  // Swap news.
  gossip(world, a, b);
  gossip(world, b, a);
}

/** Once a day: couples form, marry or split. */
export function updateRomanceDaily(world: World): void {
  const npcs = world.state.npcs;
  for (const a of npcs) {
    if (!isAdult(a)) continue;
    if (a.partnerId < 0) {
      // Find the person they're most in love with, if it's mutual.
      let best: Npc | null = null;
      let bestR = 0.55;
      for (const [idStr, r] of Object.entries(a.relationships)) {
        if (r.romance < bestR) continue;
        const b = world.npcById(Number(idStr));
        if (!b || b.partnerId >= 0 || (b.relationships[a.id]?.romance ?? 0) < 0.55) continue;
        best = b;
        bestR = r.romance;
      }
      if (best) formCouple(world, a, best);
      continue;
    }
    const partner = world.npcById(a.partnerId);
    if (!partner) {
      a.partnerId = -1;
      a.married = false;
      continue;
    }
    if (a.id > partner.id) continue; // handle each couple once
    const ra = rel(a, partner.id);
    const rb = rel(partner, a.id);
    // Living together slowly brings people closer, or apart if they clash.
    const drift = (compatibility(a, partner) - 0.35) * 0.004;
    ra.affinity = clamp(ra.affinity + drift, -1, 1);
    rb.affinity = clamp(rb.affinity + drift, -1, 1);
    if (!a.married && ra.affinity > 0.45 && rb.affinity > 0.45 && chance(world.state.rng, 0.04)) marry(world, a, partner);
    else if (ra.affinity < -0.15 && rb.affinity < 0.1 && chance(world.state.rng, 0.1)) breakUp(world, a, partner);
  }
}

function formCouple(world: World, a: Npc, b: Npc): void {
  a.partnerId = b.id;
  b.partnerId = a.id;
  const id = world.newId();
  const share = `${a.firstName} and ${b.firstName} are a couple now.`;
  remember(world, a, `${b.firstName} and I are together now.`, { importance: 0.85, feeling: 0.9, about: b.id, eventId: id, share });
  remember(world, b, `${a.firstName} and I are together now.`, { importance: 0.85, feeling: 0.9, about: a.id, eventId: id, share });
  world.log(`${fullName(a)} and ${fullName(b)} fell in love.`, 'social', a.id);
}

function marry(world: World, a: Npc, b: Npc): void {
  a.married = true;
  b.married = true;
  const s = world.settlement(a.settlementId);
  const eventId = world.newId();
  const coupleId = world.newId();
  // The whole village remembers a wedding.
  for (const n of world.residentsOf(a.settlementId)) {
    const self = n.id === a.id || n.id === b.id;
    remember(world, n, self ? `I married ${(n.id === a.id ? b : a).firstName}.` : `${a.firstName} and ${b.firstName} got married.`, {
      importance: self ? 1 : 0.4, feeling: self ? 1 : 0.4, about: n.id === a.id ? b.id : a.id, eventId: self ? coupleId : eventId,
      share: `${a.firstName} and ${b.firstName} got married.`,
    });
  }
  world.log(`${fullName(a)} and ${fullName(b)} were married${s ? ` in ${s.name}` : ''}.`, 'social', a.id);
}

function breakUp(world: World, a: Npc, b: Npc): void {
  a.partnerId = -1;
  b.partnerId = -1;
  a.married = false;
  b.married = false;
  rel(a, b.id).romance = 0;
  rel(b, a.id).romance = 0;
  const id = world.newId();
  const share = `${a.firstName} and ${b.firstName} split up.`;
  remember(world, a, `${b.firstName} and I separated.`, { importance: 0.8, feeling: -0.7, about: b.id, eventId: id, share });
  remember(world, b, `${a.firstName} and I separated.`, { importance: 0.8, feeling: -0.7, about: a.id, eventId: id, share });
  world.log(`${fullName(a)} and ${fullName(b)} separated.`, 'social', a.id);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
