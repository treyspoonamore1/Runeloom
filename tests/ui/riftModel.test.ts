/** M6 rift views: the map's sigil list, the open rift summary, and rift banners. */
import { describe, expect, it } from 'vitest';
import { bannersFor } from '../../src/ui/adventure/hudEvents';
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
