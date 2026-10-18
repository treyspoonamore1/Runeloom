/** One stylesheet for all dev tools; injected once by createDebugUI. */
export const css = `
.dbg-left { position: fixed; top: 8px; left: 8px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; pointer-events: none !important; z-index: 900; }
.dbg-left > * { pointer-events: auto; }
.dbg-panel { background: rgba(14, 19, 24, 0.82); border: 1px solid #2c3a45; border-radius: 4px; color: #b9c7d1; font: 11px/1.4 ui-monospace, 'SF Mono', Menlo, Consolas, monospace; padding: 6px 9px; }
.dbg-panel h4 { margin: 0 0 4px; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #6f8ea3; font-weight: 600; }
.dbg-stats { min-width: 190px; pointer-events: none !important; }
.dbg-row { display: flex; justify-content: space-between; gap: 14px; }
.dbg-row b { font-weight: 400; color: #e8eef2; font-variant-numeric: tabular-nums; }
.dbg-row.dim, .dbg-row.dim b { color: #5b6b76; }
.dbg-menu label { display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 1px 0; }
.dbg-menu label.dis { color: #5b6b76; cursor: default; }
.dbg-menu input { accent-color: #e0a64a; margin: 0; }
.dbg-console { position: fixed; left: 0; right: 0; bottom: 0; height: 26vh; min-height: 140px; display: flex; flex-direction: column; background: rgba(10, 14, 18, 0.92); border-top: 2px solid #e0a64a; font: 12px/1.45 ui-monospace, 'SF Mono', Menlo, Consolas, monospace; color: #c7d3db; z-index: 950; }
.dbg-console-out { flex: 1; overflow-y: auto; padding: 6px 10px; white-space: pre-wrap; word-break: break-word; }
.dbg-line-in { color: #e0a64a; }
.dbg-line-err { color: #ef7b6b; }
.dbg-line-hint { color: #6f8ea3; }
.dbg-console-in { display: flex; align-items: center; gap: 6px; padding: 5px 10px; border-top: 1px solid #26323b; background: #0b1014; }
.dbg-console-in span { color: #e0a64a; }
.dbg-console-in input { flex: 1; background: none; border: 0; outline: 0; color: #f2f6f8; font: inherit; }
.dbg-toasts { position: fixed; right: 12px; bottom: 12px; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; pointer-events: none !important; z-index: 1000; }
.dbg-toast { background: rgba(14, 19, 24, 0.92); border: 1px solid #e0a64a; color: #f2e6c9; border-radius: 4px; padding: 7px 12px; font: 12px ui-monospace, Menlo, Consolas, monospace; transition: opacity 0.4s; max-width: 420px; }
.dbg-toast-out { opacity: 0; }
.lil-gui.root { --background-color: rgba(14, 19, 24, 0.94); --title-background-color: #1a242c; --widget-color: #26333d; --hover-color: #324350; --focus-color: #3b4f5e; --number-color: #e0a64a; --string-color: #e0a64a; --font-family: ui-monospace, Menlo, Consolas, monospace; --font-size: 11px; --width: 260px; z-index: 960; max-height: 90vh; overflow-y: auto; }
`;

export function injectStyle(): void {
  const el = document.createElement('style');
  el.id = 'dbg-style';
  el.textContent = css;
  document.head.appendChild(el);
}
