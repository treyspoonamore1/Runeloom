import { describe, expect, it } from 'vitest';
import { Button, killAllEnemies, noteCrit, setLoadoutSpindle, type GameState } from '../../../src/sim';
import { hitWith } from '../combat/helpers';
import { addEnemy, castFor, ofType, releaseTick, tick, ticks, weaveArena } from './runtimeHelpers';

const fires = (ev: ReturnType<typeof ticks>, trigger: string) =>
  ofType(ev, 'triggerFired').filter((f) => f.trigger === trigger);

/** Ticks on which `trigger` fired over `n` ticks of `frame(i)` buttons. */
function fireTicks(
  state: GameState,
  n: number,
  trigger: string,
  buttons: (i: number) => number = () => 0,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (fires(tick(state, buttons(i)), trigger).length) out.push(i);
  return out;
}

describe('Cast trigger', () => {
  it('pays the weave mana at release and fires along the aim', () => {
    const state = weaveArena(['Cast > Bolt[Fire, Split]']);
    const p = state.player;
    const cost = state.weaves.slots[0]!.program!.mana;
    expect(cost).toBeCloseTo(6 * 1.1 * 1.4, 12);
    const before = ticks(state, releaseTick(0.45) - 1, Button.Cast1);
    expect(fires(before, 'cast')).toHaveLength(0);
    expect(p.mana).toBe(p.maxMana);
    const ev = tick(state, Button.Cast1);
    expect(fires(ev, 'cast')).toMatchObject([{ slot: 0, x: 80, y: 60, dirX: 1, dirY: 0, mana: cost }]);
    expect(ofType(ev, 'cast')).toMatchObject([{ slot: 0, spell: 'bolt' }]);
    expect(p.mana).toBeCloseTo(p.maxMana - cost, 12);
  });

  it('a slot whose weave no longer fits the spindle does nothing', () => {
    const state = weaveArena(['Cast > Bolt[Fire, Split, Pierce]'], 5);
    setLoadoutSpindle(state, 'test_spindle', 4);
    expect(state.weaves.slots[0]!.error).toBe('Needs 5 Capacity; this spindle has 4');
    expect(ofType(ticks(state, 30, Button.Cast1), 'castStart')).toHaveLength(0);
    setLoadoutSpindle(state, 'test_spindle', 5);
    expect(ofType(ticks(state, 1, Button.Cast1), 'castStart')).toHaveLength(1);
  });

  it('an automatic weave ignores its button', () => {
    const state = weaveArena(['OnDodge > Nova[Frost]']);
    const ev = ticks(state, 30, Button.Cast1);
    expect(ofType(ev, 'castStart')).toHaveLength(0);
    expect(ofType(ev, 'castFailed')).toHaveLength(0);
  });
});

describe('Pulse', () => {
  it('fires every 2 s at the nearest visible enemy within 40 cells, from its first tick', () => {
    const state = weaveArena([null, null, 'Pulse > Bolt[Fire]']);
    const near = addEnemy(state, 'dummy', 110, 60);
    addEnemy(state, 'dummy', 115, 60);
    const ev: ReturnType<typeof ticks> = [];
    const at = [];
    for (let i = 0; i < 250; i++) {
      const e = [...tick(state)];
      if (fires(e, 'pulse').length) at.push(i);
      ev.push(...e);
    }
    expect(at).toEqual([0, 120, 240]);
    const f = fires(ev, 'pulse')[0]!;
    expect(f).toMatchObject({ slot: 2, x: 80, y: 60, dirX: 1, dirY: 0 });
    expect(ofType(ev, 'hit').every((h) => h.target === near.id)).toBe(true);
  });

  it('skips when no enemy is in range or in sight, and when mana is short', () => {
    const none = weaveArena(['Pulse > Bolt[Fire]']);
    addEnemy(none, 'dummy', 80 + 41.6, 60);
    expect(fireTicks(none, 250, 'pulse')).toEqual([]);

    const hidden = weaveArena(['Pulse > Bolt[Fire]']);
    const r = hidden.room;
    for (let y = 0; y < r.height; y++) r.shotSolid[y * r.width + 95] = 1;
    addEnemy(hidden, 'dummy', 100, 60);
    expect(fireTicks(hidden, 250, 'pulse')).toEqual([]);

    const broke = weaveArena(['Pulse > Bolt[Fire]']);
    addEnemy(broke, 'dummy', 100, 60);
    broke.tuning.combat.manaRegen = 0;
    broke.player.mana = 1;
    expect(fireTicks(broke, 250, 'pulse')).toEqual([]);
    broke.player.mana = 50;
    // Skipped pulses still restart the period: next chance at tick 240 + 120 k.
    expect(fireTicks(broke, 130, 'pulse')).toEqual([110]);
  });
});

