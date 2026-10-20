/**
 * The item-get panel (DESIGN §10.2's dungeon item): a Zelda-style "you got it" card for a new
 * element rune, centered below the hero, who holds the rune overhead in a light burst (render).
 * The HUD opens it like a menu (the sim pauses, player input is off) and owns its keys: Enter or
 * Tab opens the Loom on the suggested slot, Esc continues.
 */
import { useEffect, useRef } from 'preact/hooks';
import { RuneGlyph } from '../loom/glyphs';
import type { ItemGetView } from './itemGetModel';
import { injectItemGetStyle } from './itemGetStyle';

/** The suggestion line with its weave in the notation font. */
function Step({ text, notation }: { text: string; notation: string | null }) {
  const at = notation ? text.indexOf(notation) : -1;
  if (at < 0 || !notation) return <p class="ig-step-text">{text}</p>;
  return (
    <p class="ig-step-text">
      {text.slice(0, at)}
      <code>{notation}</code>
      {text.slice(at + notation.length)}
    </p>
  );
}

export function ItemGetPanel(p: { view: ItemGetView; onLoom(): void; onContinue(): void }) {
  injectItemGetStyle();
  const loomBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    loomBtn.current?.focus({ preventScroll: true });
  }, [p.view.rune]);
  const v = p.view;
  const s = v.suggestion;
  return (
    <div class={`ig-root ig-${v.rune}`} role="dialog" aria-modal="true" aria-labelledby="ig-title">
      <div class="ig-card">
        <p class="ig-kicker">New element</p>
        <div class="ig-medal" aria-hidden="true">
          <RuneGlyph id={v.rune} class="ig-glyph" />
        </div>
        <h2 id="ig-title">{v.title}</h2>
        <p class="ig-flavor">{v.flavor}</p>
        {v.does.length ? (
          <ul class="ig-does" aria-label="What it does">
            {v.does.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : null}
        <div class="ig-step">
          <b>Next</b>
          <Step text={s.text} notation={s.notation} />
          {s.why ? <small>{s.why}</small> : null}
        </div>
        <div class="ig-acts">
          <button type="button" class="ig-btn gold" ref={loomBtn} data-act="loom" onClick={p.onLoom}>
            Open the Loom <kbd>Enter</kbd>
          </button>
          <button type="button" class="ig-btn" data-act="continue" onClick={p.onContinue}>
            Continue <kbd>Esc</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Keys while the panel is open: Esc continues; Tab opens the Loom (the key it names); Enter or
 * Space presses the focused button (Open the Loom by default); arrows move between the buttons.
 */
export function itemGetKey(e: KeyboardEvent, act: (toLoom: boolean) => void): void {
  if (e.repeat) return;
  const focused = (document.activeElement as HTMLElement | null)?.dataset?.act;
  if (e.key === 'Escape') act(false);
  else if (e.key === 'Tab') act(true);
  else if (e.key === 'Enter' || e.key === ' ') act(focused !== 'continue');
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const other = document.querySelector<HTMLElement>(
      `.ig-btn[data-act="${focused === 'continue' ? 'loom' : 'continue'}"]`,
    );
    other?.focus();
  } else return;
  e.preventDefault();
  e.stopPropagation();
}
