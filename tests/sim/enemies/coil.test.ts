import { describe, expect, it } from 'vitest';
import { placeBorrowedWater, startEnemyAttack } from '../../../src/sim';
import { attackByName } from '../../../data/enemies';
import { eye, hit, put } from './coilHelpers';
import { MAT } from '../../../data/materials';
import { groundAt, idx, ofType, paintRect, run } from './helpers';

/**
 * DESIGN §10.5, CONTENT §5 Glasswater Coil (F10; test/boss_coil is CONTENT §13.3's map): its
 * arena, its states and the damage it takes in each, its lunge, spit, tail thrash and crawl.
 * Phases, pulses, the pylon storm, Overload and ice: coilPhases.test.ts; Tide: coilTide.test.ts.
 */

describe('Glasswater Coil: arena and numbers', () => {
  it('the Glass Eye: 128×96, a 48×40 deep Eye with a 4-cell shallow rim, sluice channels, four pylon pads, four isolated glass flats', () => {
    const { s, c } = eye();
    expect([s.room.width, s.room.height]).toEqual([128, 96]);
    expect([c.maxLife, c.areaLevel, c.radius, c.resist.storm]).toEqual([48000, 24, 5, 0.75]);
    expect([c.x, c.y]).toEqual([62, 46]);
    expect(groundAt(s, 62, 46)).toBe(MAT.deep_water);
    expect(groundAt(s, 41, 30)).toBe(MAT.deep_water);
    expect(groundAt(s, 62, 25)).toBe(MAT.shallow_water);
    expect(groundAt(s, 62, 70)).toBe(MAT.shallow_water);
    expect(groundAt(s, 18, 46)).toBe(MAT.deep_water); // west channel, 12 cells short of the wall
    expect(groundAt(s, 14, 46)).toBe(MAT.stone);
    expect(groundAt(s, 20, 10)).toBe(MAT.shallow_water); // a glass flat
    expect(groundAt(s, 20, 18)).toBe(MAT.stone); // ... apart from the Eye
    expect(groundAt(s, 25, 21)).toBe(MAT.metal_floor); // a pylon pad, touching the rim
    expect(groundAt(s, 36, 26)).toBe(MAT.shallow_water);
    let pylons = 0;
    for (const t of s.room.tiles) if (t === 'M'.charCodeAt(0)) pylons++;
    expect(pylons).toBe(4);
  });

  it('is always Wet and uses the boss chill rule', () => {
    const { s, c } = eye();
    run(s, 2);
    expect(c.terrain.wetLeft).toBeGreaterThan(0);
  });
});

describe('Glasswater Coil: states and damage taken', () => {
  it('Submerged in deep water: 75% less in phase 1, 90% less in phases 2–3', () => {
    const { s, c } = eye();
    put(s, c, 62, 46);
    run(s, 1);
    expect(c.boss!.fen!.coil).toBe('submerged');
    expect(hit(s, c)).toBeCloseTo(25);
    c.boss!.phase = 2;
    expect(hit(s, c)).toBeCloseTo(10);
  });

  it('Surfaced (attacking in deep water), Exposed (in shallows) and Iced take normal damage', () => {
    const { s, c } = eye();
    put(s, c, 62, 46);
    startEnemyAttack(s, c, 0, 1, attackByName('glasswater_coil', 'coil_lunge'), { length: 10 });
    run(s, 1);
    expect(c.boss!.fen!.coil).toBe('surfaced');
    expect(hit(s, c)).toBeCloseTo(100);
    const e = eye();
    put(e.s, e.c, 62, 25); // the rim
    run(e.s, 1);
    expect(e.c.boss!.fen!.coil).toBe('exposed');
    e.c.boss!.phase = 3;
    expect(hit(e.s, e.c)).toBeCloseTo(100);
  });

  it('75% Storm resistance', () => {
    const { s, c } = eye();
    put(s, c, 62, 25);
    run(s, 1);
    expect(hit(s, c, 100, 'storm')).toBeCloseTo(25);
  });

  it('Stranded when its borrowed water goes (rule 31): 50% more, only the tail thrash, and after 5 s it crawls back at 6 cells/s', () => {
    const { s, c } = eye(62, 90);
    // Borrowed water from the rim down onto the south stone; the Coil lies at its end.
    for (let y = 72; y <= 80; y++) placeBorrowedWater(s, 62, y, 2.5, 1);
    put(s, c, 62.5, 78.5);
    run(s, 2);
    expect(c.boss!.fen!.coil).toBe('exposed');
    const ev = run(s, 70);
    expect(ofType(ev, 'swimmerStranded')).toMatchObject([{ id: c.id, stranded: true }]);
    expect(c.boss!.fen!.coil).toBe('stranded');
    expect(hit(s, c)).toBeCloseTo(150);
    // Lies still for 5 s (AI on: it may only thrash; the player is out of reach).
    s.cheats.noAI = false;
    const y0 = c.y;
    run(s, 4 * 60);
    expect(c.y).toBeCloseTo(y0, 5);
    run(s, 70);
    // Then it crawls north toward the rim at 6 cells/s.
    const y1 = c.y;
    run(s, 30);
    expect(y1 - c.y).toBeGreaterThan(2.5);
    expect(y1 - c.y).toBeLessThan(3.2);
    run(s, 3 * 60);
    expect(c.special.stranded).toBe(false);
    expect(groundAt(s, c.x, c.y)).not.toBe(MAT.stone);
  });

  it('Stranded, it thrashes at a player in reach: 0.7 s, a 7-cell circle for 100 with knockback 5; it never lunges', () => {
    const { s, c } = eye(62, 85);
    paintRect(s, 56, 72, 68, 82, 'stone');
    put(s, c, 62, 79);
    s.cheats.noAI = false;
    const ev = run(s, 120);
    expect(c.special.stranded).toBe(true);
    const tel = ofType(ev, 'telegraph').filter((t) => t.id === c.id);
    expect(tel.length).toBeGreaterThan(0);
    expect(tel.every((t) => t.attack === 'tail_thrash')).toBe(true);
    expect(tel[0]!.windup).toBe(0.7);
    const h = ofType(ev, 'hit').find((e) => e.target === 'player' && e.sourceId === c.id)!;
    expect(h.amount).toBe(100);
  });
});

