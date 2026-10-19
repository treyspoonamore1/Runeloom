/**
 * Per-encounter combat sims (M4 acceptance: "a combat sim for every encounter, at the expected
 * player level, completes without the bot dying"). A synthetic reference character for a room,
 * built from `expectedCharacters` (what the campaign sim, bots/campaign.ts, reaches there across
 * seeds, rounded down), plays that one room with the campaign bot and its reference build.
 *
 * The character owns the new-game runes plus one item of every rune the rooms before this one
 * guarantee (CONTENT §9.1), all at `runeLevel`, and no random drops: no duplicate runes (so no Q
 * Frost Bolt and no automatic E weave), no gear affixes and no Fuse parts. That is a little
 * weaker than a typical campaign at the same level, on purpose.
 */
import { guaranteedRunes, regionRooms, type RegionRoomId } from '../../../data/progression';
import type { SpindleId } from '../../../data/spindles';
import { syncWeaveSpindle } from '../hero/equip';
import { refreshHero } from '../hero/hero';
import { newGameHero } from '../hero/newGame';
import type { HeroState } from '../hero/types';
import { makeItem, makeRune } from '../items/items';
import { createAdventure } from '../world/adventure';
import type { RoomSource } from '../world/worldState';
import { campaignOrder, playRoom, type CampaignOptions, type RoomKey, type RoomLog } from './campaign';

export interface CharacterSpec {
  level: number;
  /** Level of every rune item. */
  runeLevel: number;
  spindle: SpindleId;
  heartSeeds: number;
  loomShards: number;
}

/**
 * The character at each room's entry: level, rune level and spindle at or below the campaign's
 * across seeds 1–3 (npm run sim -- --campaign --seeds 3), Heart Seeds and Loom Shards from the
 * rooms before (CONTENT §9: E2, E4, E6, E7, K4, K7, K8).
 */
export const expectedCharacters: Readonly<Record<RoomKey, CharacterSpec>> = {
  e1: { level: 1, runeLevel: 1, spindle: 'twig', heartSeeds: 0, loomShards: 0 },
  e2: { level: 2, runeLevel: 2, spindle: 'twig', heartSeeds: 0, loomShards: 0 },
  e3: { level: 3, runeLevel: 3, spindle: 'twig', heartSeeds: 0, loomShards: 1 },
  e4: { level: 4, runeLevel: 3, spindle: 'twig', heartSeeds: 0, loomShards: 1 },
  e5: { level: 4, runeLevel: 4, spindle: 'twig', heartSeeds: 1, loomShards: 1 },
  e6: { level: 5, runeLevel: 5, spindle: 'twig', heartSeeds: 1, loomShards: 1 },
  e7: { level: 6, runeLevel: 6, spindle: 'twig', heartSeeds: 2, loomShards: 1 },
  e8: { level: 6, runeLevel: 6, spindle: 'twig', heartSeeds: 2, loomShards: 2 },
  k1: { level: 7, runeLevel: 7, spindle: 'twig', heartSeeds: 2, loomShards: 2 },
  k2: { level: 8, runeLevel: 7, spindle: 'twig', heartSeeds: 2, loomShards: 2 },
  k3: { level: 8, runeLevel: 7, spindle: 'twig', heartSeeds: 2, loomShards: 2 },
  k4: { level: 8, runeLevel: 7, spindle: 'twig', heartSeeds: 2, loomShards: 2 },
  k5: { level: 8, runeLevel: 8, spindle: 'twig', heartSeeds: 3, loomShards: 2 },
  k6: { level: 8, runeLevel: 8, spindle: 'twig', heartSeeds: 3, loomShards: 2 },
  k7: { level: 8, runeLevel: 8, spindle: 'twig', heartSeeds: 3, loomShards: 2 },
  k8: { level: 9, runeLevel: 8, spindle: 'twig', heartSeeds: 4, loomShards: 2 },
  k9: { level: 9, runeLevel: 8, spindle: 'twig', heartSeeds: 4, loomShards: 3 },
  k10: { level: 9, runeLevel: 9, spindle: 'twig', heartSeeds: 4, loomShards: 3 },
};

/** The rooms played before `key`, in campaign order. */
function roomsBefore(key: RoomKey): RoomKey[] {
  return campaignOrder.slice(0, campaignOrder.indexOf(key));
}

/** A hero with `spec` and the runes the rooms before `key` guarantee. */
export function referenceHero(key: RoomKey, spec: CharacterSpec): HeroState {
  const hero = newGameHero();
  hero.level = spec.level;
  hero.heartSeeds = spec.heartSeeds;
  hero.loomShards = spec.loomShards;
  for (const k of roomsBefore(key))
    for (const rune of guaranteedRunes[regionRooms[k] as RegionRoomId] ?? []) {
      hero.runes.push(makeRune(hero, rune));
      if (!hero.unlockedRunes.includes(rune)) hero.unlockedRunes.push(rune);
    }
  hero.unlockedRunes.sort();
  for (const r of hero.runes) r.level = spec.runeLevel;
  if (spec.spindle !== 'twig') {
    const sp = makeItem(hero, spec.spindle, 'normal', 1);
    hero.items.push(sp);
    hero.equipped.spindle = sp.uid;
  }
  return hero;
}

export interface EncounterOptions {
  rooms: RoomSource;
  key: RoomKey;
  seed: number;
  /** Default expectedCharacters[key]. */
  spec?: CharacterSpec;
  maxSeconds?: number;
  /** Called after every fight tick (debugging). */
  onTick?: CampaignOptions['onTick'];
}

/** Plays one room with the reference character; the log says whether it cleared and how. */
export function runEncounter(opts: EncounterOptions): RoomLog {
  const spec = opts.spec ?? expectedCharacters[opts.key];
  const i = campaignOrder.indexOf(opts.key);
  const from = i > 0 ? regionRooms[campaignOrder[i - 1]!] : null;
  const state = createAdventure({
    seed: opts.seed,
    rooms: opts.rooms,
    hero: referenceHero(opts.key, spec),
    startRoomId: from ?? regionRooms[opts.key],
  });
  syncWeaveSpindle(state);
  refreshHero(state);
  const p = state.player;
  p.life = p.maxLife;
  p.mana = p.maxMana;
  // No stall rescue: an encounter the bot can't finish fails.
  return playRoom(state, opts.key, from, {
    maxSeconds: opts.maxSeconds ?? 400,
    maxDeaths: 1,
    stallSeconds: 1e9,
    onTick: opts.onTick,
  });
}
