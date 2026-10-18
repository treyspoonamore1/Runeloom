import { describe, expect, it } from 'vitest';
import { Button, DT, killPlayer } from '../../../src/sim';
import { spells, spellManaCost } from '../../../data/spells';
import { addEnemy, arena, BOLT, ofType, STRIKE, tick, ticks } from './helpers';

/** 1-based tick (counting the press tick) on which a cast of `castTime` releases. */
const releaseTick = (castTime: number, frac = 0.25) => Math.ceil((castTime * frac - 1e-9) / DT);

describe('casting', () => {
  it('releases at castReleaseFraction of the cast time and pays mana then', () => {
    const state = arena();
    const p = state.player;
    const cost = spellManaCost(spells.fire_bolt);
    expect(cost).toBeCloseTo(6.6, 12);
    const rt = releaseTick(0.45);
    expect(rt).toBe(7);
    for (let i = 1; i < rt; i++) {
      const ev = tick(state, BOLT);
      if (i === 1) expect(ofType(ev, 'castStart')).toHaveLength(1);
      expect(ofType(ev, 'projectileSpawn')).toHaveLength(0);
      expect(p.mana).toBe(p.maxMana);
      expect(p.castSlot).toBe(0);
    }
    const ev = tick(state, BOLT);
    expect(ofType(ev, 'cast')).toHaveLength(1);
    expect(ofType(ev, 'projectileSpawn')).toHaveLength(1);
    expect(p.mana).toBeCloseTo(p.maxMana - cost, 12);
    expect(p.castReleased).toBe(true);
  });

  it('Strike releases on tick 6 of its 0.40 s cast', () => {
    const state = arena();
    const events = ticks(state, 6, STRIKE);
    const cast = events.findIndex((e) => e.type === 'cast');
    expect(releaseTick(0.4)).toBe(6);
    expect(cast).toBeGreaterThan(-1);
    expect(ofType(ticks(arena(), 5, STRIKE), 'cast')).toHaveLength(0);
  });

  it('holding repeats one cast duration apart', () => {
    const state = arena();
    const starts: number[] = [];
    for (let i = 0; i < 120; i++) if (ofType(tick(state, BOLT), 'castStart').length) starts.push(i);
    expect(starts).toEqual([0, 27, 54, 81, 108]);
  });

  it('a press with too little mana does nothing but report castFailed once', () => {
    const state = arena();
    state.tuning.combat.manaRegen = 0; // keep mana pinned below the cost
    state.player.mana = 6; // Fire Bolt costs 6.6
    const events = ticks(state, 10, BOLT);
    expect(ofType(events, 'castStart')).toHaveLength(0);
    expect(ofType(events, 'castFailed')).toEqual([
      { type: 'castFailed', slot: 0, spell: 'fire_bolt', reason: 'mana' },
    ]);
    // Strike (4 mana) is still affordable.
    expect(ofType(ticks(state, 1, STRIKE), 'castStart')).toHaveLength(1);
  });

  it('the lowest held slot wins', () => {
    const state = arena();
    expect(ofType(tick(state, BOLT | STRIKE), 'castStart')[0]!.spell).toBe('fire_bolt');
  });

  it('the player keeps moving while casting', () => {
    const state = arena();
    const x0 = state.player.x;
    ticks(state, 10, BOLT, undefined, [0, 1]);
    expect(state.player.castSlot).toBe(0);
    expect(state.player.y).toBeGreaterThan(60 + 3);
    expect(state.player.x).toBe(x0);
  });

  it('a dodge cancels an unreleased cast, not a released one', () => {
    const state = arena();
    tick(state, BOLT);
    const ev = tick(state, Button.Dodge);
    expect(ofType(ev, 'castCancel')).toHaveLength(1);
    expect(state.player.castSlot).toBe(-1);
    expect(ofType(ticks(state, 30), 'projectileSpawn')).toHaveLength(0);
    expect(state.player.mana).toBe(state.player.maxMana);

    const s2 = arena();
    ticks(s2, 7, BOLT);
    expect(s2.player.castReleased).toBe(true);
    expect(ofType(tick(s2, Button.Dodge), 'castCancel')).toHaveLength(0);
    expect(s2.player.castSlot).toBe(0);
  });

  it("can't start a cast while dodging or dead", () => {
    const state = arena();
    tick(state, Button.Dodge);
    expect(ofType(tick(state, BOLT), 'castStart')).toHaveLength(0);
    const s2 = arena();
    killPlayer(s2);
    expect(ofType(ticks(s2, 30, BOLT), 'castStart')).toHaveLength(0);
  });

  it('mana regenerates tuning.combat.manaRegen of max per second', () => {
    const state = arena();
    state.player.mana = 10;
    ticks(state, 60);
    expect(state.player.mana).toBeCloseTo(10 + state.tuning.combat.manaRegen * 50, 9);
  });
});

