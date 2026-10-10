/**
 * Settlements: where people live together, share a stockpile and build.
 *
 * A settlement starts as a camp (campfire + stockpile + a few huts). The
 * daily planner decides what to build next from what people actually need:
 * homes for families without one, and later farms, workshops and more.
 */
import { BIOMES, Biome, CHUNK_SIZE } from '../../shared/terrain';
import { BUILDINGS, FOODS, RESOURCES, placeName, type ResourceKey } from '../../shared/people';
import { nextFloat, randRange } from '../../shared/rng';
import type { Building, BuildingKind, Npc, ResourceType, Settlement } from '../state';
import type { World } from '../world';

export function emptyStock(): Record<ResourceType, number> {
  return { fruit: 0, grain: 0, meat: 0, fish: 0, wood: 0, stone: 0, tools: 0, cloth: 0, metal: 0, goods: 0 };
}

export function foundSettlement(world: World, x: number, y: number, parentId = -1, name?: string): Settlement {
  const rng = world.state.rng;
  // Make sure the land around is generated so people can find their way.
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) world.ensureChunk(cx + dx, cy + dy);

  const parent = parentId >= 0 ? world.settlement(parentId) : undefined;
  const s: Settlement = {
    id: world.newId(),
    name: name ?? uniqueName(world),
    x: Math.floor(x) + 0.5,
    y: Math.floor(y) + 0.5,
    foundedDay: Math.floor(world.state.time / 1440),
    tier: 'camp',
    stock: emptyStock(),
    tech: parent ? parent.tech.slice() : ['fire'],
    research: {},
    laws: [],
    culture: parent ? { name: parent.culture.name, traits: parent.culture.traits.slice() } : { name: `${placeName(() => nextFloat(rng))}folk`, traits: [] },
    treasury: 0,
    prices: {},
    abstractPop: 0,
    parentId,
    abandoned: false,
    diplomacy: {},
    leaderId: -1,
    lastMigrationDay: Math.floor(world.state.time / 1440),
    lastRaidDay: -999,
    raids: 0,
  };
  world.state.settlements.push(s);
  placeBuilding(world, s, 'campfire', s.x, s.y, 1);
  const pile = findBuildSpot(world, s, 1, 2) ?? { x: s.x + 2, y: s.y };
  placeBuilding(world, s, 'stockpile', pile.x, pile.y, 1);
  return s;
}

function uniqueName(world: World): string {
  const used = new Set(world.state.settlements.map((s) => s.name));
  const r = () => nextFloat(world.state.rng);
  for (let i = 0; i < 20; i++) {
    const n = placeName(r);
    if (!used.has(n)) return n;
  }
  return `${placeName(r)} ${world.state.settlements.length + 1}`;
}

export function placeBuilding(world: World, s: Settlement, kind: BuildingKind, x: number, y: number, progress = 0): Building {
  const b: Building = { id: world.newId(), kind, x, y, settlementId: s.id, progress, crop: 0, amount: 0 };
  world.state.buildings.push(b);
  // Clear plants from the footprint.
  const r = BUILDINGS[kind].size;
  for (let dy = -r + 1; dy < r; dy++) {
    for (let dx = -r + 1; dx < r; dx++) world.removePlantAt(Math.floor(x) + dx, Math.floor(y) + dy);
  }
  world.markBuildingsChanged(b);
  return b;
}

/** Finds free, dry, flat-enough ground near the settlement centre. */
export function findBuildSpot(world: World, s: Settlement, size: number, minRadius = 3): { x: number; y: number } | null {
  const rng = world.state.rng;
  const buildings = world.buildingsOf(s.id);
  const maxR = 6 + Math.sqrt(buildings.length) * 3.2 + size * 2;
  for (let tries = 0; tries < 80; tries++) {
    const radius = minRadius + (tries / 80) * (maxR - minRadius);
    const a = nextFloat(rng) * Math.PI * 2;
    const x = Math.floor(s.x + Math.cos(a) * radius) + 0.5;
    const y = Math.floor(s.y + Math.sin(a) * radius) + 0.5;
    if (!areaBuildable(world, x, y, size)) continue;
    const clash = buildings.some((b) => Math.hypot(b.x - x, b.y - y) < BUILDINGS[b.kind].size + size + 0.6);
    if (clash) continue;
    return { x, y };
  }
  return null;
}

function areaBuildable(world: World, x: number, y: number, size: number): boolean {
  for (let dy = -size; dy <= size; dy++) {
    for (let dx = -size; dx <= size; dx++) {
      const b = world.biomeAt(Math.floor(x) + dx, Math.floor(y) + dy);
      if (b < 0) return false;
      if (!BIOMES[b as Biome].walkable || b === Biome.River || b === Biome.Mountain || b === Biome.Snow) return false;
    }
  }
  return true;
}

export function canAfford(s: Settlement, kind: BuildingKind): boolean {
  const cost = BUILDINGS[kind].cost;
  return Object.entries(cost).every(([k, v]) => s.stock[k as ResourceType] >= (v ?? 0));
}

export function pay(s: Settlement, kind: BuildingKind): void {
  for (const [k, v] of Object.entries(BUILDINGS[kind].cost)) s.stock[k as ResourceType] -= v ?? 0;
}

export function totalFood(s: Settlement): number {
  return FOODS.reduce((sum, f) => sum + s.stock[f as ResourceType] * RESOURCES[f].food, 0);
}

/** Takes one portion of food (the most plentiful kind). Returns hunger relief. */
export function takeFood(s: Settlement): number {
  let best: ResourceKey | null = null;
  for (const f of FOODS) {
    if (s.stock[f as ResourceType] >= 1 && (!best || s.stock[f as ResourceType] > s.stock[best as ResourceType])) best = f;
  }
  if (!best) return 0;
  s.stock[best as ResourceType] -= 1;
  return RESOURCES[best].food;
}

