/** Shared setup for the crafting bench tests: a real new game with known gear and currency. */
import { Session } from '../../src/app/session';
import { findScene } from '../../src/app/scenes';
import type { CurrencyId } from '../../data/currency';
import type { AffixRoll, HeroState, Item, ItemRarity } from '../../src/sim/hero/types';
import { makeItem, makeRune } from '../../src/sim/items/items';
import {
  craftArmed,
  craftCurrency,
  craftFilter,
  craftLast,
  craftPending,
  craftResult,
  craftSkipConfirm,
  craftTab,
  craftTarget,
} from '../../src/ui/craft/craftState';
import { noFilter } from '../../src/ui/craft/craftModel';

export function newGame(): Session {
  const scene = findScene('adventure')!;
  return new Session({ seed: 3, roomId: scene.roomId, sceneId: scene.id, mode: scene.mode });
}

/** Puts an item in the bag and returns it. */
export function give(
  hero: HeroState,
  base: string,
  rarity: ItemRarity,
  itemLevel = 9,
  affixes: AffixRoll[] = [],
  extra: Partial<Item> = {},
): Item {
  const it = { ...makeItem(hero, base, rarity, itemLevel, affixes), ...extra };
  hero.items.push(it);
  return it;
}

export function giveCurrency(hero: HeroState, stacks: Partial<Record<CurrencyId, number>>): void {
  hero.currency = { ...stacks };
}

export function giveRune(hero: HeroState, rune: string, quality = 0) {
  const r = makeRune(hero, rune as never);
  r.quality = quality;
  hero.runes.push(r);
  return r;
}

/** Back to the bench's opening state, between tests. */
export function resetBenchState(): void {
  craftCurrency.value = 'weavers_knot';
  craftTarget.value = null;
  craftArmed.value = false;
  craftTab.value = 'items';
  craftFilter.value = noFilter;
  craftLast.value = null;
  craftResult.value = null;
  craftPending.value = null;
  craftSkipConfirm.value = false;
}

/** The text a component tree renders, expanding function components (hook-free ones only). */
export function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  const v = node as { type?: unknown; props?: Record<string, unknown> };
  if (typeof v.type === 'function') return textOf((v.type as (p: unknown) => unknown)(v.props ?? {}));
  return textOf(v.props?.children);
}
