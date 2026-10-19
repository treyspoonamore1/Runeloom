import { describe, expect, it } from 'vitest';
import { cellAt, chargeEventInfo } from '../../../src/sim';
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
  paint,
} from './helpers';

const charged = (s: ReturnType<typeof field>) => countCells(s, (i) => s.grid.charge[i]! > 0);

describe('storm (rules 11–14)', () => {
  it('rule 11: storm on water electrifies the connected body for 1 s with falloff', () => {
    // A 4-cell-wide channel of water 160 cells long, with stone around.
    const s = gridGame(['.'.repeat(42), `.${'~'.repeat(40)}.`, '.'.repeat(42)]);
    const ev = hit(s, 'storm', cellShape(4, 4), { hitDamage: 20 });
    const e = ofType(ev, 'waterElectrified');
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ x: 4.5, y: 4.5, owner: OWNER.player, handoff: false });
    // Flood fill limited to 40 steps from the hit: rows 4..7, x + |dy| ≤ 40 from (4, 4).
    expect(e[0]!.cells).toBe(41 + 40 + 39 + 38);
    expect(charged(s)).toBe(158);
    expect(s.grid.charge[idx(s, 44, 4)]).toBe(20);
    expect(s.grid.charge[idx(s, 45, 4)]).toBe(0);
    // Falloff 1 − d/40, at least 0.25.
    const at = (x: number, y: number) => cellAt(s, x + 0.5, y + 0.5);
    expect(at(4, 4).chargeFalloff).toBe(1);
    expect(at(14, 4).chargeFalloff).toBeCloseTo(0.75, 6);
    expect(at(24, 4).chargeFalloff).toBeCloseTo(0.5, 6);
    expect(at(34, 4).chargeFalloff).toBeCloseTo(0.25, 6);
    expect(at(44, 4).chargeFalloff).toBeCloseTo(0.25, 6);
    // One event id on every cell, with the hit's damage for the entity code.
    const id = at(30, 5).chargeId;
    expect(id).toBe(e[0]!.chargeId);
    expect(chargeEventInfo(s, id)).toMatchObject({ damage: 20, owner: OWNER.player, medium: 'water' });
    gridTicks(s, 19);
    expect(at(10, 4).charged).toBe(true);
    gridTicks(s, 1);
    expect(at(10, 4).charged).toBe(false);
    expect(charged(s)).toBe(0);
    expect(chargeEventInfo(s, id)).toBeNull();
  });

  it('rule 11: the flood fill stops at 600 cells, nearest first', () => {
    const s = field('~', 25, 25);
    const ev = hit(s, 'storm', cellShape(50, 50));
    expect(ofType(ev, 'waterElectrified')[0]!.cells).toBe(600);
    expect(charged(s)).toBe(600);
    // Breadth-first: everything within 16 steps (545 cells) is charged, nothing past 17.
    for (let i = 0; i < s.grid.charge.length; i++) {
      const x = i % s.grid.width;
      const y = Math.floor(i / s.grid.width);
      const d = Math.abs(x - 50) + Math.abs(y - 50);
      if (d <= 16) expect(s.grid.charge[i]).toBeGreaterThan(0);
      if (d > 17) expect(s.grid.charge[i]).toBe(0);
    }
  });

  it('rule 11: deep water conducts too; ice does not', () => {
    const s = gridGame(['~wi~']);
    hit(s, 'storm', cellShape(1, 1));
    expect(s.grid.charge[idx(s, 6, 1)]).toBeGreaterThan(0);
    expect(s.grid.charge[idx(s, 9, 1)]).toBe(0);
    expect(s.grid.charge[idx(s, 13, 1)]).toBe(0);
  });

  it('rule 11: Lingering lengthens the charge; a new hit takes over the body', () => {
    const s = field('~', 4, 4);
    hit(s, 'storm', cellShape(3, 3), { durationMult: 2 });
    expect(s.grid.charge[idx(s, 3, 3)]).toBe(40);
    const first = s.grid.chargeId[idx(s, 3, 3)]!;
    hit(s, 'storm', cellShape(10, 10), { owner: OWNER.enemy });
    expect(s.grid.chargeId[idx(s, 3, 3)]).not.toBe(first);
    expect(cellAt(s, 3.5, 3.5).chargeOwner).toBe(OWNER.enemy);
    expect(s.grid.charge[idx(s, 3, 3)]).toBe(20);
  });

  it('rule 12: storm on metal electrifies the whole network for 1.5 s, no falloff, 60% damage', () => {
    const s = gridGame(['mmmm.mm', 'mMm..mm']);
    const ev = hit(s, 'storm', cellShape(1, 1), { hitDamage: 50 });
    const e = ofType(ev, 'metalElectrified');
    expect(e).toHaveLength(1);
    // The connected part: 4 + 3 tiles (pylon included) = 7 tiles × 16 cells.
    expect(e[0]!.cells).toBe(7 * 16);
    expect(s.grid.charge[idx(s, 1, 1)]).toBe(30);
    expect(s.grid.charge[idx(s, 21, 1)]).toBe(0); // the separate network
    expect(cellAt(s, 10.5, 6.5).chargeFalloff).toBe(1);
    expect(chargeEventInfo(s, e[0]!.chargeId)).toMatchObject({ damage: 30, medium: 'metal' });
    gridTicks(s, 30);
    expect(charged(s)).toBe(0);
  });

  it('rule 12: a metal network charges at most 2,000 cells', () => {
    const s = field('m', 25, 25);
    const ev = hit(s, 'storm', cellShape(50, 50));
    expect(ofType(ev, 'metalElectrified')[0]!.cells).toBe(2000);
    expect(charged(s)).toBe(2000);
  });

  it('rule 13: charged water hands charge to touching metal, and metal to water', () => {
    const s = gridGame(['~~m~']);
    const ev = hit(s, 'storm', cellShape(1, 1));
    const water = ofType(ev, 'waterElectrified');
    const metal = ofType(ev, 'metalElectrified');
    expect(water.map((e) => e.handoff)).toEqual([false, true]);
    expect(metal.map((e) => e.handoff)).toEqual([true]);
    // Each medium keeps its own rules: metal 1.5 s, no falloff; the far water restarts falloff.
    expect(s.grid.charge[idx(s, 9, 1)]).toBe(30);
    expect(cellAt(s, 12.5, 1.5).chargeFalloff).toBe(1);
    expect(cellAt(s, 15.5, 1.5).chargeFalloff).toBeCloseTo(1 - 3 / 40, 6);
    expect(s.grid.charge[idx(s, 14, 1)]).toBe(20);

    const t = gridGame(['m~~']);
    const ev2 = hit(t, 'storm', cellShape(1, 1));
    expect(ofType(ev2, 'metalElectrified')).toHaveLength(1);
    expect(ofType(ev2, 'waterElectrified')[0]).toMatchObject({ handoff: true, cells: 32 });
    // Every event of the chain points back to the same chain.
    const ids = [...ofType(ev2, 'metalElectrified'), ...ofType(ev2, 'waterElectrified')].map(
      (e) => e.chargeId,
    );
    const chains = ids.map((id) => chargeEventInfo(t, id)!.chain);
    expect(new Set(chains).size).toBe(1);
  });

  it('rule 13: a hit covering water and metal makes one event per body, not two', () => {
    const s = gridGame(['~m']);
    const ev = hit(s, 'storm', circle(4, 2, 1.5));
    expect(ofType(ev, 'waterElectrified')).toHaveLength(1);
    expect(ofType(ev, 'metalElectrified')).toHaveLength(1);
  });

  it('rule 14: storm ignites about 15% of the dry flammable cells it hits (seeded)', () => {
    let total = 0;
    let cells = 0;
    for (const seed of [1, 2, 3, 4]) {
      const s = field('"', 10, 10, seed);
      const ev = hit(s, 'storm', circle(20, 20, 6));
      const lit = countCells(s, (i) => s.grid.fire[i]! > 0);
      expect(lit).toBeGreaterThan(2);
      expect(lit).toBeLessThan(40);
      expect(ofType(ev, 'cellIgnited')[0]?.count ?? 0).toBe(lit);
      total += lit;
      cells += 112; // cell centers within r = 6
    }
    expect(total / cells).toBeGreaterThan(0.08);
    expect(total / cells).toBeLessThan(0.24);
    // Wet grass never catches.
    const w = field('"', 4, 4);
    w.grid.wet.fill(100);
    for (let k = 0; k < 20; k++) hit(w, 'storm', circle(8, 8, 4));
    expect(countCells(w, (i) => w.grid.fire[i]! > 0)).toBe(0);
    // Storm on stone does nothing.
    const st = field('.', 2, 2);
    paint(st, 1, 1, 'stone');
    expect(hit(st, 'storm', circle(4, 4, 3))).toEqual([]);
    expect(st.grid.ground[idx(st, 1, 1)]).toBe(MAT.stone);
  });
});
