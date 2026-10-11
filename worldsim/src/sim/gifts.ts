/**
 * Gifts from the player. You build up "influence" while the world runs and
 * spend it on gifts for a town or a single person. What you can give depends
 * on the era they live in: a feast or warm furs for a Stone Age camp, books and
 * gold for an ancient city, vaccines and computers in the modern age, launch
 * pads and spacesuits at the dawn of space travel.
 *
 * Every gift has a real effect in the simulation, and people remember who it
 * came from (memories about the player), so they bring it up when you talk to
 * them. Personal items are kept for life and handed down to a child as heirlooms.
 */
import type { Building, BuildingKind, Npc, Settlement, SkillKey } from './state';
import type { World } from './world';
import type { GiftOption, SelectTarget } from '../shared/protocol';
import { BUILDINGS, DISEASES, JOBS } from '../shared/people';
import { DAYS_PER_YEAR } from '../shared/time';
import { ERAS, TECH_BY_ID, currentFocus, discover, eraOf, hasTech } from './society/tech';
import { findBuildSpot, placeBuilding } from './society/settlement';
import { population } from './society/work';
import { ageYears, clamp01, fullName, isAdult } from './npc/people';
import { remember } from './npc/memory';
import { makeAnimal } from './ecology/animals';
import { endWar, ongoingWars } from './society/war';
import { starsNear, planetsOf } from '../shared/galaxy';

export const MAX_INFLUENCE = 100;
/** Influence gained per real second while the game is running. */
export const INFLUENCE_PER_SECOND = 0.25;

export interface PlayerState {
  influence: number;
  giftsGiven: number;
}

export function emptyPlayer(): PlayerState {
  return { influence: 50, giftsGiven: 0 };
}

// ------------------------------------------------------------------ items

export interface ItemDef {
  id: string;
  icon: string;
  name: string;
  era: number;
  tech?: string;
  minAge: number;
  description: string;
  /** Skill bonus when someone receives (or inherits) it. */
  skill?: [SkillKey, number];
}

export const ITEMS: ItemDef[] = [
  { id: 'furs', icon: '🧥', name: 'Warm furs', era: 0, minAge: 0, description: 'Far less likely to fall ill in winter.' },
  { id: 'spear', icon: '🗡️', name: 'Fine spear', era: 0, minAge: 10, description: 'A better hunter.', skill: ['hunting', 0.25] },
  { id: 'plough', icon: '🌱', name: 'Plough', era: 1, tech: 'agriculture', minAge: 12, description: 'A better farmer.', skill: ['farming', 0.25] },
  { id: 'book', icon: '📖', name: 'Book', era: 2, tech: 'writing', minAge: 6, description: 'Learns to think like a scholar.', skill: ['research', 0.2] },
  { id: 'herbs', icon: '🌿', name: 'Herbal remedies', era: 2, tech: 'medicine', minAge: 12, description: 'Becomes a better healer.', skill: ['medicine', 0.25] },
  { id: 'telescope', icon: '🔭', name: 'Telescope', era: 3, tech: 'mathematics', minAge: 10, description: 'Studies the sky: research skill.', skill: ['research', 0.3] },
  { id: 'bicycle', icon: '🚲', name: 'Bicycle', era: 4, tech: 'industry', minAge: 6, description: 'Gets around 40% faster.' },
  { id: 'medkit', icon: '🩹', name: 'First-aid kit', era: 4, tech: 'germ_theory', minAge: 12, description: 'Illnesses are far less deadly for them.' },
  { id: 'radio', icon: '📻', name: 'Radio', era: 5, tech: 'electricity', minAge: 6, description: 'Company at home: loneliness grows more slowly.' },
  { id: 'car', icon: '🚗', name: 'Motor car', era: 5, tech: 'electricity', minAge: 17, description: 'Travels more than twice as fast.' },
  { id: 'computer', icon: '💻', name: 'Computer', era: 6, tech: 'computing', minAge: 8, description: 'Research skill, and a window on the world.', skill: ['research', 0.3] },
  { id: 'phone', icon: '📱', name: 'Mobile phone', era: 6, tech: 'computing', minAge: 10, description: 'Always in touch: loneliness grows much more slowly.' },
  { id: 'spacesuit', icon: '🧑‍🚀', name: 'Spacesuit', era: 7, tech: 'spaceflight', minAge: 18, description: 'First in line for crewed space missions.' },
];
export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

