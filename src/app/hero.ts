/**
 * The character as menus see it: inventory, equipment, runes, Fuse, passive tree, map.
 *
 * CONTRACT (M4): UI code reads the hero only through these functions and changes it only with
 * `sendHeroEdit`, which applies a HeroEdit between ticks and records it in the Session so
 * replays reproduce it (like weave edits in src/app/loadout.ts). The hero/items agent fills in
 * the descriptions and the recording; the effects agent the passive tree; the world agent the
 * region map.
 */
import { applyHeroEdit, type HeroEdit } from '../sim/hero/edits';
import type { HeroMods } from '../sim/hero/mods';
import type { FusePart, HeroState, Item, RuneItem } from '../sim/hero/types';
import type { Session } from './session';
import { buildRegionMap, type RegionMap } from '../sim/world/regionMap';

export type { HeroEdit };

/** Read-only: never mutate what this returns. */
export function getHero(session: Session): Readonly<HeroState> {
  return session.state.hero;
}

/** Read-only totals for the character sheet and tooltips. */
export function getHeroMods(session: Session): Readonly<HeroMods> {
  return session.state.heroMods;
}

/** Applies a menu command now (between ticks). Returns null on success, else why it failed. */
export function sendHeroEdit(session: Session, edit: HeroEdit): string | null {
  const err = applyHeroEdit(session.state, edit);
  // 'travel' and 'rest' change rooms between ticks: let the renderer rebuild now.
  session.syncRoom();
  return err;
}

/** Display text for tooltips: a name, its rarity color class, and one line per stat. */
export interface Description {
  name: string;
  rarity: 'normal' | 'magic' | 'rare' | 'unique';
  /** Base type line, e.g. "Ashwood Spindle", "Cloak". */
  base: string;
  /** Implicit, then affix lines, then fused parts. */
  lines: string[];
}

export function describeItem(item: Item): Description {
  return { name: item.base, rarity: item.rarity, base: item.base, lines: [] };
}

export function describeRune(rune: RuneItem): Description {
  return { name: rune.rune, rarity: 'normal', base: `Level ${rune.level}`, lines: [] };
}

export function describePart(part: FusePart): Description {
  return { name: part.part, rarity: 'magic', base: `Tier ${part.tier}`, lines: [] };
}

// ---- Region map (world agent): src/sim/world/regionMap.ts ----

/** The map screen's data: the rooms connected to the current one, laid out from their exits. */
export function getRegionMap(session: Session): RegionMap {
  return buildRegionMap(session.state);
}
