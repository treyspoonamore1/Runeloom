/**
 * Item art for menus (M7.5 menu pass): one picture per item base, unique, crafting currency and
 * Fuse part, inside a frame colored by rarity. Every menu that shows an item, a currency or a
 * part (bag, equipment, Fuse, crafting bench, Spindlewright, toasts) draws it with these.
 *
 * CONTRACT (M7.5), owned by the art agent: these three components, their props, and the
 * `.ia-*` class names stay as they are; the art agent replaces the placeholder pictures
 * (today the slot-kind icons and the currency glyph) with per-base SVG art and rarity frames.
 * Callers size them with their container (the art fills it) or with `size`.
 */
import type { JSX } from 'preact';
import type { CurrencyId } from '../../../data/currency';
import type { ItemRarity } from '../../sim/hero/types';
import { kindOfBase } from '../../sim/items/items';
import { Icon, type IconKind } from '../adventure/icons';
import { CurrencyGlyph } from './currencyGlyph';

export type ArtSize = 'sm' | 'md' | 'lg';

/** What ItemArt needs from an item (an Item fits, or a base for previews). */
export interface ItemArtSource {
  base: string;
  rarity: ItemRarity;
  /** Unique items: data/uniques.ts key. */
  unique?: string;
}

function Frame(p: { rarity?: ItemRarity | 'currency' | 'part'; size?: ArtSize; children: JSX.Element }) {
  return (
    <span class={`ia-frame ia-${p.size ?? 'md'} r-${p.rarity ?? 'normal'}`} aria-hidden="true">
      {p.children}
    </span>
  );
}

/** An item's picture in its rarity frame. */
export function ItemArt(p: { item: ItemArtSource; size?: ArtSize }) {
  const kind = (kindOfBase(p.item.base) ?? 'charm') as IconKind;
  return (
    <Frame rarity={p.item.rarity} size={p.size}>
      <Icon kind={kind} />
    </Frame>
  );
}

/** A crafting currency's picture. */
export function CurrencyArt(p: { currency: CurrencyId; size?: ArtSize }) {
  return (
    <Frame rarity="currency" size={p.size}>
      <CurrencyGlyph id={p.currency} />
    </Frame>
  );
}

/** A Fuse part's picture, marked with its tier (I to III). */
export function PartArt(p: { part: string; tier: 1 | 2 | 3; size?: ArtSize }) {
  void p.part;
  return (
    <Frame rarity="part" size={p.size}>
      <Icon kind="part" />
    </Frame>
  );
}
