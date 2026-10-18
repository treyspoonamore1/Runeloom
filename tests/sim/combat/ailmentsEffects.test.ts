import { describe, expect, it } from 'vitest';
import { Button, castDuration, freezeTarget, isFrozen, startEnemyAttack } from '../../../src/sim';
import { spells } from '../../../data/spells';
import { addEnemy, arena, BOLT, hitWith, ofType, STRIKE, tick, ticks, ticksFor } from './helpers';

/** What ailments do to enemies and the player: Freeze, Chill slow, limits, Shatter, dot events. */

describe('frozen enemies', () => {
  it("don't move or turn, and stay put until they thaw", () => {
    const state = arena(true);
    const t = addEnemy(state, 'tinderling', 120, 60);
    ticks(state, 10);
    expect(t.ai.mode).toBe('chase');
    freezeTarget(state, t, 1.2, 0);
    const [x, y, fx, fy] = [t.x, t.y, t.facingX, t.facingY];
    ticks(state, ticksFor(1.2) - 1);
    expect([t.x, t.y, t.facingX, t.facingY]).toEqual([x, y, fx, fy]);
    ticks(state, 2);
    expect(t.x).toBeLessThan(x);
  });

  it('lose an attack in windup and start none while frozen', () => {
    const state = arena();
    const t = addEnemy(state, 'tinderling', 82.5, 60);
    expect(startEnemyAttack(state, t, -1, 0)).toBe(true);
    ticks(state, 5);
    freezeTarget(state, t, 1.2, 0);
    expect(t.attack.phase).toBe('none');
    expect(startEnemyAttack(state, t, -1, 0)).toBe(false);
    const ev = ticks(state, ticksFor(1.2) - 1);
    expect(ofType(ev, 'attack')).toHaveLength(0);
    expect(ofType(ev, 'hit')).toHaveLength(0);
    expect(state.player.life).toBe(state.player.maxLife);
  });

  it('take knockback normally', () => {
    const state = arena();
    const t = addEnemy(state, 'tinderling', 100, 60);
    freezeTarget(state, t, 1.2, 0);
    hitWith(state, t, 1, 'physical', { knockback: 3 });
    ticks(state, 30);
    expect(t.x - 100).toBeGreaterThan(2.9);
  });

  it('shatter when killed by a hit: death says so and adds feel.hitstopShatter', () => {
    const state = arena();
    const t = addEnemy(state, 'tinderling', 100, 60);
    freezeTarget(state, t, 1.2, 0);
    hitWith(state, t, 100, 'physical');
    expect(ofType(state.events, 'death')).toMatchObject([
      { id: t.id, shattered: true, cause: 'hit', killerId: 0 },
    ]);
    expect(ofType(state.events, 'hitstop')).toEqual([{ type: 'hitstop', seconds: 0.08 }]);
    expect(state.hitstopLeft).toBe(state.tuning.feel.hitstopShatter);
  });

  it("don't shatter when not frozen, and an ignite shatter adds no hitstop", () => {
    const state = arena();
    const a = addEnemy(state, 'tinderling', 100, 60);
    hitWith(state, a, 100, 'physical');
    expect(ofType(state.events, 'death')[0]!.shattered).toBe(false);
    expect(ofType(state.events, 'hitstop')).toHaveLength(0);

    const b = addEnemy(state, 'ember_archer', 100, 80);
    hitWith(state, b, 20, 'fire');
    freezeTarget(state, b, 1.2, 0);
    b.life = 0.01;
    const ev = ticks(state, 1);
    expect(ofType(ev, 'death')).toMatchObject([{ id: b.id, shattered: true, cause: 'dot' }]);
    expect(ofType(ev, 'hitstop')).toHaveLength(0);
  });
});

describe('Chill slows enemies', () => {
  it('attack phases advance at 1 − slow', () => {
    const windupTicks = (chill: number): number => {
      const state = arena();
      state.tuning.ailments.chillDecay = 0;
      const sb = addEnemy(state, 'shieldbearer', 100, 60);
      sb.ailments.chill = chill;
      startEnemyAttack(state, sb, -1, 0);
      for (let n = 1; n <= 120; n++) if (ofType(tick(state), 'attack').length > 0) return n;
      return -1;
    };
    // Shield bash windup 0.5 s: 30 ticks, and 0.5 ÷ (1 − 15%) = 0.588 s at 50 chill.
    expect(windupTicks(0)).toBe(30);
    expect(windupTicks(50)).toBe(Math.ceil(0.5 / 0.85 / (1 / 60)));
  });

  it('movement and AI timers slow by the same fraction', () => {
    const state = arena();
    state.tuning.ailments.chillDecay = 0;
    const t = addEnemy(state, 'tinderling', 100, 60);
    t.ailments.chill = 50;
    t.vx = 10;
    ticks(state, 60);
    expect(t.x - 100).toBeCloseTo(8.5, 9);

    const live = arena(true);
    live.tuning.ailments.chillDecay = 0;
    // Too far to notice the player: it idles, but its cooldown still runs, slowed.
    const idle = addEnemy(live, 'tinderling', 150, 60);
    idle.ailments.chill = 50;
    idle.ai.cooldown = 1;
    ticks(live, 60);
    expect(idle.ai.mode).toBe('idle');
    expect(idle.ai.cooldown).toBeCloseTo(0.15, 9);
  });
});

