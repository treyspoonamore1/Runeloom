import { describe, expect, it } from 'vitest';
import { freezeTarget, killEnemy, PLAYER_ID, spawnEnemy, applyIgnite, stepGrid } from '../../../src/sim';
import {
  apply,
  burning,
  dummy,
  idx,
  inCircle,
  MAT,
  ofType,
  OWNER,
  paintRect,
  place,
  room,
  run,
} from './helpers';

/** DESIGN §6.3 rules 20, 22 and 25, plus charge, explosions and the rule 26 death fire. */

const circle = (x: number, y: number, r: number) => ({ kind: 'circle' as const, x, y, r });

describe('rule 20: Shatter', () => {
  it('rule 20: a Frozen enemy killed bursts into frost in a 4-cell radius (rules 7 and 8), owned by the killer', () => {
    const s = room('.', 30, 20, 100, 40);
    paintRect(s, 30, 30, 39, 50, 'shallow_water');
    paintRect(s, 40, 30, 50, 50, 'deep_water');
    const e = spawnEnemy(s, 'shieldbearer', 38, 40);
    freezeTarget(s, e, 2, PLAYER_ID);
    s.events.length = 0;
    killEnemy(s, e, PLAYER_ID, 'hit');
    expect(ofType(s.events, 'death')[0]!.shattered).toBe(true);
    expect(s.grid.ground[idx(s, 36, 40)]).toBe(MAT.ice);
    expect(s.grid.ground[idx(s, 41, 40)]).toBe(MAT.ice_bridge);
    expect(s.grid.ground[idx(s, 38, 45)]).toBe(MAT.shallow_water); // 5 cells away
    expect(ofType(s.events, 'hit')).toHaveLength(0);
    expect(s.grid.walkVersion).toBeGreaterThan(0); // the ice bridge is walkable now
  });

  it('rule 20: an unfrozen kill leaves no frost', () => {
    const s = room('~', 30, 20, 100, 40);
    const e = spawnEnemy(s, 'shieldbearer', 40, 40);
    killEnemy(s, e, PLAYER_ID, 'hit');
    expect(s.grid.ground[idx(s, 40, 40)]).toBe(MAT.shallow_water);
  });
});

describe('rule 22: burning entities light what they cross', () => {
  it('rule 22: an Ignited enemy walking over grass lights it, owned by the team that ignited it', () => {
    const s = room('"', 30, 20, 100, 40);
    const e = spawnEnemy(s, 'shieldbearer', 30, 40);
    applyIgnite(s, e, 3, 3, PLAYER_ID);
    for (let k = 0; k < 10; k++) {
      e.x += 1;
      run(s, 1);
    }
    for (const x of [32, 35, 39]) {
      expect(s.grid.fire[idx(s, x, 40)], `x ${x}`).toBeGreaterThan(0);
      expect(s.grid.owner[idx(s, x, 40)]).toBe(OWNER.player);
    }
  });

  it('rule 22: a Tinderling lights enemy-owned fire as it runs over grass, but not while Wet', () => {
    const s = room('"', 30, 20, 100, 40);
    const t = spawnEnemy(s, 'tinderling', 30, 40);
    run(s, 1);
    expect(s.grid.fire[idx(s, 30, 40)]).toBeGreaterThan(0);
    expect(s.grid.owner[idx(s, 30, 40)]).toBe(OWNER.enemy);
    paintRect(s, 50, 30, 60, 50, 'shallow_water');
    t.x = 55;
    run(s, 1);
    paintRect(s, 50, 30, 60, 50, 'grass');
    run(s, 1);
    expect(s.grid.fire[idx(s, 55, 40)]).toBe(0);
  });
});

describe('rule 25: falling', () => {
  it('rule 25: an ice bridge breaking under an entity drops it: 10% max life, back to its last safe cell', () => {
    const s = room('.', 30, 20, 100, 40);
    paintRect(s, 40, 30, 60, 50, 'deep_water');
    apply(s, 'frost', { kind: 'line', x0: 36, y0: 40, x1: 64, y1: 40, width: 4 });
    expect(s.grid.ground[idx(s, 50, 40)]).toBe(MAT.ice_bridge);
    place(s, 36, 40);
    run(s, 1);
    place(s, 50, 40);
    s.player.terrain.cell = idx(s, 50, 40);
    // 8 s + 1.5 s cracking at 20 grid ticks per second.
    for (let k = 0; k < 190; k++) stepGrid(s);
    expect(s.grid.ground[idx(s, 50, 40)]).toBe(MAT.deep_water);
    const ev = run(s, 1);
    const fell = ofType(ev, 'fell');
    expect(fell).toHaveLength(1);
    expect(fell[0]).toMatchObject({ target: 'player', fromX: 50, toX: 36, toY: 40 });
    expect(s.player.life).toBeCloseTo(s.player.maxLife * 0.9, 9);
    expect([s.player.x, s.player.y]).toEqual([36, 40]);
    expect(ofType(ev, 'hit')[0]).toMatchObject({ target: 'player', amount: 8 });
  });

  it('rule 25: a burnt-away wooden bridge drops whoever stands on it; a dummy with no safe spot finds the nearest one', () => {
    const s = room('.', 30, 20, 100, 40);
    paintRect(s, 40, 30, 60, 50, 'deep_water');
    paintRect(s, 40, 36, 60, 44, 'wood');
    for (let y = 36; y <= 44; y++) for (let x = 40; x <= 60; x++) s.grid.under[idx(s, x, y)] = MAT.deep_water;
    const d = dummy(s, 50, 40);
    run(s, 1);
    expect(d.terrain.hasSafe).toBe(false);
    apply(s, 'fire', circle(50, 40, 3));
    let fell = false;
    for (let k = 0; k < 60 * 8 && !fell; k++) fell = ofType(run(s, 1), 'fell').length > 0;
    expect(fell).toBe(true);
    expect(s.room.solid[idx(s, d.x, d.y)]).toBe(0);
    expect(s.grid.ground[idx(s, d.x, d.y)]).toBe(MAT.stone); // wood over water isn't safe
  });

  it('rule 25: wood over a pit counts as unsafe, stone as safe', () => {
    const s = room('+', 30, 20, 100, 40);
    run(s, 1);
    expect(s.player.terrain.hasSafe).toBe(false);
    const t = room('.', 30, 20, 100, 40);
    run(t, 1);
    expect(t.player.terrain.hasSafe).toBe(true);
  });
});

