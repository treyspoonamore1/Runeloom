/** The notation line under the tree (editable, with parse errors marked) and the slot's status. */
import { SLOT_LABELS, slotViewOf } from '../../app/loadout';
import { slotWarning } from './editor';
import type { LoomState } from './loomState';
import { draftNotation } from './model';

/** Notation text with the parse error's token highlighted (drawn behind a transparent textarea). */
function Backdrop({ text, err }: { text: string; err: { index: number; length: number } | null }) {
  if (!err)
    return (
      <div class="lm-nback" aria-hidden="true">
        {text + '​'}
      </div>
    );
  const a = Math.min(err.index, text.length);
  const b = Math.min(text.length, a + Math.max(1, err.length));
  return (
    <div class="lm-nback" aria-hidden="true">
      {text.slice(0, a)}
      <mark>{a >= text.length ? ' ' : text.slice(a, b)}</mark>
      {text.slice(b) + '​'}
    </div>
  );
}

export function NotationLine({ st }: { st: LoomState }) {
  const err = st.parseError.value;
  const text = st.text.value ?? draftNotation(st.draft);
  return (
    <div class={`lm-notation${err ? ' err' : ''}`}>
      <label for="lm-ntext">Notation</label>
      <div class="lm-nbox">
        <Backdrop text={text} err={err} />
        <textarea
          id="lm-ntext"
          rows={1}
          spellcheck={false}
          autocomplete="off"
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? 'lm-nerr' : undefined}
          value={text}
          onInput={(e) => st.typeNotation((e.currentTarget as HTMLTextAreaElement).value.replace(/\n/g, ''))}
          onBlur={() => st.commitNotation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.currentTarget as HTMLTextAreaElement).blur();
            }
          }}
        />
      </div>
      {err ? (
        <p id="lm-nerr" class="lm-nerr" role="alert">
          {err.message}
        </p>
      ) : null}
    </div>
  );
}

export function SlotStatusLine({ st }: { st: LoomState }) {
  const s = st.status;
  const label = SLOT_LABELS[st.slot.value]!;
  const live = slotViewOf(st.loadout.value, st.slot.value)?.notation ?? null;
  const warn = st.parseError.value ? 'Not applied: the notation has an error (marked above)' : slotWarning(s);
  return (
    <div class={`lm-status${warn ? ' warn' : s.kind === 'ok' ? ' ok' : ''}`} aria-live="polite">
      <div class="lm-status-main">
        {warn ? (
          <span>
            <b>⚠ {warn}</b>
          </span>
        ) : s.kind === 'ok' && s.applied ? (
          <span>
            <b>✓ Live in {label}.</b> Changes apply as you weave.
          </span>
        ) : s.kind === 'ok' ? (
          <span>
            <b>✓ This weave works.</b> Press Enter to put it in {label}.
          </span>
        ) : (
          <span>{label} is empty. Pick a trigger and a form to start, or load a reference weave.</span>
        )}
      </div>
      {(warn || !s.applied) && !(s.kind === 'invalid' && s.applied && !st.parseError.value) ? (
        <div class="lm-status-live">
          <span>
            {label} keeps {live ? <code>{live}</code> : 'nothing (empty)'}
          </span>
          <button type="button" class="lm-mini" onClick={() => st.revert()}>
            Revert edit
          </button>
        </div>
      ) : null}
    </div>
  );
}
