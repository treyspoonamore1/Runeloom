/**
 * The rune pouch, grouped by kind and searchable. Sandbox, arena and lab: every rune this build
 * ships, unlimited. Adventure: only the runes the hero owns, with free / owned counts.
 */
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

/** The runes the pouch offers: owned ones in adventure mode, else every shipped rune. */
export function pouchPool(st: LoomState): readonly RuneDef[] {
  const t = st.totals.value;
  return t ? pouchRunes.filter((r) => (t.get(r.id) ?? 0) > 0) : pouchRunes;
}

export function Pouch({ st }: { st: LoomState }) {
  const q = st.search.value;
  const armed = st.armed.value;
  const tree = st.draft;
  const totals = st.totals.value;
  const free = st.free.value;
  const opts = st.editOpts;
  const pool = pouchPool(st);
  const owned = totals ? [...totals.values()].reduce((a, b) => a + b, 0) : 0;
  return (
    <section class="lm-pouch lm-panel" aria-label="Rune pouch">
      <header class="lm-panel-head">
        <h3>Rune pouch</h3>
        {totals ? (
          <span class="lm-inf" title="Each rune sits in one place at a time. Free / owned">
            {owned} runes
          </span>
        ) : (
          <span class="lm-inf" title="Sandbox: unlimited copies of every rune">
            ∞ sandbox
          </span>
        )}
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
          const list = pool.filter((r) => r.kind === k && matchesSearch(r, q));
          if (list.length === 0) return null;
          return (
            <div class="lm-group" key={k}>
              <h4 class={`k-${k}`}>{KIND_TITLE[k]}</h4>
              <div class="lm-grid">
                {list.map((r) => {
                  const pl = placements(tree, r.id, opts);
                  const fits = pl.some((p) => p.ok);
                  const why = fits
                    ? undefined
                    : (pl[0]?.reason ?? 'No spot in this weave takes it right now.');
                  const n = free?.get(r.id) ?? 0;
                  const total = totals?.get(r.id) ?? 0;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      draggable
                      class={`lm-chip k-${r.kind} r-${r.id}${armed === r.id ? ' armed' : ''}${fits ? '' : ' nofit'}`}
                      aria-pressed={armed === r.id}
                      aria-label={`${r.name}, ${r.kind}, complexity ${r.cx}${totals ? `, ${n} of ${total} free` : ''}${fits ? '' : `, ${why}`}`}
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
                      {...tipHandlers(r, 'right', why)}
                    >
                      <span class={`lm-medal k-${r.kind} r-${r.id}`}>
                        <RuneGlyph id={r.id} />
                      </span>
                      <span class="lm-name">{r.name}</span>
                      {totals ? (
                        <span
                          class={`lm-count${n <= 0 ? ' none' : ''}`}
                          title={`${n} free of ${total} owned`}
                        >
                          {n}/{total}
                        </span>
                      ) : null}
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
          : totals
            ? 'Pick a rune, or drag it onto the weave. Free / owned.'
            : 'Pick a rune, or drag it onto the weave.'}
      </p>
    </section>
  );
}
