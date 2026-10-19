import { describe, expect, it } from 'vitest';
import { applyHit, makePacket, PLAYER_ID, type GameState } from '../../../src/sim';
import { addEnemy, arena, hitWith, ofType, ticks, ticksFor } from './helpers';
import { OWNER } from '../../../data/materials';

/** DESIGN §6.4 Ignite and Shock, and the Lingering duration multiplier. */

/** A 500-life training dummy with no resistances, no AI and no knockback. */
function dummy(state: GameState) {
  return addEnemy(state, 'dummy', 100, 60);
}

describe('Ignite', () => {
  it('burns for 50% of the fire hit per second for 3 s', () => {
    const state = arena();
    const d = dummy(state);
    hitWith(state, d, 20, 'fire');
    const applied = ofType(state.events, 'ailmentApplied');
    expect(applied).toHaveLength(1);
    expect(applied[0]).toMatchObject({ target: d.id, ailment: 'ignite', magnitude: 10, duration: 3 });
    expect(d.ailments.ignite).toEqual({ dps: 10, timeLeft: 3, sourceId: PLAYER_ID, owner: OWNER.player });
    const lifeAfterHit = d.life;

    const burning = ticks(state, ticksFor(3) - 1);
    expect(d.ailments.ignite.timeLeft).toBeGreaterThan(0);
    expect(ofType(burning, 'ailmentEnded')).toHaveLength(0);
    const last = ticks(state, 1);
    expect(ofType(last, 'ailmentEnded')).toEqual([
      { type: 'ailmentEnded', target: d.id, ailment: 'ignite', x: 100, y: 60 },
    ]);
    expect(d.ailments.ignite.timeLeft).toBe(0);
    expect(lifeAfterHit - d.life).toBeCloseTo(30, 9);
    ticks(state, 30);
    expect(lifeAfterHit - d.life).toBeCloseTo(30, 9);
  });

  it('a new ignite replaces the current one only if stronger', () => {
    const state = arena();
    const d = dummy(state);
    hitWith(state, d, 20, 'fire');
    ticks(state, 30);
    const left = d.ailments.ignite.timeLeft;
    hitWith(state, d, 10, 'fire', { sourceId: 7 });
    expect(ofType(state.events, 'ailmentApplied')).toHaveLength(0);
    expect(d.ailments.ignite).toEqual({ dps: 10, timeLeft: left, sourceId: PLAYER_ID, owner: OWNER.player });
    hitWith(state, d, 20, 'fire', { sourceId: 7 });
    expect(ofType(state.events, 'ailmentApplied')).toHaveLength(0);
    hitWith(state, d, 40, 'fire', { sourceId: 7 });
    expect(ofType(state.events, 'ailmentApplied')).toHaveLength(1);
    expect(d.ailments.ignite).toEqual({ dps: 20, timeLeft: 3, sourceId: 7, owner: OWNER.enemy });
  });

  it("applies the target's fire resistance once, at the hit", () => {
    const state = arena();
    const sb = addEnemy(state, 'shieldbearer', 100, 60, [1, 0]);
    const res = hitWith(state, sb, 20, 'fire')!;
    // 20 × (1 − 25%) = 15; ignite = 7.5/s, not reduced again per tick.
    expect(res.total).toBeCloseTo(15, 9);
    expect(sb.ailments.ignite.dps).toBeCloseTo(7.5, 9);
    const before = sb.life;
    ticks(state, 60);
    expect(before - sb.life).toBeCloseTo(7.5, 9);
  });

  it('credits a kill by ignite to whoever applied it, without hitstop', () => {
    for (const source of [PLAYER_ID, 7]) {
      const state = arena();
      const ar = addEnemy(state, 'ember_archer', 100, 60);
      hitWith(state, ar, 20, 'fire', { sourceId: source });
      ar.life = 0.01;
      const ev = ticks(state, 1);
      const death = ofType(ev, 'death');
      expect(death).toHaveLength(1);
      expect(death[0]).toMatchObject({ id: ar.id, killerId: source, cause: 'dot', shattered: false });
      const dot = ofType(ev, 'dot');
      expect(dot).toHaveLength(1);
      expect(dot[0]!.sourceId).toBe(source);
      expect(ev.indexOf(dot[0]!)).toBeLessThan(ev.indexOf(death[0]!));
      expect(ofType(ev, 'hitstop')).toHaveLength(0);
      expect(state.enemies).not.toContain(ar);
    }
  });

  it('Tinderlings are immune', () => {
    const state = arena();
    const t = addEnemy(state, 'tinderling', 100, 60);
    hitWith(state, t, 20, 'fire');
    expect(t.ailments.ignite.timeLeft).toBe(0);
    expect(ofType(state.events, 'ailmentApplied')).toHaveLength(0);
    const life = t.life;
    ticks(state, 30);
    expect(t.life).toBe(life);
  });

  it('dummies burn but never die from it', () => {
    const state = arena();
    const d = dummy(state);
    hitWith(state, d, 20, 'fire');
    d.life = 0.01;
    const ev = ticks(state, 1);
    expect(ofType(ev, 'death')).toHaveLength(0);
    expect(d.life).toBe(d.maxLife);
    expect(d.ailments.ignite.timeLeft).toBeGreaterThan(0);
  });
});