/** "a telescope", "an ...", "warm furs" (plurals take no article). */
export function aName(item: ItemDef): string {
  const name = item.name.toLowerCase();
  if (name.endsWith('s')) return name;
  return /^[aeiou]/.test(name) ? `an ${name}` : `a ${name}`;
}

export function hasItem(n: Npc, id: string): boolean {
  return n.items.includes(id);
}

/** Walking speed multiplier from vehicles. */
export function itemSpeed(n: Npc): number {
  if (n.items.includes('car') && ageYears(n) >= 17) return 2.2;
  if (n.items.includes('bicycle')) return 1.4;
  return 1;
}

/** How fast loneliness grows (1 = normal). */
export function itemLoneliness(n: Npc): number {
  if (n.items.includes('phone')) return 0.4;
  if (n.items.includes('radio')) return 0.6;
  return 1;
}

function giveItem(world: World, n: Npc, item: ItemDef, fromText: string, about = -2): void {
  if (n.items.includes(item.id)) return;
  n.items.push(item.id);
  if (item.skill) n.skills[item.skill[0]] = clamp01(n.skills[item.skill[0]] + item.skill[1] * (1 - n.skills[item.skill[0]]));
  remember(world, n, fromText, { importance: 0.7, feeling: 0.7, about, share: `${n.firstName} has ${aName(item)} now.` });
}

/** When someone dies, their belongings go to a child (or their partner). */
export function passOnItems(world: World, dead: Npc): void {
  if (!dead.items.length) return;
  const heirs = dead.childrenIds.map((id) => world.npcById(id)).filter((c): c is Npc => !!c)
    .sort((a, b) => b.ageDays - a.ageDays);
  const partner = world.npcById(dead.partnerId);
  if (partner) heirs.push(partner);
  if (!heirs.length) return;
  const relation = (h: Npc) => (h === partner ? 'my late partner' : dead.sex === 'female' ? 'my mother' : 'my father');
  for (const id of dead.items) {
    const item = ITEM_BY_ID.get(id);
    const heir = heirs.find((h) => !h.items.includes(id));
    if (!item || !heir) continue;
    giveItem(world, heir, item, `I inherited ${relation(heir)} ${dead.firstName}'s ${item.name.toLowerCase()}.`, dead.id);
  }
}

// ------------------------------------------------------------------ gifts

interface GiftDef {
  id: string;
  icon: string;
  name: string;
  target: 'town' | 'person';
  era: number;
  tech?: string;
  cost: number | ((s: Settlement) => number);
  description: string;
  /** A reason the gift can't be given right now, or null. */
  blocked?(world: World, s: Settlement, n: Npc | null): string | null;
  /** Applies the gift and returns the sentence for the history, or null if it couldn't be done. */
  apply(world: World, s: Settlement, n: Npc | null): string | null;
}

