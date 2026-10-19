/** Chemistry Lab controls: the hint in the bottom-left corner (clear of the plaques), R to run the station you stand at, Shift+R for all. */
import { signal } from '@preact/signals';
import { h, render } from 'preact';
import { labRoomId, labStations } from '../../data/lab';
import { nearestStation } from '../sim';
import type { DebugContext } from './debug';
import { consoleOpen } from './console/Console';
import { runLabStations } from './console/lab';
import { showToast } from './toast';

const HINT_STYLE: Record<string, string> = {
  position: 'fixed',
  bottom: '8px',
  left: '8px',
  padding: '6px 10px',
  background: 'rgba(14, 19, 24, 0.82)',
  border: '1px solid #2c3a45',
  borderRadius: '4px',
  color: '#b9c7d1',
  font: "11px/1.4 ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  pointerEvents: 'none',
  zIndex: '900',
};

/** True while the lab room is loaded (any scene or `room test/lab`). */
const inLab = signal(false);

export function LabHint(): preact.JSX.Element | null {
  if (!inLab.value) return null;
  return (
    <div class="lab-hint" style={HINT_STYLE}>
      R: run nearest station · Shift+R: run all · F1: overlays
    </div>
  );
}

const isTextField = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');

/** Installs the hint and the R keys; both work only while the lab room is loaded. */
export function installLabControls(ctx: DebugContext): void {
  const host = document.createElement('div');
  ctx.uiRoot.appendChild(host);
  render(h(LabHint, {}), host);
  const sync = (): void => void (inLab.value = ctx.session.state.room.id === labRoomId);
  sync();
  ctx.session.onReset(sync);
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyR' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!inLab.value || consoleOpen.value || isTextField(e.target)) return;
    const state = ctx.session.state;
    const all = e.shiftKey;
    const indices = all ? labStations.map((_, i) => i) : [nearestStation(state)];
    if (indices[0]! < 0) return;
    e.preventDefault();
    showToast(ctx.uiRoot, runLabStations(ctx, indices));
  });
}
