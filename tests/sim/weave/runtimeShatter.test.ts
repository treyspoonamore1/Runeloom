import { describe, expect, it } from 'vitest';
import {
  Button,
  hashState,
  killAllEnemies,
  killEnemy,
  PLAYER_ID,
  setSlotWeave,
  type Enemy,
  type GameState,
} from '../../../src/sim';
import { OWNER } from '../../../data/materials';
import { triggers } from '../../../data/runes';
import { adventure, giveRune } from '../hero/helpers';
import { addEnemy, castFor, ofType, releaseTick, tick, ticks, weaveArena } from './runtimeHelpers';

/** The Shatter trigger (CONTENT §1.1, unlocked by the Shatterpoint mutation, §11). */
const fires = (ev: ReturnType<typeof ticks>) =>
  ofType(ev, 'triggerFired').filter((f) => f.trigger === 'shatter');

function frozen(state: GameState, kind: string, x: number, y: number, life = 1): Enemy {
  const e = addEnemy(state, kind, x, y);
  e.life = life;
  e.ailments.freeze.timeLeft = 2;
  return e;
}

/** The player's damage over time kills `e` (no hitstop, unlike a hit shatter). */
const playerKill = (state: GameState, e: Enemy) => killEnemy(state, e, PLAYER_ID, 'dot');