export function residents(world: World, s: Settlement): Npc[] {
  return world.state.npcs.filter((n) => n.settlementId === s.id);
}

export function homeResidents(world: World, homeId: number): Npc[] {
  return world.state.npcs.filter((n) => n.homeId === homeId);
}

/** Once a day: food spoils; homes get planned; tier is updated. */
export function updateSettlementDaily(world: World, s: Settlement): void {
  for (const [k, info] of Object.entries(RESOURCES)) {
    const key = k as ResourceType;
    const storage = s.tech.includes('pottery') ? 0.5 : 1;
    if (info.spoilPerDay > 0) s.stock[key] = Math.max(0, s.stock[key] * (1 - info.spoilPerDay * storage));
  }
  planHousing(world, s);
  assignHomes(world, s);
}

/** Queue a new hut if some household has no home or homes are overcrowded. */
function planHousing(world: World, s: Settlement): void {
  const sites = world.buildingsOf(s.id).filter((b) => b.progress < 1);
  if (sites.length >= 2) return;
  const people = residents(world, s);
  const homes = world.buildingsOf(s.id).filter((b) => BUILDINGS[b.kind].housing > 0);
  const capacity = homes.reduce((n, b) => n + BUILDINGS[b.kind].housing, 0);
  const homeless = people.filter((n) => n.homeId < 0).length;
  const couplesWithoutOwnHome = people.filter(
    (n) => n.partnerId >= 0 && n.married && n.homeId >= 0 &&
      homeResidents(world, n.homeId).some((o) => o.id === n.motherId || o.id === n.fatherId),
  ).length;
  if (people.length + 1 <= capacity && homeless === 0 && couplesWithoutOwnHome === 0) return;
  const kind: BuildingKind = s.tech.includes('masonry') && canAfford(s, 'house') ? 'house' : 'hut';
  if (!canAfford(s, kind)) return;
  const spot = findBuildSpot(world, s, 1);
  if (!spot) return;
  pay(s, kind);
  placeBuilding(world, s, kind, spot.x, spot.y, 0);
}

/** Gives homeless people (and newly-wed couples living with parents) a home. */
function assignHomes(world: World, s: Settlement): void {
  const homes = world.buildingsOf(s.id).filter((b) => BUILDINGS[b.kind].housing > 0 && b.progress >= 1);
  const count = new Map<number, number>();
  for (const n of residents(world, s)) if (n.homeId >= 0) count.set(n.homeId, (count.get(n.homeId) ?? 0) + 1);
  const emptyHome = () => homes.find((h) => (count.get(h.id) ?? 0) === 0);
  const freeHome = (need: number) => homes.find((h) => (count.get(h.id) ?? 0) + need <= BUILDINGS[h.kind].housing);

  for (const n of residents(world, s)) {
    // A married couple living with parents moves into an empty home.
    if (n.married && n.partnerId >= 0 && n.homeId >= 0) {
      const withParents = homeResidents(world, n.homeId).some((o) => o.id === n.motherId || o.id === n.fatherId);
      const partner = world.npcById(n.partnerId);
      if (withParents && partner) {
        const h = emptyHome();
        if (h) {
          for (const p of [n, partner]) {
            count.set(p.homeId, (count.get(p.homeId) ?? 1) - 1);
            p.homeId = h.id;
          }
          count.set(h.id, 2);
          world.log(`${n.firstName} and ${partner.firstName} moved into their own home in ${s.name}.`, 'social', n.id);
        }
      }
    }
    if (n.homeId < 0 || !world.building(n.homeId)) {
      // Children live with a parent if possible.
      const parent = world.npcById(n.motherId) ?? world.npcById(n.fatherId);
      if (parent && parent.homeId >= 0 && parent.settlementId === s.id) {
        n.homeId = parent.homeId;
        continue;
      }
      const h = freeHome(1);
      if (h) {
        n.homeId = h.id;
        count.set(h.id, (count.get(h.id) ?? 0) + 1);
      } else {
        n.homeId = -1;
      }
    }
  }
}

/** A good spot to found a new settlement: grassland near fresh water. */
export function scoutSite(world: World, fromX: number, fromY: number, minDist: number, maxDist: number): { x: number; y: number } | null {
  const rng = world.state.rng;
  for (let tries = 0; tries < 60; tries++) {
    const a = nextFloat(rng) * Math.PI * 2;
    const d = randRange(rng, minDist, maxDist);
    const x = Math.floor(fromX + Math.cos(a) * d);
    const y = Math.floor(fromY + Math.sin(a) * d);
    const sample = world.terrain.sample(x, y);
    if (sample.biome !== Biome.Grass && sample.biome !== Biome.Savanna && sample.biome !== Biome.Forest) continue;
    if (sample.temperature < 2 || sample.temperature > 28) continue;
    // Fresh water within ~10 tiles, and not too close to another settlement.
    let water = false;
    for (let k = 0; k < 24 && !water; k++) {
      const wa = (k / 24) * Math.PI * 2;
      for (const r of [4, 7, 10]) {
        const b = world.terrain.sample(Math.floor(x + Math.cos(wa) * r), Math.floor(y + Math.sin(wa) * r)).biome;
        if (b === Biome.River || b === Biome.Water) water = true;
      }
    }
    if (!water) continue;
    if (world.state.settlements.some((s) => !s.abandoned && Math.hypot(s.x - x, s.y - y) < minDist * 0.8)) continue;
    return { x, y };
  }
  return null;
}
