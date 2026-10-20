import { describe, expect, it } from 'vitest';
import {
  aggro,
  applyIgnite,
  isOiled,
  PLAYER_ID,
  spawnEnemy,
  spillOil,
  type GameState,
} from '../../../src/sim';
import { OWNER } from '../../../data/materials';
import { bosses } from '../../../data/bosses';
import { defaultTuning } from '../../../data/tuning';
import { hitWith } from '../combat/helpers';
import { fromFile, idx, ofType, paintRect, place, run } from './helpers';

/**
 * CONTENT §5 Tar Matriarch: lit while Oiled she flares (the Tar Hulk's fuse and burst, but she
 * lives and burns herself); phase 2 makes her faster and adds her tar rush.
 */

const M = bosses.tar_matriarch;
const FLARE = M.chemistry.flare;
const T = defaultTuning.bosses;

/** K5 with her standing still on her own tar, the player at (px, py). */
function standing(px: number, py: number): { s: GameState; m: GameState['enemies'][number] } {
  const s = fromFile('kiln/k5_matriarch_pit');
  s.cheats.noAI = true;
  s.cheats.god = true;
  const m = s.enemies.find((e) => e.kind === 'tar_matriarch')!;
  place(s, m.x + px, m.y + py);
  spillOil(s, m.x, m.y, 4, true);
  run(s, 1);
  return { s, m };
}

describe('Tar Matriarch flare', () => {
  it('lit while Oiled: a 1.5 s fuse, then a 6-cell world-owned burst for 35 and 250 to herself', () => {
    const { s, m } = standing(6, 0);
    const near = spawnEnemy(s, 'shieldbearer', m.x, m.y + 6);
    const far = spawnEnemy(s, 'shieldbearer', m.x + 30, m.y);
    expect(isOiled(m)).toBe(true);
    applyIgnite(s, m, 2, 3, PLAYER_ID);
    const lit = run(s, 1);
    expect(ofType(lit, 'matriarchFuse')).toMatchObject([
      { id: m.id, fuse: FLARE.fuse, radius: FLARE.radius },
    ]);
    expect(FLARE.fuse).toBeGreaterThanOrEqual(0.4); // DESIGN §14: the fuse is the telegraph
    const life = m.life;
    const ev = run(s, 90);
    expect(ofType(ev, 'matriarchFlare')).toMatchObject([
      { id: m.id, radius: 6, damage: 35, selfDamage: 250 },
    ]);
    expect(ofType(ev, 'explosion')).toMatchObject([{ owner: OWNER.world, radius: 6 }]);
    const hits = ofType(ev, 'hit');
    expect(hits.find((h) => h.target === 'player')).toMatchObject({ amount: 35, sourceId: -1 });
    expect(hits.find((h) => h.target === m.id)).toMatchObject({ amount: 250, damageType: 'physical' });
    expect(hits.some((h) => h.target === near.id)).toBe(true);
    expect(hits.some((h) => h.target === far.id)).toBe(false);
    expect(m.dead).toBe(false);
    expect(m.life).toBeLessThanOrEqual(life - 250);
    // The burst lit her tar: world-owned fire.
    expect(s.grid.owner[idx(s, m.x + 2, m.y)]).toBe(OWNER.world);
  });

  it(`can't flare again for ${FLARE.cooldown} s`, () => {
    const { s, m } = standing(30, 0);
    applyIgnite(s, m, 2, 3, PLAYER_ID);
    expect(ofType(run(s, 100), 'matriarchFlare')).toHaveLength(1);
    spillOil(s, m.x, m.y, 4, true);
    const again: number[] = [];
    for (let t = 0; t < (FLARE.cooldown + 1) * 60; t += 30) {
      applyIgnite(s, m, 2, 3, PLAYER_ID); // she stays lit and Oiled throughout
      if (ofType(run(s, 30), 'matriarchFuse').length > 0) again.push(t / 60);
      spillOil(s, m.x, m.y, 4, true);
    }
    expect(again.length).toBeGreaterThan(0);
    expect(again[0]!).toBeGreaterThanOrEqual(FLARE.cooldown - 1.6);
  });

  it('getting Wet puts the fuse out', () => {
    const { s, m } = standing(30, 0);
    applyIgnite(s, m, 2, 3, PLAYER_ID);
    run(s, 30);
    expect(m.special.fuseLeft).toBeGreaterThan(0);
    paintRect(s, m.x - 5, m.y - 5, m.x + 5, m.y + 5, 'shallow_water');
    const ev = run(s, 90);
    expect(ofType(ev, 'matriarchFuseOut')).toMatchObject([{ id: m.id }]);
    expect(ofType(ev, 'matriarchFlare')).toHaveLength(0);
  });

  it('dying with the fuse lit flares at once, without hurting herself', () => {
    const { s, m } = standing(5, 0);
    applyIgnite(s, m, 2, 3, PLAYER_ID);
    run(s, 10);
    hitWith(s, m, m.life + 10, 'physical');
    const ev = [...s.events, ...run(s, 1)];
    expect(ofType(ev, 'matriarchFlare')).toMatchObject([{ id: m.id, selfDamage: 0 }]);
    expect(ofType(ev, 'hit').some((h) => h.target === 'player' && h.amount === 35)).toBe(true);
  });
});

