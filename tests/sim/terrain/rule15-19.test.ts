import { describe, expect, it } from 'vitest';
import { applyIgnite, isOiled, isWet, makePacket, PLAYER_ID, spawnEnemy, applyHit } from '../../../src/sim';
import { hitWith } from '../combat/helpers';
import { apply, dummy, idx, MAT, oilRect, ofType, OWNER, paintRect, place, room, run } from './helpers';

/** DESIGN §6.3 rules 15–19: what the grid does to entities standing on it. */

const circle = (x: number, y: number, r: number) => ({ kind: 'circle' as const, x, y, r });

describe('rule 15: Wet', () => {
  it('rule 15: shallow water wets the player and enemies, refreshed to 3 s after leaving', () => {
    const s = room('.');
    paintRect(s, 30, 30, 50, 50, 'shallow_water');
    place(s, 40, 40);
    const d = dummy(s, 45, 45);
    const ev = run(s, 1);
    expect(isWet(s.player)).toBe(true);
    expect(isWet(d)).toBe(true);
    expect(ofType(ev, 'wetChanged').map((e) => [e.target, e.wet])).toEqual([
      ['player', true],
      [d.id, true],
    ]);
    run(s, 60);
    expect(s.player.terrain.wetLeft).toBeCloseTo(3, 9);
    place(s, 70, 40); // out on stone
    run(s, 175);
    expect(isWet(s.player)).toBe(true);
    const dry = run(s, 10);
    expect(isWet(s.player)).toBe(false);
    expect(ofType(dry, 'wetChanged')).toEqual([
      { type: 'wetChanged', target: 'player', wet: false, x: 70, y: 40 },
    ]);
  });

  it('rule 15: Wet puts out and prevents Ignite', () => {
    const s = room('.');
    paintRect(s, 30, 30, 50, 50, 'shallow_water');
    const d = dummy(s, 60, 40);
    hitWith(s, d, 20, 'fire');
    expect(d.ailments.ignite.timeLeft).toBeGreaterThan(0);
    d.x = 40;
    const ev = run(s, 1);
    expect(d.ailments.ignite.timeLeft).toBe(0);
    expect(ofType(ev, 'ailmentEnded').some((e) => e.ailment === 'ignite')).toBe(true);
    hitWith(s, d, 20, 'fire');
    expect(d.ailments.ignite.timeLeft).toBe(0);
    expect(applyIgnite(s, d, 10, 3, PLAYER_ID)).toBe(false);
  });

  it('rule 15: Wet multiplies chill gain by 1.5', () => {
    const s = room('.');
    paintRect(s, 30, 30, 50, 50, 'shallow_water');
    const wet = dummy(s, 40, 40);
    const dry = dummy(s, 80, 40);
    run(s, 1);
    hitWith(s, wet, 50, 'frost');
    hitWith(s, dry, 50, 'frost');
    expect(wet.ailments.chill / dry.ailments.chill).toBeCloseTo(1.5, 9);
  });
});

describe('rule 16: burning ground', () => {
  it('rule 16: player fire ignites enemies at terrain-fire DPS, never the player', () => {
    const s = room('.', 30, 20, 40, 40);
    const d = dummy(s, 60, 40);
    apply(s, 'fire', circle(40, 40, 3), { durationMult: 4 });
    apply(s, 'fire', circle(60, 40, 3), { durationMult: 4 });
    run(s, 1);
    expect(s.player.ailments.ignite.timeLeft).toBe(0);
    expect(d.ailments.ignite.dps).toBeCloseTo(5, 9); // 10% of refLife(1) = 50
    expect(d.ailments.ignite.owner).toBe(OWNER.player);
  });

  it('rule 16: world fire hurts everyone; enemy fire hurts the player but not enemies', () => {
    const s = room('.', 30, 20, 40, 40);
    const d = dummy(s, 60, 40);
    apply(s, 'fire', circle(40, 40, 3), { owner: OWNER.enemy, durationMult: 4 });
    apply(s, 'fire', circle(60, 40, 3), { owner: OWNER.enemy, durationMult: 4 });
    run(s, 1);
    expect(s.player.ailments.ignite.dps).toBeCloseTo(5, 9);
    expect(d.ailments.ignite.timeLeft).toBe(0);
    apply(s, 'fire', circle(60, 40, 3), { owner: OWNER.world, durationMult: 4 });
    run(s, 1);
    expect(d.ailments.ignite.dps).toBeCloseTo(5, 9);
  });

  it('rule 16: refreshed while standing in it; doubled on burning oil; scaled by area level and fire resistance', () => {
    const s = room('.', 30, 20, 40, 40, 3);
    const d = dummy(s, 60, 40);
    apply(s, 'fire', circle(40, 40, 3), { owner: OWNER.world, durationMult: 3 });
    run(s, 150);
    const ref = 50 * 1.12 * 1.12 * 0.1;
    expect(s.player.ailments.ignite.dps).toBeCloseTo(ref, 9);
    expect(s.player.ailments.ignite.timeLeft).toBeGreaterThan(2.9);
    oilRect(s, 58, 38, 62, 42);
    apply(s, 'fire', circle(60, 40, 2));
    run(s, 1);
    expect(d.ailments.ignite.dps).toBeCloseTo(ref * 2, 9);
    const archer = spawnEnemy(s, 'ember_archer', 80, 40);
    apply(s, 'fire', circle(80, 40, 2));
    run(s, 1);
    expect(archer.ailments.ignite.dps).toBeCloseTo(ref * 0.5, 9);
  });

  it('rule 16: dodging (i-frames) through fire does not ignite', () => {
    const s = room('.', 30, 20, 40, 40);
    apply(s, 'fire', circle(40, 40, 3), { owner: OWNER.world, durationMult: 4 });
    s.player.iframesLeft = 1;
    run(s, 10);
    expect(s.player.ailments.ignite.timeLeft).toBe(0);
  });
});

