import { describe, expect, it } from 'vitest';
import { isBlockedByShield, makePacket, PLAYER_ID, spawnProjectile } from '../../../src/sim';
import { addEnemy, arena, ofType, ticks } from './helpers';

describe('Shieldbearer shield (100° front arc)', () => {
  it('isBlockedByShield: front arc yes, sides past 50° and back no', () => {
    const state = arena();
    const sb = addEnemy(state, 'shieldbearer', 100, 60, [-1, 0]);
    const at = (deg: number) => {
      const r = (deg * Math.PI) / 180; // test-side trig only
      return isBlockedByShield(sb, 100 - 10 * Math.cos(r), 60 + 10 * Math.sin(r));
    };
    expect(at(0)).toBe(true);
    expect(at(49)).toBe(true);
    expect(at(-49)).toBe(true);
    expect(at(51)).toBe(false);
    expect(at(-51)).toBe(false);
    expect(at(180)).toBe(false);
    const plain = addEnemy(state, 'tinderling', 120, 60, [-1, 0]);
    expect(isBlockedByShield(plain, 110, 60)).toBe(false);
  });

  function bolt(state: ReturnType<typeof arena>, x: number, dirX: number) {
    spawnProjectile(state, {
      team: 'player',
      ownerId: PLAYER_ID,
      x,
      y: 60,
      dirX,
      dirY: 0,
      def: { kind: 'fire_bolt', speed: 70, radius: 1, life: 0.9, pierce: 0 },
      damage: makePacket(12, { fire: 1 }, 0, 1.5),
      knockback: 1,
    });
  }

  it('blocks a projectile from the front', () => {
    const state = arena();
    const sb = addEnemy(state, 'shieldbearer', 100, 60, [-1, 0]);
    bolt(state, 80, 1);
    const ev = ticks(state, 30);
    expect(ofType(ev, 'shieldBlock')).toHaveLength(1);
    expect(ofType(ev, 'projectileEnd')[0]!.reason).toBe('blocked');
    expect(ofType(ev, 'hit')).toHaveLength(0);
    expect(sb.life).toBe(sb.maxLife);
  });

  it('lets a projectile from behind through', () => {
    const state = arena();
    const sb = addEnemy(state, 'shieldbearer', 100, 60, [-1, 0]);
    bolt(state, 120, -1);
    const ev = ticks(state, 30);
    expect(ofType(ev, 'shieldBlock')).toHaveLength(0);
    expect(ofType(ev, 'hit').map((h) => h.target)).toEqual([sb.id]);
    // 12 fire × (1 − 25%) = 9.
    expect(sb.maxLife - sb.life).toBeCloseTo(9, 9);
  });
});
