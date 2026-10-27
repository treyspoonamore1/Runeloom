/**
 * Rune items in weaves (adventure mode, DESIGN §5.1): a weave may only use rune items the hero
 * owns, and each item sits in one place per weave bar: the pouch, or one slot of each bar. The
 * two bars share the pouch (playtest 8), so an item can be in a bar-1 slot and a bar-2 slot, but
 * not in two slots of one bar, and not in R (live on both bars) and any other slot
 * (weave/runtime/slots.ts slotsClash). Setting a weave socket specific items, preferring the
 * highest-level free item of each rune (ties: the oldest). Sandbox, arena and lab games have
 * unlimited runes and never socket items (WeaveSlot.runes null).
 *
 * Rune order: the order a weave's runes are listed in WeaveSlot.runes. The trigger, then every
 * spell in tree order (pre-order, branches in order): the branch rune leading into it (if any),
 * its form, then its items in slot order.
 */
import { runes as runeDefs, weaveLimits, type RuneId } from '../../../data/runes';
import { maxRuneLevel, runeXpToNext } from '../../../data/progression';
import { emit } from '../events';
import type { GameState } from '../state';
import { runeKey } from '../weave/context';
import { walkSpells, type WeavePath, type WeaveTree } from '../weave/tree';
import { liveSlots, slotsClash } from '../weave/runtime/slots';
import type { RuneItem } from './types';

export interface RuneSlotRef {
  rune: RuneId;
  /** Path of the rune in the tree (WeavePath convention). */
  path: WeavePath;
}

/** Every rune of a weave in rune order, with its path. */
export function runeOrder(tree: WeaveTree): RuneSlotRef[] {
  const out: RuneSlotRef[] = [{ rune: tree.trigger, path: ['trigger'] }];
  walkSpells(tree, (v) => {
    if (v.via) out.push({ rune: v.via.branch, path: [...v.path, 'branch'] });
    out.push({ rune: v.spell.form, path: [...v.path, 'form'] });
    v.spell.items.forEach((id, i) => out.push({ rune: id, path: [...v.path, `i${i}`] }));
  });
  return out;
}

/** True when the game tracks rune items (adventure); otherwise runes are unlimited. */
export function usesRuneItems(state: GameState): boolean {
  return state.mode === 'adventure';
}

/** Uids socketed in weave slots, except `exceptSlot`. */
export function socketedUids(state: GameState, exceptSlot = -1): Set<number> {
  const out = new Set<number>();
  state.weaves.slots.forEach((s, i) => {
    if (i !== exceptSlot && s.runes) for (const u of s.runes) out.add(u);
  });
  return out;
}

/** The first weave slot a rune item is socketed in (it can be in one per bar), or -1 for the pouch. */
export function slotOfRune(state: GameState, uid: number): number {
  return state.weaves.slots.findIndex((s) => s.runes?.includes(uid) ?? false);
}

/**
 * Uids that can't go into a weave `slot` now: socketed in a slot that clashes with it (the same
 * bar's other slots and R; every slot for R, or for no slot, -1), or planted in the Rune Garden
 * (M7: a planted rune is not in the pouch for socketing). The other bar's slots don't count.
 */
function takenUids(state: GameState, slot: number): Set<number> {
  const taken = new Set<number>();
  state.weaves.slots.forEach((s, i) => {
    if (s.runes && slotsClash(slot, i)) for (const u of s.runes) taken.add(u);
  });
  for (const u of state.hero.hearth.garden) taken.add(u);
  return taken;
}

/**
 * Rune items free for `slot` (not planted and not in a clashing slot: in the pouch, in that slot,
 * or in the other bar's slots), best first: level, then oldest. No slot: in the pouch only.
 */
export function freeRunes(state: GameState, slot = -1): RuneItem[] {
  const taken = takenUids(state, slot);
  return state.hero.runes.filter((r) => !taken.has(r.uid)).sort((a, b) => b.level - a.level || a.uid - b.uid);
}

/** Owned and free counts per rune id (free for `slot` as freeRunes; no slot: in the pouch and not planted). */
export function runeCounts(
  state: GameState,
  slot = -1,
): Partial<Record<RuneId, { free: number; total: number }>> {
  const taken = takenUids(state, slot);
  const out: Partial<Record<RuneId, { free: number; total: number }>> = {};
  for (const r of state.hero.runes) {
    const c = (out[r.rune] ??= { free: 0, total: 0 });
    c.total++;
    if (!taken.has(r.uid)) c.free++;
  }
  return out;
}

export type RuneAssignment = { ok: true; uids: number[] } | { ok: false; message: string; path: WeavePath };

