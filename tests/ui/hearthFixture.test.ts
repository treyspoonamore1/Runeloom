import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { upgradeCost } from '../../src/sim/meta/view';
import { demoHero } from '../../src/ui/fixtures/hero';
import { fixtureHearthApply, fixtureHearthTick } from '../../src/ui/fixtures/hearthStore';
import { setFixtures } from '../../src/ui/fixtures/mode';
import { fixtureHero, setFixtureHero } from '../../src/ui/fixtures/store';
import { readHearth, sendHearth } from '../../src/ui/hearth/adapter';
import type { Session } from '../../src/app/session';

/** The fixture Hearth follows the edit rules the screens rely on (src/sim/meta/edits.ts). */
describe('fixture Hearth', () => {
  beforeEach(() => {
    setFixtures(true);
    setFixtureHero(demoHero());
  });
  afterAll(() => setFixtures(false));
  const h = () => fixtureHero().hearth;

  it('starts lit, mid-game, with two planted runes, an expedition out and one back', () => {
    expect(h().lit).toBe(true);
    expect(h().garden).toHaveLength(2);
    expect(h().expeditions.map((e) => e.left > 0)).toEqual([true, false]);
    expect(h().ash).toBeGreaterThan(0);
    expect(Object.keys(h().mutations).length).toBeGreaterThanOrEqual(2);
  });

  it('upgrades a building for Embers and refuses when short', () => {
    const lvl = h().buildings.kindling_pit;
    const cost = upgradeCost('kindling_pit', lvl);
    const before = h().embers;
    expect(fixtureHearthApply({ kind: 'hearthUpgrade', building: 'kindling_pit' })).toBeNull();
    expect(h().buildings.kindling_pit).toBe(lvl + 1);
    expect(h().embers).toBe(before - cost);
    expect(h().embersSpent).toBeGreaterThanOrEqual(cost);
    h().embers = 1;
    expect(fixtureHearthApply({ kind: 'hearthUpgrade', building: 'kindling_pit' })).toMatch(
      /^Needs \d+ Embers$/,
    );
    h().buildings.salvage_loom = 10;
    expect(fixtureHearthApply({ kind: 'hearthUpgrade', building: 'salvage_loom' })).toBe('Max level');
  });

  it('plants into free plots only, and uproots', () => {
    const spare = fixtureHero().runes.find((r) => !h().garden.includes(r.uid))!;
    expect(fixtureHearthApply({ kind: 'gardenPlant', uid: spare.uid })).toMatch(/No free plot/);
    const first = h().garden[0]!;
    expect(fixtureHearthApply({ kind: 'gardenUproot', uid: first })).toBeNull();
    expect(fixtureHearthApply({ kind: 'gardenUproot', uid: first })).toBe('Not planted');
    expect(fixtureHearthApply({ kind: 'gardenPlant', uid: spare.uid })).toBeNull();
    expect(h().garden).toContain(spare.uid);
  });

  it('collects only what is back, and sends only on a free Weaver', () => {
    const [out, back] = h().expeditions;
    expect(fixtureHearthApply({ kind: 'expeditionCollect', uid: out!.uid })).toBe('Not back yet');
    expect(fixtureHearthApply({ kind: 'expeditionSend', tier: 1 })).toBe('No free Weaver');
    const embers = h().embers;
    expect(fixtureHearthApply({ kind: 'expeditionCollect', uid: back!.uid })).toBeNull();
    expect(h().embers).toBeGreaterThan(embers);
    expect(fixtureHearthApply({ kind: 'expeditionSend', tier: 99 })).toMatch(/too high/);
    expect(fixtureHearthApply({ kind: 'expeditionSend', tier: 4 })).toBeNull();
    expect(h().expeditions.at(-1)).toMatchObject({ tier: 4 });
  });

  it('counts expeditions down and stops at ready', () => {
    fixtureHearthTick(100);
    expect(h().expeditions[0]!.left).toBeCloseTo(312);
    fixtureHearthTick(10_000);
    expect(h().expeditions.every((e) => e.left === 0)).toBe(true);
  });

  it('limits the Salvage Loom setting to what its level allows', () => {
    h().buildings.salvage_loom = 5; // up to Magic
    expect(fixtureHearthApply({ kind: 'salvageSetting', setting: 'magic' })).toBeNull();
    expect(fixtureHearthApply({ kind: 'salvageSetting', setting: 'rare' })).toBe('Upgrade the Salvage Loom');
    expect(h().salvage).toBe('magic');
  });

  it('sells currency for Thread Scrap', () => {
    const hero = fixtureHero();
    const had = hero.currency.chaos_skein ?? 0;
    const scrap = hero.threadScrap;
    expect(fixtureHearthApply({ kind: 'spindlewrightBuy', currency: 'chaos_skein' })).toBeNull();
    expect(hero.currency.chaos_skein).toBe(had + 1);
    expect(hero.threadScrap).toBe(scrap - 25);
    hero.threadScrap = 3;
    expect(fixtureHearthApply({ kind: 'spindlewrightBuy', currency: 'chaos_skein' })).toBe(
      'Needs 25 Thread Scrap',
    );
  });

  it('rekindles for Ash and resets what DESIGN §11 says, keeping the rest', () => {
    const hero = fixtureHero();
    const ash = h().ash;
    const keepScrap = hero.threadScrap;
    expect(fixtureHearthApply({ kind: 'rekindle' })).toBeNull();
    expect(h().ash).toBeGreaterThan(ash);
    expect(h().rekindles).toBe(2);
    expect(h().embers).toBe(0);
    expect(Object.values(h().buildings)).toEqual([0, 0, 0, 0]);
    expect(h().garden).toEqual([]);
    expect(hero.riftTier).toBe(0);
    expect(hero.threadScrap).toBe(keepScrap);
    expect(h().mutations.bright_hearth).toBe(3);
    expect(fixtureHearthApply({ kind: 'rekindle' })).toMatch(/Complete a tier 8 rift first/);
  });

  it('buys mutations with Ash up to their maximum', () => {
    h().ash = 1;
    expect(fixtureHearthApply({ kind: 'mutationBuy', mutation: 'deeper_weave' })).toBe('Needs 3 Ash');
    expect(fixtureHearthApply({ kind: 'mutationBuy', mutation: 'bright_hearth' })).toBeNull();
    expect(h().mutations.bright_hearth).toBe(4);
    expect(h().ash).toBe(0);
    expect(fixtureHearthApply({ kind: 'mutationBuy', mutation: 'shatterpoint' })).toBe('Owned');
  });
});

