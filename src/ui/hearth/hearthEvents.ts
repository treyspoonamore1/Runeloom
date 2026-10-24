/**
 * Hearth sim events (src/sim/meta/events.ts) as the HUD reads them: the screen a station opens,
 * and the toasts and banners the rest become. Pure (no DOM). Embers pickups make no toast: the
 * counter in the HUD is their feedback, and a kill-by-kill toast would be spam.
 */
import {
  buildings,
  mutations,
  stations,
  type BuildingId,
  type MutationId,
  type StationId,
} from '../../../data/hearth';
import type { LooseEvent, ToastSpec } from '../adventure/hudEvents';
import { tabForStation } from './hearthModel';
import type { HearthTab } from './hearthSignals';

export const HEARTH_EVENT = {
  /** { embers }: the Cinder Warden lit the Hearth. */
  lit: 'hearthLit',
  /** { station }: Interact at a hub station. */
  stationUse: 'stationUse',
  /** { building, level } */
  buildingUpgraded: 'buildingUpgraded',
  /** { uid, level }: a planted rune levelled up. */
  gardenRuneLevel: 'gardenRuneLevel',
  /** { uid, tier } */
  expeditionReturned: 'expeditionReturned',
  /** { uid, tier, parts, currency, embers } */
  expeditionCollected: 'expeditionCollected',
  /** { scrap }: the Salvage Loom turned a pickup into Thread Scrap. */
  autoSalvaged: 'autoSalvaged',
  /** { ash, rekindles, maxTier } */
  rekindled: 'rekindled',
  /** { mutation, count } */
  mutationBought: 'mutationBought',
} as const;

const isBuilding = (id: unknown): id is BuildingId => typeof id === 'string' && id in buildings;
const isMutation = (id: unknown): id is MutationId => typeof id === 'string' && id in mutations;
const isStation = (id: unknown): id is StationId => typeof id === 'string' && id in stations;

/** The sub-tab to open for the last station used in this batch, or null. */
export function stationTabFor(events: readonly LooseEvent[]): HearthTab | null {
  let tab: HearthTab | null = null;
  for (const e of events)
    if (e.type === HEARTH_EVENT.stationUse && isStation(e.station)) tab = tabForStation(e.station);
  return tab;
}

const spec = (kind: ToastSpec['kind'], title: string, sub = '', amount = 1): ToastSpec => ({
  kind,
  title,
  sub,
  rarity: null,
  amount,
});

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** The toast one Hearth event makes, or null. */
export function hearthToast(e: LooseEvent): ToastSpec | null {
  switch (e.type) {
    case HEARTH_EVENT.buildingUpgraded:
      return isBuilding(e.building)
        ? spec('hearth', `${stations[e.building].name} level ${Number(e.level)}`, 'Upgraded')
        : null;
    case HEARTH_EVENT.gardenRuneLevel:
      return spec('rune', 'Rune Garden', `A planted rune reached level ${Number(e.level)}`);
    case HEARTH_EVENT.expeditionReturned:
      return spec('hearth', 'Expedition back', `Tier ${Number(e.tier)}: collect it at the Expedition Board`);
    case HEARTH_EVENT.expeditionCollected:
      return spec(
        'hearth',
        'Expedition collected',
        `${plural(Number(e.parts), 'Fuse part')}, ${Number(e.currency)} currency, ` +
          (Number(e.sigils) > 0 ? `${plural(Number(e.sigils), 'Rift Sigil')}, ` : '') +
          `${Number(e.embers)} Embers`,
      );
    case HEARTH_EVENT.autoSalvaged: {
      const n = Number(e.scrap);
      return n > 0 ? spec('salvage', `+${n} Thread Scrap`, 'Salvage Loom', n) : null;
    }
    case HEARTH_EVENT.mutationBought: {
      if (!isMutation(e.mutation)) return null;
      const d = mutations[e.mutation];
      return spec(
        'hearth',
        d.name,
        d.max > 1 ? `Mutation: ${Number(e.count)} of ${d.max}` : 'Mutation bought',
      );
    }
    default:
      return null;
  }
}

/** The center-screen banner one Hearth event makes, or null. */
export function hearthBanner(e: LooseEvent): { title: string; sub: string } | null {
  if (e.type === HEARTH_EVENT.lit)
    return { title: 'The Hearth is lit', sub: 'Travel there from any Loom Stone' };
  if (e.type === HEARTH_EVENT.rekindled)
    return {
      title: 'Rekindled',
      sub: `+${Number(e.ash)} Ash · rifts now open up to tier ${Number(e.maxTier)}`,
    };
  return null;
}