describe('rules 17 and 18: Oiled', () => {
  it('rule 17: oil makes entities Oiled for 5 s after leaving it', () => {
    const s = room('.', 30, 20, 40, 40);
    oilRect(s, 36, 36, 44, 44);
    const ev = run(s, 1);
    expect(isOiled(s.player)).toBe(true);
    expect(ofType(ev, 'oiledChanged')).toHaveLength(1);
    place(s, 70, 40);
    run(s, 295);
    expect(isOiled(s.player)).toBe(true);
    run(s, 10);
    expect(isOiled(s.player)).toBe(false);
  });

  it('rule 18: an Oiled entity takes double Ignite damage', () => {
    const s = room('.', 30, 20, 40, 40);
    oilRect(s, 56, 36, 64, 44);
    const oiled = dummy(s, 60, 40);
    const clean = dummy(s, 90, 40);
    run(s, 1);
    for (const d of [oiled, clean]) applyIgnite(s, d, 10, 3, PLAYER_ID);
    const a = oiled.life;
    const b = clean.life;
    run(s, 60);
    expect((a - oiled.life) / (b - clean.life)).toBeCloseTo(2, 6);
  });

  it('rule 18: an Oiled, Ignited entity leaves burning cells behind it, owned by its igniter', () => {
    const s = room('.', 30, 20, 30, 40);
    oilRect(s, 26, 36, 34, 44);
    run(s, 1);
    place(s, 40, 40);
    applyIgnite(s, s.player, 3, 3, 5); // an enemy (id 5) ignited the player
    run(s, 30, 0, undefined, [1, 0]);
    const lit: number[] = [];
    for (let x = 41; x < Math.floor(s.player.x) - 1; x++) if (s.grid.fire[idx(s, x, 40)]! > 0) lit.push(x);
    expect(lit.length).toBeGreaterThan(5);
    expect(s.grid.owner[idx(s, lit[0]!, 40)]).toBe(OWNER.enemy);
    expect(s.grid.ground[idx(s, lit[0]!, 40)]).toBe(MAT.stone);
  });
});

describe('rule 19: arcs between Wet entities', () => {
  it('rule 19: a Shock on a Wet enemy arcs to the 5 nearest other Wet enemies within 6 cells, 30% damage, same Shock', () => {
    const s = room('.', 30, 20, 100, 40);
    paintRect(s, 20, 20, 60, 60, 'shallow_water');
    const center = dummy(s, 40, 40);
    const near = [
      [43, 40],
      [37, 40],
      [40, 43.5],
      [40, 36],
      [44, 44],
      [35.5, 43.5],
    ].map(([x, y]) => dummy(s, x!, y!));
    const far = dummy(s, 50, 40);
    paintRect(s, 61, 30, 70, 50, 'stone');
    const dry = dummy(s, 62, 40); // dry, and too far anyway
    run(s, 1);
    const before = new Map([...near, far, dry].map((d) => [d.id, d.life]));
    s.events.length = 0;
    hitWith(s, center, 40, 'storm');
    const arcs = ofType(s.events, 'arc');
    expect(arcs).toHaveLength(5);
    const hitIds = new Set(arcs.map((a) => a.to));
    expect(hitIds.has(near[5]!.id)).toBe(false); // the farthest of six
    for (const d of near.slice(0, 5)) {
      expect(before.get(d.id)! - d.life).toBeCloseTo(12, 6);
      expect(d.ailments.shock.effect).toBeCloseTo(center.ailments.shock.effect, 9);
    }
    expect(far.life).toBe(before.get(far.id));
    // One generation: the arcs didn't arc on.
    expect(ofType(s.events, 'hit')).toHaveLength(6);
  });

  it('rule 19: a dry target does not arc, and the player is never arced by their own shock', () => {
    const s = room('.', 30, 20, 42, 40);
    paintRect(s, 20, 20, 60, 60, 'shallow_water');
    const wet = dummy(s, 38, 40);
    run(s, 1);
    s.events.length = 0;
    hitWith(s, wet, 40, 'storm');
    expect(ofType(s.events, 'arc')).toHaveLength(0);
    // An enemy's shock on a wet enemy reaches the wet player instead.
    s.events.length = 0;
    applyHit(s, wet, makePacket(40, { storm: 1 }, 0, 1.5), { sourceId: 99, dirX: 0, dirY: 0, knockback: 0 });
    expect(ofType(s.events, 'arc').map((a) => a.to)).toEqual(['player']);
  });
});
