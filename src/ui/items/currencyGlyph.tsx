/** The crafting currency glyph (M5): a knot in the currency's color. Menus now draw currencies with CurrencyArt (itemArt.tsx); the crafting bench still uses this. */
import type { CurrencyId } from '../../../data/currency';
import { LOOT } from '../../render/world/worldPalette';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export function CurrencyGlyph({ id }: { id: CurrencyId }) {
  const c = hex(LOOT.currency[id]);
  return (
    <svg class="ad-ico" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="11" fill="#3a3040" stroke="#1c1426" stroke-width="2" />
      <ellipse cx="16" cy="16" rx="8.5" ry="3.6" stroke={c} stroke-width="2.2" fill="none" />
      <ellipse cx="16" cy="16" rx="3.6" ry="8.5" stroke={c} stroke-width="2.2" fill="none" />
      <circle cx="16" cy="16" r="2.8" fill={c} />
    </svg>
  );
}
