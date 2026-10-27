/**
 * The second weave bar (playtest 8): slots 5–8 are bar 2's LMB, RMB, Q, E; X (Button.SwapBar)
 * swaps the live bar on its press edge inside the sim; only the live bar and R act; the other
 * bar's trigger timers freeze; a short lockout follows each swap.
 */
import { describe, expect, it } from 'vitest';
import {
  actingSlots,
  applyLoadoutSpec,
  Button,
  hashState,
  listensFor,
  liveSlots,
  loadoutSpecOf,
  refreshHero,
  runFrames,
  setSlotWeave,
  type GameState,
  type InputFrame,
} from '../../../src/sim';
import { addEnemy, ofType, releaseTick, tick, ticks, weaveArena } from './runtimeHelpers';

const X = Button.SwapBar;
const LMB = Button.Cast1;
const R = Button.Cast5;
/** Ticks of the default swap lockout (tuning.player.barSwapLockout, 0.15 s). */
const LOCK = 9;

/** Bar 1: Bolt on LMB. Bar 2: Strike on LMB, plus whatever `bar2` adds (slots 5–8). */
function bars(bar2: (string | null)[] = ['Cast > Strike[]']): GameState {
  return weaveArena(['Cast > Bolt[Fire]', null, null, null, null, ...bar2]);
}

/** Presses X for one tick (with `held` buttons); the next tick without X is a release. */
function swap(s: GameState, held = 0) {
  return tick(s, X | held);
}

describe('weave bars: the swap', () => {
  it('X is its own button bit, separate from every slot, dodge and interact button', () => {
    const others = Button.Cast1 | Button.Cast2 | Button.Cast3 | Button.Cast4 | R | Button.Dodge | Button.Interact;
    expect(X & others).toBe(0);
    expect(X).toBe(1 << 7);
  });

  it('swaps on the press edge only: holding X swaps once, each new press swaps again', () => {
    const s = bars();
    expect(s.weaves.activeBar).toBe(0);
    const ev = ticks(s, 20, X);
    expect(ofType(ev, 'barSwap')).toEqual([{ type: 'barSwap', bar: 1 }]);
    expect(s.weaves.activeBar).toBe(1);
    tick(s);
    expect(ofType(swap(s), 'barSwap')).toEqual([{ type: 'barSwap', bar: 0 }]);
    expect(s.weaves.activeBar).toBe(0);
  });

  it('live slots: bar 1 casts slot 0 on LMB; after a swap LMB casts slot 5', () => {
    const s = bars();
    expect(liveSlots(s.weaves)).toEqual([0, 1, 2, 3, 4]);
    expect(new Set(ofType(ticks(s, 40, LMB), 'castStart').map((e) => e.slot))).toEqual(new Set([0]));
    ticks(s, 60);
    swap(s);
    expect(liveSlots(s.weaves)).toEqual([5, 6, 7, 8, 4]);
    ticks(s, LOCK);
    const ev = ticks(s, 40, LMB);
    expect(new Set(ofType(ev, 'castStart').map((e) => e.slot))).toEqual(new Set([5]));
    expect(ofType(ev, 'spellSpawn').every((e) => e.form === 'strike')).toBe(true);
  });

  it('cancels an unreleased cast from the bar being left', () => {
    const s = bars();
    const start = ticks(s, 2, LMB);
    expect(ofType(start, 'castStart').map((e) => e.slot)).toEqual([0]);
    expect(releaseTick(0.45)).toBeGreaterThan(3);
    const ev = swap(s, LMB);
    expect(ofType(ev, 'castCancel').map((e) => e.slot)).toEqual([0]);
    expect(s.player.castSlot).toBe(-1);
    // Nothing from bar 1 releases afterwards.
    expect(ofType(ticks(s, 30), 'cast')).toHaveLength(0);
  });

  it("doesn't cancel a cast from R (Twin Threads): R is on both bars", () => {
    const s = weaveArena(['Cast > Bolt[Fire]', null, null, null, 'Cast > Bolt[Fire]', 'Cast > Strike[]']);
    s.hero.hearth.mutations.twin_threads = 1;
    refreshHero(s);
    expect(ofType(ticks(s, 2, R), 'castStart').map((e) => e.slot)).toEqual([4]);
    const ev = [...swap(s, R), ...ticks(s, 10, R)];
    expect(ofType(ev, 'castCancel')).toHaveLength(0);
    expect(ofType(ev, 'cast').map((e) => e.slot)).toEqual([4]);
  });

  it("ends a Channel on the bar being left; R's Channel keeps going", () => {
    const s = bars([null]);
    expect(setSlotWeave(s, 0, 'Channel > Bolt[Fire]').applied).toBe(true);
    const before = ofType(ticks(s, 30, LMB), 'triggerFired');
    expect(before.length).toBeGreaterThan(0);
    swap(s, LMB);
    expect(ofType(ticks(s, 60, LMB), 'triggerFired')).toHaveLength(0);
    expect(s.weaves.slots[0]!.periodLeft).toBe(0);
  });

  it('a lockout follows the swap: the new bar acts tuning.player.barSwapLockout later', () => {
    const s = bars();
    swap(s, LMB);
    expect(s.weaves.swapLeft).toBeCloseTo(0.15, 9);
    expect(actingSlots(s.weaves)).toEqual([4]);
    const ev: number[] = [];
    for (let i = 1; i <= LOCK + 3; i++) if (ofType(tick(s, LMB), 'castStart').length > 0) ev.push(i);
    expect(ev[0]).toBe(LOCK);
    expect(actingSlots(s.weaves)).toEqual([5, 6, 7, 8, 4]);
  });

  it('the lockout is a tuning value: 0 lets the new bar cast on the swap tick', () => {
    const s = bars();
    s.tuning.player.barSwapLockout = 0;
    expect(ofType(swap(s, LMB), 'castStart').map((e) => e.slot)).toEqual([5]);
  });

  it("doesn't swap while dead", () => {
    const s = bars();
    s.player.dead = true;
    s.player.respawnLeft = 5;
    expect(ofType(swap(s), 'barSwap')).toHaveLength(0);
    expect(s.weaves.activeBar).toBe(0);
  });
});

