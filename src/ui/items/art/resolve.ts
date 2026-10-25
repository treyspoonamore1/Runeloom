/**
 * Which picture an item, currency or part gets. Pure lookups (no DOM), so tests can check every
 * id in data/ has its own art and that unknown ids fall back without throwing.
 */
import { currencies, type CurrencyId } from '../../../../data/currency';
import { itemKinds, type ItemKind } from '../../../../data/items';
import { kindOfBase } from '../../../sim/items/items';
import { CURRENCY_ART, unknownCurrency, type CurrencyShape } from './currency';
import { boots, charm, cloak, GEAR_ART, hood, unknownItem } from './gear';
import type { Shape } from './ink';
import { PART_ART, unknownPart } from './parts';
import { SPINDLE_ART, twig } from './spindles';
import { UNIQUE_ART } from './uniques';

/** Where a picture came from: the unique, the base, a kind fallback, or nothing known. */
export type ArtFrom = 'unique' | 'base' | 'kind' | 'unknown';

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Kind fallbacks: the kind's shape in plain grey-violet, for bases the art doesn't know yet. */
const KIND_ART: Record<ItemKind, Shape> = {
  spindle: () => twig({ wood: '#8a82ad', leaf: '#b9b0d8', thread: '#e9dfc6' }),
  cloak: () => cloak({ main: '#8a82ad', lining: '#4a4270', clasp: '#e9dfc6' }),
  hood: () => hood({ main: '#8a82ad', inner: '#1d1838', trim: '#e9dfc6' }),
  boots: () => boots({ main: '#8a82ad', back: '#5f5788', cuff: '#b9b0d8' }),
  charm: () => charm({ cord: '#b9b0d8', bone: '#e9dfc6', bead: '#8a82ad', mark: '#5f5788' }),
};

/** A base's kind from the data, else guessed from its id ("wool_cloak" is a cloak). */
export function guessKind(base: string): ItemKind | null {
  const known = kindOfBase(base);
  if (known) return known;
  const id = base.toLowerCase();
  if (id.includes('boot')) return 'boots';
  return itemKinds.find((k) => id.includes(k)) ?? null;
}

export function resolveItemArt(src: { base?: string; unique?: string }): { from: ArtFrom; shape: Shape } {
  const base = String(src.base ?? '');
  if (src.unique && own(UNIQUE_ART, src.unique)) return { from: 'unique', shape: UNIQUE_ART[src.unique]! };
  if (own(SPINDLE_ART, base)) return { from: 'base', shape: SPINDLE_ART[base]! };
  if (own(GEAR_ART, base)) return { from: 'base', shape: GEAR_ART[base]! };
  const kind = guessKind(base);
  return kind ? { from: 'kind', shape: KIND_ART[kind] } : { from: 'unknown', shape: unknownItem };
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export function resolveCurrencyArt(
  id: string,
  palette: Record<string, number>,
): { from: ArtFrom; shape: CurrencyShape; color: string } {
  if (own(CURRENCY_ART, id) && own(currencies, id))
    return { from: 'base', shape: CURRENCY_ART[id as CurrencyId], color: hex(palette[id] ?? 0xe9dfc6) };
  return { from: 'unknown', shape: unknownCurrency, color: '#e9dfc6' };
}

export function resolvePartArt(id: string): { from: ArtFrom; shape: Shape } {
  return own(PART_ART, id) ? { from: 'base', shape: PART_ART[id]! } : { from: 'unknown', shape: unknownPart };
}
