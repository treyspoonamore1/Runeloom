import { describe, expect, it } from 'vitest';
import type { GameState } from '../../../src/sim';
import { addEnemy, arena, hitWith, ofType } from '../combat/helpers';
import { allocateExactly, fuse } from '../hero/helpers';

/** The "Ailments" HeroMods group on the player's ailments (hero/effectsCombat.ts ailmentScale). */

const A = () => arena().tuning.ailments;

describe('ignite: Slow Burn and small nodes', () => {
  it('Slow Burn: Ignite lasts 50% longer', () => {
    const s = arena();
    allocateExactly(s, 'slow_burn');
    const d = addEnemy(s, 'dummy', 100, 60);
    hitWith(s, d, 100, 'fire');
    expect(d.ailments.ignite.timeLeft).toBeCloseTo(A().igniteDuration * 1.5);
  });

  it('ailment duration and ignite duration add up; ignite effect raises its damage', () => {
    const s = arena();
    allocateExactly(s, 'weaver_nw1', 'ember_l2', 'ember_l1'); // +6% ailment dur, +10% ignite dur, +6% ignite effect
    const d = addEnemy(s, 'dummy', 100, 60);
    hitWith(s, d, 100, 'fire');
    expect(d.ailments.ignite.timeLeft).toBeCloseTo(A().igniteDuration * 1.16);
    expect(d.ailments.ignite.dps).toBeCloseTo(100 * A().igniteDpsFraction * 1.06);
  });

  it('enemy ignites on the player are not scaled', () => {
    const s = arena();
    allocateExactly(s, 'slow_burn', 'ember_l1');
    hitWith(s, s.player, 10, 'fire', { sourceId: 9 });
    expect(s.player.ailments.ignite.timeLeft).toBeCloseTo(A().igniteDuration);
    expect(s.player.ailments.ignite.dps).toBeCloseTo(10 * A().igniteDpsFraction);
  });
});

describe('chill and freeze: Deep Freeze, Rime Mote, build-up', () => {
  // Dummies have 500 life: a frost hit of 250 builds 100 chill and freezes.
  const frost = (s: GameState, dmg: number) => {
    const d = addEnemy(s, 'dummy', 100, 60);
    hitWith(s, d, dmg, 'frost');
    return d;
  };

  it('Deep Freeze: +15% chill build-up (a 220 hit freezes) and Freeze lasts 0.4 s longer', () => {
    const plain = frost(arena(), 220);
    expect(plain.ailments.freeze.timeLeft).toBe(0);
    expect(plain.ailments.chill).toBeCloseTo(88);
    const s = arena();
    allocateExactly(s, 'deep_freeze');
    const d = frost(s, 220);
    expect(d.ailments.freeze.timeLeft).toBeCloseTo(A().freezeDuration + 0.4);
  });

  it('Rime Mote: Freeze lasts 40% longer (80% at tier III)', () => {
    for (const [tier, k] of [
      [1, 1.4],
      [3, 1.8],
    ] as const) {
      const s = arena();
      fuse(s, ['rime_mote', tier]);
      expect(frost(s, 250).ailments.freeze.timeLeft).toBeCloseTo(A().freezeDuration * k);
    }
  });

  it('chill effect and build-up both multiply the chill points', () => {
    const s = arena();
    allocateExactly(s, 'rime_m1', 'rime_m3'); // +8% build-up, +6% chill effect
    expect(frost(s, 100).ailments.chill).toBeCloseTo(40 * 1.08 * 1.06);
  });

  it('the freeze in the event matches the duration', () => {
    const s = arena();
    allocateExactly(s, 'deep_freeze');
    frost(s, 250);
    expect(ofType(s.events, 'freeze')[0]!.duration).toBeCloseTo(A().freezeDuration + 0.4);
  });
});

describe('shock: effect and duration', () => {
  it('shock effect is increased after the clamp; ailment duration lengthens it', () => {
    const plain = arena();
    const a = addEnemy(plain, 'dummy', 100, 60);
    hitWith(plain, a, 100, 'storm');
    const s = arena();
    allocateExactly(s, 'tempest_l1', 'weaver_nw1'); // +6% shock effect, +6% ailment duration
    const b = addEnemy(s, 'dummy', 100, 60);
    hitWith(s, b, 100, 'storm');
    expect(b.ailments.shock.effect).toBeCloseTo(a.ailments.shock.effect * 1.06);
    expect(b.ailments.shock.timeLeft).toBeCloseTo(A().shockDuration * 1.06);
  });
});

describe('Bog Gill: arcs reach 50% farther and hit 2 more targets', () => {
  /** A Wet dummy hit by Storm with `n` other Wet dummies on a ring of radius r around it. */
  function arcs(r: number, n: number, part?: 1 | 2 | 3): number {
    const s = arena();
    if (part) fuse(s, ['bog_gill', part]);
    const center = addEnemy(s, 'dummy', 100, 60);
    center.terrain.wetLeft = 3;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 2 * Math.PI;
      const e = addEnemy(s, 'dummy', 100 + r * Math.cos(a), 60 + r * Math.sin(a));
      e.terrain.wetLeft = 3;
    }
    s.enemyHash.rebuild(s.enemies);
    s.events.length = 0;
    hitWith(s, center, 50, 'storm');
    return ofType(s.events, 'arc').length;
  }

  it('without it: 6 cells, at most 5 targets', () => {
    expect(arcs(5, 9)).toBe(5);
    expect(arcs(8, 9)).toBe(0);
  });

  it('tier I: 9 cells and 7 targets; tier III: 12 cells and 9 targets', () => {
    expect(arcs(8, 9, 1)).toBe(7);
    expect(arcs(11, 12, 3)).toBe(9);
    expect(arcs(11, 12, 1)).toBe(0);
  });

  it("the arcs' Shock carries your shock effect", () => {
    const s = arena();
    allocateExactly(s, 'tempest_l1');
    const c = addEnemy(s, 'dummy', 100, 60);
    const o = addEnemy(s, 'dummy', 103, 60);
    c.terrain.wetLeft = o.terrain.wetLeft = 3;
    s.enemyHash.rebuild(s.enemies);
    hitWith(s, c, 100, 'storm');
    expect(o.ailments.shock.effect).toBeCloseTo(c.ailments.shock.effect);
    expect(o.ailments.shock.timeLeft).toBeCloseTo(A().shockDuration);
  });
});