const GIFTS: GiftDef[] = [
  // ---------------------------------------------------------- towns
  {
    id: 'feast', icon: '🍖', name: 'A great feast', target: 'town', era: 0, cost: 8,
    description: 'About a week of food for everyone, and a happy evening.',
    apply(world, s) {
      const pop = Math.max(5, population(world, s));
      if (hasTech(s, 'agriculture')) s.stock.grain += pop * 5;
      else {
        s.stock.meat += pop * 3;
        s.stock.fruit += pop * 3;
      }
      cheer(world, s, 0.25, 'A great feast appeared out of nowhere. The stranger sent it!');
      return `${s.name} received a great feast.`;
    },
  },
  {
    id: 'herd', icon: '🦌', name: 'A herd of deer', target: 'town', era: 0, cost: 6,
    description: 'Ten deer arrive in the meadows nearby: good hunting for years.',
    apply(world, s) {
      const r = world.state.rng;
      let placed = 0;
      for (let i = 0; i < 60 && placed < 10; i++) {
        const a = world.rand() * Math.PI * 2;
        const d = 8 + world.rand() * 12;
        const x = s.x + Math.cos(a) * d;
        const y = s.y + Math.sin(a) * d;
        if (!world.isWalkable(x, y)) continue;
        world.state.animals.push(makeAnimal(world, r, x, y, (2 + world.rand() * 4) * DAYS_PER_YEAR, -1));
        placed++;
      }
      cheer(world, s, 0.1, 'A herd of deer wandered close to home, a gift from the stranger.');
      return `A herd of ${placed} deer came to graze near ${s.name}.`;
    },
  },
  {
    id: 'healing', icon: '🌿', name: 'Healing', target: 'town', era: 0, cost: 12,
    description: 'Everyone who is sick gets well at once.',
    blocked: (world, s) => (world.residentsOf(s.id).some((n) => n.illness || n.health < 0.6) ? null : 'Nobody here is sick.'),
    apply(world, s) {
      let healed = 0;
      for (const n of world.residentsOf(s.id)) {
        if (n.illness || n.health < 0.6) healed++;
        heal(world, n);
      }
      cheer(world, s, 0.2, 'Every sick person in town was healed overnight. They say it was the stranger.');
      return `${healed} sick people in ${s.name} were healed.`;
    },
  },
  {
    id: 'materials', icon: '🪵', name: 'Timber and stone', target: 'town', era: 0, cost: 6,
    description: '60 wood and 30 stone for building.',
    apply(_world, s) {
      s.stock.wood += 60;
      s.stock.stone += 30;
      return `${s.name} received timber and stone.`;
    },
  },
  {
    id: 'festival', icon: '🎉', name: 'A festival', target: 'town', era: 0, cost: 5,
    description: 'A day of music and dancing: everyone is happy and less lonely.',
    apply(world, s) {
      for (const n of world.residentsOf(s.id)) {
        n.needs.social = 0;
        n.needs.purpose = Math.min(n.needs.purpose, 0.2);
        n.needs.safety = 0;
      }
      cheer(world, s, 0.4, 'We held a wonderful festival, thanks to the stranger.');
      return `${s.name} held a festival.`;
    },
  },
  {
    id: 'builders', icon: '🏗️', name: "Builders' blessing", target: 'town', era: 0, cost: 10,
    description: 'Everything under construction is finished at once.',
    blocked: (world, s) => (world.buildingsOf(s.id).some((b) => b.progress < 1) ? null : 'Nothing is being built.'),
    apply(world, s) {
      const list = world.buildingsOf(s.id).filter((b) => b.progress < 1);
      for (const b of list) {
        b.progress = 1;
        world.markBuildingsChanged(b, true);
      }
      cheer(world, s, 0.15, 'All the building work in town was finished overnight!');
      return `${list.length} buildings in ${s.name} were finished overnight.`;
    },
  },
  {
    id: 'inspiration', icon: '💡', name: 'Inspiration', target: 'town', era: 0, cost: (s) => 10 + 4 * eraOf(s),
    description: 'A burst of ideas: research jumps forward.',
    blocked: (world, s) => (currentFocus(world, s) ? null : 'Nothing left to discover.'),
    apply(world, s) {
      const t = currentFocus(world, s)!;
      s.research[t.id] = (s.research[t.id] ?? 0) + t.cost * 0.4;
      return `The people of ${s.name} had a burst of ideas about ${t.name.toLowerCase()}.`;
    },
  },
  {
    id: 'harvest', icon: '🌾', name: 'Bountiful harvest', target: 'town', era: 1, tech: 'agriculture', cost: 10,
    description: 'Every field ripens at once and the granary fills.',
    apply(world, s) {
      for (const f of world.buildingsOf(s.id)) {
        if (f.kind !== 'farm' || f.progress < 1) continue;
        f.crop = 1;
        world.markBuildingsChanged(f);
      }
      s.stock.grain += Math.max(5, population(world, s)) * 4;
      cheer(world, s, 0.2, 'The fields ripened overnight. A gift from the stranger!');
      return `The fields of ${s.name} gave a miraculous harvest.`;
    },
  },
  {
    id: 'scroll', icon: '📜', name: 'A scroll of knowledge', target: 'town', era: 2, tech: 'writing', cost: (s) => 25 + 8 * eraOf(s),
    description: 'Teaches the technology they are working towards right now.',
    blocked: (world, s) => (currentFocus(world, s) ? null : 'Nothing left to discover.'),
    apply(world, s) {
      const t = currentFocus(world, s)!;
      discover(world, s, t, null);
      return `A mysterious scroll taught ${s.name} ${t.name.toLowerCase()}.`;
    },
  },
  {
    id: 'gold', icon: '💰', name: 'A chest of gold', target: 'town', era: 2, tech: 'currency', cost: 10,
    description: '300 coins for the treasury and 20 for every adult.',
    apply(world, s) {
      s.treasury += 300;
      for (const n of world.residentsOf(s.id)) if (isAdult(n)) n.wealth += 20;
      cheer(world, s, 0.2, 'A chest of gold was found in the square, with a note from the stranger.');
      return `${s.name} found a chest of gold.`;
    },
  },
  {
    id: 'peace', icon: '🕊️', name: 'Peace', target: 'town', era: 2, cost: 12,
    description: 'Ends their wars and old grudges fade: friendly relations with every other town.',
    blocked: (world, s) => (world.state.settlements.some((o) => o !== s && !o.abandoned) ? null : 'There are no other towns.'),
    apply(world, s) {
      for (const w of ongoingWars(world)) if (w.attackerId === s.id || w.defenderId === s.id) endWar(world, w, null, 'The Stranger brought peace.', false);
      for (const o of world.state.settlements) {
        if (o === s || o.abandoned) continue;
        s.diplomacy[o.id] = Math.max(0.6, s.diplomacy[o.id] ?? 0);
        o.diplomacy[s.id] = Math.max(0.6, o.diplomacy[s.id] ?? 0);
      }
      s.lastRaidDay = Math.floor(world.state.time / 1440);
      cheer(world, s, 0.15, 'Our quarrels with the neighbours were forgotten.');
      return `${s.name} made peace with all its neighbours.`;
    },
  },
  {
    id: 'metal', icon: '⚒️', name: 'Tools and metal', target: 'town', era: 3, tech: 'metalwork', cost: 8,
    description: '40 tools and 40 metal.',
    apply(_world, s) {
      s.stock.tools += 40;
      s.stock.metal += 40;
      return `${s.name} received tools and metal.`;
    },
  },
  {
    id: 'charts', icon: '🗺️', name: 'Star charts', target: 'town', era: 3, tech: 'mathematics', cost: 15,
    description: 'Maps of eight more stars and their planets.',
    blocked: (world) => (nextStars(world).length ? null : 'Every nearby star is already known.'),
    apply(world) {
      const sp = world.state.space;
      const stars = nextStars(world);
      for (const st of stars) {
        sp.knownStars.push(st.id);
        for (const p of planetsOf(world.state.seed, st)) if (!sp.charted.includes(p.id)) sp.charted.push(p.id);
      }
      return `Star charts showing ${stars.length} new stars appeared in an observatory.`;
    },
  },
  {
    id: 'vaccines', icon: '💉', name: 'Vaccines', target: 'town', era: 4, tech: 'germ_theory', cost: 25,
    description: 'Cures the sick and protects everyone from every disease for 3 years.',
    apply(world, s) {
      const until = Math.floor(world.state.time / 1440) + 3 * DAYS_PER_YEAR;
      for (const n of world.residentsOf(s.id)) {
        heal(world, n);
        for (const d of Object.keys(DISEASES)) n.immunity[d] = Math.max(n.immunity[d] ?? 0, until);
      }
      cheer(world, s, 0.2, 'Everyone in town was vaccinated.');
      return `Everyone in ${s.name} was vaccinated.`;
    },
  },
  building('factory', '🏭', 4, 'industry', 20, 'Mass-produces goods.'),
  building('powerplant', '⚡', 5, 'electricity', 25, 'Electricity for the whole town.'),
  building('lab', '🔬', 6, 'computing', 25, 'Research goes 50% faster.'),
  building('launchpad', '🚀', 6, 'rocketry', 35, 'A ready launch pad: rockets can fly from here.'),
  {
    id: 'rocketparts', icon: '🛰️', name: 'Rocket parts', target: 'town', era: 7, tech: 'spaceflight', cost: 20,
    description: '150 metal and 100 goods: enough for a crewed mission or a colony ship.',
    apply(_world, s) {
      s.stock.metal += 150;
      s.stock.goods += 100;
      return `${s.name} received a shipment of rocket parts.`;
    },
  },

  // ---------------------------------------------------------- people
  {
    id: 'heal', icon: '❤️', name: 'Healing', target: 'person', era: 0, cost: 4,
    description: 'Cures their illness and restores their health.',
    blocked: (_w, _s, n) => (n!.illness || n!.health < 0.9 ? null : 'They are already healthy.'),
    apply(world, s, n) {
      heal(world, n!);
      remember(world, n!, 'I was healed. The stranger did it!', { importance: 0.8, feeling: 0.8, about: -2, share: `${n!.firstName} was healed by a miracle.` });
      return `${fullName(n!)} of ${s.name} was healed.`;
    },
  },
  {
    id: 'longlife', icon: '⏳', name: 'Long life', target: 'person', era: 0, cost: 15,
    description: 'Ten more years of life.',
    apply(world, s, n) {
      n!.lifespanDays += 10 * DAYS_PER_YEAR;
      remember(world, n!, 'I feel younger than I have in years.', { importance: 0.6, feeling: 0.7, about: -2 });
      return `${fullName(n!)} of ${s.name} was blessed with a long life.`;
    },
  },
  {
    id: 'talent', icon: '🎓', name: 'A talent', target: 'person', era: 0, cost: 5,
    description: 'Much better at their work.',
    blocked: (_w, _s, n) => (n!.job === 'child' ? 'Children have no trade yet.' : null),
    apply(world, s, n) {
      const skill = JOBS[n!.job].skill as SkillKey;
      n!.skills[skill] = clamp01(n!.skills[skill] + 0.3 * (1 - n!.skills[skill]));
      remember(world, n!, `Suddenly I'm much better at ${JOBS[n!.job].verb}.`, { importance: 0.6, feeling: 0.7, about: -2 });
      return `${fullName(n!)} of ${s.name} became a gifted ${JOBS[n!.job].name.toLowerCase()}.`;
    },
  },
  {
    id: 'joy', icon: '😊', name: 'Joy', target: 'person', era: 0, cost: 2,
    description: 'Cheers them up: not hungry, lonely, bored or afraid.',
    apply(world, s, n) {
      n!.needs.hunger = 0;
      n!.needs.social = 0;
      n!.needs.purpose = 0;
      n!.needs.safety = 0;
      n!.mood = Math.min(1, n!.mood + 0.5);
      remember(world, n!, 'The stranger made my day wonderful.', { importance: 0.4, feeling: 0.9, about: -2 });
      return `${fullName(n!)} of ${s.name} had a wonderful day.`;
    },
  },
  {
    id: 'child', icon: '👶', name: 'A child', target: 'person', era: 0, cost: 10,
    description: 'A couple who live together will have a baby.',
    blocked(world, _s, n) {
      const mother = expectingMother(world, n!);
      if (typeof mother === 'string') return mother;
      return null;
    },
    apply(world, s, n) {
      const mother = expectingMother(world, n!) as Npc;
      const father = world.npcById(mother.partnerId)!;
      mother.pregnantDays = 0;
      mother.pregnancyFatherId = father.id;
      const id = world.newId();
      const share = `${mother.firstName} is expecting a baby with ${father.firstName}.`;
      remember(world, mother, "I'm expecting a baby! The stranger blessed us.", { importance: 0.9, feeling: 0.9, about: -2, eventId: id, share });
      remember(world, father, `${mother.firstName} is expecting our baby!`, { importance: 0.8, feeling: 0.8, about: mother.id, eventId: id, share });
      return `${fullName(mother)} and ${fullName(father)} of ${s.name} are expecting a baby.`;
    },
  },
  {
    id: 'coins', icon: '🪙', name: 'A purse of coins', target: 'person', era: 2, tech: 'currency', cost: 3,
    description: '50 coins to spend.',
    apply(world, s, n) {
      n!.wealth += 50;
      remember(world, n!, 'I found a purse of coins with my name on it.', { importance: 0.5, feeling: 0.7, about: -2 });
      return `${fullName(n!)} of ${s.name} received a purse of coins.`;
    },
  },
  ...ITEMS.map(itemGift),
];