describe('event triggers', () => {
  it('On Dodge fires at dodge start along the dodge, at most every 0.5 s', () => {
    const state = weaveArena(['OnDodge > Nova[Frost]']);
    const ev = tick(state, Button.Dodge, undefined, [0, 1]);
    expect(fires(ev, 'on_dodge')).toMatchObject([{ x: 80, y: 60, dirX: 0, dirY: 1 }]);
    // Second dodge 10 ticks later is inside the ICD; a dodge 30 ticks after the first is not.
    ticks(state, 9);
    expect(fires(tick(state, Button.Dodge, undefined, [1, 0]), 'on_dodge')).toHaveLength(0);
    const s2 = weaveArena(['OnDodge > Nova[Frost]']);
    const at = fireTicks(s2, 31, 'on_dodge', (i) => (i === 0 || i === 30 ? Button.Dodge : 0));
    expect(at).toEqual([0, 30]);
  });

  it('Harvest fires from each enemy the player kills, aimed away from the player, at most every 0.25 s', () => {
    const state = weaveArena([null, 'Cast > Strike[]', 'Harvest > Nova[Fire]']);
    const a = addEnemy(state, 'tinderling', 84, 59);
    const b = addEnemy(state, 'tinderling', 84, 61);
    a.life = b.life = 1;
    const ev = castFor(state, Button.Cast2, releaseTick(0.4), [100, 60], 2);
    expect(ofType(ev, 'death')).toHaveLength(2);
    // Both died on one tick: the first fires, the second is inside the 0.25 s ICD.
    const h = fires(ev, 'harvest');
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ x: a.x, y: a.y });
    expect(h[0]!.dirX).toBeGreaterThan(0.9);
    // Kills that aren't the player's (console killall) don't count.
    const s2 = weaveArena(['Harvest > Nova[Fire]']);
    addEnemy(s2, 'tinderling', 90, 60);
    killAllEnemies(s2);
    expect(fires(ticks(s2, 5), 'harvest')).toHaveLength(0);
  });

  it('On Crit fires from the target, along the hit, at most every 0.3 s', () => {
    const state = weaveArena(['Cast > Bolt[Storm, Keen]', 'OnCrit > Nova[Fire]']);
    const d = addEnemy(state, 'dummy', 95, 60);
    let crit = -1;
    let fired = -1;
    for (let i = 0; i < 2000 && fired < 0; i++) {
      const ev = tick(state, Button.Cast1, [95, 60]);
      if (crit < 0 && ofType(ev, 'hit').some((h) => h.crit)) crit = i;
      const f = fires(ev, 'on_crit');
      if (f.length) {
        fired = i;
        expect(f[0]).toMatchObject({ x: d.x, y: d.y, dirX: 1, dirY: 0 });
      }
    }
    expect(crit).toBeGreaterThanOrEqual(0);
    // Queued on the crit's tick, fired at the next trigger phase (after a crit's hitstop).
    expect(fired).toBeGreaterThan(crit);
    const s2 = weaveArena(['OnCrit > Nova[Fire]']);
    const t = addEnemy(s2, 'dummy', 95, 60);
    noteCrit(s2, t.id, t.x, t.y, 1, 0);
    noteCrit(s2, t.id, t.x, t.y, 1, 0);
    expect(fires(tick(s2), 'on_crit')).toHaveLength(1);
  });

  it('On Hurt fires when one hit deals at least 5% of max life, at most every 1 s, for no mana', () => {
    const state = weaveArena(['OnHurt > Nova[Fire]']);
    const p = state.player;
    hitWith(state, p, 3.9, 'physical', { sourceId: 3 });
    expect(fires(tick(state), 'on_hurt')).toHaveLength(0);
    hitWith(state, p, 4, 'physical', { sourceId: 3 });
    const mana = p.mana;
    const ev = tick(state);
    expect(fires(ev, 'on_hurt')).toMatchObject([{ x: p.x, y: p.y, mana: 0 }]);
    expect(p.mana).toBeGreaterThanOrEqual(mana);
    hitWith(state, p, 10, 'physical', { sourceId: 3 });
    expect(fires(tick(state), 'on_hurt')).toHaveLength(0);
    ticks(state, 58);
    hitWith(state, p, 10, 'physical', { sourceId: 3 });
    expect(fires(tick(state), 'on_hurt')).toHaveLength(1);
  });

  it('automatic triggers skip without mana and then start no ICD', () => {
    const state = weaveArena(['OnDodge > Nova[Frost]']);
    state.tuning.combat.manaRegen = 0;
    state.player.mana = 1;
    expect(fires(tick(state, Button.Dodge), 'on_dodge')).toHaveLength(0);
    expect(state.weaves.slots[0]!.cooldownLeft).toBe(0);
    state.player.mana = 50;
    ticks(state, 15); // the first dodge ends
    expect(fires(tick(state, Button.Dodge), 'on_dodge')).toHaveLength(1);
  });

  it('nothing fires while the player is frozen or dead', () => {
    const state = weaveArena(['OnHurt > Nova[Fire]', null, 'Pulse > Bolt[Fire]']);
    addEnemy(state, 'dummy', 100, 60);
    state.player.ailments.freeze.timeLeft = 0.5;
    hitWith(state, state.player, 10, 'physical', { sourceId: 3 });
    const ev = ticks(state, 20);
    expect(ofType(ev, 'triggerFired')).toHaveLength(0);
  });
});
