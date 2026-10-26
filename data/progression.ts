/**
 * Character progression and the M4 region (CONTENT §9, DESIGN §7): room ids, the XP curve, the
 * new-game loadout and the runes each room guarantees on first clear.
 *
 * CONTRACT (M4): room ids here are the file paths under data/rooms (without .txt). The content
 * agent authors these files; the world agent connects them; the hero agent pays the rewards.
 */
import { riftBosses } from './rift';
import type { RuneId } from './runes';

/** Every M4 room, in intended play order (CONTENT §9). */
export const regionRooms = {
  e1: 'emberwood/e1_glade',
  e2: 'emberwood/e2_thicket',
  e3: 'emberwood/e3_riverbend',
  e4: 'emberwood/e4_old_mill',
  e5: 'emberwood/e5_archer_ridge',
  e6: 'emberwood/e6_shield_road',
  e7: 'emberwood/e7_hollow_oak',
  e8: 'emberwood/e8_kiln_approach',
  k1: 'kiln/k1_gate',
  k2: 'kiln/k2_brazier_hall',
  k3: 'kiln/k3_bramble_vault',
  k4: 'kiln/k4_oil_works',
  k5: 'kiln/k5_matriarch_pit',
  k6: 'kiln/k6_frost_shrine',
  k7: 'kiln/k7_ice_crossing',
  k8: 'kiln/k8_slide_room',
  k9: 'kiln/k9_thaw_lock',
  k10: 'kiln/k10_wardens_hearth',
} as const;

export type RegionRoomId = (typeof regionRooms)[keyof typeof regionRooms];

/**
 * Glasswater Fen and the Drowned Foundry (M8 phase 1, CONTENT §13): a second region group, reached
 * through K10's storm door. Kept apart from `regionRooms`, which is the M4 campaign's route (the
 * campaign bot and the M4 region tests walk it). G7 is the side room north of G5; F9 is the dead
 * end east of F8, the hub.
 */
export const fenRooms = {
  g1: 'fen/g1_storm_landing',
  g2: 'fen/g2_glass_reeds',
  g3: 'fen/g3_pylon_field',
  g4: 'fen/g4_heron_lake',
  g5: 'fen/g5_fogbank',
  g6: 'fen/g6_drowned_causeway',
  g7: 'fen/g7_lantern_grotto',
  g8: 'fen/g8_foundry_steps',
  f1: 'foundry/f1_sluice_gate',
  f2: 'foundry/f2_pump_hall',
  f3: 'foundry/f3_cooling_pools',
  f4: 'foundry/f4_slag_run',
  f5: 'foundry/f5_bellwethers_belfry',
  f6: 'foundry/f6_tide_shrine',
  f7: 'foundry/f7_furnace_row',
  f8: 'foundry/f8_dry_conduit',
  f9: 'foundry/f9_flood_lock',
  f10: 'foundry/f10_glass_eye',
} as const;

export type FenRoomId = (typeof fenRooms)[keyof typeof fenRooms];
/** Every hand-authored region room: Emberwood and the Kiln (M4), the Fen and the Foundry (M8). */
export const worldRooms = { ...regionRooms, ...fenRooms } as const;
export type WorldRoomId = RegionRoomId | FenRoomId;

/**
 * Level of the rune copies the Fen pays (CONTENT §13.1): a tier 8 character already owns every
 * rune the Fen teaches, so it pays second copies at this level (Tide and Gale arrive at it too).
 */
export const fenRuneLevel = 10;
const FEN_ROOM_IDS: ReadonlySet<string> = new Set(Object.values(fenRooms));

/** The level a room's guaranteed runes arrive at: fenRuneLevel in the Fen and Foundry, else 1. */
export function guaranteedRuneLevel(roomId: string): number {
  return FEN_ROOM_IDS.has(roomId) ? fenRuneLevel : 1;
}

/** Where a new game starts. */
export const startRoom: RegionRoomId = regionRooms.e1;

/**
 * XP needed to go from level L to L + 1. DESIGN §7's starting point was round(30 × L^2.2); the M4
 * balance pass flattened it so the campaign bot (npm run sim -- --campaign) reaches level 12 on
 * entering the Cinder Warden's room: the Kiln's second half has few enemies, so late levels must
 * cost less relative to early ones.
 */
export function xpToNext(level: number): number {
  if (level <= xpCurve.kneeLevel) return Math.round(68 * Math.pow(level, 1.6));
  // Past the region (M6.5): grows like kill XP grows per area level, so the player settles a
  // few levels above the rift's area level instead of out-levelling it.
  const knee = Math.round(68 * Math.pow(xpCurve.kneeLevel, 1.6));
  return Math.round(knee * Math.pow(xpCurve.growth, level - xpCurve.kneeLevel));
}

/** The XP curve above the region (M6.5): × growth per level past kneeLevel (data/loot.ts killXp.growth). */
export const xpCurve = { kneeLevel: 12, growth: 1.2 };

/** Socketed runes level from 1 to this (DESIGN §5.1). */
export const maxRuneLevel = 20;

/**
 * XP a socketed rune needs to go from level L to L + 1. Every socketed rune gains the full XP of
 * each kill (data/loot.ts killXp), so the starting runes reach about level 9 by the Cinder
 * Warden in the campaign sim (the M4 balance pass raised 60 × L^1.8 to 90 × L^1.8 with the larger
 * kill XP; the Warden's kill time depends on it). A balance input.
 */