const GIFT_BY_ID = new Map(GIFTS.map((g) => [g.id, g]));

function itemGift(item: ItemDef): GiftDef {
  return {
    id: `item:${item.id}`, icon: item.icon, name: item.name, target: 'person', era: item.era, tech: item.tech,
    cost: 4 + item.era * 2,
    description: item.description,
    blocked(_w, _s, n) {
      if (n!.items.includes(item.id)) return 'They already have one.';
      if (ageYears(n!) < item.minAge) return `Too young (needs age ${item.minAge}).`;
      return null;
    },
    apply(world, s, n) {
      giveItem(world, n!, item, `The stranger gave me ${aName(item)}!`);
      return `${fullName(n!)} of ${s.name} received ${aName(item)}.`;
    },
  };
}

function building(kind: BuildingKind, icon: string, era: number, tech: string, cost: number, what: string): GiftDef {
  const name = BUILDINGS[kind].name;
  return {
    id: `build:${kind}`, icon, name: `A ${name.toLowerCase()}`, target: 'town', era, tech, cost,
    description: `A finished ${name.toLowerCase()} appears. ${what}`,
    blocked(world, s) {
      if (kind === 'launchpad' && world.buildingsOf(s.id).some((b) => b.kind === 'launchpad')) return 'They already have a launch pad.';
      return null;
    },
    apply(world, s) {
      // (Looking for a spot uses the world's random numbers, so only do it when actually giving.)
      const size = BUILDINGS[kind].size;
      const spot = findBuildSpot(world, s, size, size + 3);
      if (!spot) return null;
      const b: Building = placeBuilding(world, s, kind, spot.x, spot.y, 1);
      world.markBuildingsChanged(b, true);
      cheer(world, s, 0.15, `A ${name.toLowerCase()} appeared in town overnight.`);
      return `A ${name.toLowerCase()} appeared in ${s.name} overnight.`;
    },
  };
}

