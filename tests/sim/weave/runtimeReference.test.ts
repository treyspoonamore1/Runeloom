/** CONTENT §2 reference weaves: the "Behavior to test" parts that don't need terrain (terrain is M3). */
import { describe, expect, it } from 'vitest';
import {
  Button,
  createReferenceScene,
  freezeTarget,
  referenceWeaves,
  sceneCenter,
  step,
} from '../../../src/sim';
import { hitWith } from '../combat/helpers';
import {
  addEnemy,
  baseAmount,
  castFor,
  hitsByTarget,
  ofType,
  releaseTick,
  setWeaves,
  spawnsOf,
  tick,
  ticks,
  weaveArena,
} from './runtimeHelpers';

const REF = (n: number) => referenceWeaves.find((w) => w.n === n)!.notation;
const LMB = Button.Cast1;

describe('reference weave behavior (CONTENT §2)', () => {
  it('#1 Starter Spark: the hit enemy is Ignited', () => {
    const state = weaveArena([REF(1)]);
    const d = addEnemy(state, 'dummy', 95, 60);
    castFor(state, LMB, releaseTick(0.45), [95, 60], 10);
    expect(d.ailments.ignite.timeLeft).toBeGreaterThan(0);
  });

  it('#3 Wildfire Seed: the lob lands, then the nova bursts where it landed', () => {
    const state = weaveArena([REF(3)]);
    const d = addEnemy(state, 'dummy', 108, 60);
    const ev = castFor(state, LMB, releaseTick(0.55), [100, 60], 50);
    const land = ofType(ev, 'lobLand')[0]!;
    const nova = spawnsOf(ev, 'nova')[0]!;
    expect(ev.indexOf(nova)).toBeGreaterThan(ev.indexOf(land));
    expect(nova).toMatchObject({ x: 100, y: 60, depth: 1 });
    expect(nova.params.form === 'nova' && nova.params.radius).toBeCloseTo(10 * Math.sqrt(1.4), 12);
    // 8 cells from the landing: outside the 5-cell burst, inside the wide nova.
    expect(hitsByTarget(ev).get(d.id)).toBe(1);
  });

  it('#4 Scatter Spark: 3 bolts in a fan, each passing through up to 4 targets', () => {
    const state = weaveArena([REF(4)]);
    const r15 = { cos: 0.9659258262890683, sin: 0.25881904510252074 };
    // Six dummies along each bolt's line, from 20 cells out (where the lines are 5 cells apart).
    const lines = [-1, 0, 1].map((k) =>
      [20, 24, 28, 32, 36, 40].map((d) =>
        addEnemy(state, 'dummy', 80 + d * (k === 0 ? 1 : r15.cos), 60 + d * k * r15.sin),
      ),
    );
    const ev = castFor(state, LMB, releaseTick(0.45), [120, 60], 60);
    expect(spawnsOf(ev, 'bolt')).toHaveLength(3);
    const hit = hitsByTarget(ev);
    for (const line of lines) expect(line.map((e) => hit.get(e.id) ?? 0)).toEqual([1, 1, 1, 1, 0, 0]);
  });

  it('#5 Glacier Step: dodging casts the frost nova at the dodge start', () => {
    const state = weaveArena([REF(5)]);
    const d = addEnemy(state, 'dummy', 86, 60);
    const ev = ticks(state, 15, 0);
    ev.push(...tick(state, Button.Dodge, undefined, [0, 1]), ...ticks(state, 15));
    expect(spawnsOf(ev, 'nova')[0]).toMatchObject({ x: 80, y: 60 });
    expect(hitsByTarget(ev).get(d.id)).toBe(1);
    expect(
      ofType(ev, 'ailmentApplied').filter((a) => a.target === d.id && a.ailment === 'chill'),
    ).toHaveLength(1);
  });

  it('#6 Shatter Lance: killing Frozen enemies shatters them and fires the nova', () => {
    const state = weaveArena([REF(6)]);
    const a = addEnemy(state, 'tinderling', 95, 60);
    const b = addEnemy(state, 'tinderling', 100, 60);
    for (const e of [a, b]) {
      e.life = 1;
      freezeTarget(state, e, 5, 0);
    }
    const ev = castFor(state, LMB, releaseTick(0.35), [120, 60], 15);
    expect(ofType(ev, 'death').map((d) => [d.id, d.shattered])).toEqual([
      [a.id, true],
      [b.id, true],
    ]);
    expect(spawnsOf(ev, 'nova').map((n) => [n.x, n.y])).toEqual([
      [95, 60],
      [100, 60],
    ]);
  });

  it('#7 Conductor: the bolt chains to two more enemies', () => {
    const state = weaveArena([REF(7)]);
    addEnemy(state, 'dummy', 90, 60);
    addEnemy(state, 'dummy', 98, 66);
    addEnemy(state, 'dummy', 106, 60);
    const ev = castFor(state, LMB, releaseTick(0.45), [90, 60], 20);
    expect(ofType(ev, 'chainJump')).toHaveLength(2);
    expect(hitsByTarget(ev).size).toBe(3);
  });

  it('#8 Stormfront: fires only when a visible enemy is within 40 cells', () => {
    const state = weaveArena([REF(8)]);
    const fired = () => ofType(ticks(state, 121), 'triggerFired').length;
    expect(fired()).toBe(0);
    const far = addEnemy(state, 'dummy', 80 + 45, 60);
    expect(fired()).toBe(0);
    far.x = 80 + 35;
    expect(fired()).toBe(1);
  });

  it('#9 Steam Veil: a big enough hit casts the fire nova at the player', () => {
    const state = weaveArena([REF(9)]);
    const d = addEnemy(state, 'dummy', 85, 60);
    hitWith(state, state.player, 2, 'physical', { sourceId: d.id });
    expect(ofType(ticks(state, 20), 'triggerFired')).toHaveLength(0);
    hitWith(state, state.player, 8, 'physical', { sourceId: d.id });
    const ev = ticks(state, 20);
    expect(spawnsOf(ev, 'nova')[0]).toMatchObject({ x: 80, y: 60 });
    expect(d.ailments.ignite.timeLeft).toBeGreaterThan(0);
  });

  it('#10 Ember Orbit: the orb emits homing bolts every 0.5 s while alive', () => {
    const state = weaveArena([REF(10)]);
    const d = addEnemy(state, 'dummy', 80, 80); // off the orbit, within 30 cells of it
    const emitted: number[] = [];
    for (let i = 0; i < 185; i++)
      for (const e of tick(state))
        if (e.type === 'spellSpawn' && e.form === 'bolt' && e.castId === 1) emitted.push(i);
    // Pulsed on tick 0; the orb lives 180 ticks and emits on every 30th, its last on its final tick.
    expect(emitted).toEqual([30, 60, 90, 120, 150, 180].map((t) => t - 1));
    const bolts = ofType(ticks(state, 30), 'hit').length;
    expect(bolts).toBeGreaterThan(0);
    expect(d.life).toBeLessThan(d.maxLife);
  });

  it('#11 Thunder Sigil: emitted beams deal Storm damage (inherited element)', () => {
    const state = weaveArena([REF(11)]);
    addEnemy(state, 'dummy', 110, 60);
    const ev = castFor(state, LMB, releaseTick(0.5), [100, 60], 60);
    const beams = spawnsOf(ev, 'beam');
    expect(beams.length).toBeGreaterThan(0);
    expect(beams[0]!.elements).toEqual(['storm']);
    const hits = ofType(ev, 'hit');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.damageType === 'storm')).toBe(true);
  });

  it('#12 Echo Strike: a second strike 0.35 s later with 20% less damage', () => {
    const state = weaveArena([REF(12)]);
    addEnemy(state, 'dummy', 84, 60);
    const at: number[] = [];
    const hits = [];
    for (let i = 0; i < 40; i++) {
      const ev = tick(state, i < releaseTick(0.4) ? LMB : 0, [100, 60]);
      for (const h of ofType(ev, 'hit')) {
        at.push(i);
        hits.push(h);
      }
    }
    expect(at[1]! - at[0]!).toBe(21);
    const crit = state.weaves.slots[0]!.program!.root.critMultiplier;
    const shock = hits[0]!.amount / (hits[0]!.crit ? crit : 1) / 500; // first hit's Shock on the dummy
    const shockTaken = Math.min(0.5, Math.max(0.05, shock));
    expect(baseAmount(hits[1]!.amount, hits[1]!.crit, crit) / (1 + shockTaken)).toBeCloseTo(16 * 0.8, 9);
  });

  it('#13 Twin Fates: both branches fire, On Hit first (the bolt stops on the enemy, ending it)', () => {
    const state = weaveArena([REF(13)]);
    addEnemy(state, 'dummy', 100, 60);
    const ev = castFor(state, LMB, releaseTick(0.45), [120, 60], 20);
    const kids = ofType(ev, 'spellSpawn').filter((s) => s.depth === 1);
    expect(kids.map((k) => k.form)).toEqual(['nova', 'lob']);
    const end = ofType(ev, 'spellEnd').find((e) => e.form === 'bolt')!;
    expect(end.reason).toBe('hit');
    expect(ev.indexOf(kids[0]!)).toBeLessThan(ev.indexOf(end));
    expect(ev.indexOf(end)).toBeLessThan(ev.indexOf(kids[1]!));
  });

  it('#14 Recursion Stress on a 22-Capacity test spindle in dummy_grid hits the 64 cap and counts drops', () => {
    const { state, centerX, centerY } = createReferenceScene('dummy_grid', { seed: 1 });
    setWeaves(state, [REF(14)], 22);
    const frame = { moveX: 0, moveY: 0, aimX: centerX, aimY: centerY, buttons: LMB };
    let spawned = 0;
    let dropped = 0;
    for (let i = 0; i < releaseTick(0.45); i++) step(state, frame);
    for (let i = 0; i < 120; i++) {
      for (const e of state.events) {
        if (e.type === 'spellSpawn' && e.castId === 1) spawned++;
        if (e.type === 'spawnDropped' && e.castId === 1) dropped++;
      }
      step(state, { ...frame, buttons: 0 });
    }
    expect(spawned).toBe(64);
    expect(dropped).toBeGreaterThan(0);
    expect(state.stats.dropped).toBeGreaterThanOrEqual(dropped);
    expect(sceneCenter('dummy_grid')).toEqual({ x: centerX, y: centerY });
  });
});
