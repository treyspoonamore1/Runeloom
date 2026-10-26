import { describe, expect, it } from 'vitest';
import { applyElement, PLAYER_ID, setGround, step, type GameState, type SimEvent } from '../../../src/sim';
import { metalConductionCells, waterConduction } from '../../../src/sim/hero/effectsTerrain';
import { MAT, OWNER } from '../../../data/materials';
import { fuseEffectLines } from '../../../data/fuseEffects';
import { partDroppedBy } from '../../../data/fuseParts';
import { addEnemy, arena, ofType } from '../combat/helpers';
import { fuse } from '../hero/helpers';

/** The Drowned Foundry bosses' Fuse parts (CONTENT §4): Bellwether's Clapper and the Coil Dynamo. */

function paint(s: GameState, x0: number, y0: number, x1: number, y1: number, code: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setGround(s, y * s.grid.width + x, code);
}

const storm = (s: GameState, x: number, y: number, owner: number = OWNER.player) =>
  applyElement(s, {
    element: 'storm',
    shape: { kind: 'circle', x, y, r: 0.6 },
    owner,
    sourceId: owner === OWNER.player ? PLAYER_ID : -1,
    hitDamage: 40,
    durationMult: 1,
  });

function steps(s: GameState, n: number): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    step(s, { moveX: 0, moveY: 0, aimX: s.player.x + 1, aimY: s.player.y, buttons: 0 });
    all.push(...s.events);
  }
  return all;
}

describe('Foundry boss Fuse parts', () => {
  it('each drops from its boss, with tooltip lines', () => {
    expect(partDroppedBy('bellwether')).toBe('bellwethers_clapper');
    expect(partDroppedBy('glasswater_coil')).toBe('coil_dynamo');
    expect(fuseEffectLines('bellwethers_clapper', 1)[0]).toContain('30%');
    expect(fuseEffectLines('coil_dynamo', 2)[0]).toContain('75%');
  });

  it("Bellwether's Clapper: your charge reaches 30% farther, water distance and both cell caps; enemy charge doesn't", () => {
    const s = arena();
    const base = waterConduction(s, OWNER.player);
    const metal = metalConductionCells(s, OWNER.player);
    fuse(s, ['bellwethers_clapper', 1]);
    const w = waterConduction(s, OWNER.player);
    expect(w.maxDistance).toBeCloseTo(base.maxDistance * 1.3);
    expect(w.maxCells).toBe(Math.round(base.maxCells * 1.3));
    expect(metalConductionCells(s, OWNER.player)).toBe(Math.round(metal * 1.3));
    expect(waterConduction(s, OWNER.enemy)).toEqual(base);
    // A long canal: the charge runs 52 cells instead of 40.
    paint(s, 10, 20, 140, 20, MAT.shallow_water);
    storm(s, 10.5, 20.5);
    expect(s.grid.charge[20 * s.grid.width + 10 + 50]).toBeGreaterThan(0);
    expect(s.grid.charge[20 * s.grid.width + 10 + 54]).toBe(0);
  });

  it('Coil Dynamo: when your charge ends it pulses once more for 50% (the same entities hit again); enemy charge and the pulse itself never do', () => {
    const s = arena();
    fuse(s, ['coil_dynamo', 1]);
    paint(s, 20, 40, 60, 50, MAT.shallow_water);
    const e = addEnemy(s, 'dummy', 40, 45);
    storm(s, 22.5, 45.5);
    const ev = steps(s, 3 * 60);
    const hits = ofType(ev, 'chargeHit').filter((h) => h.target === e.id);
    expect(hits).toHaveLength(2);
    expect(hits[1]!.damage).toBeCloseTo(hits[0]!.damage * 0.5);
    expect(s.grid.charge[45 * s.grid.width + 40]).toBe(0);
    // Without the part, or with enemy charge: one hit.
    const t = arena();
    fuse(t, ['coil_dynamo', 1]);
    paint(t, 20, 40, 60, 50, MAT.shallow_water);
    const f = addEnemy(t, 'dummy', 40, 45);
    storm(t, 22.5, 45.5, OWNER.world);
    expect(ofType(steps(t, 3 * 60), 'chargeHit').filter((h) => h.target === f.id)).toHaveLength(1);
  });
});