// ------------------------------------------------------------------ helpers

function heal(world: World, n: Npc): void {
  if (n.illness) {
    const day = Math.floor(world.state.time / 1440);
    n.immunity[n.illness.disease] = day + DISEASES[n.illness.disease].immunityDays;
    n.illness = null;
  }
  n.health = 1;
}

/** Everyone in town feels better and remembers the gift came from the player. */
function cheer(world: World, s: Settlement, mood: number, memory: string): void {
  const eventId = world.newId();
  for (const n of world.residentsOf(s.id)) {
    n.mood = Math.min(1, n.mood + mood);
    n.playerAffinity = Math.min(1, n.playerAffinity + 0.05);
    remember(world, n, memory, { importance: 0.55, feeling: 0.7, about: -2, eventId, share: memory });
  }
}

function expectingMother(world: World, n: Npc): Npc | string {
  const partner = world.npcById(n.partnerId);
  if (!partner) return 'They need a partner first.';
  const mother = n.sex === 'female' ? n : partner.sex === 'female' ? partner : null;
  const father = mother === n ? partner : n;
  if (!mother || father.sex !== 'male') return 'This couple cannot have a baby together.';
  if (mother.pregnantDays >= 0) return 'Already expecting a baby.';
  const age = ageYears(mother);
  if (age < 17 || age > 48) return `${mother.firstName} is too ${age < 17 ? 'young' : 'old'}.`;
  return mother;
}