describe('Tar Matriarch phase 2', () => {
  /** K5 with her at (36, 22) in phase 2, aggroed, the player px cells east (open stone between). */
  function phase2(px: number): { s: GameState; m: GameState['enemies'][number] } {
    const s = fromFile('kiln/k5_matriarch_pit');
    s.cheats.god = true;
    const m = s.enemies.find((e) => e.kind === 'tar_matriarch')!;
    m.x = m.prevX = 36;
    m.y = m.prevY = 22;
    place(s, m.x + px, m.y);
    aggro(s, m);
    m.boss!.phase = 2;
    m.boss!.gap = 0;
    return { s, m };
  }

  it(`walks ${T.matriarchPhase2Speed}× faster`, () => {
    const { s, m } = phase2(40);
    m.ai.cooldowns.fill(99);
    run(s, 10);
    expect(Math.hypot(m.vx, m.vy)).toBeCloseTo(M.speed * T.matriarchPhase2Speed, 6);
  });

  it(`her cooldowns shrink to ${T.matriarchPhase2Cooldown}×`, () => {
    const { s, m } = phase2(6);
    m.ai.cooldowns.fill(0);
    const ev = run(s, 2);
    expect(ofType(ev, 'telegraph')).toMatchObject([{ attack: 'matriarch_slam' }]);
    expect(m.ai.cooldowns[0]).toBeCloseTo(M.attack.cooldown * T.matriarchPhase2Cooldown, 1);
  });

  it('rushes a far player: a 0.9 s line, 25 on contact with knockback, smearing tar along the way', () => {
    const { s, m } = phase2(26);
    m.ai.cooldowns.fill(99);
    m.ai.cooldowns[2] = 0;
    const x0 = m.x;
    const tel = run(s, 2);
    expect(ofType(tel, 'telegraph')).toMatchObject([{ id: m.id, attack: 'tar_rush', windup: 0.9 }]);
    expect(m.attack.shape.kind).toBe('line');
    const ev = run(s, 120);
    const hit = ofType(ev, 'hit').find((h) => h.target === 'player' && h.sourceId === m.id);
    expect(hit).toMatchObject({ amount: 25 });
    expect(m.x).toBeGreaterThan(x0 + 15);
    for (let x = x0 + 4; x < x0 + 14; x += 3) expect(s.grid.tar[idx(s, x, m.y)]).toBe(1);
    expect(m.ai.cooldowns[2]).toBeGreaterThan(0);
  });

  it(`doesn't rush in phase 1 or at a player closer than ${T.matriarchRushMinDistance} cells`, () => {
    const a = phase2(24);
    a.m.boss!.phase = 1;
    a.m.ai.cooldowns.fill(99);
    a.m.ai.cooldowns[2] = 0;
    expect(ofType(run(a.s, 60), 'telegraph').filter((t) => t.attack === 'tar_rush')).toHaveLength(0);
    const b = phase2(M.radius + 4);
    b.m.ai.cooldowns.fill(99);
    b.m.ai.cooldowns[2] = 0;
    expect(ofType(run(b.s, 10), 'telegraph').filter((t) => t.attack === 'tar_rush')).toHaveLength(0);
  });
});
