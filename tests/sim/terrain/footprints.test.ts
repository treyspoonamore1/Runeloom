import { describe, expect, it } from 'vitest';
import { AIR } from '../../../data/materials';
import { Button, DT, makePacket, stormDamage, type GameState, type SimEvent } from '../../../src/sim';
import { burning, dummy, idx, inCircle, MAT, ofType, OWNER, room, run, weaves } from './helpers';

/** BUILD_PLAN M3 task 3: spells write terrain through their footprints (CONTENT §1.2). */

const LMB = Button.Cast1;

/** Presses slot 0 until its spell releases (cast time × 0.25), aiming at `aim`; returns the events. */
function cast(s: GameState, aim: [number, number]): SimEvent[] {
  const t = s.weaves.slots[0]!.program!.castTime;
  const n = Math.ceil((t * 0.25 - 1e-9) / DT);
  return [...run(s, n, LMB, aim), ...run(s, 1, 0, aim)];
}

const fuel = (s: GameState, x: number, y: number) => s.grid.fuel[idx(s, x, y)]!;

describe('Bolt: 2-cell radius at impact or expiry', () => {
  it('ignites grass around the dummy it stops on, as the player', () => {
    const s = room('"');
    weaves(s, ['Cast > Bolt[Fire]']);
    const d = dummy(s, 40, 40);
    const ev = [...cast(s, [40, 40]), ...run(s, 20)];
    const end = ofType(ev, 'spellEnd')[0]!;
    expect(end.reason).toBe('hit');
    const [lit, all] = inCircle(s, end.x, end.y, 2, burning(s));
    expect(all).toBeGreaterThanOrEqual(9);
    expect(lit).toBe(all);
    expect(s.grid.owner[idx(s, end.x, end.y)]).toBe(OWNER.player);
    expect(d.dead).toBe(false);
  });

  it('paints where it expires and nothing on the way', () => {
    const s = room('"', 40, 20);
    weaves(s, ['Cast > Bolt[Fire]']);
    const ev = [...cast(s, [150, 40]), ...run(s, 60)];
    const end = ofType(ev, 'spellEnd')[0]!;
    expect(end.reason).toBe('expired');
    expect(burning(s)(idx(s, end.x, end.y)) || s.grid.ground[idx(s, end.x, end.y)] === MAT.ash).toBe(true);
    expect(s.grid.fire[idx(s, 40, 40)]).toBe(0);
    expect(s.grid.ground[idx(s, 40, 40)]).toBe(MAT.grass);
  });

  it('Saturate doubles the footprint area', () => {
    const plain = room('"');
    const sat = room('"');
    weaves(plain, ['Cast > Bolt[Fire]']);
    weaves(sat, ['Cast > Bolt[Fire, Saturate]']);
    for (const s of [plain, sat]) {
      dummy(s, 40, 40);
      cast(s, [40, 40]);
      run(s, 15);
    }
    const lit = (s: GameState) => s.grid.fire.reduce((n, f) => n + (f > 0 ? 1 : 0), 0);
    expect(lit(sat) / lit(plain)).toBeGreaterThan(1.6);
    expect(lit(sat) / lit(plain)).toBeLessThan(2.5);
  });

  it("Storm charge deals the bolt's Storm damage", () => {
    const s = room('~');
    weaves(s, ['Cast > Bolt[Storm]']);
    dummy(s, 40, 40);
    cast(s, [40, 40]);
    run(s, 14);
    const ev = s.grid.chargeEvents[0];
    expect(ev).toBeDefined();
    const bolt = s.weaves.slots[0]!.program!.root;
    expect(ev!.damage).toBeCloseTo(bolt.baseDamage * bolt.moreProduct, 6);
    const packet = makePacket(10, { storm: 0.5, fire: 0.5 }, 0.5, 1.5);
    packet.more = [0.5, -0.2];
    packet.increased = 0.1;
    expect(stormDamage(packet)).toBeCloseTo(5 * 1.1 * 1.5 * 0.8, 9);
  });
});

