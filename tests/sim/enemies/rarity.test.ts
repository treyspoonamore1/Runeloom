import { describe, expect, it } from 'vitest';
import { bosses } from '../../../data/bosses';
import { aggro, enemyAttackPacket, scaleByLevel, spawnEnemy } from '../../../src/sim';
import { enemies } from '../../../data/enemies';
import { hastedWindup, rollMods } from '../../../src/sim/actors/rarity';
import { hitWith } from '../combat/helpers';
import { arena, idx, ofType, run } from './helpers';
import { OWNER } from '../../../data/materials';

/** CONTENT §5 monster mods (M4: Hasted, Incendiary, Thick-skinned; M5 in modsM5.test.ts) and DESIGN §7 level scaling. */

describe('monster mods', () => {
  it('rolls Magic 1–2 and Rare 2–4 distinct mods from the AI stream', () => {
    const s = arena();
    for (let k = 0; k < 50; k++) {
      const m = rollMods(s, 'magic');
      expect(m.length >= 1 && m.length <= 2).toBe(true);
      const r = rollMods(s, 'rare');
      expect(r.length >= 2 && r.length <= 4).toBe(true);
      expect(new Set(r).size).toBe(r.length);
    }
    expect(rollMods(s, 'normal')).toEqual([]);
  });

  it('Hasted: 30% faster walking and attacks, but windups stay at least 0.4 s', () => {
    const s = arena(140, 40);
    const n = spawnEnemy(s, 'tar_hulk', 30, 30);
    const h = spawnEnemy(s, 'tar_hulk', 30, 50, { rarity: 'magic', mods: ['hasted'] });
    aggro(s, n);
    aggro(s, h);
    run(s, 1);
    expect(Math.hypot(h.vx, h.vy)).toBeCloseTo(Math.hypot(n.vx, n.vy) * 1.3, 6);
    expect(hastedWindup(0.9, 1.3)).toBeCloseTo(0.9 / 1.3, 9);
    expect(hastedWindup(0.45, 1.3)).toBe(0.4);
    expect(hastedWindup(0.3, 1.3)).toBe(0.3);
    expect(hastedWindup(1.2, 1)).toBe(1.2);
    // Its slam winds up faster and it attacks again sooner.
    const t = arena(34, 40);
    t.cheats.god = true;
    const fast = spawnEnemy(t, 'tar_hulk', 30, 40, { rarity: 'magic', mods: ['hasted'] });
    aggro(t, fast);
    fast.ai.cooldown = 0;
    const ev = run(t, 2);
    expect(ofType(ev, 'telegraph')[0]!.windup).toBeCloseTo(0.9 / 1.3, 9);
    run(t, 54);
    expect(fast.ai.cooldown).toBeLessThan(enemies.tar_hulk.attack.cooldown / 1.3 + 0.21);
  });

  it('Incendiary: 5×5 enemy-owned fire where it dies', () => {
    const s = arena(140, 40);
    s.cheats.noAI = true;
    const e = spawnEnemy(s, 'shieldbearer', 40.3, 40.7, { rarity: 'magic', mods: ['incendiary'] });
    hitWith(s, e, 10_000, 'physical');
    for (let y = 38; y <= 42; y++)
      for (let x = 38; x <= 42; x++) {
        expect(s.grid.fire[idx(s, x, y)]).toBeGreaterThan(0);
        expect(s.grid.owner[idx(s, x, y)]).toBe(OWNER.enemy);
      }
    expect(s.grid.fire[idx(s, 37, 40)]).toBe(0);
    expect(s.grid.fire[idx(s, 43, 40)]).toBe(0);
    expect(OWNER.enemy).toBe(OWNER.enemy);
  });

  it('Thick-skinned: +40% life, multiplying the rarity', () => {
    const s = arena();
    const e = spawnEnemy(s, 'stormcaller', 30, 30, { rarity: 'rare', mods: ['thick_skinned', 'hasted'] });
    expect(e.maxLife).toBeCloseTo(50 * 4 * 1.4, 9);
    expect(e.life).toBe(e.maxLife);
  });
});

describe('area level scaling (DESIGN §7)', () => {
  const kinds = ['bog_lurker', 'tar_hulk', 'frost_wisp', 'stormcaller', 'kiln_mite', 'brood_kiln'] as const;
  for (const kind of kinds) {
    it(`${kind}: life × 1.12^(L − 1) and damage × 1.09^(L − 1)`, () => {
      for (const L of [1, 5, 10]) {
        const s = arena(100, 40, L);
        const e = spawnEnemy(s, kind, 30, 30);
        expect(e.areaLevel).toBe(L);
        expect(e.maxLife).toBeCloseTo(scaleByLevel(enemies[kind].life, 1.12, L), 6);
      }
    });
  }

  it('attack damage scales with the enemy area level', () => {
    const s = arena(100, 40, 6);
    const e = spawnEnemy(s, 'stormcaller', 30, 30);
    const p = enemyAttackPacket(s, e, enemies.stormcaller.attack);
    expect(p.base.storm).toBeCloseTo(18 * 1.09 ** 5, 9);
  });

  it('boss life and damage are absolute, at their CONTENT §5 level', () => {
    const s = arena(100, 40, 3);
    const m = spawnEnemy(s, 'tar_matriarch', 30, 30);
    const w = spawnEnemy(s, 'cinder_warden', 60, 30);
    expect([m.maxLife, m.areaLevel]).toEqual([bosses.tar_matriarch.life, 8]);
    expect([w.maxLife, w.areaLevel]).toEqual([bosses.cinder_warden.life, 10]);
    expect(enemyAttackPacket(s, w, enemies.cinder_warden.attack).base.fire).toBe(40);
    expect(enemyAttackPacket(s, m, enemies.tar_matriarch.attack).base.physical).toBe(30);
  });
});
