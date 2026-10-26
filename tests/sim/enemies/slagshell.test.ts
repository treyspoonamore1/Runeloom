import { describe, expect, it } from 'vitest';
import { addChill, aggro, fenTakenMult, isHot, PLAYER_ID } from '../../../src/sim';
import { arena, idx, ofType, paintRect, run, spawn } from './helpers';

/**
 * CONTENT §5 Slagshell: Hot (70% less damage taken, can't be chilled) until Wet; getting Wet
 * quenches it in steam: Cracked (no reduction, 25% more damage, 30% slower, chill works) for 6 s
 * once dry, then Hot again. Avoids water while Hot. Slag slam: 24 Fire, 5-cell circle, 0.9 s,
 * placed fire.
 */

describe('Slagshell', () => {
  it('Hot: takes 70% less damage and cannot be chilled', () => {
    const s = arena();
    const e = spawn(s, 'slagshell', 40, 40);
    expect(isHot(e)).toBe(true);
    expect(fenTakenMult(s, e)).toBeCloseTo(0.3);
    addChill(s, e, 80, 1, PLAYER_ID);
    expect(e.ailments.chill).toBe(0);
  });

  it('cracks when Wet, in a puff of steam: 25% more damage taken, 30% slower, chill works', () => {
    const s = arena(140, 40);
    s.cheats.noAI = true;
    paintRect(s, 30, 30, 49, 49, 'shallow_water');
    const e = spawn(s, 'slagshell', 40, 40);
    // Wet in the terrain phase of the first tick, quenched as it next acts.
    const ev = run(s, 2);
    expect(ofType(ev, 'slagQuenched')).toMatchObject([{ id: e.id, seconds: 6 }]);
    expect(ofType(ev, 'steam').length).toBeGreaterThan(0);
    expect(s.grid.air[idx(s, 40, 40)]).not.toBe(0);
    expect(isHot(e)).toBe(false);
    expect(fenTakenMult(s, e)).toBeCloseTo(1.25);
    addChill(s, e, 40, 1, PLAYER_ID);
    expect(e.ailments.chill).toBeGreaterThan(0);
    // 30% slower.
    e.vx = 9;
    run(s, 1);
    expect(e.terrain.slideX).toBeCloseTo(
      9 * 0.8 * 0.7 * (1 - e.ailments.chill * s.tuning.ailments.chillSlowPerPoint),
      1,
    );
  });

  it('dry, it heats again 6 s after it dried off', () => {
    const s = arena(140, 40);
    s.cheats.noAI = true;
    paintRect(s, 30, 30, 49, 49, 'shallow_water');
    const e = spawn(s, 'slagshell', 40, 40);
    run(s, 1);
    paintRect(s, 30, 30, 49, 49, 'stone');
    // Wet lasts 3 s after leaving the water, then 6 s Cracked.
    run(s, 60 * 8.5);
    expect(isHot(e)).toBe(false);
    const ev = run(s, 60);
    expect(ofType(ev, 'slagReheated')).toMatchObject([{ id: e.id }]);
    expect(fenTakenMult(s, e)).toBeCloseTo(0.3);
  });

  it('slams for 24 Fire in a 5-cell circle after 0.9 s, leaving placed fire', () => {
    const s = arena(50, 40);
    s.cheats.god = true;
    const e = spawn(s, 'slagshell', 46, 40);
    aggro(s, e);
    e.ai.cooldown = 0;
    expect(ofType(run(s, 2), 'telegraph')).toMatchObject([{ id: e.id, attack: 'slag_slam', windup: 0.9 }]);
    const ev = run(s, 60);
    const hit = ofType(ev, 'hit').filter((h) => h.target === 'player' && h.sourceId === e.id);
    expect(hit).toHaveLength(1);
    expect(hit[0]!.damageType).toBe('fire');
    expect(hit[0]!.amount).toBeCloseTo(24);
    expect(ofType(ev, 'cellIgnited').length).toBeGreaterThan(0);
  });

  it('avoids water while Hot: it walks around a pool between it and the player', () => {
    const s = arena(90, 40);
    paintRect(s, 50, 34, 60, 46, 'shallow_water');
    const e = spawn(s, 'slagshell', 30, 40);
    aggro(s, e);
    let wet = false;
    for (let t = 0; t < 400; t++) {
      run(s, 1);
      if (s.grid.ground[idx(s, e.x, e.y)] !== s.grid.ground[idx(s, 10, 10)]) wet = true;
    }
    expect(wet).toBe(false);
    expect(isHot(e)).toBe(true);
  });
});
