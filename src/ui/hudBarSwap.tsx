/**
 * The HUD's weave-bar switch (the second weave bar, playtest 8): beside the live slots, a "1/2"
 * bar number, the other bar's four slots small and greyed, and the X key hint.
 */
import type { BarSnap } from './hudModel';
import { WeaveIcon } from './loom/glyphs';

export function OtherBar({ bar }: { bar: BarSnap }) {
  const other = bar.active === 0 ? 2 : 1;
  return (
    <div class="rl-otherbar" aria-label={`Weave bar ${bar.active + 1} of 2 is live; X swaps to bar ${other}`}>
      <div class="rl-barnum rl-outline" title={`Weave bar ${bar.active + 1} of 2`}>
        <b>{bar.active + 1}</b>/2
      </div>
      <div class="rl-mini" title={`Bar ${other} (X swaps)`}>
        {bar.other.map((m) => (
          <i
            key={m.slot}
            class={`rl-minislot${m.notation ? '' : ' empty'}`}
            title={`Bar ${other} ${m.key}: ${m.notation ?? 'empty'}`}
          >
            {m.notation ? <WeaveIcon form={m.form} element={m.element} /> : null}
          </i>
        ))}
      </div>
      <span class="rl-swapkey">
        <span class="rl-cap">X</span> swap
      </span>
    </div>
  );
}
