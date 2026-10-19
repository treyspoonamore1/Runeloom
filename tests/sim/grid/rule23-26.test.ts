import { describe, expect, it } from 'vitest';
import { SURFACE } from '../../../data/materials';
import { WORLD_SOURCE_ID } from '../../../src/sim';
import {
  MAT,
  OWNER,
  cellShape,
  circle,
  countCells,
  field,
  gridGame,
  gridTicks,
  hit,
  idx,
  ofType,
} from './helpers';

describe('placed fire, mud and oil barrels (rules 23, 26)', () => {
  it('rule 23: mud under fire for 1 s dries to dirt', () => {
    const s = gridGame([':::']);
    const i = idx(s, 5, 1);
    hit(s, 'fire', cellShape(5, 1));
    expect(s.grid.fire[i]).toBe(128); // placed fire: mud isn't flammable
    gridTicks(s, 19);
    expect(s.grid.ground[i]).toBe(MAT.mud);
    gridTicks(s, 1);
    expect(s.grid.ground[i]).toBe(MAT.dirt);
    expect(s.grid.fire[i]).toBe(0);
    // Less than 1 s of fire leaves mud.
    const t = gridGame([':::']);
    hit(t, 'fire', cellShape(5, 1));
    gridTicks(t, 10);
    hit(t, 'frost', circle(1, 1, 0.1)); // elsewhere: nothing
    t.grid.fire[i] = 0; // put out without frost (frost would dry it by rule 10)
    gridTicks(t, 30);
    expect(t.grid.ground[i]).toBe(MAT.mud);
  });

  it('rule 26: placed fire on stone burns at 128 for 1 s, then leaves the stone', () => {
    const s = field('.', 3, 3);
    const i = idx(s, 6, 6);
    const ev = hit(s, 'fire', cellShape(6, 6));
    expect(s.grid.fire[i]).toBe(128);
    expect(s.grid.fuel[i]).toBe(20);
    expect(s.grid.owner[i]).toBe(OWNER.player);
    expect(ofType(ev, 'cellIgnited')).toHaveLength(1);
    gridTicks(s, 19);
    expect(s.grid.fire[i]).toBe(128);
    gridTicks(s, 1);
    expect(s.grid.fire[i]).toBe(0);
    expect(s.grid.ground[i]).toBe(MAT.stone);
    // Lingering applies.
    hit(s, 'fire', cellShape(6, 6), { durationMult: 2 });
    expect(s.grid.fuel[i]).toBe(40);
  });

  it("rule 26: placed fire spreads into grass but doesn't spread across stone", () => {
    const s = gridGame(['..."', '....']);
    hit(s, 'fire', circle(10, 2, 2.5)); // stone cells next to the grass tile at x = 12
    gridTicks(s, 1);
    expect(countCells(s, (i) => s.grid.fire[i]! > 0 && s.grid.ground[i] === MAT.stone)).toBeGreaterThan(0);
    gridTicks(s, 20);
    // Stone cells outside the footprint never caught.
    for (let y = 0; y < 8; y++) expect(s.grid.fire[idx(s, 4, y)]).toBe(0);
    // The grass caught from it (0.2 per tick for 20 ticks from several burning neighbors).
    expect(countCells(s, (i) => s.grid.ground[i] === MAT.grass && s.grid.fire[i]! > 0)).toBeGreaterThan(0);
  });

  it('rule 26: no placed fire on walls, pits or on water (steam instead)', () => {
    const s = gridGame(['#_~']);
    hit(s, 'fire', circle(6, 2, 6));
    expect(countCells(s, (i) => s.grid.fire[i]! > 0)).toBe(0);
  });

  it('oil barrel: lights as a whole, explodes after 1 s, spills oil and bursts into world fire', () => {
    const s = gridGame(['.....', '..b..', '.....'], 1, 3);
    const center = idx(s, 9, 5);
    expect(s.room.solid[center]).toBe(1);
    const ev = hit(s, 'fire', cellShape(8, 4));
    expect(ofType(ev, 'cellIgnited')[0]!.count).toBe(16); // every cell of the barrel's tile
    expect(s.grid.fuel[center]).toBe(20);
    let out = gridTicks(s, 19);
    expect(ofType(out, 'explosion')).toHaveLength(0);
    const v = s.grid.walkVersion;
    out = gridTicks(s, 1);
    const ex = ofType(out, 'explosion');
    const damage = 30 * 1.09 * 1.09;
    expect(ex).toHaveLength(1);
    expect(ex[0]!.x).toBe(10);
    expect(ex[0]!.y).toBe(6);
    expect(ex[0]!.radius).toBe(4);
    expect(ex[0]!.damage).toBeCloseTo(damage, 9);
    expect(ex[0]!.owner).toBe(OWNER.world);
    expect(ex[0]!.sourceId).toBe(WORLD_SOURCE_ID);
    expect(s.grid.blasts).toEqual([
      { x: 10, y: 6, radius: 4, damage: ex[0]!.damage, owner: OWNER.world, sourceId: WORLD_SOURCE_ID },
    ]);
    // The barrel is gone: stone, walkable, and the masks know it.
    expect(s.grid.ground[center]).toBe(MAT.stone);
    expect(s.room.solid[center]).toBe(0);
    expect(s.room.shotSolid[center]).toBe(0);
    expect(s.grid.walkVersion).toBeGreaterThan(v);
    // Oil within 3 cells, burning hot and world-owned; fire burst out to 4 cells.
    expect(s.grid.surface[idx(s, 12, 6)]).toBe(SURFACE.oil);
    expect(s.grid.fire[idx(s, 12, 6)]).toBe(255);
    expect(s.grid.surface[idx(s, 13, 6)]).toBe(SURFACE.none);
    expect(s.grid.fire[idx(s, 13, 6)]).toBe(128);
    expect(s.grid.owner[idx(s, 13, 6)]).toBe(OWNER.world);
    expect(s.grid.fire[idx(s, 15, 6)]).toBe(0);
    // Blasts last until the next grid tick.
    gridTicks(s, 1);
    expect(s.grid.blasts).toEqual([]);
    gridTicks(s, 40);
    expect(countCells(s, (i) => s.grid.surface[i] === SURFACE.oil)).toBe(0);
  });

  it('oil barrel: an explosion sets off a barrel next to it a second later', () => {
    // Two barrels side by side: the second catches (by spread or the blast) and goes off later.
    const s = gridGame(['......', '.bb...', '......']);
    hit(s, 'fire', cellShape(5, 5));
    let ev = gridTicks(s, 20);
    expect(ofType(ev, 'explosion').map((e) => e.x)).toEqual([6]);
    expect(s.grid.fire[idx(s, 9, 5)]).toBeGreaterThan(0);
    ev = gridTicks(s, 20);
    expect(ofType(ev, 'explosion').map((e) => e.x)).toEqual([10]);
  });
});