describe('weave bars: only the live slots fire, the other bar is frozen', () => {
  it("bar 2's Pulse doesn't fire while bar 1 is live, and fires after the swap", () => {
    const s = bars(['Pulse > Bolt[Fire]']);
    addEnemy(s, 'dummy', 100, 60);
    expect(ofType(ticks(s, 200), 'triggerFired')).toHaveLength(0);
    expect(s.weaves.slots[5]!.periodLeft).toBe(0);
    swap(s);
    const ev = ticks(s, LOCK + 1);
    expect(ofType(ev, 'triggerFired').map((e) => e.slot)).toEqual([5]);
  });

  it("freezes the inactive bar's Pulse period and ICD until it is live again", () => {
    const s = bars(['Pulse > Bolt[Fire]', 'OnDodge > Nova[Frost]']);
    addEnemy(s, 'dummy', 100, 60);
    swap(s);
    ticks(s, LOCK + 10);
    tick(s, Button.Dodge, undefined, [1, 0]);
    ticks(s, 3);
    const pulse = s.weaves.slots[5]!.periodLeft;
    const icd = s.weaves.slots[6]!.cooldownLeft;
    expect(pulse).toBeGreaterThan(0);
    expect(icd).toBeGreaterThan(0);
    swap(s);
    const away = ticks(s, 300);
    expect(ofType(away, 'triggerFired').filter((e) => e.slot >= 5)).toHaveLength(0);
    expect(s.weaves.slots[5]!.periodLeft).toBe(pulse);
    expect(s.weaves.slots[6]!.cooldownLeft).toBe(icd);
    // Back on bar 2: the timers pick up where they stopped, after the lockout (no burst on swap).
    swap(s);
    ticks(s, LOCK - 1);
    expect(s.weaves.slots[5]!.periodLeft).toBe(pulse);
    tick(s); // the lockout's last tick: bar 2 acts from here
    expect(s.weaves.slots[5]!.periodLeft).toBeLessThan(pulse);
  });

  it("bar 2's On Dodge doesn't listen or fire while bar 1 is live", () => {
    const s = bars(['OnDodge > Nova[Frost]']);
    expect(listensFor(s, 'dodge_start')).toBe(false);
    const ev = [...tick(s, Button.Dodge, undefined, [1, 0]), ...ticks(s, 5)];
    expect(ofType(ev, 'triggerFired')).toHaveLength(0);
    ticks(s, 120);
    swap(s);
    expect(listensFor(s, 'dodge_start')).toBe(false); // the lockout
    ticks(s, LOCK);
    expect(listensFor(s, 'dodge_start')).toBe(true);
    ticks(s, 120);
    const on = [...tick(s, Button.Dodge, undefined, [1, 0]), ...ticks(s, 5)];
    expect(ofType(on, 'triggerFired').map((e) => [e.slot, e.trigger])).toEqual([[5, 'on_dodge']]);
  });

  it('a bar-1 automatic weave stops when bar 2 is live', () => {
    const s = weaveArena(['Pulse > Bolt[Fire]']);
    addEnemy(s, 'dummy', 100, 60);
    expect(ofType(ticks(s, 1), 'triggerFired').map((e) => e.slot)).toEqual([0]);
    swap(s);
    expect(ofType(ticks(s, 400), 'triggerFired')).toHaveLength(0);
  });
});

