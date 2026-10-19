import { describe, expect, it } from 'vitest';
import { aggro, spawnEnemy } from '../../../src/sim';
import { refreshSight } from '../../../src/sim/ai/common';
import { apply, oilRect, ofType, paintRect, place, room, run } from './helpers';

/** DESIGN §6.2 slows and slippery ice, and §6.4 Blind (smoke and steam). */

/** Player speed after running right for a second from (30, 40) over a floor of `ch`. */
function topSpeed(ch: string, oil = false): number {
  const s = room(ch, 40, 20, 30, 40);
  if (oil) oilRect(s, 4, 4, 155, 75);
  run(s, 60, 0, undefined, [1, 0]);
  return Math.hypot(s.player.vx, s.player.vy);
}

describe('movement on the ground', () => {
  it('shallow water slows by 20%, mud by 40%, oil by 15%', () => {
    const base = topSpeed('.');
    expect(base).toBeCloseTo(26, 6);
    expect(topSpeed('~') / base).toBeCloseTo(0.8, 6);
    expect(topSpeed(':') / base).toBeCloseTo(0.6, 6);
    expect(topSpeed('.', true) / base).toBeCloseTo(0.85, 6);
    expect(topSpeed('~', true) / base).toBeCloseTo(0.8 * 0.85, 6);
  });

  it('ice is slippery: the player takes much longer to stop and to get going', () => {
    const stopDistance = (ch: string) => {
      const s = room(ch, 40, 20, 30, 40);
      run(s, 40, 0, undefined, [1, 0]);
      const x = s.player.x;
      run(s, 60);
      return s.player.x - x;
    };
    expect(stopDistance('i')).toBeGreaterThan(stopDistance('.') * 5);
    const s = room('i', 40, 20, 30, 40);
    run(s, 6, 0, undefined, [1, 0]);
    expect(s.player.vx).toBeLessThan(26 * 0.5);
    expect(s.player.terrain.onIce).toBe(true);
  });

  it('enemies are slowed and slide too', () => {
    const plain = room('.', 40, 20, 140, 40);
    const mud = room(':', 40, 20, 140, 40);
    const ice = room('i', 40, 20, 140, 40);
    const xs = [plain, mud, ice].map((s) => {
      s.cheats.noAI = false;
      s.mode = 'arena';
      const e = spawnEnemy(s, 'shieldbearer', 30, 40);
      aggro(s, e);
      run(s, 30);
      return e.x - 30;
    });
    expect(xs[1]! / xs[0]!).toBeCloseTo(0.6, 1);
    expect(xs[2]!).toBeLessThan(xs[0]! * 0.8);
  });
});

describe('Blind (smoke and steam)', () => {
  it('an enemy in steam is Blind and sees nothing beyond 4 cells', () => {
    const s = room('~', 30, 20, 60, 40);
    const e = spawnEnemy(s, 'ember_archer', 40, 40);
    refreshSight(s, e);
    expect(e.ai.los).toBe(true);
    apply(s, 'fire', { kind: 'circle', x: 40, y: 40, r: 2 });
    const ev = run(s, 1);
    expect(e.terrain.blind).toBe(true);
    expect(ofType(ev, 'blindChanged')).toEqual([
      { type: 'blindChanged', id: e.id, blind: true, x: 40, y: 40 },
    ]);
    refreshSight(s, e);
    expect(e.ai.los).toBe(false);
    place(s, 43, 40);
    refreshSight(s, e);
    expect(e.ai.los).toBe(true);
  });

  it('an enemy whose target stands in smoke is Blind; one that has no target is not', () => {
    const s = room('"', 30, 20, 60, 40);
    const hunter = spawnEnemy(s, 'ember_archer', 30, 40);
    const idle = spawnEnemy(s, 'ember_archer', 90, 40);
    aggro(s, hunter);
    paintRect(s, 56, 36, 64, 44, 'grass');
    apply(s, 'fire', { kind: 'circle', x: 60, y: 40, r: 2 }, { owner: 0 });
    run(s, 4);
    expect(s.grid.air[40 * s.grid.width + 60]).not.toBe(0);
    expect(hunter.terrain.blind).toBe(true);
    expect(idle.terrain.blind).toBe(false);
  });
});
