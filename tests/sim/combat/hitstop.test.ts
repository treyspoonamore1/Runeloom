import { describe, expect, it } from 'vitest';
import { addHitstop, applyHit, Button, DT, makePacket, PLAYER_ID, spawnProjectile } from '../../../src/sim';
import { addEnemy, arena, BOLT, ofType, tick } from './helpers';

describe('hitstop', () => {
  it('a crit adds hitstopCrit and emits a hitstop event', () => {
    const state = arena();
    const d = addEnemy(state, 'dummy', 100, 60);
    const res = applyHit(state, d, makePacket(12, { fire: 1 }, 1, 1.5), {
      sourceId: PLAYER_ID,
      dirX: 1,
      dirY: 0,
      knockback: 0,
    });
    expect(res!.crit).toBe(true);
    expect(state.hitstopLeft).toBe(0.03);
    expect(ofType(state.events, 'hitstop')).toEqual([{ type: 'hitstop', seconds: 0.03 }]);
    expect(ofType(state.events, 'hit')[0]!.crit).toBe(true);
  });

  it('overlapping hitstops keep the longest, not the sum', () => {
    const state = arena();
    addHitstop(state, 0.06);
    addHitstop(state, 0.03);
    expect(state.hitstopLeft).toBe(0.06);
  });

  it('freezes players, enemies, projectiles and timers, but tracks buttons', () => {
    const state = arena();
    const e = addEnemy(state, 'tinderling', 100, 60);
    e.vx = 10;
    e.kbY = 20;
    spawnProjectile(state, {
      team: 'player',
      ownerId: PLAYER_ID,
      x: 20,
      y: 20,
      dirX: 1,
      dirY: 0,
      def: { kind: 'fire_bolt', speed: 70, radius: 1, life: 0.9, pierce: 0 },
      damage: makePacket(12, { fire: 1 }, 0, 1.5),
      knockback: 1,
    });
    tick(state, BOLT, undefined, [1, 0]);
    state.player.mana = 10;
    const snap = () =>
      JSON.stringify({
        p: [
          state.player.x,
          state.player.y,
          state.player.castLeft,
          state.player.mana,
          state.player.dodgeCharges,
        ],
        e: [e.x, e.y, e.kbY],
        pr: state.projectiles.map((p) => [p.x, p.y, p.lifeLeft]),
      });
    const before = snap();
    addHitstop(state, 0.06);
    const frozenTicks = Math.ceil(0.06 / DT - 1e-9);
    for (let i = 0; i < frozenTicks; i++) {
      const ev = tick(state, Button.Dodge, undefined, [1, 0]);
      expect(ev).toEqual([]);
      expect(snap()).toBe(before);
      expect(state.player.prevX).toBe(state.player.x);
      expect(e.prevX).toBe(e.x);
      expect(state.prevButtons).toBe(Button.Dodge);
    }
    expect(state.hitstopLeft).toBe(0);
    tick(state, 0, undefined, [1, 0]);
    expect(snap()).not.toBe(before);
    expect(e.x).toBeGreaterThan(100);
  });
});
