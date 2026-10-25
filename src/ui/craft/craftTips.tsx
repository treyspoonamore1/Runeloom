/** Hover text for a card in the bench's list: the item's affixes with tiers and ranges, and why a dimmed one is dimmed. */
import { snapshotOf } from './craftDiff';
import type { Entry } from './craftModel';
import type { HeroState } from '../../sim/hero/types';
import { AffixRows } from './affixRows';

export function EntryTip({ hero, entry, armed }: { hero: Readonly<HeroState>; entry: Entry; armed: boolean }) {
  const snap = snapshotOf(hero, entry.uid);
  return (
    <>
      <h4>{entry.name}</h4>
      {entry.kind === 'item' ? (
        <p class="mn-base">
          {entry.base} · {entry.item.rarity} · item level {entry.item.itemLevel}
        </p>
      ) : (
        <p class="mn-base">
          Level {entry.rune.level} · Quality {entry.rune.quality}%
        </p>
      )}
      {snap && snap.lines.length > 0 ? <AffixRows lines={snap.lines.map((line) => ({ line, mark: 'same' }))} /> : null}
      {entry.kind === 'item' && snap && snap.lines.length === 0 ? <p class="mn-muted">No affixes.</p> : null}
      {armed && entry.problem ? <p class="mn-hint">{entry.problem}</p> : null}
    </>
  );
}
