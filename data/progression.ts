/**
 * Character progression and the M4 region (CONTENT §9, DESIGN §7): room ids, the XP curve, the
 * new-game loadout and the runes each room guarantees on first clear.
 *
 * CONTRACT (M4): room ids here are the file paths under data/rooms (without .txt). The content
 * agent authors these files; the world agent connects them; the hero agent pays the rewards.
 */
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

/** Where a new game starts. */
export const startRoom: RegionRoomId = regionRooms.e1;

/** XP needed to go from level L to L + 1 (DESIGN §7; the M4 balance pass tunes it). */
export function xpToNext(level: number): number {
  return Math.round(30 * Math.pow(level, 2.2));
}

/** The new-game character (CONTENT §9.1). */
export const newGame = {
  spindle: 'twig',
  runes: ['cast', 'bolt', 'strike', 'fire'] as RuneId[],
  weaves: ['Cast > Bolt[Fire]', 'Cast > Strike[]', null, null] as (string | null)[],
} as const;

/** Runes each room guarantees on its first clear (CONTENT §9.1); boss rooms pay when the boss dies. */
export const guaranteedRunes: Partial<Record<RegionRoomId, RuneId[]>> = {
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
};

/** Spindle bases by the area level they start dropping at: E4, E8 and K4 (CONTENT §9.1). */
export const spindleDropFrom = { ashwood: 4, ironbark: 6, rimeglass: 8 } as const;
