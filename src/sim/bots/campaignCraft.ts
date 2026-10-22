/**
 * The campaign bot's crafting habit (M5 playtest: "did your simulations craft?"). Between rooms it
 * spends the currency it carries the way a player who uses their materials would, without ever
 * seeing a roll before it happens (every craft goes through the 'craft' HeroEdit and craftRng):
 *
 * 1. Loom Shuttle on the best Normal item of each slot that has no Rare or unique; Weaver's Knot
 *    on one when out of Shuttles.
 * 2. With that gear equipped (campaignPlan.ts equipBest): Golden Needles on equipped Rares with
 *    room, a Chaos Skein on an equipped Rare with 3 or fewer affixes, a Spool of Change on an
 *    equipped Magic item with a single affix.
 * 3. Rune Polish on the LMB weave's form rune (its damage), up to 20%.
 *
 * Unpick is never used. Pure apart from the hero edits; the result labels go into the room log.
 */
import { affixCounts } from '../../../data/affixes';
import { maxRuneQuality, type CurrencyId } from '../../../data/currency';
import type { ItemKind } from '../../../data/items';
import { applyHeroEdit } from '../hero/edits';
import { runeOrder } from '../hero/runes';
import { EQUIP_SLOTS, type EquipSlot, type Item } from '../hero/types';
import { findItem, kindOfBase } from '../items/items';
import { parseWeave } from '../weave/notation';
import type { GameState } from '../state';
import { itemLabel, itemScore } from './campaignPlan';

const KIND_OF_SLOT: Record<EquipSlot, ItemKind> = {
  spindle: 'spindle',
  cloak: 'cloak',
  hood: 'hood',
  boots: 'boots',
  charm1: 'charm',
  charm2: 'charm',
};

const has = (state: GameState, c: CurrencyId): boolean => (state.hero.currency[c] ?? 0) > 0;

function craft(state: GameState, c: CurrencyId, uid: number, out: string[]): boolean {
  if (applyHeroEdit(state, { kind: 'craft', currency: c, uid }) !== null) return false;
  const it = findItem(state.hero, uid);
  out.push(`${c}→${it ? itemLabel(it) : uid}`);
  return true;
}

function equippedIn(state: GameState, slot: EquipSlot): Item | undefined {
  const uid = state.hero.equipped[slot];
  return uid === null ? undefined : findItem(state.hero, uid);
}

/** The Normal item of `kind` worth making magical: equipped first, else the best-scored loose one. */
function normalOf(state: GameState, kind: ItemKind, slot: EquipSlot): Item | undefined {
  const cur = equippedIn(state, slot);
  if (cur?.rarity === 'normal') return cur;
  const worn = new Set(EQUIP_SLOTS.map((s) => state.hero.equipped[s]));
  let best: Item | undefined;
  for (const it of state.hero.items)
    if (it.rarity === 'normal' && !worn.has(it.uid) && kindOfBase(it.base) === kind)
      if (
        !best ||
        itemScore(it) > itemScore(best) ||
        (itemScore(it) === itemScore(best) && it.itemLevel > best.itemLevel)
      )
        best = it;
  return best;
}

/** Step 1: Shuttles, then Knots, on slots without a Rare or unique. */
export function craftNewItems(state: GameState): string[] {
  const out: string[] = [];
  for (const slot of EQUIP_SLOTS) {
    const cur = equippedIn(state, slot);
    if (cur?.rarity === 'rare' || cur?.rarity === 'unique') continue;
    const n = normalOf(state, KIND_OF_SLOT[slot], slot);
    if (!n) continue;
    if (has(state, 'loom_shuttle')) craft(state, 'loom_shuttle', n.uid, out);
    else if (cur?.rarity !== 'magic' && has(state, 'weavers_knot')) craft(state, 'weavers_knot', n.uid, out);
  }
  return out;
}

/** Step 2: improve what is equipped. */
export function craftEquipped(state: GameState): string[] {
  const out: string[] = [];
  const maxAffixes = affixCounts.rare.prefixes + affixCounts.rare.suffixes;
  for (const slot of EQUIP_SLOTS) {
    const it = equippedIn(state, slot);
    if (!it) continue;
    if (it.rarity === 'rare') {
      if (it.affixes.length <= 3 && has(state, 'chaos_skein')) craft(state, 'chaos_skein', it.uid, out);
      while (it.affixes.length < maxAffixes && has(state, 'golden_needle'))
        if (!craft(state, 'golden_needle', it.uid, out)) break;
    } else if (it.rarity === 'magic' && it.affixes.length < 2 && has(state, 'spool_of_change'))
      craft(state, 'spool_of_change', it.uid, out);
  }
  return out;
}

/** Step 3: Rune Polish on the LMB weave's form rune. */
export function polishMainRune(state: GameState): string[] {
  const out: string[] = [];
  const slot = state.weaves.slots[0];
  if (!slot?.notation || !slot.runes) return out;
  const p = parseWeave(slot.notation);
  if (!p.ok) return out;
  const i = runeOrder(p.tree).findIndex((r) => r.path.join('.') === 'root.form');
  const uid = slot.runes[i];
  const rune = state.hero.runes.find((r) => r.uid === uid);
  if (!rune) return out;
  while (rune.quality < maxRuneQuality && has(state, 'rune_polish')) {
    if (applyHeroEdit(state, { kind: 'craft', currency: 'rune_polish', uid: rune.uid }) !== null) break;
    out.push(`rune_polish→${rune.rune} ${rune.quality}%`);
  }
  return out;
}