describe('Shock', () => {
  it('increased damage taken = clamp(storm hit ÷ max life × 100, 5, 50)%', () => {
    const cases: [number, number][] = [
      [10, 0.05], // 2% → 5%
      [100, 0.2],
      [400, 0.5], // 80% → 50%
    ];
    for (const [storm, effect] of cases) {
      const state = arena();
      const d = dummy(state);
      hitWith(state, d, storm, 'storm');
      expect(d.ailments.shock.effect).toBeCloseTo(effect, 12);
      expect(ofType(state.events, 'ailmentApplied')[0]).toMatchObject({ ailment: 'shock', duration: 4 });
    }
  });

  it('the strongest applies; magnitudes use the damage before Shock', () => {
    const state = arena();
    const d = dummy(state);
    hitWith(state, d, 100, 'storm');
    ticks(state, 30);
    const left = d.ailments.shock.timeLeft;
    // 50 storm lands as 60 on a 20% shock, but shocks for 50 ÷ 500 = 10%: weaker, kept.
    expect(hitWith(state, d, 50, 'storm')!.total).toBeCloseTo(60, 9);
    expect(d.ailments.shock).toEqual({ effect: 0.2, timeLeft: left });
    expect(ofType(state.events, 'ailmentApplied')).toHaveLength(0);
    hitWith(state, d, 150, 'storm');
    expect(d.ailments.shock.effect).toBeCloseTo(0.3, 12);
    expect(d.ailments.shock.timeLeft).toBe(4);
  });

  it('lasts 4 s', () => {
    const state = arena();
    const d = dummy(state);
    hitWith(state, d, 100, 'storm');
    expect(ofType(ticks(state, ticksFor(4) - 1), 'ailmentEnded')).toHaveLength(0);
    expect(d.ailments.shock.effect).toBe(0.2);
    expect(ofType(ticks(state, 1), 'ailmentEnded')).toMatchObject([{ ailment: 'shock', target: d.id }]);
    expect(d.ailments.shock).toEqual({ effect: 0, timeLeft: 0 });
  });

  it('multiplies hits and ignite damage', () => {
    const state = arena();
    const d = dummy(state);
    hitWith(state, d, 100, 'storm');
    expect(hitWith(state, d, 10, 'physical')!.total).toBeCloseTo(12, 9);
    expect(hitWith(state, d, 20, 'fire')!.total).toBeCloseTo(24, 9);
    // The ignite is 50% of the fire hit before Shock; Shock then applies to each tick once.
    expect(d.ailments.ignite.dps).toBeCloseTo(10, 9);
    const before = d.life;
    ticks(state, 60);
    expect(before - d.life).toBeCloseTo(12, 9);
  });
});

describe('Lingering (DamagePacket.ailmentDuration)', () => {
  it('scales ignite, shock and freeze durations', () => {
    const state = arena();
    const d = dummy(state);
    hitWith(state, d, 20, 'fire', { ailmentDuration: 1.3 });
    hitWith(state, d, 100, 'storm', { ailmentDuration: 1.3 });
    hitWith(state, d, 250, 'frost', { ailmentDuration: 1.3 });
    expect(d.ailments.ignite.timeLeft).toBeCloseTo(3.9, 12);
    expect(d.ailments.shock.timeLeft).toBeCloseTo(5.2, 12);
    expect(d.ailments.freeze.timeLeft).toBeCloseTo(1.56, 12);
    expect(ofType(state.events, 'freeze')[0]!.duration).toBeCloseTo(1.56, 12);
    // The ignite's total damage grows with its duration: 10/s × 3.9 s.
    const before = d.life;
    ticks(state, ticksFor(3.9) + 5);
    // Shocked (100 storm, then 250 frost shocked nothing): 20% more for the first 5.2 s.
    expect(before - d.life).toBeCloseTo(10 * 3.9 * 1.2, 6);
  });

  it('defaults to 1 for packets without it', () => {
    const state = arena();
    const d = dummy(state);
    const packet = makePacket(20, { fire: 1 }, 0, 1.5);
    delete packet.ailmentDuration;
    applyHit(state, d, packet, { sourceId: PLAYER_ID, dirX: 1, dirY: 0, knockback: 0 });
    expect(d.ailments.ignite.timeLeft).toBe(3);
  });
});
