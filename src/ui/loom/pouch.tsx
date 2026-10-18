/** The rune pouch: every rune this build ships, grouped by kind, searchable. Sandbox: unlimited. */
import { ALLOWED_SHIPS } from '../../app/loadout';
import type { RuneDef } from '../../../data/runes';
import { KIND_ORDER, KIND_TITLE } from './describe';
import { RuneGlyph } from './glyphs';
import type { LoomState } from './loomState';
import { allRunes, placements } from './model';
import { tip, tipHandlers } from './popups';

/** Runes the player can use in this build, in kind order then table order. */
export const pouchRunes: readonly RuneDef[] = KIND_ORDER.flatMap((k) =>
  allRunes.filter((r) => r.kind === k && ALLOWED_SHIPS.has(r.ships)),
);

export function matchesSearch(r: RuneDef, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (s === '') return true;
  return (
    r.name.toLowerCase().includes(s) ||
    r.notation.toLowerCase().includes(s) ||
    r.kind.includes(s) ||
    r.description.toLowerCase().includes(s)
  );
}

export const RUNE_MIME = 'application/x-runeloom-rune';

export function Pouch({ st }: { st: LoomState }) {
  const q = st.search.value;
  const armed = st.armed.value;
  const tree = st.draft;
  return (
    <section class="lm-pouch lm-panel" aria-label="Rune pouch">
      <header class="lm-panel-head">
        <h3>Rune pouch</h3>
        <span class="lm-inf" title="Sandbox: unlimited copies of every rune">
          ∞ sandbox
        </span>
      </header>
      <input
        class="lm-search"
        type="search"
        placeholder="Search runes…"
        aria-label="Search runes"
        value={q}
        onInput={(e) => (st.search.value = (e.currentTarget as HTMLInputElement).value)}
      />
      <div class="lm-scroll">
        {KIND_ORDER.map((k) => {
          const list = pouchRunes.filter((r) => r.kind === k && matchesSearch(r, q));
          if (list.length === 0) return null;
          return (
            <div class="lm-group" key={k}>
              <h4 class={`k-${k}`}>{KIND_TITLE[k]}</h4>
              <div class="lm-grid">
                {list.map((r) => {
                  const fits = placements(tree, r.id).some((p) => p.ok);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      draggable
                      class={`lm-chip k-${r.kind} r-${r.id}${armed === r.id ? ' armed' : ''}${fits ? '' : ' nofit'}`}
                      aria-pressed={armed === r.id}
                      aria-label={`${r.name}, ${r.kind}, complexity ${r.cx}${fits ? '' : ', no spot in this weave'}`}
                      onClick={() => {
                        st.picker.value = null;
                        st.armed.value = armed === r.id ? null : r.id;
                      }}
                      onDragStart={(e) => {
                        tip.value = null;
                        e.dataTransfer?.setData(RUNE_MIME, r.id);
                        e.dataTransfer?.setData('text/plain', r.notation);
                        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
                        st.dragging.value = r.id;
                      }}
                      onDragEnd={() => (st.dragging.value = null)}
                      {...tipHandlers(
                        r,
                        'right',
                        fits ? undefined : 'No spot in this weave takes it right now.',
                      )}
                    >
                      <span class={`lm-medal k-${r.kind} r-${r.id}`}>
                        <RuneGlyph id={r.id} />
                      </span>
                      <span class="lm-name">{r.name}</span>
                      <span class="lm-cx" title="Complexity">
                        {r.cx}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p class="lm-pouch-hint">
        {armed
          ? 'Now click a lit spot in the weave. Esc cancels.'
          : 'Pick a rune, or drag it onto the weave.'}
      </p>
    </section>
  );
}
