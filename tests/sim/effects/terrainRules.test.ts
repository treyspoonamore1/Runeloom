import { describe, expect, it } from 'vitest';
import { Button, stepGrid, type GameState } from '../../../src/sim';
import { gridTicks } from '../../../src/sim/grid/cells';
import { terrainFireDps } from '../../../src/sim/grid/query';
import { apply, count, dummy, idx, MAT, OWNER, paintRect, room, run } from '../terrain/helpers';
import { allocateExactly, fuse } from '../hero/helpers';

/** The "Terrain" HeroMods group and the terrain keystones (hero/effectsTerrain.ts). */

const circle = (x: number, y: number, r: number) => ({ kind: 'circle' as const, x, y, r });
const enemyOwned = { owner: OWNER.enemy, sourceId: 5 };

describe('terrain duration (small nodes)', () => {
  it('player-owned placed fire lasts 16% longer with four +4% nodes; enemy fire does not', () => {
    const s = room('.');
    allocateExactly(s, 'ember_m3', 'ember_r3', 'rime_r2', 'tempest_m2');
    apply(s, 'fire', circle(40.5, 40.5, 0.4));
    expect(s.grid.fuel[idx(s, 40, 40)]).toBe(gridTicks(s.tuning.grid.placedFireSeconds * 1.16));
    apply(s, 'fire', circle(50.5, 40.5, 0.4), enemyOwned);
    expect(s.grid.fuel[idx(s, 50, 40)]).toBe(gridTicks(s.tuning.grid.placedFireSeconds));
  });
});

describe('Long Winter: ice and ice bridges you create last 50% longer', () => {
  it('shallow water → ice and deep water → ice bridge timers', () => {
    for (const [ids, k] of [
      [[], 1],
      [['long_winter'], 1.5],
    ] as const) {
      const s = room('.');
      allocateExactly(s, ...ids);
      paintRect(s, 30, 30, 39, 50, 'shallow_water');
      paintRect(s, 40, 30, 50, 50, 'deep_water');
      apply(s, 'frost', circle(35.5, 40.5, 0.4));
      apply(s, 'frost', circle(45.5, 40.5, 0.4));
      expect(s.grid.ground[idx(s, 35, 40)]).toBe(MAT.ice);
      expect(s.grid.timer[idx(s, 35, 40)]).toBe(gridTicks(15 * k));
      expect(s.grid.timer[idx(s, 45, 40)]).toBe(gridTicks(8 * k) + gridTicks(1.5));
      apply(s, 'frost', circle(36.5, 40.5, 0.4), enemyOwned);
      expect(s.grid.timer[idx(s, 36, 40)]).toBe(gridTicks(15));
    }
  });
});

describe('Overcharge and Storm Antler: charge you create lasts longer', () => {
  function chargeTicks(s: GameState, mat: 'shallow_water' | 'metal_floor', extra = {}): number {
    paintRect(s, 30, 30, 50, 50, mat);
    apply(s, 'storm', circle(40.5, 40.5, 0.4), { hitDamage: 10, ...extra });
    return s.grid.charge[idx(s, 40, 40)]!;
  }

  it('Overcharge: +0.5 s on water and metal', () => {
    const s = room('.');
    allocateExactly(s, 'overcharge');
    expect(chargeTicks(s, 'shallow_water')).toBe(gridTicks(1.5));
    const m = room('.');
    allocateExactly(m, 'overcharge');
    expect(chargeTicks(m, 'metal_floor')).toBe(gridTicks(2));
  });

  it('Storm Antler stacks with Overcharge and scales with its tier; enemy charge is untouched', () => {
    const s = room('.');
    allocateExactly(s, 'overcharge');
    fuse(s, ['storm_antler', 2]);
    expect(chargeTicks(s, 'shallow_water')).toBe(gridTicks(1 + 0.5 + 0.75));
    const e = room('.');
    fuse(e, ['storm_antler', 1]);
    expect(chargeTicks(e, 'shallow_water', enemyOwned)).toBe(gridTicks(1));
  });
});

