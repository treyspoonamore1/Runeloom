/**
 * Hearth events (M7) for render, audio and UI; part of SimEvent (src/sim/events.ts). Persistent
 * looks (building levels, planted runes) read `state.hero.hearth`; these are for sounds,
 * one-shot effects, toasts and opening screens.
 */
import type { BuildingId, MutationId, StationId } from '../../../data/hearth';

export type HearthEvent =
  /** The Cinder Warden lit the Hearth: the hub is open (banner, fast travel). */
  | { type: 'hearthLit'; embers: number }
  /** The player pressed Interact (F) at a hub station: the UI opens its screen. */
  | { type: 'stationUse'; station: StationId }
  /** A building rose a level. */
  | { type: 'buildingUpgraded'; building: BuildingId; level: number }
  /** A rune in the Rune Garden levelled up (online or offline). */
  | { type: 'gardenRuneLevel'; uid: number; level: number }
  /** An expedition came back and waits to be collected. */
  | { type: 'expeditionReturned'; uid: number; tier: number }
  /** An expedition's rewards went into the bag: counts for the toast. */
  | {
      type: 'expeditionCollected';
      uid: number;
      tier: number;
      parts: number;
      currency: number;
      embers: number;
      /** Rift Sigils it brought (M7 balance). */
      sigils: number;
    }
  /** The Salvage Loom turned a picked-up item into Thread Scrap. */
  | { type: 'autoSalvaged'; base: string; rarity: string; scrap: number; x: number; y: number }
  /** Offline progress applied: what it gave, for the "While you were away" summary. */
  | {
      type: 'offlineGains';
      seconds: number;
      scrap: number;
      runeXp: number;
      runeLevels: number;
      expeditionsReturned: number;
    }
  /** Rekindled: the Ash gained and the new highest openable tier. */
  | { type: 'rekindled'; ash: number; rekindles: number; maxTier: number }
  | { type: 'mutationBought'; mutation: MutationId; count: number };
