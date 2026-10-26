import { describe, expect, it } from 'vitest';
import { aggro, enemyAttackPacket, freezeTarget, PLAYER_ID, type GameState } from '../../../src/sim';
import { OWNER } from '../../../data/materials';
import { attackByName } from '../../../data/enemies';
import { apply } from '../terrain/helpers';
import { arena, ofType, paintRect, run, spawn } from './helpers';

/**
 * CONTENT §5 Copperback: pinch 12 after a 0.5 s claw raise; charge of any team reaching it makes
 * it Charged for 3 s: its pinch adds 12 Storm and once a second it re-electrifies the water or
 * metal under it as enemy charge. Freezing ends it. Teaches: charge walks.
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

describe('Copperback', () => {
  it('pinches for 12 after a 0.5 s claw raise', () => {
    const s = arena(52, 40);
    s.cheats.god = true;
    const c = spawn(s, 'copperback', 48, 40);
    aggro(s, c);
    c.ai.cooldown = 0;
    const ev = run(s, 2);
    expect(ofType(ev, 'telegraph')).toMatchObject([{ id: c.id, attack: 'copper_pinch', windup: 0.5 }]);
    const hits = ofType(run(s, 40), 'hit').filter((h) => h.target === 'player');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.amount).toBeCloseTo(12);
  });

  it('player charge in its water makes it Charged for 3 s; its pinch adds 12 Storm', () => {
    const s = ford();
    const c = spawn(s, 'copperback', 30, 40);
    run(s, 1);
    storm(s, 50, 40);
    const ev = run(s, 1);
    expect(ofType(ev, 'copperCharged')).toMatchObject([{ id: c.id, charged: true, seconds: 3 }]);
    expect(c.special.chargedLeft).toBeGreaterThan(2.9);
    const pinch = attackByName('copperback', 'copper_pinch')!;
    const p = enemyAttackPacket(s, c, pinch);
    expect(p.base.physical).toBeCloseTo(12);
    expect(p.base.storm).toBeCloseTo(12);
    // It ends 3 s later.
    const later = run(s, 185);
    expect(ofType(later, 'copperCharged')).toMatchObject([{ id: c.id, charged: false }]);
    expect(enemyAttackPacket(s, c, pinch).base.storm).toBe(0);
  });

  it('charge walks: Charged, it re-electrifies the water under it as enemy charge once a second, hurting the player there', () => {
    const s = ford(50, 40);
    const c = spawn(s, 'copperback', 30, 40);
    run(s, 1);
    storm(s, 22, 40);
    // Charged for 3 s: pulses at 1 s and 2 s (the player's own charge never hurts the player).
    const ev = run(s, 190);
    const pulses = ofType(ev, 'copperPulse').filter((p) => p.id === c.id);
    expect(pulses.length).toBe(2);
    const enemyWater = ofType(ev, 'waterElectrified').filter((w) => w.sourceId === c.id);
    expect(enemyWater.length).toBe(2);
    expect(enemyWater[0]!.owner).toBe(OWNER.enemy);
    const hurt = ofType(ev, 'hit').filter((h) => h.target === 'player' && h.sourceId === c.id);
    expect(hurt.length).toBeGreaterThan(0);
    expect(hurt[0]!.damageType).toBe('storm');
  });

  it('enemy charge charges it too, but its own pulses never keep it (or a neighbour) charged', () => {
    const s = ford();
    const a = spawn(s, 'copperback', 30, 40);
    const b = spawn(s, 'copperback', 40, 40);
    run(s, 1);
    // A Spark Heron-style enemy strike from some other enemy.
    const heron = spawn(s, 'spark_heron', 100, 80);
    storm(s, 50, 40, OWNER.enemy, heron.id);
    run(s, 1);
    expect(a.special.chargedLeft).toBeGreaterThan(0);
    expect(b.special.chargedLeft).toBeGreaterThan(0);
    run(s, 200);
    expect(a.special.chargedLeft).toBe(0);
    expect(b.special.chargedLeft).toBe(0);
  });

  it('freezing it ends the charge', () => {
    const s = ford();
    const c = spawn(s, 'copperback', 30, 40);
    run(s, 1);
    storm(s, 50, 40);
    run(s, 1);
    expect(c.special.chargedLeft).toBeGreaterThan(0);
    freezeTarget(s, c, 1, PLAYER_ID);
    const ev = run(s, 1);
    expect(ofType(ev, 'copperCharged')).toMatchObject([{ id: c.id, charged: false }]);
  });

  it('conducts on metal too (rule 12)', () => {
    const s = arena(140, 40);
    paintRect(s, 20, 30, 59, 49, 'metal_floor');
    const c = spawn(s, 'copperback', 30, 40);
    run(s, 1);
    storm(s, 50, 40);
    run(s, 1);
    expect(c.special.chargedLeft).toBeGreaterThan(0);
    const ev = run(s, 70);
    expect(ofType(ev, 'metalElectrified').filter((m) => m.sourceId === c.id).length).toBeGreaterThan(0);
  });
});
