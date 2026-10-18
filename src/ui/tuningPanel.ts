import GUI from 'lil-gui';
import { cloneTuning, defaultTuning } from '../../data/tuning';
import { assignDeep, rangeFor } from './tuningRanges';
import type { DebugContext } from './debug';

type Obj = Record<string, unknown>;

function copyText(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    ta.remove();
  }
}

function addControls(gui: GUI, live: Obj, defaults: Obj): void {
  for (const [key, val] of Object.entries(live)) {
    if (val !== null && typeof val === 'object') {
      addControls(gui.addFolder(key), val as Obj, (defaults[key] as Obj | undefined) ?? (val as Obj));
    } else if (typeof val === 'number') {
      const d = typeof defaults[key] === 'number' ? (defaults[key] as number) : val;
      const r = rangeFor(d);
      // Keep the current value reachable even if it was pasted outside the default range.
      gui.add(live, key, Math.min(r.min, val), Math.max(r.max, val), r.step);
    } else {
      gui.add(live, key);
    }
  }
}

export interface TuningPanel {
  toggle(): void;
  /** Re-reads values after the live object was changed in place. */
  refresh(): void;
}

export function createTuningPanel(ctx: DebugContext, notify: (msg: string) => void): TuningPanel {
  let gui: GUI;
  let visible = false;
  const build = (): void => {
    gui = new GUI({ title: 'Tuning (F2)' });
    gui.domElement.style.display = visible ? '' : 'none';
    const live = ctx.session.state.tuning as unknown as Obj;
    gui
      .add(
        {
          copy: () => {
            const text = JSON.stringify(ctx.session.state.tuning, null, 2);
            const done = (ok: boolean) =>
              notify(ok ? 'Tuning JSON copied' : 'Copy failed: clipboard blocked');
            if (navigator.clipboard?.writeText)
              navigator.clipboard.writeText(text).then(
                () => done(true),
                () => done(copyText(text)),
              );
            else done(copyText(text));
          },
        },
        'copy',
      )
      .name('Copy JSON');
    gui
      .add(
        {
          reset: () => {
            assignDeep(live, cloneTuning(defaultTuning) as unknown as Obj);
            gui.controllersRecursive().forEach((c) => c.updateDisplay());
          },
        },
        'reset',
      )
      .name('Reset to defaults');
    addControls(gui, live, defaultTuning as unknown as Obj);
  };
  build();
  ctx.session.onReset(() => {
    gui.destroy();
    build();
  });
  return {
    toggle() {
      visible = !visible;
      gui.domElement.style.display = visible ? '' : 'none';
    },
    refresh() {
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    },
  };
}
