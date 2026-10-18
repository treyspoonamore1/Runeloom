import { describe, expect, it } from 'vitest';
import { Button, fireProgram } from '../../../src/sim';
import { weaveLimits } from '../../../data/runes';
import { addEnemy, castFor, hitsByTarget, ofType, releaseTick, spawnsOf, weaveArena } from './runtimeHelpers';

const LMB = Button.Cast1;

/** A row of dummies along +y = 60 at the given x positions. */
function row(state: ReturnType<typeof weaveArena>, xs: number[]) {
  return xs.map((x) => addEnemy(state, 'dummy', x, 60));
}

describe('branch proc rules (CONTENT §1.5)', () => {
  it('On Hit fires once per instance; up to 3 times with Pierce', () => {
    const one = weaveArena(['Cast > Bolt[Fire] > OnHit > Nova[Fire]']);
    row(one, [90, 94, 98]);
    let ev = castFor(one, LMB, releaseTick(0.45), [120, 60], 30);
    expect(spawnsOf(ev, 'nova')).toHaveLength(1);

    const pierce = weaveArena(['Cast > Bolt[Fire, Pierce] > OnHit > Swath[Fire]']);
    row(pierce, [90, 100, 110, 120, 130]);
    ev = castFor(pierce, LMB, releaseTick(0.45), [140, 60], 60);
    expect(spawnsOf(ev, 'swath')).toHaveLength(3);
    expect(ofType(ev, 'spellSpawn').filter((s) => s.depth === 1)).toHaveLength(3);
  });

  it('area forms fire On Hit on their first target only', () => {
    const state = weaveArena(['Cast > Nova[Fire] > OnHit > Bolt[Fire]']);
    const [a] = row(state, [83, 86, 89]);
    const ev = castFor(state, LMB, releaseTick(0.6), [120, 60], 20);
    const kids = spawnsOf(ev, 'bolt');
    expect(kids).toHaveLength(1);
    expect(kids[0]).toMatchObject({ x: a!.x, y: a!.y, depth: 1 });
  });

  it('Bolt, Beam and Orb children can’t hit the entity they spawned from; Nova children can', () => {
    const state = weaveArena(['Cast > Bolt[Fire] > OnHit > Bolt[Fire]']);
    const [a, b] = row(state, [90, 110]);
    const ev = castFor(state, LMB, releaseTick(0.45), [120, 60], 40);
    expect(hitsByTarget(ev)).toEqual(
      new Map([
        [a!.id, 1],
        [b!.id, 1],
      ]),
    );

    const nova = weaveArena(['Cast > Bolt[Fire] > OnHit > Nova[Fire]']);
    const [c] = row(nova, [90]);
    expect(hitsByTarget(castFor(nova, LMB, releaseTick(0.45), [120, 60], 30))).toEqual(new Map([[c!.id, 2]]));
  });

  it('On Expire fires once where the instance ends: out of life, on an enemy, or at a wall', () => {
    const expired = weaveArena(['Cast > Bolt[Fire] > OnExpire > Nova[Fire]']);
    let ev = castFor(expired, LMB, releaseTick(0.45), [150, 60], 60);
    const n1 = spawnsOf(ev, 'nova');
    expect(n1).toHaveLength(1);
    expect(n1[0]!.x).toBeCloseTo(80 + 70 * 0.9, 6);

    const onEnemy = weaveArena(['Cast > Bolt[Fire] > OnExpire > Nova[Fire]']);
    row(onEnemy, [100]);
    ev = castFor(onEnemy, LMB, releaseTick(0.45), [150, 60], 60);
    const n2 = spawnsOf(ev, 'nova');
    expect(n2).toHaveLength(1);
    expect(n2[0]!.x).toBeLessThan(100);
    expect(n2[0]!.x).toBeGreaterThan(100 - 1.5 - 1 - 0.6);

    const wall = weaveArena(['Cast > Bolt[Fire] > OnExpire > Nova[Fire]']);
    wall.player.x = wall.player.prevX = 140;
    ev = castFor(wall, LMB, releaseTick(0.45), [180, 60], 60);
    expect(ofType(ev, 'spellEnd').find((e) => e.form === 'bolt')!.reason).toBe('wall');
    expect(spawnsOf(ev, 'nova')[0]!.x).toBeGreaterThan(150);
  });

  it('On Kill fires once per kill, from the target, aimed away from the caster; dummies never die', () => {
    const state = weaveArena(['Cast > Strike[] > OnKill > Bolt[Fire]']);
    const a = addEnemy(state, 'tinderling', 84, 57);
    const b = addEnemy(state, 'tinderling', 84, 63);
    const c = addEnemy(state, 'tinderling', 85, 60);
    a.life = b.life = 1;
    c.life = c.maxLife = 1000;
    const ev = castFor(state, LMB, releaseTick(0.4), [100, 60], 1);
    const kids = spawnsOf(ev, 'bolt');
    expect(kids).toHaveLength(2);
    for (const [k, e] of [
      [kids[0]!, a],
      [kids[1]!, b],
    ] as const) {
      expect(k).toMatchObject({ x: e.x, y: e.y });
      const len = Math.hypot(e.x - 80, e.y - 60);
      expect(k.dirX).toBeCloseTo((e.x - 80) / len, 9);
    }
    const dummies = weaveArena(['Cast > Strike[] > OnKill > Bolt[Fire]']);
    const d = addEnemy(dummies, 'dummy', 84, 60);
    d.life = 1;
    expect(spawnsOf(castFor(dummies, LMB, releaseTick(0.4), [100, 60], 1), 'bolt')).toHaveLength(0);
    expect(d.life).toBe(d.maxLife);
  });

  it('Emit fires every 0.5 s at the nearest enemy within 30 cells, skipping when there is none', () => {
    const state = weaveArena(['Cast > Sigil[Fire] > Emit > Bolt[]']);
    const ev = castFor(state, LMB, releaseTick(0.5), [100, 60], 260);
    expect(spawnsOf(ev, 'sigil')).toHaveLength(1);
    expect(spawnsOf(ev, 'bolt')).toHaveLength(0);
    const near = weaveArena(['Cast > Sigil[Fire] > Emit > Bolt[]']);
    const d = addEnemy(near, 'dummy', 100, 85);
    const ev2 = castFor(near, LMB, releaseTick(0.5), [100, 60], 260);
    const kids = spawnsOf(ev2, 'bolt');
    expect(kids).toHaveLength(8);
    expect(kids[0]).toMatchObject({ x: 100, y: 60, dirX: 0, dirY: 1, elements: ['fire'] });
    expect(hitsByTarget(ev2).get(d.id)).toBe(8);
  });
});

