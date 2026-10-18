/** Chemistry Lab controls: the hint in the corner, R to run the station you stand at, Shift+R for all. */
import { h, render } from 'preact';
import { labStations } from '../../data/lab';
import { nearestStation } from '../sim';
import type { DebugContext } from './debug';
import { consoleOpen } from './console/Console';
import { runLabStations } from './console/lab';
import { showToast } from './toast';

export const LAB_SCENE = 'lab';

const HINT_STYLE: Record<string, string> = {
  position: 'fixed',
  top: '8px',
  right: '8px',
  padding: '6px 10px',
  background: 'rgba(14, 19, 24, 0.82)',
  border: '1px solid #2c3a45',
  borderRadius: '4px',
  color: '#b9c7d1',
  font: "11px/1.4 ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  pointerEvents: 'none',
  zIndex: '900',
};

export function LabHint(): preact.JSX.Element {
  return (
    <div class="lab-hint" style={HINT_STYLE}>
      R: run nearest station · Shift+R: run all · F1: overlays
    </div>
  );
}

const isTextField = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');

/** Installs the hint and the R keys when the scene is the lab; does nothing elsewhere. */
export function installLabControls(ctx: DebugContext): void {
  if (ctx.session.sceneId !== LAB_SCENE) return;
  const host = document.createElement('div');
  ctx.uiRoot.appendChild(host);
  render(h(LabHint, {}), host);
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyR' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (consoleOpen.value || isTextField(e.target)) return;
    const state = ctx.session.state;
    const all = e.shiftKey;
    const indices = all ? labStations.map((_, i) => i) : [nearestStation(state)];
    if (indices[0]! < 0) return;
    e.preventDefault();
    showToast(ctx.uiRoot, runLabStations(ctx, indices));
  });
}
