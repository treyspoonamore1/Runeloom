import { describe, expect, it } from 'vitest';
import { aggro, fenTakenMult, planCharge, type Enemy, type GameState } from '../../../src/sim';
import { attackByName, enemyDef } from '../../../data/enemies';
import { arena, ofType, paintRect, run, spawn } from './helpers';

/**
 * CONTENT §5 Mirebull: charges a player 10–36 cells away (0.9 s line telegraph, up to 36 cells,
 * 22 on contact, knockback 5); gores for 14 after 0.5 s up close. A wall stuns it 1.5 s; mud
 * ends the charge: bogged 2.5 s, 50% more damage taken. On ice the charge runs 50% farther.
 */

function startCharge(s: GameState, b: Enemy): void {
  aggro(s, b);
  b.ai.cooldown = 5;
  b.ai.cooldowns[0] = 0;
}

const behavior = () => {
  const b = enemyDef('mire_bull').behavior;
  if (b.kind !== 'charger') throw new Error('not a charger');
  return b;
};

describe('Mirebull', () => {
  it('charges a player 10–36 cells away: 0.9 s line telegraph over the run, 22 on contact, knockback 5', () => {
    const s = arena(70, 40);
    s.cheats.god = true;
    const b = spawn(s, 'mire_bull', 50, 40);
    startCharge(s, b);
    const tel = ofType(run(s, 2), 'telegraph').filter((t) => t.id === b.id);
    expect(tel).toMatchObject([{ attack: 'bull_charge', windup: 0.9 }]);
    expect(b.attack.shape.kind).toBe('line');
    // 20 cells to the player plus 6 past: 26 cells of run (and the body's front edge).
    if (b.attack.shape.kind === 'line') expect(b.attack.shape.length).toBeCloseTo(26 + b.radius, 0);
    const ev = run(s, 90);
    const hits = ofType(ev, 'hit').filter((h) => h.target === 'player' && h.sourceId === b.id);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.amount).toBeCloseTo(22);
    expect(Math.hypot(hits[0]!.kbX, hits[0]!.kbY)).toBeGreaterThan(0);
    expect(b.x).toBeGreaterThan(72);
  });

  it('does not charge a player closer than 10 cells; it gores up close for 14 after 0.5 s', () => {
    const s = arena(55, 40);
    s.cheats.god = true;
    const b = spawn(s, 'mire_bull', 50, 40);
    aggro(s, b);
    b.ai.cooldown = 0;
    b.ai.cooldowns[0] = 0;
    const tel = ofType(run(s, 2), 'telegraph').filter((t) => t.id === b.id);
    expect(tel).toMatchObject([{ attack: 'bull_gore', windup: 0.5 }]);
    const hits = ofType(run(s, 40), 'hit').filter((h) => h.target === 'player');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.amount).toBeCloseTo(14);
  });

  it('charging into a wall stuns it for 1.5 s', () => {
    // The player stands by the east wall (interior ends at x 156).
    const s = arena(150, 40);
    s.cheats.god = true;
    const b = spawn(s, 'mire_bull', 125, 40);
    startCharge(s, b);
    run(s, 2);
    expect(b.special.chargeWall).toBe(true);
    const ev = run(s, 100);
    expect(ofType(ev, 'bullStunned')).toMatchObject([{ id: b.id, seconds: 1.5 }]);
    expect(b.terrain.stunLeft).toBeGreaterThan(0);
  });

  it('entering mud ends its charge: bogged 2.5 s, taking 50% more damage', () => {
    const s = arena(80, 40);
    s.cheats.god = true;
    paintRect(s, 60, 30, 64, 50, 'mud');
    const b = spawn(s, 'mire_bull', 50, 40);
    startCharge(s, b);
    run(s, 2);
    const ev = run(s, 90);
    expect(ofType(ev, 'bullBogged')).toMatchObject([{ id: b.id, seconds: 2.5 }]);
    expect(b.x).toBeGreaterThan(59);
    expect(b.x).toBeLessThan(62);
    expect(b.special.boggedLeft).toBeGreaterThan(0);
    expect(fenTakenMult(s, b)).toBeCloseTo(1.5);
    // The player beyond the mud wasn't reached.
    expect(ofType(ev, 'hit').filter((h) => h.target === 'player')).toHaveLength(0);
    run(s, 160);
    expect(b.special.boggedLeft).toBe(0);
    expect(fenTakenMult(s, b)).toBe(1);
  });

  it('on ice its charge runs 50% farther', () => {
    const s = arena(100, 40);
    const b = spawn(s, 'mire_bull', 30, 40);
    const dash = attackByName('mire_bull', 'bull_charge')!.dash!;
    const dry = planCharge(s, b, dash, behavior(), 1, 0, 100).length;
    expect(dry).toBe(36);
    paintRect(s, 20, 30, 120, 50, 'ice');
    const iced = planCharge(s, b, dash, behavior(), 1, 0, 100).length;
    expect(iced).toBe(54);
  });
});
