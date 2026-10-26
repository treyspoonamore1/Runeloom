import { describe, expect, it } from 'vitest';
import { aggro, applyHit, makePacket, PLAYER_ID, type Enemy, type GameState } from '../../../src/sim';
import { OWNER } from '../../../data/materials';
import { arena, ofType, paintRect, run, spawn } from './helpers';

/**
 * CONTENT §5 Bellows Toad: keeps 10–16 cells away; inflates 1.0 s with a 14-cell 60° cone, then
 * croaks for 10 and knockback 6: a 2 s enemy gust over the cone (rule 21). Fire hitting it while
 * inflated lights its marsh gas: a 4-cell world-owned fire puff for 20 that hurts everyone; the
 * toad loses 15% of its max life and is stunned 1.5 s. Wet, its gas won't light.
 */

function inflating(s: GameState, t: Enemy): void {
  aggro(s, t);
  t.ai.cooldown = 0;
  run(s, 2);
}

const fireHit = (s: GameState, t: Enemy) =>
  applyHit(s, t, makePacket(5, { fire: 1 }, 0, 1.5), { sourceId: PLAYER_ID, dirX: 0, dirY: 0, knockback: 0 });

describe('Bellows Toad', () => {
  it('keeps 10–16 cells away', () => {
    const s = arena(80, 48, 1, 50, 28);
    s.cheats.god = true;
    const t = spawn(s, 'bellows_toad', 75, 48);
    aggro(s, t);
    run(s, 240);
    const d = Math.hypot(t.x - s.player.x, t.y - s.player.y);
    expect(d).toBeGreaterThanOrEqual(9);
    expect(d).toBeLessThanOrEqual(17);
  });

  it('inflates for 1.0 s under a 14-cell 60° cone, then croaks: 10 damage, knockback 6, a 2 s enemy gust', () => {
    const s = arena(62, 40);
    s.cheats.god = true;
    const t = spawn(s, 'bellows_toad', 50, 40);
    aggro(s, t);
    t.ai.cooldown = 0;
    const tel = ofType(run(s, 2), 'telegraph').filter((x) => x.id === t.id);
    expect(tel).toMatchObject([{ attack: 'croak', windup: 1 }]);
    expect(t.attack.shape).toMatchObject({ kind: 'cone', r: 14 });
    const ev = run(s, 62);
    expect(ofType(ev, 'toadCroak')).toMatchObject([{ id: t.id, radius: 14, angleDeg: 60, seconds: 2 }]);
    const hits = ofType(ev, 'hit').filter((h) => h.target === 'player' && h.sourceId === t.id);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.amount).toBeCloseTo(10);
    expect(Math.hypot(hits[0]!.kbX, hits[0]!.kbY)).toBeGreaterThan(0);
  });

  it('Fire while it inflates lights its gas: a world-owned puff for 20 that hurts everyone, 15% of its life, stunned 1.5 s', () => {
    const s = arena(60, 40);
    s.cheats.god = true;
    const t = spawn(s, 'bellows_toad', 50, 40);
    const near = spawn(s, 'copperback', 52, 43);
    inflating(s, t);
    expect(t.attack.phase).toBe('windup');
    const life = t.life;
    // The player steps in close.
    s.player.x = 53;
    s.events.length = 0;
    fireHit(s, t);
    const ev = s.events;
    expect(ofType(ev, 'toadGasLit')).toMatchObject([{ id: t.id, radius: 4, damage: 20, stun: 1.5 }]);
    expect(ofType(ev, 'explosion')).toMatchObject([{ owner: OWNER.world, radius: 4 }]);
    // The puff hurts its packmate and the player too.
    expect(ofType(ev, 'hit').some((h) => h.target === near.id)).toBe(true);
    expect(ofType(ev, 'hit').some((h) => h.target === 'player')).toBe(true);
    // 5 Fire × (1 + 25% weakness), then 15% of its max life.
    expect(life - t.life).toBeCloseTo(5 * 1.25 + t.maxLife * 0.15, 1);
    expect(t.terrain.stunLeft).toBe(1.5);
    expect(t.attack.phase).toBe('none');
    // The croak is lost.
    expect(ofType(run(s, 60), 'toadCroak')).toHaveLength(0);
  });

  it('Wet, its gas will not light', () => {
    const s = arena(60, 40);
    paintRect(s, 40, 30, 59, 49, 'shallow_water');
    const t = spawn(s, 'bellows_toad', 50, 40);
    inflating(s, t);
    expect(t.terrain.wetLeft).toBeGreaterThan(0);
    s.events.length = 0;
    fireHit(s, t);
    expect(ofType(s.events, 'toadGasLit')).toHaveLength(0);
  });

  it('Fire when it is not inflating does nothing special', () => {
    const s = arena(140, 40);
    const t = spawn(s, 'bellows_toad', 50, 40);
    s.events.length = 0;
    fireHit(s, t);
    expect(ofType(s.events, 'toadGasLit')).toHaveLength(0);
  });
});
