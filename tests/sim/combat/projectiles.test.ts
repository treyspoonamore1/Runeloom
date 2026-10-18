import { describe, expect, it } from 'vitest';
import { makePacket, PLAYER_ID, spawnProjectile, type GameState } from '../../../src/sim';
import { spells } from '../../../data/spells';
import { addEnemy, arena, BOLT, ofType, place, tick, ticks } from './helpers';

const BOLT_DEF = spells.fire_bolt.projectile;

function fire(state: GameState, x: number, y: number, dirX: number, dirY: number, pierce = 0) {
  return spawnProjectile(state, {
    team: 'player',
    ownerId: PLAYER_ID,
    x,
    y,
    dirX,
    dirY,
    def: { ...BOLT_DEF, pierce },
    damage: makePacket(12, { fire: 1 }, 0, 1.5),
    knockback: 1,
  });
}

/** Carves a 1-cell-thick shot-blocking wall at cell column `cx`. */
function thinWall(state: GameState, cx: number): void {
  const r = state.room;
  for (let y = 0; y < r.height; y++) r.shotSolid[y * r.width + cx] = 1;
}

describe('projectiles', () => {
  it('Fire Bolt flies toward the aim point at 70 cells/s and expires after 0.9 s', () => {
    const state = arena();
    place(state, 20, 60);
    const events = ticks(state, 7, BOLT, [140, 60]);
    const spawn = ofType(events, 'projectileSpawn')[0]!;
    expect(spawn.vx).toBeCloseTo(70, 9);
    expect(spawn.vy).toBe(0);
    const p = state.spells[0]!;
    const end = ofType(ticks(state, 60), 'projectileEnd');
    expect(end).toHaveLength(1);
    expect(end[0]!.reason).toBe('expired');
    expect(end[0]!.x - 20).toBeCloseTo(70 * 0.9, 6);
    expect(p.ended).toBe(true);
    expect(state.spells).toHaveLength(0);
  });

  it('stops at walls at its last clear position', () => {
    const state = arena();
    fire(state, 140, 60, 1, 0);
    const end = ofType(ticks(state, 30), 'projectileEnd')[0]!;
    expect(end.reason).toBe('wall');
    // The east wall starts at cell 156; radius 1.
    expect(end.x).toBeLessThanOrEqual(155);
    expect(end.x).toBeGreaterThan(154);
  });

  it("doesn't tunnel through a one-cell wall at 70 cells/s, at any angle or offset", () => {
    for (let i = 0; i < 200; i++) {
      const state = arena();
      thinWall(state, 100);
      const sx = 60 + (i % 17) * 0.37;
      const sy = 40 + (i % 13) * 1.13;
      const ang = ((i % 25) - 12) / 15; // slope in about [-0.8, 0.8]
      const len = Math.hypot(1, ang);
      fire(state, sx, sy, 1 / len, ang / len);
      let end;
      for (let t = 0; t < 60 && !end; t++) {
        end = ofType(tick(state), 'projectileEnd')[0];
        for (const pr of state.projectiles) expect(pr.x + pr.radius).toBeLessThanOrEqual(100 + 1e-9);
      }
      expect(end?.reason).toBe('wall');
      expect(end!.x).toBeLessThan(100);
    }
  });

  it('stops on the first enemy it reaches and hits it once', () => {
    const state = arena();
    const near = addEnemy(state, 'dummy', 100, 60);
    const far = addEnemy(state, 'dummy', 104, 60);
    fire(state, 80, 60, 1, 0);
    const ev = ticks(state, 30);
    expect(ofType(ev, 'hit').map((h) => h.target)).toEqual([near.id]);
    expect(ofType(ev, 'projectileEnd')[0]!.reason).toBe('hit');
    expect(far.life).toBe(far.maxLife);
  });

  it('with pierce, hits each target exactly once', () => {
    const state = arena();
    const a = addEnemy(state, 'dummy', 100, 60);
    const b = addEnemy(state, 'dummy', 101, 60.5);
    const c = addEnemy(state, 'dummy', 110, 60);
    fire(state, 80, 60, 1, 0, 1);
    const ev = ticks(state, 30);
    expect(ofType(ev, 'hit').map((h) => h.target)).toEqual([a.id, b.id]);
    expect(c.life).toBe(c.maxLife);
  });

  it('knocks the target back along its flight', () => {
    const state = arena();
    const e = addEnemy(state, 'tinderling', 100, 60);
    fire(state, 80, 60, 1, 0);
    ticks(state, 60);
    expect(e.x - 100).toBeGreaterThan(0.9);
    expect(e.x - 100).toBeLessThanOrEqual(1);
  });

  it('player bolts pass through the player; enemy projectiles pass through enemies and hit the player', () => {
    const state = arena();
    const archer = addEnemy(state, 'ember_archer', 120, 60);
    const blocker = addEnemy(state, 'tinderling', 100, 60);
    spawnProjectile(state, {
      team: 'enemy',
      ownerId: archer.id,
      x: 118,
      y: 60,
      dirX: -1,
      dirY: 0,
      def: { kind: 'ember_arrow', speed: 45, radius: 0.6, life: 1, pierce: 0 },
      damage: makePacket(10, { fire: 1 }, 0, 1.5),
      knockback: 0,
    });
    const ev = ticks(state, 60);
    expect(blocker.life).toBe(blocker.maxLife);
    const hits = ofType(ev, 'hit');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.target).toBe('player');
    expect(hits[0]!.amount).toBe(10);
    expect(state.player.ailments.ignite.timeLeft).toBeGreaterThan(0);
  });
});