let starCache: { key: string; stars: ReturnType<typeof starsNear> } | null = null;

function nextStars(world: World) {
  const sp = world.state.space;
  const key = `${world.state.seed}:${sp.knownStars.length}`;
  if (starCache?.key === key) return starCache.stars;
  const known = new Set(sp.knownStars);
  const stars = starsNear(world.state.seed, 0, 0, 80)
    .filter((st) => !known.has(st.id))
    .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))
    .slice(0, 8);
  starCache = { key, stars };
  return stars;
}

function costOf(g: GiftDef, s: Settlement): number {
  return typeof g.cost === 'number' ? g.cost : g.cost(s);
}

function resolve(world: World, target: SelectTarget): { s: Settlement; n: Npc | null } | null {
  if (target.kind === 'settlement') {
    const s = world.settlement(target.id);
    return s && !s.abandoned ? { s, n: null } : null;
  }
  if (target.kind === 'npc') {
    const n = world.npcById(target.id);
    const s = n ? world.settlement(n.settlementId) : undefined;
    return n && s ? { s, n } : null;
  }
  return null;
}

// ------------------------------------------------------------------ API

/** The gifts on offer for a town or person: their era's and the next era's (locked). */
export function giftOptions(world: World, target: SelectTarget): GiftOption[] {
  const r = resolve(world, target);
  if (!r) return [];
  const era = eraOf(r.s);
  const kind = r.n ? 'person' : 'town';
  const influence = world.state.player.influence;
  const out: GiftOption[] = [];
  for (const g of GIFTS.slice().sort((a, b) => a.era - b.era)) {
    if (g.target !== kind || g.era > era + 1) continue;
    let reason: string | null = null;
    if (g.tech && !hasTech(r.s, g.tech)) reason = `Needs ${TECH_BY_ID.get(g.tech)?.name ?? g.tech} (${ERAS[g.era]})`;
    else reason = g.blocked?.(world, r.s, r.n) ?? null;
    const cost = costOf(g, r.s);
    out.push({ id: g.id, icon: g.icon, name: g.name, description: g.description, cost, era: ERAS[g.era], locked: reason, affordable: cost <= influence });
  }
  return out;
}

