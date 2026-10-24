import { describe, expect, it } from 'vitest';
import { STATION_IDS } from '../../data/hearth';
import { bannersFor, pushToasts, toastsFor, type LooseEvent } from '../../src/ui/adventure/hudEvents';
import { hearthBanner, hearthToast, stationTabFor } from '../../src/ui/hearth/hearthEvents';

const names = {
  rune: (id: string) => id.toUpperCase(),
  item: () => ({ name: 'Wool Cloak', rarity: 'magic' as const }),
  part: () => 'Ember Feather',
};
const opts = { seconds: 3.2, levelSeconds: 5, mergeWindow: 1.2, salvageWindow: 2.5, max: 5 };
const ids = () => {
  let n = 0;
  return () => ++n;
};

describe('station events open screens', () => {
  it('opens the sub-tab of the station used, the last one in a batch', () => {
    expect(stationTabFor([{ type: 'stationUse', station: 'spindlewright' }])).toBe('spindlewright');
    expect(
      stationTabFor([
        { type: 'stationUse', station: 'kindling_pit' },
        { type: 'hit' },
        { type: 'stationUse', station: 'cartographer' },
      ]),
    ).toBe('cartographer');
  });

  it('ignores other events and unknown stations', () => {
    expect(stationTabFor([{ type: 'hit' }, { type: 'roomEnter' }])).toBeNull();
    expect(stationTabFor([{ type: 'stationUse', station: 'nonsense' }])).toBeNull();
    expect(stationTabFor([])).toBeNull();
  });

  it('every station routes somewhere', () => {
    for (const s of STATION_IDS) expect(stationTabFor([{ type: 'stationUse', station: s }])).not.toBeNull();
  });
});

describe('Hearth toasts and banners', () => {
  it('makes a toast for upgrades, returned and collected expeditions and mutations', () => {
    expect(hearthToast({ type: 'buildingUpgraded', building: 'kindling_pit', level: 7 })).toMatchObject({
      kind: 'hearth',
      title: 'Kindling Pit level 7',
    });
    expect(hearthToast({ type: 'expeditionReturned', uid: 1, tier: 2 })).toMatchObject({
      title: 'Expedition back',
      sub: expect.stringContaining('Tier 2'),
    });
    expect(
      hearthToast({ type: 'expeditionCollected', uid: 1, tier: 2, parts: 1, currency: 2, embers: 30 }),
    ).toMatchObject({ title: 'Expedition collected', sub: '1 Fuse part, 2 currency, 30 Embers' });
    expect(hearthToast({ type: 'mutationBought', mutation: 'bright_hearth', count: 3 })).toMatchObject({
      title: 'Bright Hearth',
      sub: 'Mutation: 3 of 10',
    });
    expect(hearthToast({ type: 'mutationBought', mutation: 'twin_threads', count: 1 })!.sub).toBe(
      'Mutation bought',
    );
  });

  it('rejects unknown ids instead of printing undefined', () => {
    expect(hearthToast({ type: 'buildingUpgraded', building: 'moat', level: 1 })).toBeNull();
    expect(hearthToast({ type: 'mutationBought', mutation: 'nope', count: 1 })).toBeNull();
    expect(hearthToast({ type: 'hit' })).toBeNull();
  });

  it('banners the Hearth lighting and a Rekindle', () => {
    expect(hearthBanner({ type: 'hearthLit', embers: 150 })).toEqual({
      title: 'The Hearth is lit',
      sub: 'Travel there from any Loom Stone',
    });
    expect(hearthBanner({ type: 'rekindled', ash: 4, rekindles: 1, maxTier: 12 })).toEqual({
      title: 'Rekindled',
      sub: '+4 Ash · rifts now open up to tier 12',
    });
    expect(bannersFor([{ type: 'hearthLit', embers: 150 }], (k) => k)).toHaveLength(1);
  });

  it('runs through toastsFor with the other events in order', () => {
    const ev: LooseEvent[] = [
      { type: 'levelUp', level: 4 },
      { type: 'buildingUpgraded', building: 'salvage_loom', level: 2 },
      { type: 'autoSalvaged', base: 'x', rarity: 'normal', scrap: 2, x: 0, y: 0 },
    ];
    expect(toastsFor(ev, names).map((t) => t.kind)).toEqual(['level', 'hearth', 'salvage']);
  });

  it('makes no toast for Embers pickups, however many', () => {
    const ev: LooseEvent[] = Array.from({ length: 30 }, () => ({
      type: 'lootPicked',
      content: { kind: 'embers', amount: 3 },
    }));
    ev.push({ type: 'rewardGranted', content: { kind: 'embers', amount: 10 } });
    expect(toastsFor(ev, names)).toEqual([]);
  });

  it('still toasts Thread Scrap pickups', () => {
    const t = toastsFor([{ type: 'lootPicked', content: { kind: 'scrap', amount: 3 } }], names);
    expect(t.map((x) => x.title)).toEqual(['+3 Thread Scrap']);
  });
});

describe('salvage toasts coalesce', () => {
  const salvage = (n: number) =>
    hearthToast({ type: 'autoSalvaged', base: 'x', rarity: 'normal', scrap: n, x: 0, y: 0 })!;

  it('merges salvages within the window into one growing toast', () => {
    const nextId = ids();
    let live = pushToasts([], [salvage(2)], 10, { ...opts, nextId });
    live = pushToasts(live, [salvage(3)], 11.5, { ...opts, nextId });
    live = pushToasts(live, [salvage(1)], 13.4, { ...opts, nextId });
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({
      kind: 'salvage',
      amount: 6,
      title: '+6 Thread Scrap',
      sub: 'Salvage Loom',
    });
  });

  it('starts a new toast after the window', () => {
    const nextId = ids();
    let live = pushToasts([], [salvage(2)], 10, { ...opts, nextId });
    live = pushToasts(live, [salvage(3)], 12.8, { ...opts, nextId });
    expect(live.map((t) => t.amount)).toEqual([2, 3]);
  });

  it('batches several salvages in one step', () => {
    const live = pushToasts([], [salvage(1), salvage(1), salvage(2)], 0, { ...opts, nextId: ids() });
    expect(live).toHaveLength(1);
    expect(live[0]!.amount).toBe(4);
  });

  it("doesn't merge with pickups or other toasts", () => {
    const nextId = ids();
    const pickup = { kind: 'scrap' as const, title: '+3 Thread Scrap', sub: '', rarity: null, amount: 3 };
    let live = pushToasts([], [pickup], 0, { ...opts, nextId });
    live = pushToasts(live, [salvage(2)], 0.5, { ...opts, nextId });
    expect(live.map((t) => t.kind)).toEqual(['scrap', 'salvage']);
    live = pushToasts(
      live,
      [hearthToast({ type: 'expeditionReturned', uid: 1, tier: 1 })!, salvage(1)],
      0.8,
      {
        ...opts,
        nextId,
      },
    );
    expect(live.map((t) => t.kind)).toEqual(['scrap', 'salvage', 'hearth', 'salvage']);
  });

  it('uses the pickup window when no salvage window is given', () => {
    const nextId = ids();
    const o = { seconds: 3.2, levelSeconds: 5, mergeWindow: 1.2, max: 5, nextId };
    let live = pushToasts([], [salvage(2)], 0, o);
    live = pushToasts(live, [salvage(2)], 1.0, o);
    live = pushToasts(live, [salvage(2)], 2.5, o);
    expect(live.map((t) => t.amount)).toEqual([4, 2]);
  });
});