describe('weave bars: state, determinism and replays', () => {
  it('activeBar and the lockout are hashed', () => {
    const a = bars();
    const b = bars();
    expect(hashState(b)).toBe(hashState(a));
    b.weaves.activeBar = 1;
    expect(hashState(b)).not.toBe(hashState(a));
    b.weaves.activeBar = 0;
    b.weaves.swapLeft = 0.1;
    expect(hashState(b)).not.toBe(hashState(a));
  });

  it('loadoutSpecOf keeps the live bar (replay starts), and leaves it out on bar 1', () => {
    const s = bars();
    expect(loadoutSpecOf(s.weaves).activeBar).toBeUndefined();
    swap(s);
    const spec = loadoutSpecOf(s.weaves);
    expect(spec.activeBar).toBe(1);
    expect(spec.notations[5]).toBe('Cast > Strike[]');
    const t = weaveArena([]);
    applyLoadoutSpec(t, spec);
    expect(t.weaves.activeBar).toBe(1);
    expect(t.weaves.swapLeft).toBe(0);
    expect(t.weaves.slots[5]!.program?.notation).toBe('Cast > Strike[]');
  });

  it('a run with swaps is deterministic, and the swaps change the outcome', () => {
    const frames = (swaps: boolean): InputFrame[] =>
      Array.from({ length: 360 }, (_, i) => ({
        moveX: 0,
        moveY: 0,
        aimX: 110,
        aimY: 60,
        buttons: (i % 20 < 12 ? LMB : 0) | (swaps && i % 90 === 45 ? X : 0),
      }));
    const createState = () => {
      const s = bars(['Cast > Strike[]', null, 'Pulse > Bolt[Frost]']);
      addEnemy(s, 'dummy', 110, 60);
      return s;
    };
    const a = runFrames(frames(true), '', { seed: 3, createState });
    const b = runFrames(frames(true), '', { seed: 3, createState });
    expect(a.hash).toBe(b.hash);
    expect(a.state.weaves.activeBar).toBe(0); // four swaps
    const none = runFrames(frames(false), '', { seed: 3, createState });
    expect(none.hash).not.toBe(a.hash);
  });
});
