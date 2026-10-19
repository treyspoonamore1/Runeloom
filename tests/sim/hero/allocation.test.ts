import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '../../../src/sim';
import { applyHeroEdit } from '../../../src/sim/hero/edits';
import {
  allocateBlocker,
  canAllocate,
  passivePath,
  passivePoints,
  passivePointsAvailable,
  refundCheck,
  refundCost,
} from '../../../src/sim/hero/passives';
import { loadRoomText } from '../../../tools/lib/rooms';

function game(level = 5, seeds = 0): GameState {
  const s = createGame({ seed: 1, roomText: loadRoomText('test/m0_room') });
  s.hero.level = level;
  s.hero.patternSeeds = seeds;
  return s;
}

describe('passive points and allocation (DESIGN §9)', () => {
  it('points = level − 1 + Pattern Seeds', () => {
    expect(passivePoints(game(1).hero)).toBe(0);
    expect(passivePoints(game(12, 2).hero)).toBe(13);
    const s = game(3, 1);
    expect(passivePointsAvailable(s.hero)).toBe(3);
    s.hero.passives.push('weaver_n');
    expect(passivePointsAvailable(s.hero)).toBe(2);
  });

  it('a node must connect to the allocated set (the start counts)', () => {
    const s = game(5);
    expect(canAllocate(s.hero, 'weaver_n')).toBe(true);
    expect(allocateBlocker(s.hero, 'ember_s1')).toMatch(/isn't connected/);
    expect(applyHeroEdit(s, { kind: 'allocate', node: 'weaver_n' })).toBeNull();
    expect(applyHeroEdit(s, { kind: 'allocate', node: 'ember_s1' })).toBeNull();
    expect(s.hero.passives).toEqual(['weaver_n', 'ember_s1']);
    expect(s.heroMods.castSpeedInc).toBeCloseTo(0.03);
    expect(s.heroMods.damageInc.fire).toBeCloseTo(0.08);
  });

  it('refuses without points, twice, unknown nodes and the start', () => {
    const s = game(2);
    expect(applyHeroEdit(s, { kind: 'allocate', node: 'weaver_n' })).toBeNull();
    expect(applyHeroEdit(s, { kind: 'allocate', node: 'weaver_ne' })).toBe('No passive points left');
    s.hero.level = 5;
    expect(applyHeroEdit(s, { kind: 'allocate', node: 'weaver_n' })).toMatch(/already allocated/);
    expect(applyHeroEdit(s, { kind: 'allocate', node: 'start' })).toMatch(/already allocated/);
    expect(applyHeroEdit(s, { kind: 'allocate', node: 'nope' })).toMatch(/Unknown passive/);
    expect(s.hero.passives).toEqual(['weaver_n']);
  });

  it('refunds only nodes whose removal keeps the tree connected', () => {
    const s = game(9);
    for (const n of ['weaver_n', 'weaver_ne', 'weaver_se', 'tempest_s1'])
      expect(applyHeroEdit(s, { kind: 'allocate', node: n })).toBeNull();
    // weaver_se holds tempest_s1 (via start? no: start–weaver_se–tempest_s1 is the only route).
    expect(refundCheck(s.hero, 'weaver_se').reason).toMatch(/disconnect/);
    // weaver_ne sits on a cycle (start–n–ne–se–start): removable.
    expect(refundCheck(s.hero, 'weaver_ne')).toEqual({ ok: true, reason: null, cost: 0 });
    expect(applyHeroEdit(s, { kind: 'refund', node: 'weaver_ne' })).toBeNull();
    expect(s.hero.passives).toEqual(['weaver_n', 'weaver_se', 'tempest_s1']);
    expect(refundCheck(s.hero, 'start').ok).toBe(false);
    expect(refundCheck(s.hero, 'weaver_s').reason).toMatch(/isn't allocated/);
  });

  it('respec is free below level 10, then 1 Thread Scrap per point', () => {
    const s = game(9);
    applyHeroEdit(s, { kind: 'allocate', node: 'weaver_n' });
    expect(refundCost(s.hero)).toBe(0);
    s.hero.level = 10;
    expect(refundCheck(s.hero, 'weaver_n').reason).toBe('Needs 1 Thread Scrap');
    s.hero.threadScrap = 3;
    expect(applyHeroEdit(s, { kind: 'refund', node: 'weaver_n' })).toBeNull();
    expect(s.hero.threadScrap).toBe(2);
    expect(s.hero.passives).toEqual([]);
    expect(s.heroMods.castSpeedInc).toBe(0);
  });

  it('path preview: the nodes to take, in order, ending at the target', () => {
    const s = game(1);
    expect(passivePath(s.hero, 'ember_s2')).toEqual(['weaver_n', 'ember_s1', 'ember_s2']);
    s.hero.passives.push('weaver_n');
    expect(passivePath(s.hero, 'ember_s2')).toEqual(['ember_s1', 'ember_s2']);
    expect(passivePath(s.hero, 'weaver_n')).toEqual([]);
    expect(passivePath(s.hero, 'nope')).toBeNull();
    expect(passivePath(s.hero, 'wildheart')!.at(-1)).toBe('wildheart');
  });

  it('allocating changes the state hash (hero.passives is hashed)', async () => {
    const { hashState } = await import('../../../src/sim');
    const a = game(5);
    const b = game(5);
    applyHeroEdit(b, { kind: 'allocate', node: 'weaver_n' });
    expect(hashState(a)).not.toBe(hashState(b));
  });
});