/** Gives a gift. Returns what happened, or why it couldn't be given. */
export function giveGift(world: World, giftId: string, target: SelectTarget): { ok: boolean; text: string } {
  const g = GIFT_BY_ID.get(giftId);
  const r = resolve(world, target);
  if (!g || !r) return { ok: false, text: 'They are no longer there.' };
  if ((g.target === 'person') !== !!r.n) return { ok: false, text: 'That gift is for someone else.' };
  if (g.tech && !hasTech(r.s, g.tech)) return { ok: false, text: `They don't know ${TECH_BY_ID.get(g.tech)?.name.toLowerCase()} yet.` };
  const reason = g.blocked?.(world, r.s, r.n);
  if (reason) return { ok: false, text: reason };
  const cost = costOf(g, r.s);
  const p = world.state.player;
  if (p.influence < cost) return { ok: false, text: `Not enough influence (${Math.floor(p.influence)} of ${cost}).` };
  const text = g.apply(world, r.s, r.n);
  if (!text) return { ok: false, text: 'There is no room for it.' };
  p.influence -= cost;
  p.giftsGiven++;
  if (r.n) r.n.playerAffinity = Math.min(1, r.n.playerAffinity + 0.25);
  if (r.n) r.n.playerFamiliarity = Math.min(1, r.n.playerFamiliarity + 0.1);
  world.log(text, 'gift', r.n?.id ?? -1);
  // Towns that receive many gifts start to revere the giver.
  r.s.giftsReceived = (r.s.giftsReceived ?? 0) + 1;
  if (r.s.giftsReceived === 5 && !r.s.culture.traits.includes('reveres the Stranger')) {
    r.s.culture.traits.push('reveres the Stranger');
    world.log(`The people of ${r.s.name} have come to revere the Stranger who sends them gifts.`, 'settlement', -1);
  }
  return { ok: true, text };
}

/** Called by the worker as real time passes (influence is a player resource, not game time). */
export function gainInfluence(world: World, realSeconds: number): void {
  const p = world.state.player;
  p.influence = Math.min(MAX_INFLUENCE, p.influence + realSeconds * INFLUENCE_PER_SECOND);
}
