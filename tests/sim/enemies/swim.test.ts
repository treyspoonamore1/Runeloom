import { describe, expect, it } from 'vitest';
import {
  aggro,
  createBossState,
  fenTakenMult,
  isStranded,
  setGround,
  type GameState,
} from '../../../src/sim';
import { placeTempWater } from '../../../src/sim/grid/tempWater';
import { hydromancerGrounds } from '../../../data/passives';
import { arena, groundAt, idx, isWaterCode, MAT, ofType, paintRect, run, spawn } from './helpers';

/**
 * Swimmers (M8): routes through the water (actors/swim.ts) and rule 31, Stranded
 * (actors/strand.ts): DESIGN §6.3 rule 31, §6.4 Stranded, §6.5 "Entities on it".
 */

/** A shallow pool x 20–39, y 30–49 in an open stone room; the player far east. */
function pool(px = 140, py = 40): GameState {
  const s = arena(px, py, 1);
  paintRect(s, 20, 30, 39, 49, 'shallow_water');
  return s;
}

describe('rule 31: Stranded', () => {
  it('rule 31: a swimmer whose cell stops being water strands: helpless, 50% more damage taken', () => {
    const s = pool();
    const l = spawn(s, 'bog_lurker', 37.5, 40.5);
    aggro(s, l);
    run(s, 2);
    expect(isStranded(l)).toBe(false);
    // The water it is in goes away (as borrowed water returns, rule 27).
    paintRect(s, 34, 30, 39, 49, 'stone');
    const ev = run(s, 1);
    expect(ofType(ev, 'swimmerStranded')).toMatchObject([{ id: l.id, stranded: true }]);
    expect(isStranded(l)).toBe(true);
    expect(l.ai.mode).not.toBe('windup');
    expect(fenTakenMult(s, l)).toBeCloseTo(s.tuning.swim.strandedTaken);
    expect(s.tuning.swim.strandedTaken).toBe(1.5);
  });

  it('rule 31: it lies still for 2 s, then crawls at 4 cells/s to the nearest water and ends Stranded there', () => {
    const s = pool();
    const l = spawn(s, 'bog_lurker', 37.5, 40.5);
    aggro(s, l);
    run(s, 1);
    paintRect(s, 30, 30, 39, 49, 'stone');
    run(s, 1);
    const x0 = l.x;
    run(s, 110);
    // Helpless for the crawl delay.
    expect(l.x).toBe(x0);
    expect(isStranded(l)).toBe(true);
    run(s, 15);
    const xa = l.x;
    run(s, 30);
    // 0.5 s of crawling west toward the pool's edge at x 30.
    expect(xa - l.x).toBeGreaterThan(1.8);
    expect(xa - l.x).toBeLessThanOrEqual(2.05);
    const ev = run(s, 120);
    expect(ofType(ev, 'swimmerStranded')).toMatchObject([{ id: l.id, stranded: false }]);
    expect(isStranded(l)).toBe(false);
    expect(isWaterCode(groundAt(s, l.x, l.y))).toBe(true);
  });

  it('rule 31: a Stranded swimmer cannot attack, even with the player beside it', () => {
    const s = pool(52, 40);
    s.cheats.god = true;
    const l = spawn(s, 'bog_lurker', 38.5, 40.5);
    aggro(s, l);
    paintRect(s, 20, 30, 39, 49, 'stone');
    run(s, 1);
    s.player.x = l.x + 3;
    s.player.y = l.y;
    l.ai.cooldown = 0;
    const ev = run(s, 60);
    expect(ofType(ev, 'telegraph').filter((t) => t.id === l.id)).toHaveLength(0);
    expect(l.ai.mode).toBe('stranded');
  });

  it('rule 31: with no water within 16 cells it dries out, losing 5% of max life per second', () => {
    const s = pool();
    const l = spawn(s, 'bog_lurker', 30.5, 40.5);
    aggro(s, l);
    run(s, 1);
    paintRect(s, 20, 30, 39, 49, 'stone');
    run(s, 1);
    const life = l.life;
    const ev = run(s, 120 + 6);
    expect(ofType(ev, 'swimmerDrying')).toMatchObject([{ id: l.id, drying: true }]);
    run(s, 60);
    // One second of drying after the 2 s delay.
    expect(life - l.life).toBeCloseTo((l.maxLife * 0.05 * (60 + 6 - 1)) / 60, 1);
  });

  it('rule 31: bosses never dry out', () => {
    const s = pool();
    const l = spawn(s, 'bog_lurker', 30.5, 40.5);
    l.boss = createBossState();
    run(s, 1);
    paintRect(s, 20, 30, 39, 49, 'stone');
    run(s, 300);
    expect(isStranded(l)).toBe(true);
    expect(l.life).toBe(l.maxLife);
  });

  it('rule 31: water freezing under it traps it instead; that ice returning to dry ground strands it', () => {
    const s = pool();
    const l = spawn(s, 'bog_lurker', 30.5, 40.5);
    run(s, 1);
    setGround(s, idx(s, l.x, l.y), MAT.ice);
    let ev = run(s, 1);
    expect(ofType(ev, 'lurkerTrapped')).toMatchObject([{ trapped: true }]);
    expect(isStranded(l)).toBe(false);
    // Borrowed ice returns to its `under` (rule 27): stone.
    setGround(s, idx(s, l.x, l.y), MAT.stone);
    ev = run(s, 1);
    expect(ofType(ev, 'lurkerTrapped')).toMatchObject([{ trapped: false }]);
    expect(isStranded(l)).toBe(true);
  });

  it('rule 31: a swimmer never falls (rule 25) when a pit is under it', () => {
    const s = pool();
    const l = spawn(s, 'bog_lurker', 30.5, 40.5);
    run(s, 1);
    setGround(s, idx(s, l.x, l.y), MAT.pit);
    const ev = run(s, 30);
    expect(ofType(ev, 'fell')).toHaveLength(0);
    expect(isStranded(l)).toBe(true);
  });
});

describe('swimmer routes', () => {
  it('follows water as it appears: a channel of temporary water leads it out to the player', () => {
    const s = pool(100, 70);
    const l = spawn(s, 'bog_lurker', 25.5, 35.5);
    aggro(s, l);
    run(s, 240);
    // Toward the player, it waits at the pool's corner nearest them.
    expect(l.x).toBeGreaterThan(38);
    expect(l.y).toBeGreaterThan(48);
    // A winding channel: south out of the pool, then east toward the player.
    for (let y = 50; y <= 70; y += 2) placeTempWater(s, 25, y, 2, 30, hydromancerGrounds);
    for (let x = 25; x <= 90; x += 2) placeTempWater(s, x, 70, 2, 30, hydromancerGrounds);
    run(s, 900);
    expect(l.x).toBeGreaterThan(85);
    expect(Math.abs(l.y - 70)).toBeLessThan(3);
    expect(isWaterCode(groundAt(s, l.x, l.y))).toBe(true);
  });

  it('strands when the temporary water it followed runs out', () => {
    const s = pool(100, 70);
    const l = spawn(s, 'bog_lurker', 25.5, 45.5);
    aggro(s, l);
    for (let y = 50; y <= 70; y += 2) placeTempWater(s, 25, y, 2, 8, hydromancerGrounds);
    for (let x = 25; x <= 90; x += 2) placeTempWater(s, x, 70, 2, 8, hydromancerGrounds);
    const ev = run(s, 900);
    expect(ofType(ev, 'swimmerStranded').some((e) => e.stranded)).toBe(true);
  });
});
