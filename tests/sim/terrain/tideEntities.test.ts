/**
 * Tide on entities and the entity side of borrowed terrain (M8, DESIGN §6.3): rule 25 (a
 * Tide-filled crossing drains away under you), rule 30 (furnace vents) and rule 32 (Tide Wets),
 * and the Tide rune's behavior.
 */
import { describe, expect, it } from 'vitest';
import {
  Button,
  DT,
  isIgnited,
  applyIgnite,
  PLAYER_ID,
  spawnEnemy,
  type GameState,
  type SimEvent,
} from '../../../src/sim';
import { RUNTIME_SHIPS } from '../../../src/sim/weave/runtime/loadout';
import { runes } from '../../../data/runes';
import { apply, dummy, idx, MAT, ofType, place, room, rowsRoom, run, weaves } from './helpers';

const LMB = Button.Cast1;

/** Presses slot 0 until its spell releases, aiming at `aim`; returns the events. */
function cast(s: GameState, aim: [number, number]): SimEvent[] {
  const t = s.weaves.slots[0]!.program!.castTime;
  const n = Math.ceil((t * 0.25 - 1e-9) / DT);
  return [...run(s, n, LMB, aim), ...run(s, 1, 0, aim)];
}

describe('rule 25: borrowed ground drains away under an entity (M8)', () => {
  it('rule 25: an ice bridge over a Tide-filled pit ends; the entity on it falls back to safe ground', () => {
    const s = rowsRoom(['......', '.____.', '......'], 2, 2);
    apply(s, 'tide', { kind: 'circle', x: 12, y: 6, r: 8 });
    apply(s, 'frost', { kind: 'circle', x: 12, y: 6, r: 8 });
    expect(s.grid.ground[idx(s, 12, 6)]).toBe(MAT.ice_bridge);
    place(s, 12, 6);
    run(s, 2);
    for (let i = 0; i < s.grid.timer.length; i++) if (s.grid.borrowed[i] === 1) s.grid.timer[i] = 1;
    const life = s.player.life;
    const ev = run(s, 4);
    expect(s.grid.ground[idx(s, 12, 6)]).toBe(MAT.pit);
    const fell = ofType(ev, 'fell');
    expect(fell).toHaveLength(1);
    expect(s.player.life).toBeCloseTo(life - 0.1 * s.player.maxLife, 6);
    expect(s.room.solid[idx(s, s.player.x, s.player.y)]).toBe(0);
  });
});

describe('rule 30: furnace vents (M8)', () => {
  const ROWS = ['.....', '..f..', '.....'];

  it('rule 30: an entity within 0.5 cells of a lit vent is Ignited, world-owned; farther away it is not', () => {
    const r = 1.5;
    const near = rowsRoom(ROWS, 12 + r + 0.3, 6);
    run(near, 2);
    expect(isIgnited(near.player)).toBe(true);
    expect(near.player.ailments.ignite.owner).toBe(0);
    const far = rowsRoom(ROWS, 12 + r + 0.8, 6);
    run(far, 2);
    expect(isIgnited(far.player)).toBe(false);
    // Enemies too.
    const s = rowsRoom(ROWS, 2, 2);
    const d = dummy(s, 7.5, 2.4);
    run(s, 2);
    expect(isIgnited(d)).toBe(true);
  });

  it('rule 30: Wet protects', () => {
    const s = rowsRoom(['..~..', '.~f~.', '..~..'], 10, 9.8);
    run(s, 3);
    expect(s.player.terrain.wetLeft).toBeGreaterThan(0);
    expect(isIgnited(s.player)).toBe(false);
  });

  it('rule 30: Tide douses it into a walkable grate; relighting pushes the walker off, not ignited and unhurt', () => {
    const s = rowsRoom(ROWS, 2, 2);
    apply(s, 'tide', { kind: 'circle', x: 10, y: 6, r: 3 });
    expect(s.grid.ground[idx(s, 10, 6)]).toBe(MAT.vent_doused);
    place(s, 10, 6);
    run(s, 2);
    expect(s.player.x).toBe(10);
    expect(isIgnited(s.player)).toBe(false);
    for (let i = 0; i < s.grid.timer.length; i++) if (s.grid.borrowed[i] === 1) s.grid.timer[i] = 1;
    const ev = run(s, 30);
    expect(s.grid.ground[idx(s, 10, 6)]).toBe(MAT.vent_lit);
    expect(ofType(ev, 'pushedOff')).toHaveLength(1);
    expect(ofType(ev, 'fell')).toHaveLength(0);
    expect(s.room.solid[idx(s, s.player.x, s.player.y)]).toBe(0);
    expect(s.player.life).toBe(s.player.maxLife);
    expect(isIgnited(s.player)).toBe(false);
  });
});

