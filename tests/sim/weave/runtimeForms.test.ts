import { describe, expect, it } from 'vitest';
import { Button, rotationDeg } from '../../../src/sim';
import {
  addEnemy,
  baseAmount,
  castFor,
  hitsByTarget,
  ofType,
  releaseTick,
  spawnsOf,
  tick,
  ticks,
  weaveArena,
} from './runtimeHelpers';

const LMB = Button.Cast1;

/** Carves a 1-cell shot-blocking wall at cell column `cx`. */
function thinWall(state: ReturnType<typeof weaveArena>, cx: number): void {
  const r = state.room;
  for (let y = 0; y < r.height; y++) r.shotSolid[y * r.width + cx] = 1;
}

describe('spell forms', () => {
  it('Bolt is a spell instance that also sends the M1 projectile events', () => {
    const state = weaveArena(['Cast > Bolt[Fire]']);
    const ev = ticks(state, releaseTick(0.45), LMB);
    const spawn = spawnsOf(ev, 'bolt');
    expect(spawn).toHaveLength(1);
    expect(spawn[0]).toMatchObject({ depth: 0, elements: ['fire'], x: 80, y: 60, dirX: 1, dirY: 0, slot: 0 });
    expect(ofType(ev, 'projectileSpawn')[0]).toMatchObject({
      kind: 'fire_bolt',
      team: 'player',
      id: spawn[0]!.id,
    });
    expect(state.spells).toHaveLength(1);
    expect(state.projectiles).toHaveLength(0);
    const end = ofType(ticks(state, 60), 'spellEnd');
    expect(end).toMatchObject([{ id: spawn[0]!.id, form: 'bolt', reason: 'expired' }]);
    expect(state.spells).toHaveLength(0);
  });

  it('Nova hits each target once as the ring reaches it, knocking outward; 10 cells + body', () => {
    const state = weaveArena(['Cast > Nova[Fire]']);
    const near = addEnemy(state, 'tinderling', 84, 60);
    near.life = near.maxLife = 1000;
    const mid = addEnemy(state, 'dummy', 80, 69);
    const edge = addEnemy(state, 'dummy', 80 - 11.4, 60);
    const out = addEnemy(state, 'dummy', 80, 60 - 11.6);
    const ev = castFor(state, LMB, releaseTick(0.6), undefined, 20);
    const hits = ofType(ev, 'hit');
    expect(hitsByTarget(ev)).toEqual(
      new Map([
        [near.id, 1],
        [mid.id, 1],
        [edge.id, 1],
      ]),
    );
    expect(hits.findIndex((h) => h.target === near.id)).toBeLessThan(
      hits.findIndex((h) => h.target === mid.id),
    );
    expect(hits.find((h) => h.target === near.id)).toMatchObject({ kbX: 1, kbY: 0 });
    expect(hits.some((h) => h.target === out.id)).toBe(false);
    const end = ofType(ev, 'spellEnd')[0]!;
    expect(end).toMatchObject({ form: 'nova', reason: 'done', x: 80, y: 60 });
  });

  it('Beam hits the first target in line, Pierce more, and walls and shields stop it', () => {
    const state = weaveArena(['Cast > Beam[Fire]', 'Cast > Beam[Fire, Pierce]']);
    const a = addEnemy(state, 'dummy', 90, 60);
    const b = addEnemy(state, 'dummy', 100, 61);
    addEnemy(state, 'dummy', 100, 64); // 4 cells off the line: out of its 1.5 width
    let ev = castFor(state, LMB, releaseTick(0.35), [120, 60]);
    expect(hitsByTarget(ev)).toEqual(new Map([[a.id, 1]]));
    expect(ofType(ev, 'beamFire')[0]).toMatchObject({ fromX: 80, toX: 90, hits: [{ target: a.id }] });
    expect(ofType(ev, 'spellEnd')[0]).toMatchObject({ form: 'beam', reason: 'hit', x: 90 });
    ticks(state, 30);
    ev = castFor(state, Button.Cast2, releaseTick(0.35), [120, 60]);
    expect(hitsByTarget(ev)).toEqual(
      new Map([
        [a.id, 1],
        [b.id, 1],
      ]),
    );
    expect(ofType(ev, 'beamFire')[0]!.toX).toBeCloseTo(125, 9); // full 45 cells

    const walled = weaveArena(['Cast > Beam[Fire]']);
    thinWall(walled, 95);
    const behind = addEnemy(walled, 'dummy', 100, 60);
    ev = castFor(walled, LMB, releaseTick(0.35), [120, 60]);
    expect(hitsByTarget(ev).has(behind.id)).toBe(false);
    expect(ofType(ev, 'beamFire')[0]!.toX).toBe(95);
    expect(ofType(ev, 'spellEnd')[0]!.reason).toBe('wall');

    const shielded = weaveArena(['Cast > Beam[Fire]']);
    const sb = addEnemy(shielded, 'shieldbearer', 95, 60, [-1, 0]);
    ev = castFor(shielded, LMB, releaseTick(0.35), [120, 60]);
    expect(ofType(ev, 'shieldBlock')).toHaveLength(1);
    expect(ofType(ev, 'hit')).toHaveLength(0);
    expect(sb.life).toBe(sb.maxLife);
    expect(ofType(ev, 'spellEnd')[0]!.reason).toBe('blocked');
  });

  it('Lob flies over walls to the aim point (at most 40 cells) and bursts in 5 cells', () => {
    const state = weaveArena(['Cast > Lob[Fire]']);
    thinWall(state, 90);
    const inBurst = addEnemy(state, 'dummy', 105, 60 + 5 + 1.5 - 0.01);
    const outBurst = addEnemy(state, 'dummy', 105, 60 + 5 + 1.5 + 0.01);
    const ev = castFor(state, LMB, releaseTick(0.55), [105, 60], 31);
    expect(ofType(ev, 'lobLand')).toMatchObject([{ x: 105, y: 60, radius: 5 }]);
    expect(hitsByTarget(ev)).toEqual(new Map([[inBurst.id, 1]]));
    expect(outBurst.life).toBe(outBurst.maxLife);
    const far = weaveArena(['Cast > Lob[Fire]']);
    const ev2 = castFor(far, LMB, releaseTick(0.55), [150, 60], 31);
    expect(ofType(ev2, 'lobLand')[0]).toMatchObject({ x: 120, y: 60 });
  });

  it('Lob lands after its 0.5 s flight (30 ticks, counting the release tick)', () => {
    const state = weaveArena(['Cast > Lob[Fire]']);
    const ev = ticks(state, releaseTick(0.55), LMB, [100, 60]);
    expect(spawnsOf(ev, 'lob')).toHaveLength(1);
    expect(ofType(ticks(state, 28), 'lobLand')).toHaveLength(0);
    expect(ofType(tick(state), 'lobLand')).toHaveLength(1);
  });

  it('Orb circles the player at 6 cells, follows them, and hits a target at most every 0.5 s', () => {
    const state = weaveArena(['Cast > Orb[Fire]']);
    const ev = ticks(state, releaseTick(0.5), LMB);
    const orb = state.spells[0]!;
    expect(spawnsOf(ev, 'orb')[0]).toMatchObject({ followsPlayer: true });
    // Released along +x; 15 ticks later (a quarter turn at 1 rev/s, toward +y) it is below the player.
    ticks(state, 14);
    expect(orb.x).toBeCloseTo(state.player.x, 6);
    expect(orb.y).toBeCloseTo(state.player.y + 6, 6);
    ticks(state, 20, 0, undefined, [1, 0]);
    expect(Math.hypot(orb.x - state.player.x, orb.y - state.player.y)).toBeCloseTo(6, 6);

    const s2 = weaveArena(['Cast > Orb[Fire]']);
    const big = addEnemy(s2, 'dummy', 80, 60);
    big.radius = 8; // always touching the orb
    const hitTicks: number[] = [];
    const all = [];
    for (let i = 0; i < 220; i++) {
      const ev = [...tick(s2, i < releaseTick(0.5) ? LMB : 0)];
      if (ev.some((e) => e.type === 'hit' && e.target === big.id)) hitTicks.push(i);
      all.push(...ev);
    }
    // 3 s orb (180 ticks counting its spawn tick): hits on its 1st tick, then every 30 ticks.
    const first = hitTicks[0]!;
    expect(hitTicks).toEqual([0, 30, 60, 90, 120, 150].map((k) => first + k));
    expect(ofType(all, 'spellEnd')[0]).toMatchObject({ form: 'orb', reason: 'expired' });
  });

  it('Swath hits each enemy touching its 14 × 3 strip once', () => {
    const state = weaveArena(['Cast > Swath[Fire]']);
    const a = addEnemy(state, 'dummy', 85, 60);
    const edge = addEnemy(state, 'dummy', 88, 63);
    const tip = addEnemy(state, 'dummy', 95, 60);
    addEnemy(state, 'dummy', 88, 63.1);
    addEnemy(state, 'dummy', 95.6, 60);
    const ev = castFor(state, LMB, releaseTick(0.4), [120, 60], 10);
    expect(hitsByTarget(ev)).toEqual(
      new Map([
        [a.id, 1],
        [edge.id, 1],
        [tip.id, 1],
      ]),
    );
  });

  it('Sigil sits at the aim point (at most 30 cells) for 4 s and only emits', () => {
    const state = weaveArena(['Cast > Sigil[Storm] > Emit > Beam[]']);
    const d = addEnemy(state, 'dummy', 125, 60);
    const ev = castFor(state, LMB, releaseTick(0.5), [140, 60], 260);
    expect(spawnsOf(ev, 'sigil')[0]).toMatchObject({ x: 110, y: 60, toX: 110 });
    expect(spawnsOf(ev, 'beam')).toHaveLength(8);
    expect(hitsByTarget(ev)).toEqual(new Map([[d.id, 8]]));
    expect(ofType(ev, 'spellEnd').filter((e) => e.form === 'sigil')).toMatchObject([{ reason: 'expired' }]);
  });
});

