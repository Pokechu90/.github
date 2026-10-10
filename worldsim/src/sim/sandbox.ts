/**
 * Sandbox shortcuts for trying out late-game features without waiting
 * centuries: add ?sandbox=space (or =modern) to the page address.
 */
import { TECHS } from './society/tech';
import { findBuildSpot, placeBuilding } from './society/settlement';
import { createNpc } from './npc/people';
import type { World } from './world';

export function applySandbox(world: World, mode: string): void {
  const s = world.state.settlements[0];
  if (!s) return;
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
