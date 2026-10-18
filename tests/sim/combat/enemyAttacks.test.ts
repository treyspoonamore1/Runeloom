import { describe, expect, it } from 'vitest';
import { circleHitsShape, DT, pointInAttackShape, startEnemyAttack } from '../../../src/sim';
import { enemies } from '../../../data/enemies';
import { addEnemy, arena, ofType, tick, ticks } from './helpers';

describe('enemy attacks', () => {
  it('telegraph → windup → active (hits once) → recover → none', () => {
    const state = arena();
    const t = addEnemy(state, 'tinderling', 83, 60, [-1, 0]);
    expect(startEnemyAttack(state, t, -1, 0)).toBe(true);
    expect(ofType(state.events, 'telegraph')).toEqual([
      { type: 'telegraph', id: t.id, attack: 'nip', windup: 0.3 },
    ]);
    // Can't start another while one runs.
    expect(startEnemyAttack(state, t, -1, 0)).toBe(false);
    const def = enemies.tinderling.attack;
    const windupTicks = Math.ceil(def.windup / DT - 1e-9);
    const phases: string[] = [];
    let hitTick = -1;
    for (let i = 1; i <= 60; i++) {
      const ev = tick(state);
      phases.push(t.attack.phase);
      if (ofType(ev, 'hit').length) {
        expect(hitTick).toBe(-1);
        hitTick = i;
        expect(ofType(ev, 'attack')).toHaveLength(1);
      }
    }
    expect(hitTick).toBe(windupTicks);
    expect(phases[windupTicks - 2]).toBe('windup');
    expect(phases[windupTicks - 1]).toBe('active');
    expect(phases.at(-1)).toBe('none');
    expect(phases.filter((p) => p === 'recover').length).toBeGreaterThan(0);
    expect(state.player.life).toBe(80 - 4);
  });

  it('misses when the player is outside the shape, and the telegraph is the hit shape', () => {
    const state = arena();
    const sb = addEnemy(state, 'shieldbearer', 85, 60, [-1, 0]);
    // Bash straight up while the player is west: the 90° cone faces away.
    startEnemyAttack(state, sb, 0, -1);
    const a = sb.attack;
    const p = state.player;
    expect(circleHitsShape(a.shape, a.originX, a.originY, p.x, p.y, 1.5)).toBe(false);
    // Windup + active + recover = 1.2 s.
    expect(ofType(ticks(state, 75), 'hit')).toHaveLength(0);

    expect(startEnemyAttack(state, sb, -1, 0)).toBe(true);
    expect(pointInAttackShape(sb.attack.shape, sb.attack.originX, sb.attack.originY, 84, 60)).toBe(true);
    expect(ofType(ticks(state, 60), 'hit')).toHaveLength(1);
  });

  it('locks shape and origin at windup start', () => {
    const state = arena();
    const sb = addEnemy(state, 'shieldbearer', 88, 60, [-1, 0]);
    startEnemyAttack(state, sb, -1, 0);
    const { originX, originY } = sb.attack;
    sb.kbX = 30;
    ticks(state, 10);
    expect(sb.x).toBeGreaterThan(88);
    expect([sb.attack.originX, sb.attack.originY]).toEqual([originX, originY]);
  });

  it('Ember Archer fires an arrow along its aim line that hits the player', () => {
    const state = arena();
    const ar = addEnemy(state, 'ember_archer', 105, 60, [-1, 0]);
    startEnemyAttack(state, ar, -1, 0);
    expect(ar.attack.shape.kind).toBe('line');
    const ev = ticks(state, 60);
    const spawn = ofType(ev, 'projectileSpawn')[0]!;
    expect(spawn.team).toBe('enemy');
    expect(spawn.ownerId).toBe(ar.id);
    expect(spawn.vx).toBeCloseTo(-45, 9);
    const hit = ofType(ev, 'hit')[0]!;
    expect(hit.target).toBe('player');
    expect(hit.damageType).toBe('fire');
    expect(hit.amount).toBe(10);
    // The fire arrow also ignites the player: 50% of 10 per second, burning since the hit.
    expect(state.player.ailments.ignite.dps).toBe(5);
    const burnt = ofType(ev, 'dot').reduce((s, d) => s + d.amount, 0) + state.player.ailments.dotPending;
    expect(state.player.life).toBeCloseTo(70 - burnt, 9);
  });

  it('dummies have no attack', () => {
    const state = arena();
    const d = addEnemy(state, 'dummy', 84, 60);
    expect(startEnemyAttack(state, d, -1, 0)).toBe(false);
  });

  it('telegraphs of attacks dealing ≥ 15% of player life last ≥ 0.4 s (DESIGN §14)', () => {
    for (const def of Object.values(enemies)) {
      if (def.attack && def.attack.damage >= 0.15 * 80) expect(def.attack.windup).toBeGreaterThanOrEqual(0.4);
    }
  });
});
