/** M6 rift views: the map's sigil list, the open rift summary, and rift banners. */
import { describe, expect, it } from 'vitest';
import { bannersFor, toastsFor } from '../../src/ui/adventure/hudEvents';
import { bonusLine, riftSummary, sigilViews } from '../../src/ui/map/riftModel';
import { createWorldState } from '../../src/sim/world/worldState';

describe('rift views', () => {
  const sigils = [
    { uid: 3, tier: 5, mods: ['brutal' as const, 'drought' as const] },
    { uid: 1, tier: 2, mods: [] },
  ];

  it('list sigils lowest tier first, with what blocks opening each', () => {
    const v = sigilViews(sigils, 3, true, false);
    expect(v.map((x) => x.uid)).toEqual([1, 3]);
    expect(v[0]!.blocked).toBeNull();
    expect(v[1]!.blocked).toBe('Complete a tier 4 rift first');
    expect(v[1]!.name).toBe('Brutal Rift Sigil of Drought (Tier 5)');
    expect(v[1]!.areaLevel).toBe(16);
    expect(v[1]!.mods.map((m) => m.kind)).toEqual(['prefix', 'suffix']);
    expect(sigilViews(sigils, 9, false, false)[0]!.blocked).toBe('Stand at a Loom Stone to open it');
    expect(sigilViews(sigils, 9, true, true)[0]!.blocked).toBe('A rift is already open');
  });

  it('say why a sigil above the Rekindle cap cannot open, before the ladder rule', () => {
    const high = [{ uid: 7, tier: 12, mods: [] }];
    expect(sigilViews(high, 11, true, false, 10)[0]!.blocked).toBe('Rekindle to open tiers above 10');
    expect(sigilViews(high, 4, true, false, 10)[0]!.blocked).toBe('Rekindle to open tiers above 10');
    expect(sigilViews(high, 11, true, false, 12)[0]!.blocked).toBeNull();
    expect(sigilViews(high, 11, true, false)[0]!.blocked).toBeNull();
  });

  it('sum the bonuses in one line', () => {
    expect(bonusLine(['brutal', 'drought'])).toBe('+15% item quantity · +20% item rarity');
    expect(bonusLine([])).toBe('');
  });

  it('summarize the open rift: rooms and how many are cleared', () => {
    const w = createWorldState('rift/2/entry');
    expect(riftSummary(w, [])).toBeNull();
    w.rift = {
      spec: { index: 2, seed: 1, tier: 7, mods: ['hasty'], home: { roomId: 'a', key: 'k' } },
      bossDead: false,
    };
    w.flags['rift/2/entry'] = { visited: true, cleared: true, rewardsPaid: false, opened: [], taken: [] };
    const r = riftSummary(w, ['emberwood/e1_glade', 'rift/2/entry', 'rift/2/r1', 'rift/2/boss'])!;
    expect(r).toMatchObject({ tier: 7, rooms: 3, cleared: 1, bossDead: false, bonus: '+15% item quantity' });
  });

  it('banner a completed rift and a collapsed one', () => {
    expect(
      bannersFor(
        [
          { type: 'riftCompleted', tier: 3, newBest: true },
          { type: 'riftClosed', tier: 3, completed: true, reason: 'completed' },
          { type: 'riftClosed', tier: 2, completed: false, reason: 'died' },
        ],
        (k) => k,
      ),
    ).toEqual([
      { title: 'Rift complete', sub: 'Tier 3: your best yet. Tier 4 is open to you' },
      { title: 'The rift collapses', sub: 'Its sigil is spent' },
    ]);
  });
});

describe('the deep-rift lock (M8)', () => {
  const deep = [
    { uid: 4, tier: 9, mods: [] },
    { uid: 5, tier: 8, mods: [] },
  ];

  it('locks tier 9+ sigils with the flooded line until the Coil is dead', () => {
    const v = sigilViews(deep, 8, true, false, 12, false);
    expect(v.map((x) => [x.tier, x.locked])).toEqual([
      [8, false],
      [9, true],
    ]);
    expect(v[0]!.blocked).toBeNull();
    expect(v[1]!.blocked).toBe(
      'The deep rifts are flooded. Calm the Glasswater Coil in the Drowned Foundry to open tier 9 and above.',
    );
    const open = sigilViews(deep, 8, true, false, 12, true);
    expect(open.every((x) => !x.locked)).toBe(true);
    expect(open[1]!.blocked).toBeNull();
  });

  it('shows the lock line away from a Loom Stone too, and an open rift still wins', () => {
    expect(sigilViews(deep, 8, false, false, 12, false)[1]!.blocked).toMatch(/^The deep rifts are flooded/);
    expect(sigilViews(deep, 8, true, true, 12, false)[1]!.blocked).toBe('A rift is already open');
  });
});

describe('the deep-rift toasts (M8)', () => {
  const names = {
    rune: (r: string) => r,
    item: () => ({ name: '', rarity: 'normal' as const }),
    part: () => '',
  };
  it('the storm door hint and the drained rifts', () => {
    expect(toastsFor([{ type: 'stormDoorWoke' }], names).map((t) => t.title)).toEqual([
      "The storm door in Warden's Hearth hums. Something stirs in the Fen.",
    ]);
    expect(toastsFor([{ type: 'bossDefeated', kind: 'glasswater_coil' }], names).map((t) => t.title)).toEqual(
      ['The deep rifts drain. Tiers 9 and up are open.'],
    );
    expect(toastsFor([{ type: 'bossDefeated', kind: 'rift_coil' }], names)).toEqual([]);
  });
});
