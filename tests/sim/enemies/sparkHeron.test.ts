import { describe, expect, it } from 'vitest';
import { aggro, stepGrid } from '../../../src/sim';
import { arena, groundAt, isWaterCode, MAT, ofType, paintRect, run, spawn } from './helpers';

/**
 * CONTENT §5 Spark Heron: kites at 18–28 cells. Lightning beak for 18 Storm after 1.0 s on the
 * water nearest the player within 10 cells. Every 5 s a lobbed puddle spit for 6 at a dry player
 * (0.8 s landing marker) leaves water of radius 3 for 6 s, to be struck through. Wades.
 */

describe('Spark Heron', () => {
  it('kites at 18–28 cells', () => {
    const s = arena(80, 48, 1, 50, 28);
    s.cheats.god = true;
    const h = spawn(s, 'spark_heron', 74, 48);
    aggro(s, h);
    run(s, 300);
    const d = Math.hypot(h.x - s.player.x, h.y - s.player.y);
    expect(d).toBeGreaterThanOrEqual(17);
    expect(d).toBeLessThanOrEqual(29);
  });

  it('strikes the water nearest the player within 10 cells with a 1.0 s beak glow, electrifying it', () => {
    const s = arena(70, 48, 1, 50, 28);
    paintRect(s, 78, 30, 85, 70, 'shallow_water');
    const h = spawn(s, 'spark_heron', 46, 48);
    aggro(s, h);
    h.ai.cooldown = 0;
    // The spit waits: the player stands in no water, but its timer isn't up.
    h.ai.cooldowns[0] = 10;
    const tel = ofType(run(s, 2), 'telegraph').filter((t) => t.id === h.id);
    expect(tel).toMatchObject([{ attack: 'heron_beak', windup: 1 }]);
    expect(h.attack.originX).toBe(78.5);
    const ev = run(s, 70);
    expect(ofType(ev, 'waterElectrified').filter((w) => w.sourceId === h.id)).toHaveLength(1);
  });

  it('spits a puddle under a dry player: 0.8 s marker, 6 damage, water of radius 3 that dries in 6 s', () => {
    const s = arena(70, 48, 1, 50, 28);
    s.cheats.god = true;
    const h = spawn(s, 'spark_heron', 46, 48);
    aggro(s, h);
    h.ai.cooldown = 10;
    h.ai.cooldowns[0] = 0;
    const tel = ofType(run(s, 2), 'telegraph').filter((t) => t.id === h.id);
    expect(tel).toMatchObject([{ attack: 'puddle_spit', windup: 0.8 }]);
    expect([h.attack.originX, h.attack.originY]).toEqual([70, 48]);
    const ev = run(s, 50);
    expect(ofType(ev, 'heronPuddle')).toMatchObject([{ id: h.id, x: 70, y: 48, radius: 3, seconds: 6 }]);
    const hit = ofType(ev, 'hit').filter((x) => x.target === 'player' && x.sourceId === h.id);
    expect(hit).toHaveLength(1);
    expect(hit[0]!.amount).toBeCloseTo(6);
    expect(isWaterCode(groundAt(s, 70, 48))).toBe(true);
    expect(isWaterCode(groundAt(s, 72, 48))).toBe(true);
    // Six seconds later it is stone again.
    s.cheats.noAI = true;
    for (let k = 0; k < 6.2 * 20; k++) stepGrid(s);
    expect(groundAt(s, 70, 48)).toBe(MAT.stone);
  });

  it('does not spit at a player already standing in water', () => {
    const s = arena(70, 48, 1, 50, 28);
    paintRect(s, 66, 44, 74, 52, 'shallow_water');
    const h = spawn(s, 'spark_heron', 46, 48);
    aggro(s, h);
    h.ai.cooldown = 10;
    h.ai.cooldowns[0] = 0;
    const tel = ofType(run(s, 30), 'telegraph').filter((t) => t.id === h.id && t.attack === 'puddle_spit');
    expect(tel).toHaveLength(0);
  });

  it('wades: shallow water does not slow it', () => {
    const s = arena(140, 48, 1, 50, 28);
    s.cheats.noAI = true;
    paintRect(s, 30, 30, 60, 60, 'shallow_water');
    const h = spawn(s, 'spark_heron', 45, 45);
    const b = spawn(s, 'bellshell', 40, 50);
    run(s, 1);
    expect(h.terrain.moveMult).toBe(1);
    expect(b.terrain.moveMult).toBeCloseTo(0.8);
  });
});
