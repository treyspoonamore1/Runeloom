/**
 * Every rune (CONTENT §1), keyed by id, plus the weave-wide limits from DESIGN §5.
 * Import from 'data/runes'; the per-kind tables live in the sibling files.
 */
import { branches } from './branches';
import { elements } from './elements';
import { forms } from './forms';
import { modifiers } from './modifiers';
import { triggers } from './triggers';
import { runeShips, type RuneDef, type RuneId, type RuneShip } from './types';

export * from './types';
export { branches, elements, forms, modifiers, triggers };

/** Weave-wide numbers (DESIGN §5.2–5.4, §7). */
export const weaveLimits = {
  /** Deepest branch spell allowed (root is depth 0). Uniques and Mutations raise it later. */
  maxDepth: 3,
  /** Extra complexity per branch depth level beyond 1. */
  branchCxPerDepth: 1,
  /** Mana weight of each branch spell in its parent's cost. */
  branchManaWeight: 0.5,
  /** Most spell instances one cast can create across its whole tree. */
  spawnCapPerCast: 64,
  /** Most live player spell instances; past this, the oldest expire. */
  maxLivePlayerInstances: 2000,
  /** Rune base damage grows by this per rune level above 1 (DESIGN §7). */
  runeLevelGrowth: 1.11,
  /**
   * Rune quality (DESIGN §5.1, 0–20%; Rune Polish, M5). Each point of a form rune's quality is
   * this much increased damage for its spell; each point of any socketed rune's quality is this
   * much increased XP for that rune.
   */
  qualityDamagePerPoint: 0.01,
  qualityXpPerPoint: 0.01,
} as const;

/** Every rune by id. */
export const runes: Readonly<Record<RuneId, RuneDef>> = {
  ...triggers,
  ...forms,
  ...elements,
  ...modifiers,
  ...branches,
};

export const runeIds = Object.keys(runes) as RuneId[];

export function isRuneId(id: string): id is RuneId {
  return Object.prototype.hasOwnProperty.call(runes, id);
}

/** The rune with this id, or undefined. Safe on untrusted strings. */
export function getRune(id: string): RuneDef | undefined {
  return isRuneId(id) ? runes[id] : undefined;
}

const byNotation = new Map<string, RuneDef>();
for (const id of runeIds) byNotation.set(runes[id].notation.toLowerCase(), runes[id]);

/** The rune whose notation name matches, ignoring case ('onhit' → On Hit), or undefined. */
export function runeByNotation(name: string): RuneDef | undefined {
  return byNotation.get(name.toLowerCase());
}

/** Milestones up to and including `m`, for `allowShips` (e.g. shipsThrough('M2')). */
export function shipsThrough(m: RuneShip): ReadonlySet<RuneShip> {
  return new Set(runeShips.slice(0, runeShips.indexOf(m) + 1));
}
