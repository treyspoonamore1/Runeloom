import { describe, expect, it } from 'vitest';
import { Session } from '../../src/app/session';
import { findScene } from '../../src/app/scenes';
import { fixturesOn } from '../../src/ui/fixtures/mode';
import { heroOf, modsFor, modsOf, sendEdit } from '../../src/ui/heroAdapter';
import { allocReason, passiveIndex, pathTo, pointsOf } from '../../src/ui/tree/adapter';
import { mapProgress, regionLayout } from '../../src/ui/map/adapter';
import { runeTotals } from '../../src/ui/loom/pouchAdapter';
import { slotsFor } from '../../src/ui/inventory/adapter';
import { readAdventure } from '../../src/ui/adventure/hudAdapter';
import { startRoom } from '../../data/progression';

function newGame(): Session {
  const scene = findScene('adventure')!;
  return new Session({ seed: 3, roomId: scene.roomId, sceneId: scene.id, mode: scene.mode });
}

describe('menu adapters on the real game (fixtures off)', () => {
  it('fixtures are off by default', () => {
    expect(fixturesOn.peek()).toBe(false);
  });

  it('the tree is the real 91-node Pattern with its rules', () => {
    const s = newGame();
    const ix = passiveIndex();
    expect(ix.tree.nodes).toHaveLength(91);
    const hero = heroOf(s);
    expect(pointsOf(hero)).toEqual({ total: 0, spent: 0, free: 0 });
    const next = ix.tree.nodes.find((n) => n.links.includes(ix.tree.start))!;
    expect(allocReason(hero, next.id)).toBe('No passive points left');
    expect(pathTo(hero, next.id)).toEqual([next.id]);
  });

  it('the map lays out the region with E1 current and its Loom Stone', () => {
    const s = newGame();
    const layout = regionLayout(s);
    expect(layout.rooms.length).toBeGreaterThanOrEqual(12); // the rooms connected to E1
    const e1 = layout.rooms.find((r) => r.id === startRoom)!;
    expect(e1.loomStones).toHaveLength(1);
    expect(layout.links.some((l) => l.a === startRoom || l.b === startRoom)).toBe(true);
    const prog = mapProgress(s);
    expect(prog.current).toBe(startRoom);
  });

  it('pouch counts, equipment slots, mods and the HUD read the new-game hero', () => {
    const s = newGame();
    const totals = runeTotals(s)!;
    // The starting runes (plus E1's first-clear Swath once the room is clear).
    expect(Object.fromEntries(totals)).toMatchObject({ bolt: 1, cast: 2, fire: 1, strike: 1 });
    const spindle = heroOf(s).items[0]!;
    expect(slotsFor(spindle)).toEqual(['spindle']);
    expect(modsFor(heroOf(s))).toEqual(modsOf(s));
    expect(readAdventure(s)).toMatchObject({ level: 1, keys: null, heartSeeds: 0 });
    expect(sendEdit(s, { kind: 'allocate', node: 'nope' })).toMatch(/Unknown passive/);
  });
});
