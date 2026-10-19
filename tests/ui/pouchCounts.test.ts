import { describe, expect, it } from 'vitest';
import { parseWeave } from '../../src/sim/weave';
import { freeCounts, missingRunes, noFreeReason, totalsOf, usedBy } from '../../src/ui/loom/pouchCounts';
import { placements } from '../../src/ui/loom/model';
import type { RuneId } from '../../data/runes';

const tree = (n: string) => {
  const p = parseWeave(n);
  if (!p.ok) throw new Error(n);
  return p.tree;
};
const owned = (...ids: string[]) => totalsOf(ids.map((rune) => ({ rune: rune as RuneId })));

describe('adventure rune pouch counts', () => {
  it('counts every rune a weave uses, branches included', () => {
    const u = usedBy(tree('Cast > Lob[Fire] > OnExpire > Nova[Fire, Wide]'));
    expect(Object.fromEntries(u)).toEqual({ cast: 1, lob: 1, fire: 2, on_expire: 1, nova: 1, wide: 1 });
  });

  it('free = owned minus what all four drafts use', () => {
    const totals = owned('cast', 'cast', 'bolt', 'strike', 'fire', 'fire');
    const free = freeCounts(totals, [tree('Cast > Bolt[Fire]'), tree('Cast > Strike[]')]);
    expect(Object.fromEntries(free)).toEqual({ cast: 0, bolt: 0, strike: 0, fire: 1 });
  });

  it("explains why a rune can't be placed", () => {
    const free = new Map([
      ['fire', 0],
      ['bolt', 1],
    ]);
    expect(noFreeReason(free, 'fire')).toBe('No free Fire rune');
    expect(noFreeReason(free, 'bolt')).toBeNull();
    expect(noFreeReason(free, 'on_hit')).toBe("You don't have an On Hit rune");
    expect(noFreeReason(null, 'fire')).toBeNull();
  });

  it('blocks every spot for a rune with no free copy, with the reason', () => {
    const t = tree('Cast > Bolt[Fire]');
    const unlimited = placements(t, 'split');
    expect(unlimited.some((p) => p.ok)).toBe(true);
    const blocked = placements(t, 'split', { available: new Map([['split', 0]]) });
    expect(blocked.length).toBe(unlimited.length);
    expect(blocked.every((p) => !p.ok && p.reason === 'No free Split rune')).toBe(true);
    expect(placements(t, 'split', { available: new Map([['split', 1]]) }).some((p) => p.ok)).toBe(true);
  });

  it('a reference weave needs runes beyond the free ones and the current slot', () => {
    const free = new Map([
      ['cast', 0],
      ['lob', 1],
      ['fire', 0],
      ['nova', 0],
    ]);
    const current = tree('Cast > Bolt[Fire]');
    expect(missingRunes(tree('Cast > Lob[Fire]'), free, current)).toEqual([]);
    expect(missingRunes(tree('Cast > Lob[Fire] > OnExpire > Nova[Fire, Wide]'), free, current)).toEqual([
      'Fire',
      'On Expire',
      'Nova',
      'Wide',
    ]);
  });
});
