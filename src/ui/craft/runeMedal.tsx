/** A rune's round glyph in its kind's color, the way the Loom's pouch draws it. */
import { getRune } from '../../../data/runes';
import { RuneGlyph } from '../loom/glyphs';

export function RuneMedal({ id }: { id: string }) {
  return (
    <span class={`lm-medal k-${getRune(id)?.kind ?? 'form'} r-${id}`} aria-hidden="true">
      <RuneGlyph id={id} />
    </span>
  );
}
