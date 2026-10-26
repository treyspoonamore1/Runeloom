import { describe, expect, it } from 'vitest';
import { aggro, applyHit, fenTakenMult, makePacket, PLAYER_ID, type GameState } from '../../../src/sim';
import { OWNER } from '../../../data/materials';
import { WORLD_SOURCE_ID } from '../../../src/sim/grid/cells';
import { apply } from '../terrain/helpers';
import { arena, ofType, paintRect, run, spawn } from './helpers';

/**
 * CONTENT §5 Bellshell: Shelled (90% less damage). Charge of another team or the world through
 * the water or metal under it rings it: stunned 2.5 s, open 5 s (25% more damage taken), then it
 * can't ring for 6 s. Direct Storm hits don't ring it. Teaches conduction as a key.
 */

function ford(px = 140, py = 40): GameState {
  const s = arena(px, py, 1);
  paintRect(s, 20, 30, 59, 49, 'shallow_water');
  return s;
}

const storm = (
  s: GameState,
  x: number,
  y: number,
  owner: number = OWNER.player,
  sourceId: number = PLAYER_ID,
) => apply(s, 'storm', { kind: 'circle', x, y, r: 0.6 }, { owner, sourceId, hitDamage: 40 });

const physical = (s: GameState) => makePacket(100, { physical: 1 }, 0, s.tuning.combat.critMultiplier);

describe('Bellshell', () => {
  it('shelled, it takes 90% less damage', () => {
    const s = ford();
    const b = spawn(s, 'bellshell', 30, 40);
    expect(fenTakenMult(s, b)).toBeCloseTo(0.1);
    const life = b.life;
    applyHit(s, b, physical(s), { sourceId: PLAYER_ID, dirX: 0, dirY: 0, knockback: 0 });
    expect(life - b.life).toBeCloseTo(10);
  });

  it('rings open when the player electrifies the water it stands in: stunned 2.5 s, open 5 s, then 6 s before it rings again', () => {
    const s = ford();
    // Hurt, it would wander off to the player; keep it in its ford.
    s.cheats.noAI = true;
    const b = spawn(s, 'bellshell', 30, 40);
    run(s, 1);
    storm(s, 55, 40);
    const ev = run(s, 1);
    expect(ofType(ev, 'bellRung')).toMatchObject([{ id: b.id, stun: 2.5, open: 5 }]);
    expect(b.terrain.stunLeft).toBeGreaterThan(2.4);
    expect(fenTakenMult(s, b)).toBeCloseTo(1.25);
    const life = b.life;
    applyHit(s, b, physical(s), { sourceId: PLAYER_ID, dirX: 0, dirY: 0, knockback: 0 });
    // × the Shock the ringing charge left.
    expect(life - b.life).toBeCloseTo(125 * (1 + b.ailments.shock.effect));
    const closing = run(s, 300);
    expect(ofType(closing, 'bellClosed')).toMatchObject([{ id: b.id, cooldown: 6 }]);
    expect(fenTakenMult(s, b)).toBeCloseTo(0.1);
    // On cooldown: a second ring does nothing.
    storm(s, 55, 40);
    expect(ofType(run(s, 1), 'bellRung')).toHaveLength(0);
    run(s, 400);
    storm(s, 55, 40);
    expect(ofType(run(s, 1), 'bellRung')).toHaveLength(1);
  });

  it('the charge that rings it hits the opened shell', () => {
    const s = ford();
    const b = spawn(s, 'bellshell', 30, 40);
    run(s, 1);
    storm(s, 31, 40);
    const ev = run(s, 1);
    const hit = ofType(ev, 'hit').find((h) => h.target === b.id)!;
    // Storm 40 × falloff ~1 × (1 − 50% resist) × 1.25 open.
    expect(hit.amount).toBeGreaterThan(20);
  });

  it('direct Storm hits do not ring it', () => {
    const s = ford();
    const b = spawn(s, 'bellshell', 30, 40);
    applyHit(s, b, makePacket(100, { storm: 1 }, 0, 1.5), {
      sourceId: PLAYER_ID,
      dirX: 0,
      dirY: 0,
      knockback: 0,
    });
    expect(b.special.openLeft).toBe(0);
  });

  it('enemy charge never rings it; world charge (pylons) does', () => {
    const s = ford();
    s.cheats.noAI = true;
    const b = spawn(s, 'bellshell', 30, 40);
    const heron = spawn(s, 'spark_heron', 120, 80);
    run(s, 1);
    storm(s, 55, 40, OWNER.enemy, heron.id);
    expect(ofType(run(s, 1), 'bellRung')).toHaveLength(0);
    expect(b.special.openLeft).toBe(0);
    run(s, 70);
    storm(s, 55, 40, OWNER.world, WORLD_SOURCE_ID);
    expect(ofType(run(s, 1), 'bellRung')).toHaveLength(1);
  });

  it('opens to bite for 16 after 0.7 s', () => {
    const s = arena(52, 40);
    s.cheats.god = true;
    const b = spawn(s, 'bellshell', 47, 40);
    aggro(s, b);
    b.ai.cooldown = 0;
    expect(ofType(run(s, 2), 'telegraph')).toMatchObject([{ id: b.id, attack: 'bell_bite', windup: 0.7 }]);
    const hits = ofType(run(s, 50), 'hit').filter((h) => h.target === 'player');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.amount).toBeCloseTo(16);
  });
});