describe('charged water and metal (rules 11, 12, entity side)', () => {
  /** A stone room with a 3-cell-high water channel along y 39–41 from x 4 to 70. */
  function channel() {
    const s = room('.', 30, 20, 100, 60);
    paintRect(s, 4, 39, 70, 41, 'shallow_water');
    return s;
  }

  it('hits each entity once per charge event, with the water falloff, as Storm (Shock)', () => {
    const s = channel();
    const near = dummy(s, 22.5, 40.5);
    const far = dummy(s, 60.5, 40.5);
    apply(s, 'storm', circle(20.5, 40.5, 0.1), { hitDamage: 40 });
    const ev = run(s, 30);
    const hits = ofType(ev, 'chargeHit');
    expect(hits.map((h) => h.target).sort()).toEqual([near.id, far.id].sort());
    expect(hits.find((h) => h.target === near.id)!.damage).toBeCloseTo(40 * (1 - 2 / 40), 6);
    expect(hits.find((h) => h.target === far.id)!.damage).toBeCloseTo(40 * 0.25, 6); // the 25% floor
    expect(near.ailments.shock.timeLeft).toBeGreaterThan(0);
  });

  it('an entity stepping into charged water before the charge ends is hit once; the owner team is spared', () => {
    const s = channel();
    place(s, 30.5, 40.5);
    const d = dummy(s, 50.5, 44);
    apply(s, 'storm', circle(20.5, 40.5, 0.1), { hitDamage: 40 });
    run(s, 5);
    expect(d.terrain.chargeIds.every((id) => id === 0)).toBe(true);
    d.y = 40.5;
    const ev = run(s, 10);
    expect(ofType(ev, 'chargeHit').filter((h) => h.target === d.id)).toHaveLength(1);
    expect(ofType(ev, 'chargeHit').some((h) => h.target === 'player')).toBe(false);
  });

  it('charged metal floor hits for 60% of the Storm damage, no falloff; world charge hurts the player', () => {
    const s = room('.', 30, 20, 60.5, 40.5);
    paintRect(s, 4, 39, 70, 41, 'metal_floor');
    const d = dummy(s, 66.5, 40.5);
    apply(s, 'storm', circle(5.5, 40.5, 0.1), { hitDamage: 50, owner: OWNER.world });
    const ev = run(s, 2);
    expect(ofType(ev, 'chargeHit').find((h) => h.target === d.id)!.damage).toBeCloseTo(30, 9);
    expect(ofType(ev, 'chargeHit').find((h) => h.target === 'player')!.damage).toBeCloseTo(30, 9);
  });
});

describe('explosions and death fire', () => {
  it('an oil barrel blast hits every entity in its radius, once', () => {
    const s = room('.', 30, 20, 42, 42.5);
    paintRect(s, 40, 36, 43, 39, 'oil_barrel');
    const d = dummy(s, 46, 38);
    const far = dummy(s, 80, 38);
    apply(s, 'fire', circle(41.5, 37.5, 1));
    const ev = run(s, 90);
    const blasts = ofType(ev, 'explosion');
    expect(blasts).toHaveLength(1);
    const hits = ofType(ev, 'hit').filter((h) => h.damageType === 'fire' && h.amount >= 29);
    expect(hits.map((h) => h.target).sort()).toEqual(['player', d.id].sort());
    expect(far.life).toBe(far.maxLife);
  });

  it('a dying Tinderling leaves a 3×3 enemy-owned fire, unless it was Wet', () => {
    const s = room('.', 30, 20, 100, 40);
    const t = spawnEnemy(s, 'tinderling', 40.3, 40.7);
    killEnemy(s, t, PLAYER_ID, 'hit');
    const [lit] = inCircle(s, 40.5, 40.5, 1.5, burning(s));
    expect(lit).toBe(9);
    expect(s.grid.fire[idx(s, 42, 40)]).toBe(0);
    expect(s.grid.owner[idx(s, 40, 40)]).toBe(OWNER.enemy);
    const w = room('.', 30, 20, 100, 40);
    paintRect(w, 30, 30, 50, 50, 'shallow_water');
    const t2 = spawnEnemy(w, 'tinderling', 40, 40);
    run(w, 1);
    paintRect(w, 30, 30, 50, 50, 'stone');
    killEnemy(w, t2, PLAYER_ID, 'hit');
    expect(w.grid.fire[idx(w, 40, 40)]).toBe(0);
  });
});
