import { describe, expect, it } from 'vitest';
import { aggro, isWet } from '../../../src/sim';
import { arena, groundAt, MAT, ofType, paintRect, run, spawn } from './helpers';

/** CONTENT §5 Frost Wisp: floats over water and pits, frost bolt every 1.6 s, a 16-cell frost line every 6 s. */

describe('Frost Wisp', () => {
  it('floats over deep water and pits: no fall, no Wet, and crosses them toward the player', () => {
    const s = arena(140, 48);
    s.cheats.god = true;
    paintRect(s, 40, 4, 59, 91, 'deep_water');
    paintRect(s, 60, 4, 79, 91, 'pit');
    const w = spawn(s, 'frost_wisp', 50, 48);
    aggro(s, w);
    const ev = run(s, 240);
    expect(ofType(ev, 'fell')).toHaveLength(0);
    expect(isWet(w)).toBe(false);
    // Kites at 12–20 cells: it crossed the pit band to get there.
    expect(w.x).toBeGreaterThan(100);
  });

  it('fires a frost bolt that chills the player', () => {
    const s = arena(70, 48);
    const w = spawn(s, 'frost_wisp', 50, 48);
    aggro(s, w);
    w.ai.cooldown = 0;
    w.ai.cooldowns[0] = 99;
    const ev = run(s, 60);
    expect(ofType(ev, 'telegraph').filter((t) => t.attack === 'frost_bolt').length).toBeGreaterThan(0);
    expect(ofType(ev, 'projectileSpawn').some((p) => p.kind === 'frost_mote')).toBe(true);
    const chill = ofType(ev, 'ailmentApplied').filter((a) => a.target === 'player' && a.ailment === 'chill');
    expect(chill.length).toBeGreaterThan(0);
  });

  it('every 6 s draws a 16-cell frost line that freezes water through the grid', () => {
    const s = arena(70, 48);
    s.cheats.god = true;
    paintRect(s, 40, 40, 80, 56, 'shallow_water');
    const w = spawn(s, 'frost_wisp', 54, 48);
    aggro(s, w);
    w.ai.cooldown = 99;
    w.ai.cooldowns[0] = 0;
    const ev = run(s, 60);
    const tel = ofType(ev, 'telegraph').filter((t) => t.attack === 'frost_line');
    expect(tel).toHaveLength(1);
    expect(ofType(ev, 'attack').filter((a) => a.attack === 'frost_line')).toHaveLength(1);
    expect(ofType(ev, 'iceFormed').length).toBeGreaterThan(0);
    // Ice along the line toward the player, but not beside it.
    expect(groundAt(s, 60, 48)).toBe(MAT.ice);
    expect(groundAt(s, 68, 48)).toBe(MAT.ice);
    expect(groundAt(s, 60, 55)).toBe(MAT.shallow_water);
    // The next one waits its 6 s.
    expect(w.ai.cooldowns[0]).toBeGreaterThan(4.5);
    const later = run(s, 4 * 60);
    expect(ofType(later, 'telegraph').filter((t) => t.attack === 'frost_line')).toHaveLength(0);
  });
});
