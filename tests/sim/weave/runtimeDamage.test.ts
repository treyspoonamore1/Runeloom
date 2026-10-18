import { describe, expect, it } from 'vitest';
import { applyLoadoutSpec, Button, hashState, Rng, type GameState } from '../../../src/sim';
import { addEnemy, arena, castFor, ofType, releaseTick, spawnsOf, ticks, weaveArena } from './runtimeHelpers';

const LMB = Button.Cast1;

function onSpindle(spindleId: 'ashwood' | 'rimeglass' | 'twig', notations: string[]): GameState {
  const state = arena();
  applyLoadoutSpec(state, { spindleId, notations });
  return state;
}

describe('"Closer pays more": Strike and Nova mana on hit (CONTENT §1.2)', () => {
  it('Strike restores 2 per enemy hit, Nova 1, with a manaRefund event each', () => {
    const state = weaveArena(['Cast > Strike[]', 'Cast > Nova[Fire]']);
    const p = state.player;
    state.tuning.combat.manaRegen = 0;
    const a = addEnemy(state, 'dummy', 84, 59);
    addEnemy(state, 'dummy', 84, 61.5);
    p.mana = 20;
    let ev = castFor(state, LMB, releaseTick(0.4), [100, 60], 30);
    expect(ofType(ev, 'manaRefund').map((r) => r.amount)).toEqual([2, 2]);
    expect(ofType(ev, 'manaRefund')[0]).toMatchObject({ x: a.x, y: a.y });
    expect(p.mana).toBeCloseTo(20 - 4 + 4, 9);
    p.mana = 20;
    ev = castFor(state, Button.Cast2, releaseTick(0.6), [100, 60], 30);
    expect(ofType(ev, 'manaRefund').map((r) => r.amount)).toEqual([1, 1]);
    expect(p.mana).toBeCloseTo(20 - state.weaves.slots[1]!.program!.mana + 2, 9);
  });

  it('only for enemies within 8 cells of the player when hit', () => {
    const state = weaveArena(['Cast > Nova[Fire]']);
    for (const x of [86, 87.9]) addEnemy(state, 'dummy', x, 60);
    for (const x of [88.1, 91]) addEnemy(state, 'dummy', 160 - x, 60);
    const ev = castFor(state, LMB, releaseTick(0.6), [100, 60], 30);
    expect(ofType(ev, 'hit')).toHaveLength(4);
    expect(ofType(ev, 'manaRefund')).toHaveLength(2);
    // However it was cast: a Strike branch far from the player restores nothing.
    const far = weaveArena(['Cast > Bolt[Fire] > OnHit > Strike[]']);
    addEnemy(far, 'dummy', 105, 59);
    addEnemy(far, 'dummy', 108, 60);
    const ev2 = castFor(far, LMB, releaseTick(0.45), [120, 60], 30);
    expect(spawnsOf(ev2, 'strike')).toHaveLength(1);
    expect(ofType(ev2, 'manaRefund')).toHaveLength(0);
    const near = weaveArena(['Cast > Bolt[Fire] > OnHit > Strike[]']);
    addEnemy(near, 'dummy', 85, 60);
    addEnemy(near, 'dummy', 87, 61);
    expect(ofType(castFor(near, LMB, releaseTick(0.45), [120, 60], 30), 'manaRefund')).toHaveLength(2);
  });

  it('at most 6 per spell instance', () => {
    const state = weaveArena(['Cast > Strike[]', 'Cast > Nova[Fire]']);
    for (let k = 0; k < 5; k++) addEnemy(state, 'dummy', 83, 57 + k * 1.5);
    let ev = castFor(state, LMB, releaseTick(0.4), [100, 60], 30);
    expect(ofType(ev, 'manaRefund').map((r) => r.amount)).toEqual([2, 2, 2]);
    for (let k = 0; k < 4; k++) addEnemy(state, 'dummy', 76, 57 + k * 2);
    ev = castFor(state, Button.Cast2, releaseTick(0.6), [100, 60], 30);
    expect(ofType(ev, 'hit')).toHaveLength(9);
    expect(ofType(ev, 'manaRefund').reduce((s, r) => s + r.amount, 0)).toBe(6);
  });

  it('the numbers come from tuning', () => {
    const state = weaveArena(['Cast > Strike[]']);
    state.tuning.combat.manaOnHit.strike = 3;
    addEnemy(state, 'dummy', 84, 60);
    const ev = castFor(state, LMB, releaseTick(0.4), [100, 60], 5);
    expect(ofType(ev, 'manaRefund').map((r) => r.amount)).toEqual([3]);
  });
});

