/** "While you were away": what the Hearth made while the game was closed (offline progress, M7). */
import { useEffect, useRef } from 'preact/hooks';
import type { OfflineGains } from '../../app/hearth';
import { Icon } from '../adventure/icons';
import { fmtAway, offlineLines } from './hearthModel';
import { injectMenuStyle, menuCss } from '../menus/menuStyle';
import { injectHearthStyle } from './hearthStyle';

export function OfflineModal(p: { gains: OfflineGains; onClose(): void }) {
  injectMenuStyle('rl-menu-style', menuCss);
  injectHearthStyle();
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus({ preventScroll: true }), []);
  const lines = offlineLines(p.gains);
  return (
    <div class="hx-away-bg" onPointerDown={(e) => e.target === e.currentTarget && p.onClose()}>
      <div class="hx-away-card" role="alertdialog" aria-modal="true" aria-label="While you were away">
        <h2>While you were away</h2>
        <p class="for">
          The Hearth kept burning for <b>{fmtAway(p.gains.seconds)}</b>
          {p.gains.seconds >= 8 * 3600 ? ' (the most it will count)' : ''}.
        </p>
        <ul>
          {lines.length === 0 ? (
            <li class="none">
              Nothing finished yet. Build in the Hearth and it will work while you are gone.
            </li>
          ) : (
            lines.map((l) => <li key={l}>{l}</li>)
          )}
        </ul>
        <button type="button" class="mn-btn gold" ref={btn} onClick={p.onClose}>
          <Icon kind="ember" cls="ad-ico hx-btn-ico" /> Back to the Weave <kbd>Enter</kbd>
        </button>
      </div>
    </div>
  );
}