describe('Shatter trigger', () => {
  it('fires from each enemy the player shatters, aimed away from the player', () => {
    const state = weaveArena([null, 'Cast > Strike[]', 'Shatter > Nova[Frost]']);
    const a = frozen(state, 'tinderling', 84, 59);
    const ev = castFor(state, Button.Cast2, releaseTick(0.4), [100, 60], 2);
    expect(ofType(ev, 'death')).toMatchObject([{ id: a.id, shattered: true, killerId: PLAYER_ID }]);
    const f = fires(ev);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ slot: 2, x: a.x, y: a.y });
    const len = Math.hypot(a.x - 80, a.y - 60);
    expect(f[0]!.dirX).toBeCloseTo((a.x - 80) / len, 9);
    expect(f[0]!.dirY).toBeCloseTo((a.y - 60) / len, 9);
    // The nova spawns at the shattered enemy, not at the player.
    expect(ofType(ev, 'spellSpawn').filter((s) => s.form === 'nova')[0]).toMatchObject({ x: a.x, y: a.y });

    // Straight below the player: aimed +y, whatever the player's aim.
    const s2 = weaveArena(['Shatter > Bolt[Frost]']);
    const b = frozen(s2, 'tinderling', 80, 75);
    playerKill(s2, b);
    expect(fires(tick(s2))).toMatchObject([{ x: 80, y: 75, dirX: 0, dirY: 1 }]);
  });

  it("doesn't fire from a kill that isn't Frozen (Harvest does)", () => {
    const state = weaveArena([null, 'Cast > Strike[]', 'Shatter > Nova[Frost]', 'Harvest > Nova[Fire]']);
    const a = addEnemy(state, 'tinderling', 84, 60);
    a.life = 1;
    const ev = castFor(state, Button.Cast2, releaseTick(0.4), [100, 60], 2);
    expect(ofType(ev, 'death')).toMatchObject([{ shattered: false }]);
    expect(fires(ev)).toHaveLength(0);
    expect(ofType(ev, 'triggerFired').filter((f) => f.trigger === 'harvest')).toHaveLength(1);
  });

  it("follows On Kill crediting: the player's Ignite counts; monster, world and console kills don't", () => {
    // Ignite applied by the player kills a Frozen enemy: a player shatter.
    const s1 = weaveArena(['Shatter > Nova[Frost]']);
    const e1 = frozen(s1, 'tinderling', 90, 60, 0.01);
    e1.ailments.ignite = { dps: 10, timeLeft: 1, sourceId: PLAYER_ID, owner: OWNER.player };
    const ev1 = ticks(s1, 3);
    expect(ofType(ev1, 'death')).toMatchObject([{ cause: 'dot', shattered: true, killerId: PLAYER_ID }]);
    expect(fires(ev1)).toHaveLength(1);

    // The same Ignite from a monster: no.
    const s2 = weaveArena(['Shatter > Nova[Frost]']);
    const src = addEnemy(s2, 'tinderling', 120, 60);
    const e2 = frozen(s2, 'tinderling', 90, 60, 0.01);
    e2.ailments.ignite = { dps: 10, timeLeft: 1, sourceId: src.id, owner: OWNER.enemy };
    const ev2 = ticks(s2, 3);
    expect(ofType(ev2, 'death')).toMatchObject([{ shattered: true, killerId: src.id }]);
    expect(fires(ev2)).toHaveLength(0);

    // A monster's hit, the world (no source) and the console: no.
    const s3 = weaveArena(['Shatter > Nova[Frost]']);
    killEnemy(s3, frozen(s3, 'tinderling', 90, 60), src.id, 'hit');
    killEnemy(s3, frozen(s3, 'tinderling', 90, 64), -1, 'hit');
    frozen(s3, 'tinderling', 90, 68);
    killAllEnemies(s3);
    expect(fires(ticks(s3, 20))).toHaveLength(0);
  });

  it('fires at most every 0.3 s across simultaneous shatters', () => {
    const state = weaveArena(['Shatter > Nova[Frost]']);
    state.cheats.infiniteMana = true;
    const at: number[] = [];
    for (let i = 0; i < 40; i++) {
      // Three shatters on every tick.
      for (let k = 0; k < 3; k++) playerKill(state, frozen(state, 'tinderling', 90 + k, 60));
      const f = fires(tick(state));
      expect(f.length).toBeLessThanOrEqual(1);
      if (f.length) at.push(i);
    }
    expect(triggers.shatter.icd).toBe(0.3);
    expect(at).toEqual([0, 18, 36]);
  });

  it('costs 0.6 × the weave mana and pays it when it fires', () => {
    const state = weaveArena(['Cast > Nova[Frost]', 'Shatter > Nova[Frost]']);
    const cast = state.weaves.slots[0]!.program!.mana;
    const shatter = state.weaves.slots[1]!.program!.mana;
    expect(shatter).toBeCloseTo(cast * 0.6, 9);
    state.tuning.combat.manaRegen = 0;
    const before = state.player.mana;
    playerKill(state, frozen(state, 'tinderling', 90, 60));
    const f = fires(tick(state));
    expect(f).toMatchObject([{ mana: shatter }]);
    expect(state.player.mana).toBeCloseTo(before - shatter, 6);
    // Short on mana: skips, and starts no ICD.
    state.player.mana = 0;
    ticks(state, 20);
    playerKill(state, frozen(state, 'tinderling', 90, 60));
    expect(fires(tick(state))).toHaveLength(0);
    expect(state.weaves.slots[1]!.cooldownLeft).toBe(0);
  });

  it('is deterministic', () => {
    const run = (): [number, number] => {
      const state = weaveArena([null, 'Cast > Strike[]', 'Shatter > Lob[Frost] > OnExpire > Nova[Frost]']);
      for (let k = 0; k < 4; k++) frozen(state, 'tinderling', 84, 57 + 2 * k);
      const ev = castFor(state, Button.Cast2, releaseTick(0.4), [100, 60], 120);
      return [hashState(state), fires(ev).length];
    };
    const a = run();
    expect(a[1]).toBeGreaterThan(0);
    expect(run()).toEqual(a);
  });

  it('needs a Shatter rune item in adventure mode, like any rune', () => {
    const state = adventure();
    giveRune(state, 'nova');
    giveRune(state, 'frost');
    const r = setSlotWeave(state, 2, 'Shatter > Nova[Frost]');
    expect(r.applied).toBe(false);
    expect(r.preview.compiled?.ok === false && r.preview.compiled.error.message).toBe(
      'Needs 1 Shatter rune; you have 0 free',
    );
    const item = giveRune(state, 'shatter');
    expect(setSlotWeave(state, 2, 'Shatter > Nova[Frost]').applied).toBe(true);
    expect(state.weaves.slots[2]!.runes).toContain(item.uid);
    playerKill(state, frozen(state, 'tinderling', 90, 60));
    expect(fires(tick(state))).toMatchObject([{ slot: 2, x: 90, y: 60 }]);
  });
});
