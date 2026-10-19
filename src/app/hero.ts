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
import {
  allocateBlocker,
  allocatedSet,
  canAllocate,
  isAllocated,
  passivePath,
  passivePoints,
  passivePointsAvailable,
  refundCheck,
  refundCost,
  type RefundCheck,
} from '../sim/hero/passives';

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
  return applyHeroEdit(session.state, edit);
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

// ---- Passive tree (effects agent): read-only views over data/passives.ts and hero/passives.ts.
// Allocate and refund with sendHeroEdit({ kind: 'allocate' | 'refund', node }).

export {
  passiveNodes,
  passiveEdges,
  passiveIds,
  passiveView,
  PASSIVE_START,
  type PassiveId,
  type PassiveNode,
  type PassiveArea,
  type PassiveType,
} from '../../data/passives';
export type { RefundCheck } from '../sim/hero/passives';

/** How the tree draws a node: allocated, allocatable now (connected, a point free), or not. */
export type PassiveNodeState = 'allocated' | 'available' | 'locked';

export interface PassiveSummary {
  /** Points earned: level − 1 + Pattern Seeds. */
  points: number;
  /** Points not spent. */
  available: number;
  /** Thread Scrap one refund costs now (0 below level 10). */
  refundCost: number;
  /** Allocated node ids, start included. */
  allocated: ReadonlySet<string>;
}

export function getPassiveSummary(session: Session): PassiveSummary {
  const hero = session.state.hero;
  return {
    points: passivePoints(hero),
    available: passivePointsAvailable(hero),
    refundCost: refundCost(hero),
    allocated: allocatedSet(hero),
  };
}

export function passiveNodeState(session: Session, id: string): PassiveNodeState {
  const hero = session.state.hero;
  if (isAllocated(hero, id)) return 'allocated';
  return canAllocate(hero, id) ? 'available' : 'locked';
}

/** Why the node can't be allocated now, or null if it can. */
export function passiveAllocateBlocker(session: Session, id: string): string | null {
  return allocateBlocker(session.state.hero, id);
}

/** Whether the node can be refunded now, why not, and the Thread Scrap it costs. */
export function passiveRefundCheck(session: Session, id: string): RefundCheck {
  return refundCheck(session.state.hero, id);
}

/** Unallocated nodes on the shortest path to `id`, ending with it ([] if allocated, null if unknown). */
export function passivePathPreview(session: Session, id: string): string[] | null {
  return passivePath(session.state.hero, id);
}