describe('Nova: the full disc, as the ring expands', () => {
  it('lights the inner band first, then the whole disc', () => {
    const s = room('"', 30, 20, 60, 40);
    weaves(s, ['Cast > Nova[Fire]']);
    const press = Math.ceil((0.6 * 0.25 - 1e-9) / DT);
    run(s, press, LMB);
    run(s, 5);
    const [inner, innerAll] = inCircle(s, 60, 40, 2, burning(s));
    const [outer] = inCircle(s, 60, 40, 9.5, burning(s));
    expect(inner).toBe(innerAll);
    expect(outer).toBeLessThan(inCircle(s, 60, 40, 9.5, () => true)[1]);
    run(s, 10);
    const [disc, discAll] = inCircle(s, 60, 40, 9.9, burning(s));
    expect(disc).toBe(discAll);
  });

  it('[Fire, Frost] on water makes steam and the frost does nothing to it; [Frost, Fire] freezes, then melts', () => {
    const a = room('~', 30, 20, 60, 40);
    const b = room('~', 30, 20, 60, 40);
    weaves(a, ['Cast > Nova[Fire, Frost]']);
    weaves(b, ['Cast > Nova[Frost, Fire]']);
    for (const s of [a, b]) cast(s, [70, 40]);
    for (const s of [a, b]) run(s, 14);
    const at = (s: GameState) => idx(s, 64, 40);
    expect(a.grid.air[at(a)]).toBe(AIR.steam);
    expect(a.grid.ground[at(a)]).toBe(MAT.shallow_water);
    expect(b.grid.air[at(b)]).toBe(AIR.none);
    expect(b.grid.ground[at(b)]).toBe(MAT.shallow_water);
    // Frost alone freezes the same water.
    const c = room('~', 30, 20, 60, 40);
    weaves(c, ['Cast > Nova[Frost]']);
    cast(c, [70, 40]);
    run(c, 14);
    expect(c.grid.ground[at(c)]).toBe(MAT.ice);
  });

  it('Storm electrifies the water once (one charge chain per nova)', () => {
    const s = room('~', 30, 20, 60, 40);
    weaves(s, ['Cast > Nova[Storm]']);
    const ev = [...cast(s, [70, 40]), ...run(s, 20)];
    expect(ofType(ev, 'waterElectrified')).toHaveLength(1);
  });
});

describe('Beam, Lob, Strike, Swath, Orb and Sigil', () => {
  it('Beam freezes its line over water, 1 cell wide', () => {
    const s = room('~', 30, 20, 20, 40);
    weaves(s, ['Cast > Beam[Frost]']);
    cast(s, [100, 40]);
    run(s, 2);
    for (const x of [24, 40, 60]) expect(s.grid.ground[idx(s, x, 40)]).toBe(MAT.ice);
    expect(s.grid.ground[idx(s, 40, 42)]).toBe(MAT.shallow_water);
  });

  it('Lob ignites its 5-cell burst where it lands', () => {
    const s = room('"');
    weaves(s, ['Cast > Lob[Fire]']);
    cast(s, [50, 40]);
    run(s, 35);
    const [lit, all] = inCircle(s, 50, 40, 4.9, burning(s));
    expect(lit).toBe(all);
    expect(s.grid.fire[idx(s, 50, 47)]).toBe(0);
  });

  it('Strike lights its arc in front of the caster, not behind', () => {
    const s = room('"', 30, 20, 40, 40);
    weaves(s, ['Cast > Strike[Fire]']);
    cast(s, [60, 40]);
    expect(s.grid.fire[idx(s, 43, 40)]).toBeGreaterThan(0);
    expect(s.grid.fire[idx(s, 36, 40)]).toBe(0);
  });

  it('Swath lights its 14×3 strip; Lingering makes the fire last 50% longer', () => {
    const plain = room('.', 30, 20, 20, 40);
    const ling = room('.', 30, 20, 20, 40);
    weaves(plain, ['Cast > Swath[Fire]']);
    weaves(ling, ['Cast > Swath[Fire, Lingering]']);
    cast(plain, [60, 40]);
    cast(ling, [60, 40]);
    for (const x of [22, 28, 33]) expect(plain.grid.fire[idx(plain, x, 40)]).toBeGreaterThan(0);
    expect(plain.grid.fire[idx(plain, 28, 43)]).toBe(0);
    expect(fuel(ling, 28, 40) / fuel(plain, 28, 40)).toBeCloseTo(1.5, 1);
  });

  it('Orb places fire under itself when it appears and every 0.25 s', () => {
    // On stone placed fire never spreads, so every ignition is the orb's.
    const s = room('.', 30, 20, 60, 40);
    weaves(s, ['Cast > Orb[Fire]']);
    cast(s, [70, 40]);
    const o = s.spells.find((x) => x.form === 'orb')!;
    expect(s.grid.fire[idx(s, o.x, o.y)]).toBeGreaterThan(0);
    const paints: number[] = [];
    for (let t = 1; t <= 60; t++) if (ofType(run(s, 1), 'cellIgnited').length > 0) paints.push(t);
    expect(paints).toHaveLength(4);
    expect(paints.slice(1).map((t, k) => t - paints[k]!)).toEqual([15, 15, 15]);
  });

  it('Sigil paints nothing', () => {
    const s = room('"', 30, 20, 20, 40);
    weaves(s, ['Cast > Sigil[Fire] > Emit > Beam[Frost]']);
    cast(s, [40, 40]);
    run(s, 20);
    expect(s.grid.fire.every((f) => f === 0)).toBe(true);
  });

  it('a physical Strike paints nothing', () => {
    const s = room('"', 30, 20, 40, 40);
    weaves(s, ['Cast > Strike[]']);
    cast(s, [60, 40]);
    expect(s.grid.fire.every((f) => f === 0)).toBe(true);
  });
});
