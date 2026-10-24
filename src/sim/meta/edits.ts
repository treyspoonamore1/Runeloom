/**
 * Hearth commands (M7): plain data, part of HeroEdit (hero/edits.ts), so the Session records them
 * and replays apply them at the same tick. The UI sends them through sendHeroEdit
 * (src/app/hearth.ts wraps them).
 *
 * CONTRACT (M7), owned by the meta agent. Every edit except 'offline' needs adventure mode, a lit
 * Hearth and the player in the Hearth's room (data/hearth.ts hearthRoom); 'offline' needs only a
 * lit Hearth. Each returns why it can't apply, or null.
 */
import { currencies, isCurrencyId, type CurrencyId } from '../../../data/currency';
import {
  BUILDING_IDS,
  buildings,
  mutations,
  MUTATION_IDS,
  offline,
  spindlewrightPrices,
  stations,
  type BuildingId,
  type MutationId,
} from '../../../data/hearth';
import { maxRuneLevel } from '../../../data/progression';
import { emit } from '../events';
import { refreshHero } from '../hero/hero';
import { slotOfRune } from '../hero/runes';
import type { GameState } from '../state';
import { advanceHearth } from './hearth';
import { collectExpedition, sendExpedition } from './expeditions';
import { mutationCount } from './mutations';
import { applyRekindle } from './rekindle';
import { SALVAGE_ORDER } from './salvage';
import type { SalvageSetting } from './types';
import { gardenPlots, inHearth, mutationCost, salvageCap, upgradeCost } from './view';

export type HearthEdit =
  /** Spends Embers to raise a building one level. */
  | { kind: 'hearthUpgrade'; building: BuildingId }
  /** Plants a pouch rune (not socketed) in a free Rune Garden plot. */
  | { kind: 'gardenPlant'; uid: number }
  /** Takes a planted rune back to the pouch. */
  | { kind: 'gardenUproot'; uid: number }
  /** Hires a free Weaver for a timed rift of `tier` (1 up to the best tier completed this cycle, at least 1). */
  | { kind: 'expeditionSend'; tier: number }
  /** Takes a returned expedition's rewards (rolled now with the loot RNG). */
  | { kind: 'expeditionCollect'; uid: number }
  /** The Salvage Loom's setting; a rarity above what its level allows is refused. */
  | { kind: 'salvageSetting'; setting: SalvageSetting }
  /** Buys one crafting currency from the Spindlewright for Thread Scrap (data/hearth.ts spindlewrightPrices). */
  | { kind: 'spindlewrightBuy'; currency: CurrencyId }
  /** Prestige (DESIGN §11): after a tier 8 clear, with no rift open. */
  | { kind: 'rekindle' }
  /** Spends Ash on a Mutation (CONTENT §11). */
  | { kind: 'mutationBuy'; mutation: MutationId }
  /**
   * Offline progress: the app measured `seconds` of wall-clock time since the save it loaded
   * (capped at data/hearth.ts offline.capSeconds; the sim refuses more) and sends this right after
   * loading. The only way wall-clock time reaches the sim.
   */
  | { kind: 'offline'; seconds: number };

export type HearthEditKind = HearthEdit['kind'];

export const HEARTH_EDIT_KINDS: readonly HearthEditKind[] = [
  'hearthUpgrade',
  'gardenPlant',
  'gardenUproot',
  'expeditionSend',
  'expeditionCollect',
  'salvageSetting',
  'spindlewrightBuy',
  'rekindle',
  'mutationBuy',
  'offline',
];

export function isHearthEdit(edit: { kind: string }): edit is HearthEdit {
  return (HEARTH_EDIT_KINDS as readonly string[]).includes(edit.kind);
}

/** Why no Hearth edit (except 'offline') can apply now, or null: adventure, lit, at the Hearth. */
export function hearthGateError(state: GameState): string | null {
  if (state.mode !== 'adventure') return 'Only in adventure mode';
  if (!state.hero.hearth.lit) return 'The Hearth is not lit: defeat the Cinder Warden';
  if (!inHearth(state)) return 'Only at the Hearth';
  return null;
}

/**
 * Applies a Hearth edit if legal; returns why not, or null. Only 'mutationBuy' changes the build
 * (Deeper Weave, Stormglass Memory, Twin Threads, Kindred Flame), so only it refreshes the hero.
 */