describe('spawn caps', () => {
  it('one cast creates at most 64 instances across its tree; extra spawns are dropped and counted', () => {
    const notation =
      'Cast > Bolt[Storm, Split] > OnHit > Bolt[Split] > OnHit > Bolt[Split] > OnHit > Bolt[Split]';
    const state = weaveArena([notation], 22);
    // A wall of dummies in front: every bolt finds a target until the tree is exhausted.
    for (let y = 30; y <= 90; y += 3) for (let x = 95; x <= 140; x += 3) addEnemy(state, 'dummy', x, y);
    const ev = castFor(state, LMB, releaseTick(0.45), [120, 60], 120);
    const spawned = ofType(ev, 'spellSpawn').length;
    const dropped = ofType(ev, 'spawnDropped');
    expect(spawned).toBe(64);
    expect(dropped.length).toBeGreaterThan(0);
    expect(state.stats.dropped).toBe(dropped.length);
    expect(state.casts).toHaveLength(0);
  });

  it(`at most ${weaveLimits.maxLivePlayerInstances} player instances live; the oldest expire without On Expire`, () => {
    const state = weaveArena([
      'Cast > Sigil[Fire] > Emit > Bolt[Fire]',
      'Cast > Sigil[Fire] { Emit > Bolt[Fire]; OnExpire > Nova[Fire] }',
    ]);
    const plain = state.weaves.slots[0]!.program!;
    const expiring = state.weaves.slots[1]!.program!;
    const cap = weaveLimits.maxLivePlayerInstances;
    fireProgram(state, 1, expiring, 80, 60, 1, 0, 90, 60, -1, true);
    for (let i = 0; i < cap + 4; i++) fireProgram(state, 0, plain, 80, 60, 1, 0, 90, 60, -1, true);
    expect(state.stats.spells).toBe(cap);
    expect(state.stats.evicted).toBe(5);
    const ends = ofType(state.events, 'spellEnd');
    expect(ends).toHaveLength(5);
    expect(ends.every((e) => e.reason === 'evicted')).toBe(true);
    expect(spawnsOf(state.events, 'nova')).toHaveLength(0);
    expect(state.spells.filter((s) => !s.ended)).toHaveLength(cap);
  });
});