describe('modifiers', () => {
  it('Split fans 3 bolts over 30°, in rotation order', () => {
    const state = weaveArena(['Cast > Bolt[Fire, Split]']);
    const ev = ticks(state, releaseTick(0.45), LMB);
    const dirs = spawnsOf(ev, 'bolt').map((s) => [s.dirX, s.dirY]);
    const r = rotationDeg(15);
    expect(dirs).toHaveLength(3);
    expect(dirs[0]![0]).toBeCloseTo(r.cos, 12);
    expect(dirs[0]![1]).toBeCloseTo(-r.sin, 12);
    expect(dirs[1]).toEqual([1, 0]);
    expect(dirs[2]![1]).toBeCloseTo(r.sin, 12);
  });

  it('Chain jumps to 2 more targets within 12 cells for 15% less each, compounding', () => {
    const state = weaveArena(['Cast > Bolt[Storm, Chain]']);
    const a = addEnemy(state, 'dummy', 90, 60);
    const b = addEnemy(state, 'dummy', 100, 64);
    const c = addEnemy(state, 'dummy', 110, 60);
    const far = addEnemy(state, 'dummy', 135, 60);
    const ev = castFor(state, LMB, releaseTick(0.45), [90, 60], 20);
    const hits = ofType(ev, 'hit');
    expect(hits.map((h) => h.target)).toEqual([a.id, b.id, c.id]);
    expect(far.life).toBe(far.maxLife);
    expect(ofType(ev, 'chainJump').map((j) => j.target)).toEqual([b.id, c.id]);
    const crit = state.weaves.slots[0]!.program!.root.critMultiplier;
    hits.forEach((h, k) => expect(baseAmount(h.amount, h.crit, crit)).toBeCloseTo(12 * 0.85 ** k, 9));
  });

  it('Seeker turns a bolt toward the nearest enemy', () => {
    const plain = weaveArena(['Cast > Bolt[Fire]']);
    addEnemy(plain, 'dummy', 120, 85);
    expect(ofType(castFor(plain, LMB, releaseTick(0.45), [120, 60], 60), 'hit')).toHaveLength(0);
    const state = weaveArena(['Cast > Bolt[Fire, Seeker]']);
    const d = addEnemy(state, 'dummy', 120, 85);
    const ev = castFor(state, LMB, releaseTick(0.45), [120, 60], 60);
    expect(hitsByTarget(ev)).toEqual(new Map([[d.id, 1]]));
  });

  it('Echo repeats 0.35 s later from the same origin and aim, for 20% less', () => {
    const state = weaveArena(['Cast > Strike[Echo]']);
    const d = addEnemy(state, 'dummy', 84, 60);
    const all = [];
    for (let i = 0; i < 40; i++)
      all.push({ i, ev: [...tick(state, i < releaseTick(0.4) ? LMB : 0, [100, 60])] });
    const hitTicks = all.filter((x) => x.ev.some((e) => e.type === 'hit')).map((x) => x.i);
    expect(hitTicks).toEqual([releaseTick(0.4) - 1, releaseTick(0.4) - 1 + 21]);
    const [h1, h2] = all.flatMap((x) => ofType(x.ev, 'hit'));
    const crit = state.weaves.slots[0]!.program!.root.critMultiplier;
    expect(baseAmount(h1!.amount, h1!.crit, crit)).toBeCloseTo(16, 9);
    expect(baseAmount(h2!.amount, h2!.crit, crit)).toBeCloseTo(16 * 0.8, 9);
    expect(
      spawnsOf(
        all.flatMap((x) => x.ev),
        'strike',
      ).map((s) => s.echo),
    ).toEqual([false, true]);
    expect(d.life).toBeLessThan(d.maxLife);
  });

  it('Lingering lengthens the ailments its hits apply by 30%', () => {
    const state = weaveArena(['Cast > Swath[Fire, Lingering]']);
    const d = addEnemy(state, 'dummy', 85, 60);
    castFor(state, LMB, releaseTick(0.4), [120, 60]);
    // The ailment phase of the hit's tick already ran once.
    expect(d.ailments.ignite.timeLeft).toBeCloseTo(3 * 1.3 - 1 / 60, 9);
  });
});
