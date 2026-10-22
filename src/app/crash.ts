/**
 * When a frame throws, the loop stops and the game freezes (app/loop.ts onCrash). This sends a
 * crash report to Claude through the Artifact's database (app/handoff.ts): the error, its stack,
 * the room, and the replay since the session's last reset (seed and inputs: `npm run sim --
 * --replay` reproduces it), plus the current save in adventure mode. It also shows a panel
 * saying so, with a button to save the report as a file and one to reload.
 */
import { makeSave } from '../sim';
import { makeReplay } from './replay';
import { saveFile, sendToClaude } from './handoff';
import type { Session } from './session';

function attempt<T>(f: () => T): T | string {
  try {
    return f();
  } catch (e) {
    return `unavailable: ${String(e)}`;
  }
}

export async function reportCrash(session: Session, error: unknown, uiRoot: HTMLElement): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error('Runeloom crashed:', err);
  const s = session.state;
  const report = {
    format: 'runeloom-crash',
    message: err.message,
    stack: err.stack ?? '',
    roomId: s.room.id,
    tick: s.tick,
    userAgent: navigator.userAgent,
    replay: attempt(() => makeReplay(session)),
    save: s.mode === 'adventure' ? attempt(() => makeSave(s)) : null,
  };
  const text = JSON.stringify(report);
  const name = `runeloom-crash-${s.room.id.replace(/\//g, '_')}-t${s.tick}.json`;

  const panel = document.createElement('div');
  panel.setAttribute('role', 'alertdialog');
  panel.style.cssText =
    'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9999;max-width:min(520px,92vw);' +
    'padding:20px 24px;border-radius:12px;background:#1d1838;color:#f6ecd9;font:15px/1.45 sans-serif;' +
    'box-shadow:0 0 0 3px #f2c35b,0 12px 40px rgba(0,0,0,.6)';
  const h = document.createElement('h2');
  h.textContent = 'The game stopped on an error';
  h.style.cssText = 'margin:0 0 8px;font-size:20px;color:#ffd75a';
  const p = document.createElement('p');
  p.textContent = `${err.message}`;
  p.style.cssText = 'margin:0 0 8px;font-family:monospace;font-size:13px;word-break:break-word';
  const status = document.createElement('p');
  status.textContent = 'Sending a crash report to Claude…';
  status.style.margin = '0 0 12px';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const button = (label: string, on: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText =
      'padding:6px 14px;border-radius:8px;border:0;background:#f2c35b;color:#2a1c1f;font-weight:700;cursor:pointer';
    b.onclick = on;
    row.appendChild(b);
  };
  button('Save crash file', () => void saveFile(name, text).then((m) => (status.textContent = m)));
  button('Reload', () => location.reload());
  panel.append(h, p, status, row);
  uiRoot.appendChild(panel);

  const id = await sendToClaude('crash', name, text, {
    message: err.message.slice(0, 500),
    roomId: s.room.id,
    tick: s.tick,
  });
  status.textContent = id
    ? `Crash report sent to Claude (${id}). Tell Claude the game crashed; it can read the report.`
    : "Couldn't send the report from here. Save the crash file and attach it in chat.";
}
