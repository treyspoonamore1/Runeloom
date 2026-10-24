/**
 * The fixture Hearth as the screens see it: a session-shaped stand-in the app/hearth.ts readers
 * accept, and an applier that follows the M7 edit rules (src/sim/meta/edits.ts) closely enough
 * for the screens to behave as they will with the real sim. Held outside the sim: the UI never
 * writes sim state.
 */
import { buildings, hearthRoom, rekindle, spindlewrightPrices, type BuildingId } from '../../../data/hearth';
import { currencies, type CurrencyId } from '../../../data/currency';
import type { Session } from '../../app/session';
import type { HearthEdit } from '../../sim/meta/edits';
import { mutationCount } from '../../sim/meta/mutations';
import type { SalvageSetting } from '../../sim/meta/types';
import {
  ashForRekindle,
  expeditionSeconds,
  gardenPlots,
  maxExpeditionTier,
  mutationCost,
  salvageCap,
  upgradeCost,
  weavers,
} from '../../sim/meta/view';
import { fixtureHero } from './store';

/** A session-shaped object over the fixture hero, in the Hearth's room. */
export function fixtureHearthSession(): Session {
  const hero = fixtureHero();
  return {
    state: { hero, room: { id: hearthRoom }, world: { rift: null }, events: [], mode: 'adventure' },
  } as unknown as Session;
}

/** Moves fixture expedition timers on by `dt` seconds (the real sim does it while the loop runs). */
export function fixtureHearthTick(dt: number): void {
  for (const e of fixtureHero().hearth.expeditions) e.left = Math.max(0, e.left - dt);
}

const RARITY_ORDER: SalvageSetting[] = ['off', 'normal', 'magic', 'rare'];

export function fixtureHearthApply(edit: HearthEdit): string | null {
  const hero = fixtureHero();
  const h = hero.hearth;
  if (!h.lit) return 'The Hearth is not lit';
  switch (edit.kind) {
    case 'hearthUpgrade': {
      const level = h.buildings[edit.building];
      if (level >= buildings[edit.building].maxLevel) return 'Max level';
      const cost = upgradeCost(edit.building, level);
      if (h.embers < cost) return `Needs ${cost} Embers`;
      h.embers -= cost;
      h.embersSpent += cost;
      h.buildings[edit.building as BuildingId] = level + 1;
      return null;
    }
    case 'gardenPlant': {
      const r = hero.runes.find((x) => x.uid === edit.uid);
      if (!r) return 'No such rune';
      if (h.garden.includes(r.uid)) return 'Already planted';
      if (h.garden.length >= gardenPlots(h.buildings.rune_garden))
        return 'No free plot: upgrade the Rune Garden';
      h.garden.push(r.uid);
      return null;
    }
    case 'gardenUproot':
      if (!h.garden.includes(edit.uid)) return 'Not planted';
      h.garden = h.garden.filter((u) => u !== edit.uid);
      return null;
    case 'expeditionSend': {
      if (h.expeditions.length >= weavers(h.buildings.expedition_board)) return 'No free Weaver';
      if (edit.tier < 1 || edit.tier > maxExpeditionTier(hero)) return 'That tier is too high';
      const s = expeditionSeconds(hero, edit.tier);
      h.expeditions.push({ uid: hero.nextUid++, tier: edit.tier, left: s, duration: s });
      return null;
    }
    case 'expeditionCollect': {
      const e = h.expeditions.find((x) => x.uid === edit.uid);
      if (!e) return 'No such expedition';
      if (e.left > 0) return 'Not back yet';
      h.expeditions = h.expeditions.filter((x) => x !== e);
      h.embers += 15 * e.tier;
      hero.currency.weavers_knot = (hero.currency.weavers_knot ?? 0) + 1;
      return null;
    }
    case 'salvageSetting':
      if (RARITY_ORDER.indexOf(edit.setting) > RARITY_ORDER.indexOf(salvageCap(h.buildings.salvage_loom)))
        return 'Upgrade the Salvage Loom';
      h.salvage = edit.setting;
      return null;
    case 'spindlewrightBuy': {
      const price = spindlewrightPrices[edit.currency as CurrencyId];
      if (price === undefined || !(edit.currency in currencies)) return 'Not for sale';
      if (hero.threadScrap < price) return `Needs ${price} Thread Scrap`;
      hero.threadScrap -= price;
      hero.currency[edit.currency] = (hero.currency[edit.currency] ?? 0) + 1;
      return null;
    }
    case 'rekindle': {
      if (hero.riftTier < rekindle.unlockTier) return `Complete a tier ${rekindle.unlockTier} rift first`;
      const ash = ashForRekindle(hero);
      h.ash += ash;
      h.rekindles += 1;
      h.embers = 0;
      h.embersSpent = 0;
      h.garden = [];
      h.salvage = 'off';
      for (const b of Object.keys(h.buildings) as BuildingId[]) h.buildings[b] = 0;
      hero.riftTier = 0;
      hero.sigils = [];
      return null;
    }
    case 'mutationBuy': {
      const cost = mutationCost(hero, edit.mutation);
      if (cost === null) return 'Owned';
      if (h.ash < cost) return `Needs ${cost} Ash`;
      h.ash -= cost;
      h.mutations[edit.mutation] = mutationCount(hero, edit.mutation) + 1;
      return null;
    }
    case 'offline':
      return null;
  }
}