/** Picks the items a weave in `slot` would socket, or explains which rune is short. */
export function assignRunes(state: GameState, tree: WeaveTree, slot: number): RuneAssignment {
  const order = runeOrder(tree);
  const need = new Map<RuneId, number>();
  for (const r of order) need.set(r.rune, (need.get(r.rune) ?? 0) + 1);
  const pool = freeRunes(state, slot);
  for (const r of order) {
    const n = need.get(r.rune)!;
    const free = pool.filter((it) => it.rune === r.rune).length;
    if (free < n) {
      const name = runeDefs[r.rune]?.name ?? r.rune;
      return {
        ok: false,
        message: `Needs ${n} ${name} rune${n === 1 ? '' : 's'}; you have ${free} free`,
        path: r.path,
      };
    }
  }
  const used = new Set<number>();
  const uids = order.map((r) => {
    const it = pool.find((x) => x.rune === r.rune && !used.has(x.uid))!;
    used.add(it.uid);
    return it.uid;
  });
  return { ok: true, uids };
}

const ELEMENT_ADDS = ['fire', 'frost', 'storm'] as const;

/**
 * Per-rune levels for CompileContext.runeLevels: each socketed item's level plus HeroMods
 * runeLevelAdd.all. A form also gets the best element bonus (runeLevelAdd.fire, …) among its
 * spell's own elements, or its parent spell's when it has none (inherited elements).
 */
export function runeLevelMap(
  state: GameState,
  tree: WeaveTree,
  uids: readonly number[],
): Record<string, number> {
  const add = state.heroMods.runeLevelAdd;
  const byUid = new Map(state.hero.runes.map((r) => [r.uid, r]));
  const order = runeOrder(tree);
  const out: Record<string, number> = {};
  order.forEach((r, i) => {
    out[runeKey(r.path)] = (byUid.get(uids[i]!)?.level ?? 1) + add.all;
  });
  const bonus = new Map<string, number>();
  walkSpells(tree, (v) => {
    let b = -1;
    for (const id of v.spell.items) for (const e of ELEMENT_ADDS) if (id === e) b = Math.max(b, add[e]);
    if (b < 0) b = v.path.length > 1 ? (bonus.get(runeKey(v.path.slice(0, -1))) ?? 0) : 0;
    bonus.set(runeKey(v.path), b);
    if (b !== 0) out[runeKey([...v.path, 'form'])]! += b;
  });
  return out;
}

/** Per-rune quality for CompileContext.runeQualities, or null when no socketed rune has any. */
export function runeQualityMap(
  state: GameState,
  tree: WeaveTree,
  uids: readonly number[],
): Record<string, number> | null {
  const byUid = new Map(state.hero.runes.map((r) => [r.uid, r]));
  let out: Record<string, number> | null = null;
  runeOrder(tree).forEach((r, i) => {
    const q = byUid.get(uids[i]!)?.quality ?? 0;
    if (q > 0) (out ??= {})[runeKey(r.path)] = q;
  });
  return out;
}

/**
 * Runes socketed in the live slots (the active bar and R; weave/runtime/slots.ts liveSlots) gain
 * `amount` XP (more with quality: weaveLimits.qualityXpPerPoint per %) and level up through
 * runeXpToNext, up to maxRuneLevel (where XP stops). The other bar's runes gain nothing, so it
 * can't level runes passively. Returns the slots whose rune levels changed, on either bar (an
 * item shared with the other bar changes its weave too), in slot order; they need recompiling.
 */
export function grantRuneXp(state: GameState, amount: number): number[] {
  if (amount <= 0) return [];
  const byUid = new Map(state.hero.runes.map((r) => [r.uid, r]));
  const w = state.weaves;
  const levelledUids = new Set<number>();
  for (const slot of liveSlots(w)) {
    const s = w.slots[slot]!;
    if (!s.runes) continue;
    for (const uid of s.runes) {
      const r = byUid.get(uid);
      if (!r || r.level >= maxRuneLevel) continue;
      r.xp += r.quality > 0 ? amount * (1 + r.quality * weaveLimits.qualityXpPerPoint) : amount;
      while (r.level < maxRuneLevel && r.xp >= runeXpToNext(r.level)) {
        r.xp -= runeXpToNext(r.level);
        r.level++;
        levelledUids.add(uid);
        emit(state, { type: 'runeLevelUp', uid: r.uid, rune: r.rune, level: r.level, slot });
      }
      if (r.level >= maxRuneLevel) r.xp = 0;
    }
  }
  const changed: number[] = [];
  if (levelledUids.size === 0) return changed;
  w.slots.forEach((s, slot) => {
    if (s.runes?.some((u) => levelledUids.has(u))) changed.push(slot);
  });
  return changed;
}
