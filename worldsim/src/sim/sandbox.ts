/**
 * Sandbox shortcuts for trying out late-game features without waiting
 * centuries: add ?sandbox=space (or =modern, or =kingdoms) to the page address.
 */
import { TECHS } from './society/tech';
import { findBuildSpot, foundSettlement, placeBuilding, scoutSite } from './society/settlement';
import { createNpc } from './npc/people';
import type { World } from './world';

export function applySandbox(world: World, mode: string): void {
  const s = world.state.settlements[0];
  if (!s) return;
  if (mode === 'kingdoms') return kingdoms(world);
  const upTo = mode === 'modern' ? 'computing' : 'warp_drive';
  const last = TECHS.findIndex((t) => t.id === upTo);
  s.tech = TECHS.slice(0, last + 1).map((t) => t.id);
  Object.assign(s.stock, { grain: 20000, fish: 3000, wood: 3000, stone: 3000, metal: 3000, goods: 3000, tools: 300, cloth: 300 });
  for (let i = 0; i < 70; i++) world.state.npcs.push(createNpc(world, { x: s.x + (i % 7) - 3, y: s.y + Math.floor(i / 7) - 3, ageYears: 18 + (i % 25), settlementId: s.id }));
  world.rebuildIndexes();
  if (mode === 'space') {
    const spot = findBuildSpot(world, s, 3, 7) ?? { x: s.x + 9, y: s.y + 9 };
    placeBuilding(world, s, 'launchpad', spot.x, spot.y, 1);
  }
  world.assignJobsFor(s);
  world.log(`Sandbox mode: ${s.name} starts with modern knowledge.`, 'world');
}

/** Six rival towns in the ancient world, some already on bad terms: for trying out wars. */
function kingdoms(world: World): void {
  const home = world.state.settlements[0];
  const ancient = TECHS.slice(0, TECHS.findIndex((t) => t.id === 'metalwork') + 1).map((t) => t.id);
  const towns = [home];
  for (let i = 0; i < 5; i++) {
    const from = towns[Math.floor(world.rand() * towns.length)];
    const spot = scoutSite(world, from.x, from.y, 50, 110);
    if (!spot) continue;
    towns.push(foundSettlement(world, spot.x, spot.y));
  }
  for (const t of towns) {
    t.tech = ancient.slice();
    Object.assign(t.stock, { grain: 600, meat: 150, wood: 400, stone: 300, metal: 60 + Math.floor(world.rand() * 200), tools: 60, goods: 60 });
    t.treasury = 200;
    const n = t === home ? 20 : 14 + Math.floor(world.rand() * 16);
    for (let i = 0; i < n; i++) {
      world.state.npcs.push(createNpc(world, { x: t.x + (i % 6) - 3, y: t.y + Math.floor(i / 6) - 2, ageYears: 16 + ((i * 7) % 40), settlementId: t.id }));
    }
  }
  // Old rivalries and friendships.
  for (const a of towns) for (const b of towns) {
    if (a.id >= b.id) continue;
    const v = Math.round((world.rand() * 1.2 - 0.75) * 100) / 100;
    a.diplomacy[b.id] = v;
    b.diplomacy[a.id] = v;
  }
  world.state.player.influence = 100;
  world.rebuildIndexes();
  for (const t of towns) world.assignJobsFor(t);
  world.log(`Sandbox mode: ${towns.length} rival towns of the ancient world.`, 'world');
}