describe('spell damage', () => {
  it('Ashwood adds 10% increased Fire damage, to the fire share only', () => {
    const twig = onSpindle('twig', ['Cast > Swath[Fire]']);
    const ash = onSpindle('ashwood', ['Cast > Swath[Fire]', 'Cast > Strike[]']);
    for (const s of [twig, ash]) addEnemy(s, 'dummy', 86, 60);
    const t = ofType(castFor(twig, LMB, releaseTick(0.4), [100, 60]), 'hit')[0]!;
    const a = ofType(castFor(ash, LMB, releaseTick(0.4), [100, 60]), 'hit')[0]!;
    expect(a.amount).toBeCloseTo(t.amount * 1.1, 9);
    ticks(ash, 60);
    const strike = ofType(castFor(ash, Button.Cast2, releaseTick(0.4), [100, 60]), 'hit')[0]!;
    expect([16, 24]).toContain(strike.amount);
  });

  it('Rimeglass adds 20% chill build-up', () => {
    const twig = onSpindle('twig', ['Cast > Swath[Frost]']);
    const rime = onSpindle('rimeglass', ['Cast > Swath[Frost]']);
    const chill = (s: GameState) => {
      const d = addEnemy(s, 'dummy', 86, 60);
      const ev = castFor(s, LMB, Math.ceil(releaseTick(0.4) / 1.05) + 1, [100, 60]);
      return ofType(ev, 'ailmentApplied').find((x) => x.target === d.id)!.magnitude;
    };
    expect(chill(rime)).toBeCloseTo(chill(twig) * 1.2, 9);
  });

  it('spell knockback follows the spec, away from the spell', () => {
    const state = weaveArena(['Cast > Bolt[Fire]']);
    const e = addEnemy(state, 'tinderling', 95, 60);
    e.life = e.maxLife = 1000;
    const ev = castFor(state, LMB, releaseTick(0.45), [95, 60], 15);
    expect(ofType(ev, 'hit')[0]).toMatchObject({ kbX: 1, kbY: 0 });
    ticks(state, 60);
    expect(e.x - 95).toBeGreaterThan(1 - 0.06);
    expect(e.x - 95).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe('Lob branch landing', () => {
  const lands = (seed: number) => {
    const state = weaveArena(['Cast > Bolt[Fire] > OnHit > Lob[Fire]']);
    state.spellRng = new Rng(seed);
    addEnemy(state, 'dummy', 100, 60);
    const ev = castFor(state, LMB, releaseTick(0.45), [120, 60], 40);
    const lob = spawnsOf(ev, 'lob')[0]!;
    return { from: [lob.x, lob.y], to: [lob.toX, lob.toY] };
  };

  it('lands on a random point within 10 cells of its origin, the same for the same seed', () => {
    const a = lands(1);
    expect(Math.hypot(a.to[0]! - a.from[0]!, a.to[1]! - a.from[1]!)).toBeLessThanOrEqual(10);
    expect(lands(1)).toEqual(a);
    expect(lands(2).to).not.toEqual(a.to);
    for (let s = 3; s < 30; s++) {
      const l = lands(s);
      expect(Math.hypot(l.to[0]! - l.from[0]!, l.to[1]! - l.from[1]!)).toBeLessThanOrEqual(10);
    }
  });
});

describe('runtime state is hashed', () => {
  it('instances, casts, echoes, the trigger queue and weave slots all change the hash', () => {
    const base = () => {
      const s = weaveArena(['Cast > Strike[Echo]', 'Pulse > Orb[Fire]', 'OnHurt > Nova[Fire]']);
      addEnemy(s, 'dummy', 84, 60);
      ticks(s, releaseTick(0.4), LMB, [100, 60]);
      s.triggerQueue.push({ event: 'hurt', targetId: -1, x: 0, y: 0, dirX: 0, dirY: 0, amount: 1 });
      return s;
    };
    const h0 = hashState(base());
    expect(base().pendingSpells.length).toBe(1);
    expect(base().spells.length).toBeGreaterThan(0);
    const mutations: Array<(s: GameState) => void> = [
      (s) => (s.spells[0]!.x += 1e-6),
      (s) => s.spells[0]!.hitIds.push(99),
      (s) => (s.spells[0]!.procs.length ? s.spells[0]!.procs[0]!++ : s.spells[0]!.emitLeft.push(1)),
      (s) => (s.casts[0]!.spawned += 1),
      (s) => (s.pendingSpells[0]!.delayLeft += 0.01),
      (s) => (s.triggerQueue[0]!.amount = 0.5),
      (s) => (s.weaves.slots[1]!.periodLeft += 0.01),
      (s) => (s.weaves.spindleId = 'ashwood'),
      (s) => (s.cheats.infiniteMana = true),
      (s) => s.spellRng.nextU32(),
      (s) => s.nextCastId++,
    ];
    for (const m of mutations) {
      const s = base();
      m(s);
      expect(hashState(s)).not.toBe(h0);
    }
  });
});