describe('Conduit and conduction range', () => {
  /** Farthest charged x along a 90-cell shallow-water strip hit at x = 5. */
  function reach(ids: Parameters<typeof allocateExactly>[1][], extra = {}): number {
    const s = room('.', 30, 20);
    allocateExactly(s, ...ids);
    paintRect(s, 4, 40, 100, 43, 'shallow_water');
    apply(s, 'storm', circle(4.5, 41.5, 0.4), { hitDamage: 10, ...extra });
    let far = -1;
    for (let x = 4; x <= 100; x++) if (s.grid.charge[idx(s, x, 41)]! > 0) far = x;
    return far - 4;
  }

  it('Conduit: water you electrify conducts 15 cells farther', () => {
    expect(reach([])).toBe(40);
    expect(reach(['conduit'])).toBe(55);
    expect(reach(['conduit'], enemyOwned)).toBe(40);
  });

  it('increased conduction range scales the reach (2 × 8%: 46.4 cells)', () => {
    expect(reach(['tempest_r1', 'tempest_r3'])).toBe(46);
  });

  it('Conduit raises the cell cap by 200', () => {
    const cells = (ids: Parameters<typeof allocateExactly>[1][]) => {
      const s = room('.', 30, 20);
      allocateExactly(s, ...ids);
      paintRect(s, 4, 4, 115, 75, 'shallow_water');
      apply(s, 'storm', circle(60.5, 40.5, 0.4), { hitDamage: 10 });
      return count(s, 0, 0, 119, 79, (i) => s.grid.charge[i]! > 0);
    };
    expect(cells([])).toBe(600);
    expect(cells(['conduit'])).toBe(800);
  });
});

describe('Kindler: fire you create spreads 30% faster', () => {
  /** Burning or burnt cells after `n` grid ticks of a fire lit at the center of a grass field. */
  function burnt(ids: Parameters<typeof allocateExactly>[1][], owner: number, n = 30): number {
    const s = room('"', 30, 20);
    allocateExactly(s, ...ids);
    apply(s, 'fire', circle(60.5, 40.5, 1.5), { owner });
    for (let k = 0; k < n; k++) stepGrid(s);
    return count(s, 0, 0, 119, 79, (i) => s.grid.fire[i]! > 0 || s.grid.ground[i] === MAT.ash);
  }

  it('player fire covers more ground with Kindler than without; enemy fire is the same', () => {
    expect(burnt(['kindler'], OWNER.player)).toBeGreaterThan(burnt([], OWNER.player) * 1.1);
    expect(burnt(['kindler'], OWNER.enemy)).toBe(burnt([], OWNER.enemy));
  });
});

describe('Wildheart: your terrain fire scales with your Fire damage modifiers', () => {
  it('an enemy in your fire ignites at terrain-fire DPS × (1 + increased Fire)', () => {
    const plain = room('.');
    const a = dummy(plain, 40.5, 40.5);
    apply(plain, 'fire', circle(40.5, 40.5, 1));
    run(plain, 1);
    const base = terrainFireDps(plain, false);
    expect(a.ailments.ignite.dps).toBeCloseTo(base);

    const s = room('.');
    allocateExactly(s, 'wildheart', 'kindler', 'ember_s1'); // +10% and +8% Fire
    const b = dummy(s, 40.5, 40.5);
    apply(s, 'fire', circle(40.5, 40.5, 1));
    run(s, 1);
    expect(b.ailments.ignite.dps).toBeCloseTo(base * 1.18);
  });

  it('Kindler alone (no Wildheart) leaves terrain fire DPS alone', () => {
    const s = room('.');
    allocateExactly(s, 'kindler');
    const b = dummy(s, 40.5, 40.5);
    apply(s, 'fire', circle(40.5, 40.5, 1));
    run(s, 1);
    expect(b.ailments.ignite.dps).toBeCloseTo(terrainFireDps(s, false));
  });
});

