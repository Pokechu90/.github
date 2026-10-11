import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { giftOptions, giveGift } from '../src/sim/gifts';
import { killNpc, ageYears } from '../src/sim/npc/people';
import { deserialize, serialize } from '../src/sim/save';
import { applySandbox } from '../src/sim/sandbox';
import { allMemories } from '../src/sim/npc/memory';

function newWorld(seed: number): World {
  const world = new World(seed);
  const spawn = world.terrain.findSpawn();
  world.populate(spawn.x, spawn.y);
  return world;
}

describe('gifts', () => {
  it('offers era-appropriate gifts and applies them', () => {
    const world = newWorld(3);
    const s = world.state.settlements[0];
    const town = { kind: 'settlement' as const, id: s.id };
    const options = giftOptions(world, town);
    // Stone Age: a feast is available, a scroll of knowledge (needs writing) is not offered yet.
    expect(options.find((g) => g.id === 'feast')?.locked).toBeNull();
    expect(options.some((g) => g.id === 'scroll')).toBe(false);
    // Next-era gifts are shown, but locked.
    expect(options.find((g) => g.id === 'harvest')?.locked).toMatch(/Agriculture/);

    const food = s.stock.meat + s.stock.fruit;
    const before = world.state.player.influence;
    expect(giveGift(world, 'feast', town).ok).toBe(true);
    expect(s.stock.meat + s.stock.fruit).toBeGreaterThan(food);
    expect(world.state.player.influence).toBe(before - 8);
    expect(world.state.chronicle.some((e) => e.kind === 'gift')).toBe(true);
    // People remember the gift came from the player.
    expect(allMemories(world.residentsOf(s.id)[0]).some((m) => m.about === -2)).toBe(true);

    // Locked gifts and empty pockets are refused.
    expect(giveGift(world, 'harvest', town).ok).toBe(false);
    world.state.player.influence = 1;
    expect(giveGift(world, 'materials', town).ok).toBe(false);
  });

  it('looking at gift options never changes the world', () => {
    const world = newWorld(5);
    applySandbox(world, 'space');
    const rng = JSON.stringify(world.state.rng);
    const ids = world.state.nextId;
    giftOptions(world, { kind: 'settlement', id: world.state.settlements[0].id });
    giftOptions(world, { kind: 'npc', id: world.state.npcs[0].id });
    expect(JSON.stringify(world.state.rng)).toBe(rng);
    expect(world.state.nextId).toBe(ids);
  });

  it('gives items with real effects, kept through saves and passed on as heirlooms', () => {
    const world = newWorld(9);
    applySandbox(world, 'modern');
    world.state.player.influence = 100;
    const parent = world.state.npcs.find((n) => ageYears(n) > 25 && n.childrenIds.some((id) => world.npcById(id)))!;
    expect(parent).toBeTruthy();
    const target = { kind: 'npc' as const, id: parent.id };
    const research = parent.skills.research;
    expect(giveGift(world, 'item:book', target).ok).toBe(true);
    expect(parent.items).toContain('book');
    expect(parent.skills.research).toBeGreaterThan(research);
    expect(giveGift(world, 'item:book', target).ok).toBe(false); // already has one

    const copy = deserialize(serialize(world));
    expect(copy.npcById(parent.id)!.items).toContain('book');
    expect(copy.state.player.influence).toBeCloseTo(world.state.player.influence, 5);

    const child = parent.childrenIds.map((id) => world.npcById(id)).find(Boolean)!;
    killNpc(world, parent, 'old age');
    expect(child.items).toContain('book');
    expect(allMemories(child).some((m) => /inherited/.test(m.text))).toBe(true);
  });
});
