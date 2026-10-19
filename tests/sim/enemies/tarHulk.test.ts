import { describe, expect, it } from 'vitest';
import { aggro, applyIgnite, isOiled, PLAYER_ID, scaleByLevel } from '../../../src/sim';
import { OWNER, SURFACE } from '../../../data/materials';
import { enemies } from '../../../data/enemies';
import { hitWith } from '../combat/helpers';
import { arena, idx, ofType, paintRect, run, spawn } from './helpers';

/** CONTENT §5 Tar Hulk: slow bruiser, slam telegraph, oil trail, explodes when ignited while Oiled. */

describe('Tar Hulk', () => {
  it('leaves an oil trail where it walks, and so stays Oiled', () => {
    const s = arena(140, 40);
    const h = spawn(s, 'tar_hulk', 30, 40);
    aggro(s, h);
    run(s, 180);
    expect(h.x).toBeGreaterThan(45);
    for (let x = 32; x < h.x - 3; x += 2) expect(s.grid.surface[idx(s, x, 40)]).toBe(SURFACE.oil);
    expect(s.grid.surface[idx(s, 30, 50)]).toBe(SURFACE.none);
    expect(isOiled(h)).toBe(true);
  });

  it('slams in a 5-cell circle after a 0.9 s telegraph', () => {
    const s = arena(36, 40);
    s.cheats.god = true;
    const h = spawn(s, 'tar_hulk', 30, 40);
    aggro(s, h);
    h.ai.cooldown = 0;
    const ev = run(s, 2);
    expect(ofType(ev, 'telegraph')).toMatchObject([{ id: h.id, attack: 'hulk_slam', windup: 0.9 }]);
    expect(h.attack.shape).toEqual({ kind: 'circle', r: 5 });
    const hits = ofType(run(s, 60), 'hit').filter((x) => x.target === 'player');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.amount).toBeCloseTo(22, 9);
  });

  it('ignited while Oiled, it explodes 1.5 s later: a 6-cell world-owned burst for 40 that hurts everyone', () => {
    const s = arena(36, 40);
    s.cheats.noAI = true;
    const h = spawn(s, 'tar_hulk', 30, 40);
    const t = spawn(s, 'shieldbearer', 30, 46);
    const far = spawn(s, 'shieldbearer', 60, 40);
    run(s, 1); // stands in its own oil
    expect(isOiled(h)).toBe(true);
    applyIgnite(s, h, 2, 3, PLAYER_ID);
    const lit = run(s, 1);
    expect(ofType(lit, 'hulkFuse')).toMatchObject([{ id: h.id, fuse: 1.5 }]);
    const lifeP = s.player.life;
    const lifeT = t.life;
    const ev = run(s, 90);
    expect(ofType(ev, 'hulkExploded')).toMatchObject([{ id: h.id, radius: 6, damage: 40 }]);
    expect(ofType(ev, 'explosion')).toMatchObject([{ owner: OWNER.world, radius: 6 }]);
    expect(ofType(ev, 'death').find((d) => d.id === h.id)).toMatchObject({ killerId: PLAYER_ID });
    expect(h.dead || !s.enemies.includes(h)).toBe(true);
    expect(s.player.life).toBeLessThan(lifeP);
    expect(t.life).toBeLessThan(lifeT);
    expect(far.life).toBe(far.maxLife);
    // The burst lit the oil around it (world-owned fire).
    expect(s.grid.fire[idx(s, 30, 40)]).toBeGreaterThan(0);
    expect(s.grid.owner[idx(s, 33, 40)]).toBe(OWNER.world);
  });

  it('getting Wet puts the fuse out', () => {
    const s = arena(100, 40);
    s.cheats.noAI = true;
    const h = spawn(s, 'tar_hulk', 30, 40);
    run(s, 1);
    applyIgnite(s, h, 2, 3, PLAYER_ID);
    run(s, 30);
    expect(h.special.fuseLeft).toBeGreaterThan(0);
    paintRect(s, 26, 36, 34, 44, 'shallow_water');
    const ev = run(s, 90);
    expect(ofType(ev, 'hulkFuseOut')).toMatchObject([{ id: h.id }]);
    expect(ofType(ev, 'hulkExploded')).toHaveLength(0);
    expect(h.dead).toBe(false);
  });

  it('dying with its fuse lit explodes at once', () => {
    const s = arena(100, 40);
    s.cheats.noAI = true;
    const h = spawn(s, 'tar_hulk', 30, 40);
    const t = spawn(s, 'shieldbearer', 34, 40);
    run(s, 1);
    applyIgnite(s, h, 2, 3, PLAYER_ID);
    run(s, 10);
    const lifeT = t.life;
    hitWith(s, h, 10_000, 'physical');
    expect(s.events.some((e) => e.type === 'hulkExploded' && e.id === h.id)).toBe(true);
    expect(t.life).toBeLessThan(lifeT);
  });

  it('scales its explosion like enemy damage (× 1.09^(L − 1))', () => {
    const s = arena(36, 40, 4);
    s.cheats.noAI = true;
    const h = spawn(s, 'tar_hulk', 30, 40);
    run(s, 1);
    applyIgnite(s, h, 2, 3, PLAYER_ID);
    const ev = run(s, 100);
    const ex = enemies.tar_hulk.chemistry.explodes;
    expect(ofType(ev, 'hulkExploded')[0]!.damage).toBeCloseTo(scaleByLevel(ex.damage, 1.09, 4), 9);
  });
});