describe('Stormglass: ice and ice bridges conduct your Storm like water', () => {
  function iceCharge(ids: Parameters<typeof allocateExactly>[1][], extra = {}) {
    const s = room('.');
    allocateExactly(s, ...ids);
    paintRect(s, 30, 30, 45, 50, 'ice');
    paintRect(s, 46, 30, 55, 50, 'shallow_water');
    const d = dummy(s, 44.5, 40.5);
    s.enemyHash.rebuild(s.enemies);
    apply(s, 'storm', circle(31.5, 40.5, 0.4), { hitDamage: 20, ...extra });
    run(s, 1);
    return { s, d };
  }

  it('a Storm hit on ice electrifies the ice, hands off to the water, and hits entities on it', () => {
    const { s, d } = iceCharge(['stormglass']);
    expect(s.grid.charge[idx(s, 40, 40)]).toBeGreaterThan(0);
    expect(s.grid.charge[idx(s, 50, 40)]).toBeGreaterThan(0);
    expect(d.terrain.chargeIds.some((x) => x > 0)).toBe(true);
  });

  it("without it ice doesn't conduct, and an enemy's Storm on ice never does", () => {
    expect(iceCharge([]).s.grid.charge[idx(iceCharge([]).s, 40, 40)]).toBe(0);
    const e = iceCharge(['stormglass'], enemyOwned);
    expect(e.s.grid.charge[idx(e.s, 40, 40)]).toBe(0);
  });
});

describe('Pyre Walker: immune to all terrain fire', () => {
  it('standing in world-owned and enemy-owned fire never ignites you', () => {
    for (const owner of [OWNER.world, OWNER.enemy]) {
      const plain = room('.', 30, 20, 40.5, 40.5);
      apply(plain, 'fire', circle(40.5, 40.5, 2), { owner, sourceId: -1 });
      run(plain, 2);
      expect(plain.player.ailments.ignite.timeLeft).toBeGreaterThan(0);
      const s = room('.', 30, 20, 40.5, 40.5);
      allocateExactly(s, 'pyre_walker');
      apply(s, 'fire', circle(40.5, 40.5, 2), { owner, sourceId: -1 });
      run(s, 2);
      expect(s.player.ailments.ignite.timeLeft).toBe(0);
    }
  });
});

describe('Hydromancer', () => {
  it("you're always Wet, so terrain fire can't ignite you", () => {
    const s = room('.', 30, 20, 40.5, 40.5);
    allocateExactly(s, 'hydromancer');
    run(s, 1);
    expect(s.player.terrain.wetLeft).toBeGreaterThan(0);
    apply(s, 'fire', circle(40.5, 40.5, 2), { owner: OWNER.world, sourceId: -1 });
    run(s, 120);
    expect(s.player.terrain.wetLeft).toBeGreaterThan(0);
    expect(s.player.ailments.ignite.timeLeft).toBe(0);
  });

  it('dodging leaves shallow water along the path for 6 s, then the ground comes back', () => {
    const s = room('"', 30, 20, 30.5, 40.5);
    allocateExactly(s, 'hydromancer');
    run(s, 1, Button.Dodge, undefined, [1, 0]);
    run(s, 15, 0, undefined, [0, 0]);
    for (const x of [31, 35, 39]) expect(s.grid.ground[idx(s, x, 40)], `x ${x}`).toBe(MAT.shallow_water);
    expect(s.grid.ground[idx(s, 46, 40)]).toBe(MAT.grass);
    run(s, 6 * 60 - 40);
    expect(s.grid.ground[idx(s, 35, 40)]).toBe(MAT.shallow_water);
    run(s, 60);
    expect(s.grid.ground[idx(s, 35, 40)]).toBe(MAT.grass);
  });

  it('no keystone, no water', () => {
    const s = room('"', 30, 20, 30.5, 40.5);
    run(s, 1, Button.Dodge, undefined, [1, 0]);
    run(s, 15);
    expect(s.grid.ground[idx(s, 35, 40)]).toBe(MAT.grass);
    expect(s.player.terrain.wetLeft).toBe(0);
  });
});