describe('Strike', () => {
  const R = 1.5; // dummy radius
  /** Casts one Strike aimed +x from (80, 60) and returns the ids it hit. */
  function strikeHits(state = arena()): Set<number | 'player'> {
    const ev = ticks(state, 6, STRIKE, [100, 60]);
    return new Set(ofType(ev, 'hit').map((h) => h.target));
  }

  it('hits enemies whose bodies touch the 120° × 5-cell arc, and only those', () => {
    const state = arena();
    // Dummies never move, so overlapping placements stay put.
    const inFront = addEnemy(state, 'dummy', 84, 60);
    const reachEdgeIn = addEnemy(state, 'dummy', 80 + 5 + R - 0.01, 60);
    const tooFar = addEnemy(state, 'dummy', 80 + 5 + R + 0.01, 60.5);
    // Straight up or down (90° off aim): its distance to a 60° edge is d·sin 30° = d/2.
    const sideIn = addEnemy(state, 'dummy', 80, 60 - 2.9);
    const sideOut = addEnemy(state, 'dummy', 80, 60 + 3.1);
    const behind = addEnemy(state, 'dummy', 76, 60);
    const hit = strikeHits(state);
    expect(hit.has(inFront.id)).toBe(true);
    expect(hit.has(reachEdgeIn.id)).toBe(true);
    expect(hit.has(sideIn.id)).toBe(true);
    expect(hit.has(tooFar.id)).toBe(false);
    expect(hit.has(sideOut.id)).toBe(false);
    expect(hit.has(behind.id)).toBe(false);
  });

  it('hits each target once per cast, for 16 physical', () => {
    const state = arena();
    const a = addEnemy(state, 'dummy', 83, 59);
    const b = addEnemy(state, 'dummy', 83, 62);
    const hits = ofType(ticks(state, 20, STRIKE, [100, 60]), 'hit');
    expect(hits.map((h) => h.target).sort()).toEqual([a.id, b.id].sort());
    for (const h of hits) {
      expect(h.damageType).toBe('physical');
      expect(h.amount === 16 || h.amount === 24).toBe(true);
    }
  });

  it('knocks back about 3 cells, away from the player', () => {
    const state = arena();
    const e = addEnemy(state, 'tinderling', 84, 60);
    e.life = e.maxLife = 1000; // survive the Strike so the knockback plays out
    ticks(state, 6, STRIKE, [100, 60]);
    expect(e.kbX).toBeGreaterThan(0);
    ticks(state, 60);
    expect(e.x - 84).toBeGreaterThan(3 - 0.06);
    expect(e.x - 84).toBeLessThanOrEqual(3 + 1e-9);
    expect(e.y).toBeCloseTo(60, 9);
  });

  it('a kill adds the Strike-kill hitstop', () => {
    const state = arena();
    const e = addEnemy(state, 'tinderling', 84, 60);
    e.life = 1;
    const ev = ticks(state, 6, STRIKE, [100, 60]);
    expect(ofType(ev, 'death')).toHaveLength(1);
    expect(ofType(ev, 'hitstop').at(-1)!.seconds).toBe(state.tuning.feel.hitstopStrikeKill);
    expect(state.hitstopLeft).toBe(state.tuning.feel.hitstopStrikeKill);
  });

  it('ignores shields', () => {
    const state = arena();
    const sb = addEnemy(state, 'shieldbearer', 85, 60, [-1, 0]);
    const ev = ticks(state, 6, STRIKE, [100, 60]);
    expect(ofType(ev, 'shieldBlock')).toHaveLength(0);
    expect(ofType(ev, 'hit').map((h) => h.target)).toEqual([sb.id]);
    expect(sb.life).toBeLessThan(sb.maxLife);
  });
});