export function applyHearthEdit(state: GameState, edit: HearthEdit): string | null {
  if (edit.kind === 'offline') return applyOffline(state, edit.seconds);
  const gate = hearthGateError(state);
  if (gate) return gate;
  switch (edit.kind) {
    case 'hearthUpgrade':
      return upgradeBuilding(state, edit.building);
    case 'gardenPlant':
      return plantRune(state, edit.uid);
    case 'gardenUproot':
      return uprootRune(state, edit.uid);
    case 'expeditionSend':
      return sendExpedition(state, edit.tier);
    case 'expeditionCollect':
      return collectExpedition(state, edit.uid);
    case 'salvageSetting':
      return setSalvage(state, edit.setting);
    case 'spindlewrightBuy':
      return buyCurrency(state, edit.currency);
    case 'rekindle':
      return applyRekindle(state);
    case 'mutationBuy':
      return buyMutation(state, edit.mutation);
  }
}

function upgradeBuilding(state: GameState, building: BuildingId): string | null {
  if (!BUILDING_IDS.includes(building)) return `No building "${String(building)}"`;
  const h = state.hero.hearth;
  const level = h.buildings[building];
  const name = stations[building].name;
  if (level >= buildings[building].maxLevel) return `${name} is at its highest level`;
  const cost = upgradeCost(building, level);
  if (h.embers < cost) return `Needs ${cost} Embers (you have ${h.embers})`;
  h.embers -= cost;
  h.embersSpent += cost;
  h.buildings[building] = level + 1;
  emit(state, { type: 'buildingUpgraded', building, level: level + 1 });
  return null;
}

function plantRune(state: GameState, uid: number): string | null {
  const hero = state.hero;
  const h = hero.hearth;
  const r = hero.runes.find((x) => x.uid === uid);
  if (!r) return "You don't have that rune";
  if (h.garden.includes(uid)) return 'Already planted';
  if (slotOfRune(state, uid) >= 0) return 'Take it out of its weave first';
  const plots = gardenPlots(h.buildings.rune_garden);
  if (plots <= 0) return 'Build the Rune Garden first';
  if (h.garden.length >= plots) return 'No free plot: uproot a rune or upgrade the Rune Garden';
  if (r.level >= maxRuneLevel) return `It is already level ${maxRuneLevel}`;
  h.garden.push(uid);
  return null;
}

function uprootRune(state: GameState, uid: number): string | null {
  const h = state.hero.hearth;
  const i = h.garden.indexOf(uid);
  if (i < 0) return "That rune isn't planted";
  h.garden.splice(i, 1);
  return null;
}

function setSalvage(state: GameState, setting: SalvageSetting): string | null {
  if (!SALVAGE_ORDER.includes(setting)) return `No Salvage Loom setting "${String(setting)}"`;
  const level = state.hero.hearth.buildings.salvage_loom;
  const cap = salvageCap(level);
  if (SALVAGE_ORDER.indexOf(setting) > SALVAGE_ORDER.indexOf(cap))
    return cap === 'off'
      ? 'Build the Salvage Loom first'
      : `At level ${level} the Salvage Loom salvages up to ${cap} gear`;
  state.hero.hearth.salvage = setting;
  return null;
}

function buyCurrency(state: GameState, currency: CurrencyId): string | null {
  if (!isCurrencyId(currency)) return `No currency "${String(currency)}"`;
  const hero = state.hero;
  const price = spindlewrightPrices[currency];
  if (hero.threadScrap < price)
    return `${currencies[currency].name} costs ${price} Thread Scrap (you have ${hero.threadScrap})`;
  hero.threadScrap -= price;
  hero.currency[currency] = (hero.currency[currency] ?? 0) + 1;
  return null;
}

function buyMutation(state: GameState, id: MutationId): string | null {
  if (!MUTATION_IDS.includes(id)) return `No mutation "${String(id)}"`;
  const hero = state.hero;
  const cost = mutationCost(hero, id);
  const d = mutations[id];
  if (cost === null)
    return d.max === 1 ? `${d.name} is already yours` : `${d.name} is bought ${d.max} times already`;
  if (hero.hearth.ash < cost) return `${d.name} costs ${cost} Ash (you have ${hero.hearth.ash})`;
  hero.hearth.ash -= cost;
  hero.hearth.mutations[id] = mutationCount(hero, id) + 1;
  emit(state, { type: 'mutationBought', mutation: id, count: mutationCount(hero, id) });
  refreshHero(state);
  return null;
}

/** HeroEdit 'offline': 0 < seconds ≤ offline.capSeconds of production, with a lit Hearth; anywhere. */
function applyOffline(state: GameState, seconds: number): string | null {
  if (!state.hero.hearth.lit) return 'The Hearth is not lit';
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0)
    return 'Offline time must be more than 0 seconds';
  if (seconds > offline.capSeconds) return `Offline time is capped at ${offline.capSeconds / 3600} hours`;
  const g = advanceHearth(state, seconds);
  emit(state, {
    type: 'offlineGains',
    seconds,
    scrap: g.scrap,
    runeXp: g.runeXp,
    runeLevels: g.runeLevels,
    expeditionsReturned: g.expeditionsReturned,
  });
  return null;
}