export function runeXpToNext(level: number): number {
  return Math.round(90 * Math.pow(level, 1.8));
}

/** Exploration rewards (DESIGN §10.1). */
export const explorationRewards = {
  /** Max life per Heart Seed. */
  heartSeedLife: 8,
  /** Capacity per Loom Shard, on every spindle. */
  loomShardCapacity: 1,
};

/** The new-game character (CONTENT §9.1). */
export const newGame = {
  spindle: 'twig',
  runes: ['cast', 'bolt', 'strike', 'fire'] as RuneId[],
  weaves: ['Cast > Bolt[Fire]', 'Cast > Strike[]', null, null] as (string | null)[],
} as const;

/**
 * Runes each room guarantees on its first clear (CONTENT §9.1, §13.1); boss rooms pay when the
 * boss dies, rune-shrine rooms (K6, F6) when the shrine is touched. Fen and Foundry runes arrive at
 * guaranteedRuneLevel. The Coil's Gale is the M8 "item get" (an element's first unlock).
 */
export const guaranteedRunes: Partial<Record<WorldRoomId, RuneId[]>> = {
  [regionRooms.e1]: ['swath'],
  [regionRooms.e2]: ['split'],
  [regionRooms.e3]: ['lob', 'on_expire'],
  [regionRooms.e4]: ['wide', 'heavy'],
  [regionRooms.e5]: ['nova', 'pierce'],
  [regionRooms.e6]: ['pulse', 'keen'],
  [regionRooms.e7]: ['lingering'],
  [regionRooms.e8]: ['on_dodge', 'on_hit'],
  [regionRooms.k2]: ['echo'],
  [regionRooms.k3]: ['saturate'],
  [regionRooms.k4]: ['beam'],
  [regionRooms.k5]: ['on_kill', 'harvest'],
  [regionRooms.k6]: ['frost'],
  [regionRooms.k8]: ['seeker', 'orb'],
  [regionRooms.k9]: ['on_hurt', 'emit'],
  [regionRooms.k10]: ['storm', 'chain', 'sigil', 'on_crit'],
  [fenRooms.g1]: ['storm'],
  [fenRooms.g3]: ['chain'],
  [fenRooms.g4]: ['frost'],
  [fenRooms.g5]: ['sigil'],
  [fenRooms.g6]: ['saturate'],
  [fenRooms.g7]: ['lingering'],
  [fenRooms.g8]: ['pulse'],
  [fenRooms.f2]: ['split'],
  [fenRooms.f4]: ['fire'],
  [fenRooms.f5]: ['on_hit', 'infuse'],
  [fenRooms.f6]: ['tide'],
  [fenRooms.f7]: ['swath'],
  [fenRooms.f8]: ['tide'],
  [fenRooms.f9]: ['lob'],
  [fenRooms.f10]: ['gale', 'nova'],
};

/** What a room's loot chest (`$`, M8) holds: paid once when it is opened. */
export type ChestContent =
  | { kind: 'pattern_seed' }
  /** A Fuse part of a kind regular monsters drop, at the room's part tier. */
  | { kind: 'part' }
  /** That many crafting currency drops, each rolled like a monster's. */
  | { kind: 'currency'; amount: number };

/** Loot chest contents by room (CONTENT §13). */
export const roomChests: Partial<Record<WorldRoomId, readonly ChestContent[]>> = {
  // The Windward Cache, behind G7's wind-vane door (opens with Gale, after the Coil).
  [fenRooms.g7]: [{ kind: 'pattern_seed' }],
  // F1's alcove behind the furnace vents (opens with Tide).
  [fenRooms.f1]: [{ kind: 'part' }, { kind: 'currency', amount: 3 }],
};

/**
 * Spindle bases by the area level they start dropping at: E4, E8 and K4 (CONTENT §9.1); Heartwood
 * and Loomsteel at their item levels 18 and 30 (CONTENT §3), so from rifts (M6) on.
 */
export const spindleDropFrom = {
  ashwood: 4,
  ironbark: 6,
  rimeglass: 8,
  heartwood: 18,
  loomsteel: 30,
} as const;

/**
 * M5 rune discovery (CONTENT §9.1 lists no room for the M5 runes): a Rare monster's death drops
 * one rune the hero hasn't unlocked yet with `rareChance`, and each boss drops one, from the M5
 * runes whose `from` area level the room reaches. Picking it up unlocks it, like any rune.
 */
export const runeDiscovery = {
  rareChance: 0.15,
  bossCount: 1,
  from: { swift: 3, fork: 5, return: 5, focus: 6, infuse: 7, channel: 8 } as Readonly<
    Partial<Record<RuneId, number>>
  >,
};

/**
 * Enemy kinds that are bosses: their death clears their room. The region's bosses are
 * remembered in WorldState.bossesDefeated; rift bosses (data/rift.ts riftBosses) only in the open
 * rift (WorldState.rift.bossDead), since every rift has one.
 */
export const regionBossKinds: readonly string[] = [
  'tar_matriarch',
  'cinder_warden',
  // M8: the Foundry's mini-boss and boss (data/bosses.ts once the bosses work lands; until then
  // F5 and F10 spawn stand-ins, so nothing spawns these kinds).
  'bellwether',
  'glasswater_coil',
];
export const riftBossKinds: readonly string[] = riftBosses.map((b) => b.boss);
export const bossKinds: readonly string[] = [...regionBossKinds, ...riftBossKinds];