describe('rule 32: Tide Wets what it hits (M8)', () => {
  it('rule 32: a Tide hit makes the enemy Wet for 3 s (Lingering +30%) and puts out its Ignite', () => {
    for (const [notation, seconds] of [
      ['Cast > Bolt[Tide]', 3],
      ['Cast > Bolt[Tide, Lingering]', 3.9],
    ] as const) {
      const s = room('.');
      weaves(s, [notation]);
      const d = dummy(s, 40, 40);
      applyIgnite(s, d, 5, 3, PLAYER_ID);
      expect(isIgnited(d)).toBe(true);
      const ev = [...cast(s, [40, 40]), ...run(s, 30)];
      const hitTick = ofType(ev, 'hit').length;
      expect(hitTick).toBeGreaterThan(0);
      expect(isIgnited(d)).toBe(false);
      expect(d.terrain.wetLeft).toBeGreaterThan(seconds - 0.6);
      expect(d.terrain.wetLeft).toBeLessThanOrEqual(seconds);
      expect(ofType(ev, 'wetChanged').some((e) => e.wet && e.target === d.id)).toBe(true);
    }
  });

  it('rule 32: [Fire, Tide] never leaves an Ignite, and a burning Tar Hulk fuse goes out', () => {
    const s = room('.');
    weaves(s, ['Cast > Bolt[Fire, Tide]']);
    const d = dummy(s, 40, 40);
    cast(s, [40, 40]);
    run(s, 30);
    expect(d.terrain.wetLeft).toBeGreaterThan(0);
    expect(isIgnited(d)).toBe(false);

    const h = rowsRoom(['oooooooooo', 'oooooooooo', 'oooooooooo'], 4, 6);
    weaves(h, ['Cast > Bolt[Tide]']);
    const hulk = spawnEnemy(h, 'tar_hulk', 26, 6);
    run(h, 2);
    applyIgnite(h, hulk, 5, 3, PLAYER_ID);
    run(h, 2);
    expect(hulk.special.fuseLeft).toBeGreaterThan(0);
    h.grid.surface.fill(0); // so it can't relight on its own oil fire later
    const ev = [...cast(h, [26, 6]), ...run(h, 20)];
    expect(ofType(ev, 'hulkFuseOut')).toHaveLength(1);
    expect(hulk.special.fuseLeft).toBe(0);
  });

  it('rule 32: Tide never Wets its caster (a Tide Nova on dry metal floor: no water to stand in)', () => {
    const s = room('m');
    weaves(s, ['Cast > Nova[Tide]']);
    const d = dummy(s, 26, 40);
    cast(s, [40, 40]);
    run(s, 20);
    expect(d.terrain.wetLeft).toBeGreaterThan(0);
    expect(s.player.terrain.wetLeft).toBe(0);
  });
});

describe('the Tide rune (CONTENT §1.3)', () => {
  it('only Tide and Gale ship in M8, and the sim now accepts them', () => {
    const m8 = Object.values(runes)
      .filter((r) => r.ships === 'M8')
      .map((r) => r.id);
    expect(m8.sort()).toEqual(['gale', 'tide']);
    expect(RUNTIME_SHIPS.has('M8')).toBe(true);
  });

  it('a Tide Bolt deals Physical damage and floods its impact on stone with borrowed water for 10 s', () => {
    const s = room('.');
    weaves(s, ['Cast > Bolt[Tide]']);
    const d = dummy(s, 40, 40);
    const ev = [...cast(s, [40, 40]), ...run(s, 30)];
    const hit = ofType(ev, 'hit')[0]!;
    expect(hit.target).toBe(d.id);
    expect(hit.byType?.physical).toBeGreaterThan(0);
    const end = ofType(ev, 'spellEnd')[0]!;
    const i = idx(s, end.x, end.y);
    expect(s.grid.ground[i]).toBe(MAT.shallow_water);
    expect(s.grid.borrowed[i]).toBe(1);
    expect(s.grid.under[i]).toBe(MAT.stone);
  });
});
