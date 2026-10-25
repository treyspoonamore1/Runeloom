/** A list of affix lines as the bench draws them: side and tier badge, the line, its tier range; new and gone lines marked. */
import type { DiffRow } from './craftDiff';

const MARK_CLASS = { same: '', new: 'cr-new', gone: 'cr-gone' } as const;
const MARK_LABEL = { same: '', new: 'new: ', gone: 'removed: ' } as const;

/** `ranges`: where each tier's roll range goes: beside the line, after its text, or nowhere. */
export function AffixRows({ lines, ranges = 'beside' }: { lines: readonly DiffRow[]; ranges?: 'beside' | 'inline' | 'none' }) {
  return (
    <ul class="cr-lines">
      {lines.map(({ line, mark }, i) => (
        <li key={`${line.key}#${i}`} class={MARK_CLASS[mark]} title={line.hint || undefined}>
          {line.tier !== null ? (
            <span class={`cr-tier t${line.tier}`}>
              {line.side === 'prefix' ? 'P' : line.side === 'suffix' ? 'S' : 'T'}
              {line.tier}
            </span>
          ) : null}
          <span class="cr-txt">
            {MARK_LABEL[mark] ? <span class="cr-sr">{MARK_LABEL[mark]}</span> : null}
            {line.text}
            {ranges === 'inline' && line.range ? <span class="cr-range inline"> ({line.range})</span> : null}
          </span>
          {ranges === 'beside' && line.range ? <span class="cr-range">{line.range}</span> : null}
        </li>
      ))}
    </ul>
  );
}
