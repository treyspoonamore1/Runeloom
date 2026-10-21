/**
 * The fixture hero and a fixture HeroEdit applier, held outside the sim (the UI never writes sim
 * state). Mirrors the rules the hero/items, passive and world agents implement in applyHeroEdit,
 * so the screens behave the same once the real edits land.
 */
import { isCurrencyId } from '../../../data/currency';
import { isSpindleId, spindles } from '../../../data/spindles';
import { Rng } from '../../sim/core/rng';
import { craftItem, polishRune } from '../../sim/items/craft';
import { UNFUSE_KEEP_COST } from '../../app/hero';
import type { HeroEdit } from '../../sim/hero/edits';
import { EQUIP_SLOTS, type EquipSlot, type HeroState, type Item } from '../../sim/hero/types';
import { fixtureBases, fixtureSlotsFor } from './content';
import { demoHero } from './hero';
import { passiveIndex, pointsOf, refundPrice } from '../tree/adapter';
import { allocatedSet, allocateProblem, refundProblem } from '../tree/treeModel';

let hero: HeroState = demoHero();

export function fixtureHero(): HeroState {
  return hero;
}

export function setFixtureHero(h: HeroState): void {
  hero = h;
}

/** Equipment slots an item fits. */
export function fixtureItemSlots(it: Item): EquipSlot[] {
  if (isSpindleId(it.base)) return ['spindle'];
  const b = fixtureBases[it.base];
  return b ? fixtureSlotsFor(b.slot) : [];
}

/** Thread Scrap for salvaging: by rarity, and 1 per part tier. */
export function fixtureSalvageValue(it: Item | { tier: number }): number {
  if ('tier' in it) return it.tier;
  return it.rarity === 'normal' ? 1 : it.rarity === 'magic' ? 2 : it.rarity === 'rare' ? 4 : 6;
}

const equippedSlot = (h: HeroState, uid: number): EquipSlot | undefined =>
  EQUIP_SLOTS.find((s) => h.equipped[s] === uid);

export function fixtureApply(edit: HeroEdit): string | null {
  const h = hero;
  switch (edit.kind) {
    case 'equip': {
      const it = h.items.find((i) => i.uid === edit.uid);
      if (!it) return 'No such item';
      if (!fixtureItemSlots(it).includes(edit.slot)) return "It doesn't go in that slot";
      const from = equippedSlot(h, it.uid);
      if (from === edit.slot) return null;
      // Moving a charm to the other charm slot swaps the two.
      if (from) h.equipped[from] = h.equipped[edit.slot];
      h.equipped[edit.slot] = it.uid;
      return null;
    }
    case 'unequip':
      if (edit.slot === 'spindle') return 'A spindle is always equipped. Equip another one instead';
      if (h.equipped[edit.slot] === null) return 'Nothing equipped there';
      h.equipped[edit.slot] = null;
      return null;
    case 'salvage': {
      const it = h.items.find((i) => i.uid === edit.uid);
      if (it) {
        if (equippedSlot(h, it.uid)) return 'Unequip it first';
        h.items = h.items.filter((i) => i !== it);
        h.threadScrap += fixtureSalvageValue(it);
        for (const f of it.fused) if (f) h.parts.push(f);
        return null;
      }
      const p = h.parts.find((x) => x.uid === edit.uid);
      if (!p) return 'No such item';
      h.parts = h.parts.filter((x) => x !== p);
      h.threadScrap += fixtureSalvageValue(p);
      return null;
    }
    case 'fuse': {
      const p = h.parts.find((x) => x.uid === edit.partUid);
      const sp = h.items.find((i) => i.uid === edit.spindleUid);
      if (!p || !sp) return 'No such part or spindle';
      if (edit.socket < 0 || edit.socket >= sp.fused.length) return 'No such socket';
      if (sp.fused[edit.socket]) return 'That socket is taken: unfuse its part first';
      sp.fused[edit.socket] = p;
      h.parts = h.parts.filter((x) => x !== p);
      return null;
    }
    case 'unfuse': {
      const sp = h.items.find((i) => i.uid === edit.spindleUid);
      const p = sp?.fused[edit.socket];
      if (!sp || !p) return 'Nothing fused there';
      if (edit.keep && h.threadScrap < UNFUSE_KEEP_COST) return `Needs ${UNFUSE_KEEP_COST} Thread Scrap`;
      sp.fused[edit.socket] = null;
      if (edit.keep) {
        h.threadScrap -= UNFUSE_KEEP_COST;
        h.parts.push(p);
      }
      return null;
    }
    case 'allocate': {
      const ix = passiveIndex();
      const why = allocateProblem(ix, allocatedSet(ix, h.passives), edit.node, pointsOf(h).free);
      if (why) return why;
      h.passives.push(edit.node);
      return null;
    }
    case 'refund': {
      const ix = passiveIndex();
      const cost = refundPrice(h);
      const why = refundProblem(ix, allocatedSet(ix, h.passives), edit.node, cost, h.threadScrap);
      if (why) return why;
      h.passives = h.passives.filter((n) => n !== edit.node);
      h.threadScrap -= cost;
      return null;
    }
    case 'craft': {
      if (!isCurrencyId(edit.currency)) return 'Unknown currency';
      if ((h.currency[edit.currency] ?? 0) <= 0) return 'None left';
      const rune = h.runes.find((r) => r.uid === edit.uid);
      const it = h.items.find((i) => i.uid === edit.uid);
      const why = rune ? polishRune(rune) : it ? craftItem(craftRng, it, edit.currency) : 'No such item';
      if (why === null) h.currency[edit.currency] = (h.currency[edit.currency] ?? 1) - 1;
      return why;
    }
    case 'travel':
    case 'rest':
      return null;
  }
}

/** Crafting rolls for the fixture hero (UI tests and the gallery). */
const craftRng = new Rng(7);

/** Fixture Fuse sockets of a spindle base. */
export const fixtureSockets = (it: Item): number =>
  isSpindleId(it.base) ? spindles[it.base].fuseSockets : 0;
