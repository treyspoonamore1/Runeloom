import { describe, expect, it } from 'vitest';
import { aggro, isWaterAt, type GameState } from '../../../src/sim';
import { SURFACE } from '../../../data/materials';
import { bosses } from '../../../data/bosses';

const LIFE = bosses.tar_matriarch.life;
import { hitWith } from '../combat/helpers';
import { fromFile, idx, ofType, place, run } from './helpers';

/**
 * CONTENT §5 Tar Matriarch (K5): slam with knockback, tar globs that leave tar, her tar crew (2 Tar
 * Hulks and 4 Tinderlings) at 50% life. Flare, rush and phase 2: matriarchPhase2.test.ts.
 */

function pit(px: number, py: number): GameState {
  const s = fromFile('kiln/k5_matriarch_pit');
  place(s, px, py);
  s.cheats.god = true;
  return s;
}

describe('Tar Matriarch', () => {
  it('spawns in K5 with her absolute CONTENT §5 life at area level 8', () => {
    const s = pit(10, 30);
    const m = s.enemies.find((e) => e.kind === 'tar_matriarch')!;
    expect(m.maxLife).toBe(LIFE);
    expect(m.areaLevel).toBe(8);
    expect(m.boss).toMatchObject({ phase: 1, pendingPhase: 0 });
    expect(s.room.level).toBe(8);
  });

  it('wakes with a bossAwake event and slams for 30 in a 6-cell circle with 4 cells of knockback', () => {
    const s = pit(50, 30);
    const m = s.enemies.find((e) => e.kind === 'tar_matriarch')!;
    place(s, m.x + 7, m.y);
    m.ai.cooldowns[1] = 99; // no globs
    // Sight is re-checked every few ticks.
    const ev = run(s, 5);
    expect(ofType(ev, 'bossAwake')).toMatchObject([
      { id: m.id, kind: 'tar_matriarch', name: 'Tar Matriarch' },
    ]);
    const all = [...ev];
    let x0 = 0;
    for (let i = 0; i < 90 && x0 === 0; i++) {
      const before = s.player.x;
      const tick = run(s, 1);
      all.push(...tick);
      if (ofType(tick, 'hit').some((h) => h.target === 'player')) x0 = before;
    }
    run(s, 30);
    expect(s.player.x - x0).toBeCloseTo(4, 0);
    const tel = ofType(all, 'telegraph').filter((t) => t.attack === 'matriarch_slam');
    expect(tel[0]).toMatchObject({ windup: 1 });
    const hit = ofType(all, 'hit').find((h) => h.target === 'player' && h.sourceId === m.id)!;
    expect(hit.amount).toBe(30);
    expect(Math.hypot(hit.kbX, hit.kbY)).toBeCloseTo(1, 9);
  });

  it('lobs tar globs at the player that leave a 4-cell splat of tar', () => {
    const s = pit(20, 30);
    const m = s.enemies.find((e) => e.kind === 'tar_matriarch')!;
    aggro(s, m);
    m.ai.cooldowns[1] = 0;
    m.boss!.gap = 0;
    const ev = run(s, 3);
    const tel = ofType(ev, 'telegraph').filter((t) => t.attack === 'tar_glob');
    expect(tel).toMatchObject([{ windup: 0.8 }]);
    const x = m.attack.originX;
    const y = m.attack.originY;
    expect(Math.hypot(x - 20, y - 30)).toBeLessThan(1);
    run(s, 50);
    expect(s.grid.surface[idx(s, x, y)]).toBe(SURFACE.oil);
    expect(s.grid.surface[idx(s, x + 3.5, y)]).toBe(SURFACE.oil);
    expect(s.grid.surface[idx(s, x + 4.6, y + 1)]).toBe(SURFACE.none);
    expect(s.grid.tar[idx(s, x, y)]).toBe(1);
    expect(s.grid.tar[idx(s, x + 3.5, y)]).toBe(1);
  });

  it('at half life calls her tar crew once, 2 Tar Hulks and 4 Tinderlings (phase 2)', () => {
    const s = pit(20, 30);
    const m = s.enemies.find((e) => e.kind === 'tar_matriarch')!;
    aggro(s, m);
    hitWith(s, m, LIFE / 2 + 1, 'physical');
    const ev = run(s, 120);
    expect(ofType(ev, 'telegraph').filter((t) => t.attack === 'summon_hulks')).toHaveLength(1);
    const sum = ofType(ev, 'bossSummon');
    expect(sum.map((x) => [x.kind, x.spawned.length])).toEqual([
      ['tar_hulk', 2],
      ['tinderling', 4],
    ]);
    expect(ofType(ev, 'bossPhase')).toMatchObject([{ id: m.id, phase: 2 }]);
    const hulks = s.enemies.filter((e) => e.kind === 'tar_hulk');
    expect(hulks).toHaveLength(2);
    for (const h of [...hulks, ...s.enemies.filter((e) => e.kind === 'tinderling')]) {
      expect(h.special.parentId).toBe(m.id);
      expect(h.areaLevel).toBe(8);
      expect(h.ai.mode).not.toBe('idle');
    }
    hitWith(s, m, LIFE / 5, 'physical');
    expect(ofType(run(s, 200), 'bossSummon')).toHaveLength(0);
  });

  it('leaves no oil trail of her own (her globs and Hulks bring the oil)', () => {
    const s = pit(90, 30);
    const m = s.enemies.find((e) => e.kind === 'tar_matriarch')!;
    aggro(s, m);
    m.ai.cooldowns[1] = 99;
    const x0 = m.x;
    run(s, 120);
    expect(m.x).toBeGreaterThan(x0 + 5);
    expect(s.grid.surface[idx(s, x0 + 3, m.y)]).toBe(SURFACE.none);
    expect(isWaterAt(s, m.x, m.y)).toBe(false);
  });
});
