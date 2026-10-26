/**
 * Where Tide and wind meet the Fen enemies (M8): swimmers follow borrowed water and strand when it
 * goes (rules 27 → 31), the Bellows Toad's croak is a real enemy gust (rule 21), enemy puddles
 * are borrowed water, and Toad Bellows scales the player's gusts.
 */
import { describe, expect, it } from 'vitest';
import { aggro, applyElement, isStranded, PLAYER_ID, type GameState } from '../../../src/sim';
import { OWNER } from '../../../data/materials';
import { placeBorrowedWater } from '../../../src/sim/grid/tempWater';
import { arena, idx, MAT, ofType, run, spawn } from './helpers';

function tide(s: GameState, x: number, y: number, r: number): void {
  applyElement(s, {
    element: 'tide',
    shape: { kind: 'circle', x, y, r },
    owner: OWNER.player,
    sourceId: PLAYER_ID,
    hitDamage: 0,
    durationMult: 1,
  });
}

/** Ends every borrowed cell's time on the next grid tick. */
function drain(s: GameState): void {
  for (let i = 0; i < s.grid.timer.length; i++) if (s.grid.borrowed[i] === 1) s.grid.timer[i] = 1;
}

describe('swimmers in borrowed water (rules 27 and 31)', () => {
  it('a Glasspike in a Tide pool strands when the water goes back to stone', () => {
    const s = arena(140, 40, 1);
    tide(s, 30, 40, 8);
    expect(s.grid.ground[idx(s, 30, 40)]).toBe(MAT.shallow_water);
    const p = spawn(s, 'glasspike', 30.5, 40.5);
    aggro(s, p);
    run(s, 30);
    expect(isStranded(p)).toBe(false);
    drain(s);
    const ev = run(s, 6);
    expect(s.grid.ground[idx(s, p.x, p.y)]).toBe(MAT.stone);
    expect(ofType(ev, 'swimmerStranded').some((e) => e.id === p.id && e.stranded)).toBe(true);
    expect(isStranded(p)).toBe(true);
  });

  it('a swimmer on Tide-then-Frost ice is trapped, and strands when that ice returns to stone', () => {
    const s = arena(140, 40, 1);
    tide(s, 30, 40, 8);
    const l = spawn(s, 'bog_lurker', 30.5, 40.5);
    run(s, 2);
    applyElement(s, {
      element: 'frost',
      shape: { kind: 'circle', x: 30, y: 40, r: 8 },
      owner: OWNER.player,
      sourceId: PLAYER_ID,
      hitDamage: 0,
      durationMult: 1,
    });
    expect(ofType(run(s, 2), 'lurkerTrapped')).toMatchObject([{ trapped: true }]);
    drain(s);
    run(s, 6);
    expect(s.grid.ground[idx(s, l.x, l.y)]).toBe(MAT.stone);
    expect(isStranded(l)).toBe(true);
  });
});

describe('the Bellows Toad croak is an enemy gust (rule 21)', () => {
  it('writes gust cells over its 14-cell 60° cone, blowing along its facing, for 2 s', () => {
    const s = arena(62, 40);
    s.cheats.god = true;
    const t = spawn(s, 'bellows_toad', 50, 40);
    aggro(s, t);
    t.ai.cooldown = 0;
    const ev = run(s, 64);
    const croak = ofType(ev, 'toadCroak')[0]!;
    expect(croak).toBeDefined();
    expect(s.grid.gusts.some((g) => g.team === 1)).toBe(true);
    // The player is to the east of the toad: the gust blows east over the cells between them.
    expect(s.grid.gustDir[idx(s, 56, 40)]).toBe(1);
    expect(s.grid.gustTimer[idx(s, 56, 40)]).toBeGreaterThan(30);
    expect(s.grid.gustDir[idx(s, 44, 40)]).toBe(0); // nothing behind it
  });
});

describe('enemy puddles are borrowed water (DESIGN §6.5)', () => {
  it('placeBorrowedWater floods dry ground with borrowed water that goes back', () => {
    const s = arena(140, 40, 1);
    expect(placeBorrowedWater(s, 30, 40, 3, 6)).toBeGreaterThan(20);
    const i = idx(s, 30, 40);
    expect(s.grid.ground[i]).toBe(MAT.shallow_water);
    expect(s.grid.borrowed[i]).toBe(1);
    run(s, 6 * 60 + 3);
    expect(s.grid.ground[i]).toBe(MAT.stone);
  });
});

describe('Toad Bellows (Fuse part) scales the player gusts', () => {
  it('adds seconds and grows the cone by √(1 + area increase)', () => {
    const gale = (s: GameState) =>
      applyElement(s, {
        element: 'gale',
        shape: { kind: 'arc', x: 20, y: 40, dirX: 1, dirY: 0, r: 12, halfAngleCos: 0.8660254037844387 },
        owner: OWNER.player,
        sourceId: PLAYER_ID,
        hitDamage: 0,
        durationMult: 1,
      });
    const plain = arena(140, 40, 1);
    gale(plain);
    const fused = arena(140, 40, 1);
    fused.heroMods.effects.gust_seconds_add = 1;
    fused.heroMods.effects.gust_area_inc = 1; // ×√2 radius
    gale(fused);
    expect(plain.grid.gustTimer[idx(plain, 26, 40)]).toBe(40);
    expect(fused.grid.gustTimer[idx(fused, 26, 40)]).toBe(60);
    expect(plain.grid.gustDir[idx(plain, 35, 40)]).toBe(0);
    expect(fused.grid.gustDir[idx(fused, 35, 40)]).toBe(1);
  });
});
