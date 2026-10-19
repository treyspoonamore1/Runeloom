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
import {
  EQUIP_SLOTS,
  type EquipSlot,
  type FusePart,
  type HeroState,
  type Item,
  type RuneItem,
} from '../sim/hero/types';
import { passivePointsEarned } from '../sim/hero/hero';
import { slotOfRune } from '../sim/hero/runes';
import { equippedSlotOf, findItem, kindOfBase, slotsForKind } from '../sim/items/items';
import {
  describeItem as simDescribeItem,
  describePart as simDescribePart,
  describeRune as simDescribeRune,
  type Description,
} from '../sim/items/describe';
import { xpToNext } from '../../data/progression';
import { scrapValues } from '../../data/loot';
import type { ItemKind } from '../../data/items';
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

export type { HeroEdit, Description };

/** Read-only: never mutate what this returns. */
export function getHero(session: Session): Readonly<HeroState> {
  return session.state.hero;
}

/** Read-only totals for the character sheet and tooltips. */
export function getHeroMods(session: Session): Readonly<HeroMods> {
  return session.state.heroMods;
}

/**
 * Applies a menu command now (between ticks). Returns null on success, else why it failed. A
 * successful edit is recorded in the Session (`heroEdits`) so replays reproduce it.
 */
export function sendHeroEdit(session: Session, edit: HeroEdit): string | null {
  const state = session.state;
  const err = applyHeroEdit(state, edit);
  if (err === null)
    session.recordHeroEdit({
      tick: state.tick,
      after: session.loadoutEdits.length,
      edit: structuredClone(edit),
    });
  return err;
}

/** Tooltip for an item: magic name, base line, base properties, implicit, affix and fused-part lines. */
export function describeItem(item: Item): Description {
  return simDescribeItem(item);
}

/** Tooltip for a rune item: its rune's text, level, costs and XP. */
export function describeRune(rune: RuneItem): Description {
  return simDescribeRune(rune);
}

/** Tooltip for a Fuse part: its effect at its tier and what drops it. */
export function describePart(part: FusePart): Description {
  return simDescribePart(part);
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

// ---- Getters for the inventory, equipment and Fuse screens ----

/** Level, XP toward the next level, and passive points. */
export interface LevelView {
  level: number;
  xp: number;
  xpToNext: number;
  /** Points earned (one per level above 1, plus Pattern Seeds) and not yet spent. */
  passivePoints: number;
}

export function getLevel(session: Session): LevelView {
  const h = session.state.hero;
  return {
    level: h.level,
    xp: h.xp,
    xpToNext: xpToNext(h.level),
    passivePoints: passivePointsEarned(h) - h.passives.length,
  };
}

/** The item in each equipment slot, or null. */
export function getEquipped(session: Session): Record<EquipSlot, Item | null> {
  const h = session.state.hero;
  const out = {} as Record<EquipSlot, Item | null>;
  for (const slot of EQUIP_SLOTS) {
    const uid = h.equipped[slot];
    out[slot] = uid === null ? null : (findItem(h, uid) ?? null);
  }
  return out;
}

/** Owned items that aren't equipped, in acquisition order. */
export function getInventory(session: Session): Item[] {
  const h = session.state.hero;
  return h.items.filter((it) => equippedSlotOf(h, it.uid) === null);
}

/** The slot an item is equipped in, or null. */
export function itemSlot(session: Session, uid: number): EquipSlot | null {
  return equippedSlotOf(session.state.hero, uid);
}

/** The kind of an item (spindle, cloak, hood, boots, charm). */
export function itemKind(item: Item): ItemKind | null {
  return kindOfBase(item.base);
}

/** Slots an item can be equipped in (charms: both charm slots). */
export function slotsForItem(item: Item): readonly EquipSlot[] {
  const k = kindOfBase(item.base);
  return k ? slotsForKind(k) : [];
}

/** A rune item and where it sits: -1 in the pouch, else the weave slot (0–3). */
export interface RuneView {
  rune: RuneItem;
  slot: number;
}

/** Every rune item with its place, pouch and socketed, in acquisition order. */
export function getRunes(session: Session): RuneView[] {
  const s = session.state;
  return s.hero.runes.map((rune) => ({ rune, slot: slotOfRune(s, rune.uid) }));
}

/** Fuse parts not fused into a spindle. */
export function getParts(session: Session): FusePart[] {
  return session.state.hero.parts;
}

export interface Currencies {
  threadScrap: number;
  heartSeeds: number;
  loomShards: number;
  patternSeeds: number;
}

/** Thread Scrap, Heart Seeds, Loom Shards and Pattern Seeds. */
export function getCurrencies(session: Session): Currencies {
  const h = session.state.hero;
  return {
    threadScrap: h.threadScrap,
    heartSeeds: h.heartSeeds,
    loomShards: h.loomShards,
    patternSeeds: h.patternSeeds,
  };
}

/**
 * Thread Scrap that salvaging an item or part would give, or null if it can't be salvaged
 * (equipped, has fused parts, not owned).
 */
export function salvageValue(session: Session, uid: number): number | null {
  const h = session.state.hero;
  const item = findItem(h, uid);
  if (item) {
    if (equippedSlotOf(h, uid) !== null || item.fused.some((p) => p !== null)) return null;
    return scrapValues.item[item.rarity];
  }
  const part = h.parts.find((p) => p.uid === uid);
  return part ? scrapValues.part[part.tier - 1]! : null;
}

/** Thread Scrap it costs to keep a part when unfusing it (DESIGN §8.4). */
export const UNFUSE_KEEP_COST = scrapValues.unfuseKeepCost;