describe('Glasswater Coil: attacks', () => {
  it('Lunge: at a player within 14 cells of its water, a 1.0 s ripple line, then a dash at 44 cells/s that stops at the water\'s edge, 150 on contact', () => {
    const { s, c } = eye(62, 76);
    put(s, c, 62, 62);
    s.cheats.noAI = false;
    c.ai.cooldowns[1] = 99;
    const ev = run(s, 120);
    const tel = ofType(ev, 'telegraph').find((t) => t.attack === 'coil_lunge')!;
    expect(tel.windup).toBe(1);
    expect(c.attack.shape.kind).toBe('line');
    const h = ofType(ev, 'hit').find((e) => e.target === 'player' && e.sourceId === c.id)!;
    expect(h.amount).toBe(150);
    // Its body stayed in the water.
    expect(groundAt(s, c.x, c.y)).not.toBe(MAT.stone);
  });

  it('phases 2–3: no lunge at a player 10 cells from its water', () => {
    const { s, c } = eye(62, 82);
    put(s, c, 62, 64);
    c.boss!.phase = 2;
    s.cheats.noAI = false;
    const ev = run(s, 5 * 60);
    expect(ofType(ev, 'telegraph').filter((t) => t.attack === 'coil_lunge')).toHaveLength(0);
  });

  it('Glass spit: at a player beyond 14 cells of its water, a 0.6 s glow, a 50 cells/s bolt for 70 Storm that leaves a borrowed puddle of radius 2 for 6 s where it lands', () => {
    const { s, c } = eye(62, 90);
    put(s, c, 62, 62);
    s.cheats.noAI = false;
    c.ai.cooldowns[0] = 99;
    s.player.terrain.wetLeft = 0;
    const ev = run(s, 90);
    expect(ofType(ev, 'telegraph').find((t) => t.attack === 'glass_spit')).toMatchObject({ windup: 0.6 });
    const shot = ofType(ev, 'projectileSpawn').find((p) => p.kind === 'glass_spit')!;
    expect(Math.hypot(shot.vx, shot.vy)).toBeCloseTo(50);
    const h = ofType(ev, 'hit').find((e) => e.target === 'player' && e.sourceId === c.id)!;
    expect(h.amount).toBeCloseTo(70 * (1 - s.player.resist.storm), 5);
    const puddle = ofType(ev, 'coilPuddle')[0]!;
    expect(puddle).toMatchObject({ radius: 2, seconds: 6 });
    const i = idx(s, puddle.x, puddle.y);
    expect(s.grid.ground[i]).toBe(MAT.shallow_water);
    expect(s.grid.borrowed[i]).toBe(1);
    s.cheats.noAI = true; // no more spits topping it up
    run(s, 6 * 60 + 10);
    expect(s.grid.ground[i]).toBe(MAT.stone);
  });

  it('phases 2–3: the spit comes in volleys of 3, 0.3 s apart', () => {
    const { s, c } = eye(62, 90);
    put(s, c, 62, 62);
    c.boss!.phase = 2;
    s.cheats.noAI = false;
    c.ai.cooldowns[0] = 99;
    const at: number[] = [];
    for (let i = 0; i < 120 && at.length < 3; i++)
      if (ofType(run(s, 1), 'projectileSpawn').some((p) => p.kind === 'glass_spit')) at.push(s.tick);
    expect(at).toHaveLength(3);
    expect(at[1]! - at[0]!).toBe(18);
    expect(at[2]! - at[1]!).toBe(18);
  });
});
