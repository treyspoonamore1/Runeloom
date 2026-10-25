/**
 * Item art for menus (M7.5 menu pass): one picture per item base, unique, crafting currency and
 * Fuse part, inside a frame colored by rarity. Every menu that shows an item, a currency or a
 * part (bag, equipment, Fuse, crafting bench, Spindlewright, toasts) draws it with these.
 *
 * CONTRACT (M7.5): these three components, their props, and the `.ia-*` class names stay as
 * they are. The pictures live in ./art (one file per family); the frames in itemArtStyle.ts.
 * Callers size them with their container (the art fills it) or with `size`.
 */
import type { JSX } from 'preact';
import type { CurrencyId } from '../../../data/currency';
import { LOOT } from '../../render/world/worldPalette';
import type { ItemRarity } from '../../sim/hero/types';
import { resolveCurrencyArt, resolveItemArt, resolvePartArt } from './art/resolve';
import { injectItemArtStyle } from './itemArtStyle';

export type ArtSize = 'sm' | 'md' | 'lg';

/** What ItemArt needs from an item (an Item fits, or a base for previews). */
export interface ItemArtSource {
  base: string;
  rarity: ItemRarity;
  /** Unique items: data/uniques.ts key. */
  unique?: string;
}

function Frame(p: {
  rarity?: ItemRarity | 'currency' | 'part';
  size?: ArtSize;
  children: JSX.Element;
  tier?: 1 | 2 | 3;
}) {
  injectItemArtStyle();
  const size = p.size ? ` ia-${p.size}` : '';
  return (
    <span class={`ia-frame${size} r-${p.rarity ?? 'normal'}`} aria-hidden="true">
      <svg class="ia-art" viewBox="0 0 32 32">
        {p.children}
      </svg>
      {p.tier ? (
        <span class={`ia-tier t-${p.tier}`}>
          {Array.from({ length: p.tier }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      ) : null}
    </span>
  );
}

/** An item's picture in its rarity frame. */
export function ItemArt(p: { item: ItemArtSource; size?: ArtSize }) {
  const art = resolveItemArt(p.item);
  return (
    <Frame rarity={p.item.rarity} size={p.size}>
      {art.shape()}
    </Frame>
  );
}

/** A crafting currency's picture. */
export function CurrencyArt(p: { currency: CurrencyId; size?: ArtSize }) {
  const art = resolveCurrencyArt(p.currency, LOOT.currency);
  return (
    <Frame rarity="currency" size={p.size}>
      {art.shape(art.color)}
    </Frame>
  );
}

/** A Fuse part's picture, marked with its tier (I to III) as pips on the frame. */
export function PartArt(p: { part: string; tier: 1 | 2 | 3; size?: ArtSize }) {
  const art = resolvePartArt(p.part);
  const tier = p.tier >= 1 && p.tier <= 3 ? p.tier : 1;
  return (
    <Frame rarity="part" size={p.size} tier={tier}>
      {art.shape()}
    </Frame>
  );
}