describe('ailments on the player', () => {
  it('Chill slows walking and casting', () => {
    const state = arena();
    state.tuning.ailments.chillDecay = 0;
    const p = state.player;
    p.ailments.chill = 50;
    ticks(state, 60, 0, undefined, [1, 0]);
    expect(p.vx).toBeCloseTo(26 * 0.85, 9);
    p.vx = 0;
    tick(state, BOLT);
    const full = castDuration(state, spells.fire_bolt);
    expect(p.castLeft).toBeCloseTo(full - 0.85 / 60, 12);
  });

  it('Freeze lasts at most 0.6 s', () => {
    const state = arena();
    const p = state.player;
    // 50 frost on 80 life: 125 chill → frozen, but only for 0.6 s.
    hitWith(state, p, 50, 'frost', { sourceId: 3 });
    expect(ofType(state.events, 'freeze')).toMatchObject([{ target: 'player', duration: 0.6 }]);
    expect(p.ailments.freeze.timeLeft).toBe(0.6);
    freezeTarget(state, p, 5, 3);
    expect(p.ailments.freeze.timeLeft).toBe(0.6);
  });

  it('Shock is at most 30%', () => {
    const state = arena();
    hitWith(state, state.player, 60, 'storm', { sourceId: 3 });
    expect(state.player.ailments.shock.effect).toBe(0.3);
    expect(hitWith(state, state.player, 10, 'physical', { sourceId: 3 })!.total).toBeCloseTo(13, 9);
  });

  it("frozen, the player can't move, cast or dodge, and an unreleased cast is cancelled", () => {
    const state = arena();
    const p = state.player;
    tick(state, BOLT);
    expect(p.castSlot).toBe(0);
    freezeTarget(state, p, 0.6, 3);
    const ev = [];
    for (let i = 0; i < ticksFor(0.6) - 1; i++)
      ev.push(...tick(state, BOLT | STRIKE | (i % 2 === 0 ? Button.Dodge : 0), undefined, [1, 0]));
    expect(isFrozen(p)).toBe(true);
    expect(ofType(ev, 'castCancel')).toHaveLength(1);
    expect(ofType(ev, 'castStart')).toHaveLength(0);
    expect(ofType(ev, 'cast')).toHaveLength(0);
    expect(ofType(ev, 'dodge')).toHaveLength(0);
    expect(p.dodgeCharges).toBe(state.tuning.player.dodgeCharges);
    expect([p.x, p.y]).toEqual([80, 60]);
    ticks(state, 1);
    expect(isFrozen(p)).toBe(false);
  });

  it('ignites the player from Ember Archer fire arrows; death and respawn clear ailments', () => {
    const state = arena();
    const ar = addEnemy(state, 'ember_archer', 105, 60, [-1, 0]);
    startEnemyAttack(state, ar, -1, 0);
    ticks(state, 60);
    const p = state.player;
    expect(p.ailments.ignite.dps).toBe(5);
    expect(p.ailments.ignite.sourceId).toBe(ar.id);
    p.life = 0.01;
    tick(state);
    expect(p.dead).toBe(true);
    expect(p.ailments.ignite.timeLeft).toBe(0);
  });

  it('god mode: ailments apply but deal no damage', () => {
    const state = arena();
    state.cheats.god = true;
    const p = state.player;
    hitWith(state, p, 20, 'fire', { sourceId: 3 });
    expect(p.ailments.ignite.timeLeft).toBe(3);
    const ev = ticks(state, ticksFor(3));
    expect(p.life).toBe(p.maxLife);
    expect(ofType(ev, 'dot')).toHaveLength(0);
  });
});

describe('dot events', () => {
  it('batch ignite damage: one per 0.5 s per target, plus one at the end', () => {
    const state = arena();
    const a = addEnemy(state, 'dummy', 100, 60);
    const b = addEnemy(state, 'dummy', 100, 80);
    hitWith(state, a, 20, 'fire');
    hitWith(state, b, 40, 'fire');
    const ev = ticks(state, ticksFor(4));
    const dots = ofType(ev, 'dot');
    for (const [d, total] of [
      [a, 30],
      [b, 60],
    ] as const) {
      const mine = dots.filter((x) => x.target === d.id);
      expect(mine).toHaveLength(6);
      expect(mine.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(total, 9);
      expect(mine[0]!.amount).toBeCloseTo(total / 6, 9);
      expect(mine.every((x) => x.damageType === 'fire' && x.sourceId === 0)).toBe(true);
    }
  });
});

describe('M1 spells', () => {
  it('Fire Bolt ignites with its fire damage; Strike stays physical', () => {
    const state = arena();
    const ar = addEnemy(state, 'ember_archer', 95, 60);
    const ev = ticks(state, 20, BOLT, [95, 60]);
    expect(ofType(ev, 'hit')).toHaveLength(1);
    // 12 fire × (1 − 50%) = 6 → 3/s.
    expect(ar.ailments.ignite.dps).toBe(3);

    const s2 = arena();
    const sb = addEnemy(s2, 'shieldbearer', 84, 60, [1, 0]);
    const ev2 = ticks(s2, 20, STRIKE, [84, 60]);
    expect(ofType(ev2, 'hit')).toHaveLength(1);
    expect(ofType(ev2, 'ailmentApplied')).toHaveLength(0);
    expect(sb.ailments.ignite.timeLeft).toBe(0);
  });
});
