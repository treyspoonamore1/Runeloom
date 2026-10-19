import { describe, expect, it } from 'vitest';
import { aggro, strikePoint } from '../../../src/sim';
import { arena, groundAt, isWaterCode, MAT, ofType, paintRect, run, spawn } from './helpers';

/** CONTENT §5 Stormcaller: keeps 15–25 cells away; its 1.0 s strike prefers water or metal within 8 cells of the player. */

describe('Stormcaller', () => {
  it('keeps 15–25 cells from the player', () => {
    const s = arena(80, 48, 1, 50, 28);
    s.cheats.god = true;
    const c = spawn(s, 'stormcaller', 74, 48);
    aggro(s, c);
    run(s, 240);
    const d = Math.hypot(c.x - s.player.x, c.y - s.player.y);
    expect(d).toBeGreaterThanOrEqual(14);
    expect(d).toBeLessThanOrEqual(26);
  });

  it('strikes water within 8 cells of the player, electrifying it, after a 1.0 s circle telegraph', () => {
    const s = arena(70, 48, 1, 50, 28);
    paintRect(s, 74, 30, 79, 70, 'shallow_water');
    const c = spawn(s, 'stormcaller', 50, 48);
    aggro(s, c);
    c.ai.cooldown = 0;
    const ev = run(s, 2);
    const tel = ofType(ev, 'telegraph').filter((t) => t.id === c.id);
    expect(tel).toMatchObject([{ attack: 'lightning_strike', windup: 1 }]);
    // The nearest water cells to the player at (70, 48) are (74.5, 47.5) and (74.5, 48.5): row-major tie.
    expect(c.attack.originX).toBe(74.5);
    expect(c.attack.originY).toBe(47.5);
    expect(isWaterCode(groundAt(s, c.attack.originX, c.attack.originY))).toBe(true);
    const after = run(s, 70);
    expect(ofType(after, 'waterElectrified').filter((w) => w.sourceId === c.id)).toHaveLength(1);
    // The player stood outside the strike's 3-cell circle and out of the water: unhurt.
    expect(ofType(after, 'hit').filter((h) => h.target === 'player')).toHaveLength(0);
  });

  it('strikes the player directly when no water or metal is near, or when they stand in it, hitting once', () => {
    const s = arena(70, 48, 1, 50, 28);
    expect(strikePoint(s, spawn(s, 'stormcaller', 50, 48))).toEqual({ x: 70, y: 48 });
    const w = arena(70, 48, 1, 50, 28);
    w.cheats.noAI = false;
    paintRect(w, 60, 30, 80, 70, 'shallow_water');
    const c = spawn(w, 'stormcaller', 50, 48);
    aggro(w, c);
    c.ai.cooldown = 0;
    run(w, 2);
    expect([c.attack.originX, c.attack.originY]).toEqual([70, 48]);
    const ev = run(w, 70);
    const hits = ofType(ev, 'hit').filter((h) => h.target === 'player');
    // The strike, not the strike plus its own charge.
    expect(hits).toHaveLength(1);
    expect(hits[0]!.damageType).toBe('storm');
  });

  it('prefers metal too', () => {
    const s = arena(70, 48, 1, 50, 28);
    paintRect(s, 64, 40, 66, 42, 'metal_floor');
    expect(groundAt(s, 65, 41)).toBe(MAT.metal_floor);
    const p = strikePoint(s, spawn(s, 'stormcaller', 30, 48));
    expect(p).toEqual({ x: 66.5, y: 42.5 });
  });
});