describe('the Hearth adapter in fixture mode', () => {
  beforeEach(() => {
    setFixtures(true);
    setFixtureHero(demoHero());
  });
  afterAll(() => setFixtures(false));
  const session = {} as Session;

  it('reads everything a screen shows', () => {
    const s = readHearth(session);
    expect(s.summary).toMatchObject({ lit: true, inHearth: true, expeditionsReady: 1 });
    expect(s.buildings.map((b) => b.id)).toEqual([
      'kindling_pit',
      'rune_garden',
      'expedition_board',
      'salvage_loom',
    ]);
    expect(s.garden.planted).toHaveLength(2);
    expect(s.garden.plantable.length).toBeGreaterThan(5);
    expect(s.garden.plantable.some((r) => s.garden.planted.includes(r))).toBe(false);
    expect(s.trade).toHaveLength(7);
    expect(s.mutations).toHaveLength(8);
    expect(s.rates.scrapPerMinute).toBeGreaterThan(0);
    expect(s.rates.planted).toBe(2);
    expect(s.scrap).toBe(148);
  });

  it('shows the blocker text when an upgrade is out of reach', () => {
    const b = readHearth(session).buildings.find((x) => x.id === 'expedition_board')!;
    expect(b.cost).toBeGreaterThan(readHearth(session).summary.embers);
    expect(b.blocker).toBe(`Needs ${b.cost} Embers`);
  });

  it('returns the edit refusal text as the error', () => {
    fixtureHero().hearth.embers = 0;
    expect(sendHearth(session, { kind: 'hearthUpgrade', building: 'kindling_pit' })).toMatch(/^Needs/);
    expect(sendHearth(session, { kind: 'gardenUproot', uid: 99999 })).toBe('Not planted');
  });
});
