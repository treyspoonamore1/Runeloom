import { describe, expect, it } from 'vitest';
import {
  aggro,
  applyIgnite,
  isDoused,
  PLAYER_ID,
  spawnEnemy,
  spawnProjectile,
  makePacket,
} from '../../../src/sim';
import { enemies } from '../../../data/enemies';
import { hitWith } from '../combat/helpers';
import { apply, idx, MAT, ofType, OWNER, paintRect, room, run } from './helpers';

/** CONTENT §5 enemy chemistry and hazard avoidance. */

describe('Tinderling', () => {
  it('goes out when Wet: stunned 2 s, takes 50% more damage while out, burns again once dry', () => {
    const s = room('.', 30, 20, 100, 40);
    s.cheats.noAI = false;
    s.mode = 'arena';
    paintRect(s, 30, 30, 50, 50, 'shallow_water');
    const t = spawnEnemy(s, 'tinderling', 40, 40);
    aggro(s, t);
    const ev = run(s, 1);
    expect(ofType(ev, 'tinderlingDoused')).toMatchObject([{ id: t.id, stun: 2 }]);
    expect(isDoused(t)).toBe(true);
    const x = t.x;
    run(s, 100);
    expect(t.x).toBe(x); // stunned: doesn't move
    run(s, 30);
    expect(t.x).toBeGreaterThan(x); // chases again (still doused while in the water)
    const dry = spawnEnemy(s, 'tinderling', 100, 70);
    const a = t.life;
    const b = dry.life;
    hitWith(s, t, 4, 'physical');
    hitWith(s, dry, 4, 'physical');
    expect((a - t.life) / (b - dry.life)).toBeCloseTo(1.5, 9);
  });

  it('relights when it dries off', () => {
    const s = room('.', 30, 20, 100, 40);
    paintRect(s, 30, 30, 50, 50, 'shallow_water');
    const t = spawnEnemy(s, 'tinderling', 40, 40);
    run(s, 1);
    t.x = 70;
    const ev = run(s, 185);
    expect(ofType(ev, 'tinderlingRelit')).toHaveLength(1);
    expect(isDoused(t)).toBe(false);
  });
});

describe('Ember Archer', () => {
  it('an arrow that misses ignites the flammable cells where it lands, as the enemy team', () => {
    const s = room('"', 30, 20, 100, 70);
    const a = spawnEnemy(s, 'ember_archer', 20, 20);
    const def = enemies.ember_archer.attack.projectile;
    spawnProjectile(s, {
      team: 'enemy',
      ownerId: a.id,
      x: 20,
      y: 20,
      dirX: 1,
      dirY: 0,
      def,
      damage: makePacket(10, { fire: 1 }, 0, 1.5),
      knockback: 0,
    });
    const ev = run(s, 61);
    const end = ofType(ev, 'projectileEnd')[0]!;
    expect(end.reason).toBe('expired');
    expect(s.grid.fire[idx(s, end.x, end.y)]).toBeGreaterThan(0);
    expect(s.grid.owner[idx(s, end.x, end.y)]).toBe(OWNER.enemy);
    expect(s.grid.fire[idx(s, 40, 20)]).toBe(0); // not along the way
  });

  it('a missed arrow on stone places no fire', () => {
    const s = room('.', 30, 20, 100, 70);
    const a = spawnEnemy(s, 'ember_archer', 20, 20);
    spawnProjectile(s, {
      team: 'enemy',
      ownerId: a.id,
      x: 20,
      y: 20,
      dirX: 1,
      dirY: 0,
      def: enemies.ember_archer.attack.projectile,
      damage: makePacket(10, { fire: 1 }, 0, 1.5),
      knockback: 0,
    });
    run(s, 61);
    expect(s.grid.fire.every((f) => f === 0)).toBe(true);
  });
});

describe('Shieldbearer', () => {
  it('its wooden shield burns away after 4 s of total burning', () => {
    const s = room('.', 30, 20, 100, 40);
    const e = spawnEnemy(s, 'shieldbearer', 40, 40);
    applyIgnite(s, e, 1, 3, PLAYER_ID);
    run(s, 150); // 2.5 s burning
    expect(e.shield!.burnLeft).toBeCloseTo(1.5, 1);
    run(s, 60); // the ignite ran out at 3 s
    expect(e.shield!.burnLeft).toBeCloseTo(1, 1);
    apply(s, 'fire', { kind: 'circle', x: 40, y: 40, r: 3 }, { durationMult: 3 });
    const ev = run(s, 61);
    expect(e.shield).toBeNull();
    expect(ofType(ev, 'shieldBurned')).toEqual([{ type: 'shieldBurned', id: e.id, x: 40, y: 40 }]);
  });
});

describe('hazard avoidance', () => {
  /** A fire wall across the room between an enemy at x 30 and the player at x 100, burning a long time. */
  function wall(kind: string) {
    const s = room('.', 30, 20, 100, 40);
    s.cheats.noAI = false;
    s.mode = 'arena';
    apply(s, 'fire', { kind: 'line', x0: 60, y0: 30, x1: 60, y1: 50, width: 3 }, { durationMult: 8 });
    const e = spawnEnemy(s, kind, 40, 40);
    aggro(s, e);
    return { s, e };
  }

  it('a Shieldbearer walks around player fire instead of through it', () => {
    const { s, e } = wall('shieldbearer');
    let burnt = 0;
    for (let k = 0; k < 240; k++) {
      run(s, 1);
      if (s.grid.fire[idx(s, e.x, e.y)]! > 0) burnt++;
    }
    expect(burnt).toBe(0);
    expect(e.ailments.ignite.timeLeft).toBe(0);
    expect(e.x).toBeGreaterThan(62); // it got past
  });

  it('a Tinderling runs straight through', () => {
    const { s, e } = wall('tinderling');
    let crossed = false;
    for (let k = 0; k < 120 && !crossed; k++) {
      run(s, 1);
      crossed = s.grid.fire[idx(s, e.x, e.y)]! > 0;
    }
    expect(crossed).toBe(true);
  });

  it('enemy-owned fire is no hazard to enemies', () => {
    const s = room('.', 30, 20, 100, 40);
    apply(s, 'fire', { kind: 'circle', x: 40, y: 40, r: 3 }, { owner: OWNER.enemy, durationMult: 4 });
    const e = spawnEnemy(s, 'shieldbearer', 40, 40);
    run(s, 10);
    expect(e.ailments.ignite.timeLeft).toBe(0);
    expect(e.shield).not.toBeNull();
    expect(e.shield!.burnLeft).toBe(4);
    expect(s.grid.ground[idx(s, 40, 40)]).toBe(MAT.stone);
  });
});
