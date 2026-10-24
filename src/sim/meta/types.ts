/**
 * The Hearth's state (DESIGN §11, M7): Embers, building levels, the Rune Garden, expeditions,
 * the Salvage Loom setting, Rekindles, Ash and Mutations. Lives in `HeroState.hearth`, so it is
 * hashed, saved and replayed with the character (hero/hero.ts hashHero, save.ts).
 *
 * CONTRACT (M7), owned by the meta agent (src/sim/meta/*). The UI reads it through
 * src/app/hearth.ts and changes it only with HearthEdits (meta/edits.ts) sent through
 * sendHeroEdit. Rekindle (meta/rekindle.ts) resets exactly: Embers, Embers spent, building levels
 * and their carries, the garden (its runes go back to the pouch), the Salvage Loom setting, and
 * the hero's rift progress (riftTier, sigils). Nothing else.
 */
import type { BuildingId, MutationId } from '../../../data/hearth';
import type { ItemRarity } from '../hero/types';

export type { BuildingId, MutationId, StationId } from '../../../data/hearth';

/** A hired Weaver on a timed rift (DESIGN §11 Expedition Board). */
export interface Expedition {
  /** hero.nextUid space. */
  uid: number;
  /** The rift tier it runs (sets its rewards and duration). */
  tier: number;
  /** Seconds of play or offline time until it returns; 0 when back and ready to collect. */
  left: number;
  /** Its full duration when sent, for progress bars. */
  duration: number;
}

/** The Salvage Loom's setting: salvage picked-up gear up to this rarity ('off': none). Never uniques. */
export type SalvageSetting = 'off' | Exclude<ItemRarity, 'unique'>;

export interface HearthState {
  /** The Cinder Warden died and lit the Hearth: the hub opens, Embers drop, buildings produce. */
  lit: boolean;
  /** Embers held (whole numbers). */
  embers: number;
  /** Embers spent on buildings since the last Rekindle (Ash, data/hearth.ts rekindle). */
  embersSpent: number;
  /** Building levels, 0 = not built. */
  buildings: Record<BuildingId, number>;
  /** Kindling Pit Thread Scrap made but not yet whole (0 ≤ carry < 1). */
  scrapCarry: number;
  /** Rune uids planted in the Rune Garden, in planting order. A planted rune can't be socketed. */
  garden: number[];
  /** Expeditions out or back and waiting, in sending order. */
  expeditions: Expedition[];
  salvage: SalvageSetting;
  /** Times Rekindled. */
  rekindles: number;
  /** Ash held. */
  ash: number;
  /** Mutations bought, by id (Bright Hearth up to 10); missing means 0. */
  mutations: Partial<Record<MutationId, number>>;
  /** Seconds of play since the Hearth was lit, offline time not included (progression reports). */
  playSeconds: number;
  /** Ticks (outside hitstop) since the last Hearth second: the sim advances the Hearth 1 s at a time. */
  clock: number;
}
