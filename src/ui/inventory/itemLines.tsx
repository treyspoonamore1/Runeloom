/**
 * An item's modifier lines for tooltips and the crafting bench: affix lines show their tier and,
 * in small text, the tier's roll range ("+26 to maximum life  T3: 20–29").
 */
import type { Item } from '../../sim/hero/types';
import { itemLines } from '../items/affixText';

export function ItemLines({ item, lines }: { item: Item; lines: readonly string[] }) {
  const typed = itemLines(item, lines);
  if (typed.length === 0) return <p class="mn-muted">No modifiers.</p>;
  return (
    <ul class="tl-lines">
      {typed.map((l, i) => (
        <li key={i} class={`tl-${l.kind}`}>
          {l.text}
          {l.affix ? (
            <small
              class="tl-tier"
              title={`${l.affix.side === 'prefix' ? 'Prefix' : 'Suffix'}, tier ${l.affix.tier} (tier 1 is the best)${
                l.affix.range ? `; this tier rolls ${l.affix.label.split(': ')[1]}` : ''
              }`}
            >
              {l.affix.label}
            </small>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
