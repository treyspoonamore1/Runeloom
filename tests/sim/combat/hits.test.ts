import { describe, expect, it } from 'vitest';
import { addKnockback, applyHit, Button, makePacket, startEnemyAttack, step } from '../../../src/sim';
import { gameFromRows, OVERLAP_TOLERANCE, penetration } from '../actors/helpers';
import { addEnemy, arena, BOLT, ofType, place, tick, ticks } from './helpers';

describe('i-frames', () => {
  it('prevent damage and knockback from an enemy attack and report evaded', () => {
    const state = arena();
    const sb = addEnemy(state, 'shieldbearer', 84, 60, [-1, 0]);
    startEnemyAttack(state, sb, -1, 0);
    state.player.iframesLeft = 10;
    const ev = ticks(state, 40);
    expect(ofType(ev, 'evaded')).toHaveLength(1);
    expect(ofType(ev, 'hit')).toHaveLength(0);
    expect(state.player.life).toBe(state.player.maxLife);
    expect(state.player.kbX).toBe(0);
    expect(state.player.x).toBe(80);
  });

  it('a dodge evades an attack that would have hit', () => {
    const state = arena();
    const sb = addEnemy(state, 'shieldbearer', 84, 60, [-1, 0]);
    startEnemyAttack(state, sb, -1, 0);
    // Windup is 0.5 s (30 ticks); dodge into the bash right before it lands.
    ticks(state, 27);
    const ev = [...tick(state, Button.Dodge, [100, 60]), ...ticks(state, 5)];
    expect(ofType(ev, 'evaded')).toHaveLength(1);
    expect(state.player.life).toBe(state.player.maxLife);
  });

  it('without i-frames the same attack hits and knocks back', () => {
    const state = arena();
    const sb = addEnemy(state, 'shieldbearer', 84, 60, [-1, 0]);
    startEnemyAttack(state, sb, -1, 0);
    const ev = ticks(state, 60);
    expect(ofType(ev, 'hit')).toHaveLength(1);
    expect(state.player.life).toBe(80 - 12);
    expect(80 - state.player.x).toBeGreaterThan(2.9);
  });
});

describe('player death and respawn', () => {
  it('dies at 0 life, ignores input, respawns after respawnDelay with full life and mana', () => {
    const state = arena();
    state.player.life = 5;
    state.player.mana = 3;
    applyHit(state, state.player, makePacket(10, { physical: 1 }, 0, 1.5), {
      sourceId: 1,
      dirX: 1,
      dirY: 0,
      knockback: 0,
    });
    expect(ofType(state.events, 'playerDeath')).toHaveLength(1);
    const p = state.player;
    expect(p.dead).toBe(true);
    expect(p.life).toBe(0);
    const delayTicks = Math.round(state.tuning.player.respawnDelay * 60);
    const events = ticks(state, delayTicks - 1, BOLT | Button.Dodge, undefined, [1, 0]);
    expect(p.dead).toBe(true);
    expect(p.x).toBe(80);
    expect(ofType(events, 'castStart')).toHaveLength(0);
    expect(ofType(events, 'dodge')).toHaveLength(0);
    const ev = tick(state);
    expect(ofType(ev, 'playerRespawn')).toHaveLength(1);
    expect(p.dead).toBe(false);
    expect([p.x, p.y]).toEqual([state.room.spawnX, state.room.spawnY]);
    expect(p.life).toBe(p.maxLife);
    expect(p.mana).toBe(p.maxMana);
    expect(p.maxLife).toBe(80);
    expect(p.maxMana).toBe(50);
  });

  it('hits on a dead player do nothing', () => {
    const state = arena();
    state.player.life = 1;
    const packet = makePacket(10, { physical: 1 }, 0, 1.5);
    const info = { sourceId: 1, dirX: 1, dirY: 0, knockback: 3 };
    applyHit(state, state.player, packet, info);
    expect(applyHit(state, state.player, packet, info)).toBeNull();
    expect(ofType(state.events, 'hit')).toHaveLength(1);
  });
});

describe('dummy', () => {
  it('never dies: resets to full life at 0 without a death event', () => {
    const state = arena();
    const d = addEnemy(state, 'dummy', 100, 60);
    d.life = 5;
    const packet = makePacket(12, { fire: 1 }, 0, 1.5);
    applyHit(state, d, packet, { sourceId: 0, dirX: 1, dirY: 0, knockback: 5 });
    expect(d.life).toBe(500);
    expect(d.dead).toBe(false);
    expect(ofType(state.events, 'death')).toHaveLength(0);
    expect(d.kbX).toBe(0);
    ticks(state, 10);
    expect(state.enemies).toContain(d);
    expect([d.x, d.y]).toEqual([100, 60]);
  });

  it('enemies die at 0 and are removed at the end of the step', () => {
    const state = arena();
    const e = addEnemy(state, 'tinderling', 100, 60);
    applyHit(state, e, makePacket(100, { physical: 1 }, 0, 1.5), {
      sourceId: 0,
      dirX: 1,
      dirY: 0,
      knockback: 0,
    });
    expect(e.dead).toBe(true);
    expect(ofType(state.events, 'death')).toEqual([
      {
        type: 'death',
        id: e.id,
        kind: 'tinderling',
        x: 100,
        y: 60,
        killerId: 0,
        cause: 'hit',
        shattered: false,
      },
    ]);
    tick(state);
    expect(state.enemies).not.toContain(e);
  });
});

describe('knockback', () => {
  it('travels about the given distance in the open', () => {
    const state = arena();
    const e = addEnemy(state, 'tinderling', 100, 60);
    addKnockback(e, 0, 1, 7, state.tuning.feel);
    ticks(state, 120);
    expect(e.y - 60).toBeGreaterThan(
      7 - state.tuning.feel.knockbackStopSpeed * state.tuning.feel.knockbackTime - 1e-9,
    );
    expect(e.y - 60).toBeLessThanOrEqual(7 + 1e-9);
    expect(e.kbX).toBe(0);
    expect(e.kbY).toBe(0);
  });

  it('never pushes a body through a wall, at any strength or angle', () => {
    const rows = ['##########', '#........#', '#....#...#', '#........#', '##########'];
    for (let i = 0; i < 24; i++) {
      const state = gameFromRows(rows);
      const e = addEnemy(state, 'tinderling', 17 + (i % 3) * 0.3, 10 + (i % 4) * 0.7);
      const len = Math.hypot(1, (i % 6) - 2.5);
      addKnockback(e, 1 / len, ((i % 6) - 2.5) / len, 60 + i * 10, state.tuning.feel);
      addKnockback(state.player, -1, 0, 200, state.tuning.feel);
      for (let t = 0; t < 120; t++) {
        step(state, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });
        expect(penetration(state.room, e.x, e.y, e.radius)).toBeLessThanOrEqual(OVERLAP_TOLERANCE);
        expect(penetration(state.room, state.player.x, state.player.y, 1.5)).toBeLessThanOrEqual(
          OVERLAP_TOLERANCE,
        );
      }
      // The pillar at tile (5, 2) spans cells 20..24 × 8..12; the enemy started west of it.
      if (e.y > 8 - e.radius && e.y < 12 + e.radius) expect(e.x).toBeLessThan(20);
    }
  });

  it('the player gets knocked back too, and walls stop it', () => {
    const state = arena();
    place(state, 6, 60);
    addKnockback(state.player, -1, 0, 10, state.tuning.feel);
    ticks(state, 60);
    expect(state.player.x).toBeCloseTo(4 + 1.5, 6);
  });
});
