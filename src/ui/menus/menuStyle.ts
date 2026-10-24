/**
 * Stylesheet for the adventure menus (inventory and Fuse, passive tree, region map) and their
 * shared frame. Same Loomwright look as the Loom (loomStyle.ts): indigo plates, gold trim, dark
 * outlines, sizes in the HUD's --u. Narrow screens get a fixed --u and a single scrolling column.
 */
export const menuCss = `
#ui.rl-menu-open .dbg-left { visibility: hidden !important; }
.mn-root { --rar: var(--sand);
  position: absolute; inset: 0; z-index: 700; pointer-events: auto !important; display: flex; align-items: stretch; justify-content: center;
  background: radial-gradient(ellipse at 50% 40%, rgba(30, 24, 70, 0.8), rgba(10, 8, 24, 0.92)); animation: rl-fade 0.16s ease-out; outline: none;
  font-size: calc(var(--u) * 1.9); line-height: 1.3; }
.mn-root :focus-visible { outline: calc(var(--u) * 0.35) solid var(--gold-hi); outline-offset: calc(var(--u) * 0.25); }
.mn-card { position: relative; margin: calc(var(--u) * 2); flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; border-radius: calc(var(--u) * 2.2);
  background: linear-gradient(180deg, rgba(43, 37, 87, 0.98), rgba(24, 20, 52, 0.99));
  box-shadow: 0 0 0 calc(var(--u) * 0.45) var(--ink), 0 0 0 calc(var(--u) * 0.9) var(--gold-lo), 0 0 0 calc(var(--u) * 1.35) var(--ink), 0 calc(var(--u) * 2) calc(var(--u) * 5) rgba(0, 0, 0, 0.55); }
.mn-head { display: flex; align-items: center; gap: calc(var(--u) * 2); padding: calc(var(--u) * 1.1) calc(var(--u) * 2.2); border-bottom: calc(var(--u) * 0.25) solid rgba(242, 195, 91, 0.25); flex-wrap: wrap; }
.mn-head h2 { margin: 0; font-size: calc(var(--u) * 3.2); letter-spacing: 0.08em; text-transform: uppercase; color: var(--gold-hi); line-height: 1; text-shadow: 0 calc(var(--u) * 0.3) 0 var(--terra), 0 calc(var(--u) * 0.6) 0 var(--ink); }
.mn-tabs { display: flex; gap: calc(var(--u) * 0.8); margin-left: auto; }
.mn-tab, .mn-btn { font: inherit; cursor: pointer; border: 0; display: inline-flex; align-items: center; gap: calc(var(--u) * 0.6); border-radius: calc(var(--u) * 1.1); padding: calc(var(--u) * 0.6) calc(var(--u) * 1.6); font-size: calc(var(--u) * 1.8); font-weight: 700; line-height: 1.2; white-space: nowrap;
  color: var(--cream); background: linear-gradient(180deg, var(--indigo-3), var(--indigo-1)); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--gold-lo), 0 0 0 calc(var(--u) * 0.9) var(--ink); }
.mn-tab[aria-selected='true'], .mn-btn.gold { color: var(--ink); background: linear-gradient(180deg, var(--gold-hi), var(--gold) 55%, #e0a23a); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 calc(var(--u) * 0.45) 0 calc(var(--u) * 0.3) var(--ink); }
.mn-tab:hover, .mn-btn:hover:not(:disabled) { filter: brightness(1.1); }
.mn-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.mn-btn.danger { background: linear-gradient(180deg, #e0523f, #8a1f26); }
.mn-tab kbd, .mn-btn kbd, .mn-help kbd { font: inherit; font-size: 0.82em; padding: 0 calc(var(--u) * 0.5); border-radius: calc(var(--u) * 0.5); color: var(--ink); background: var(--sand); }
.mn-tab[aria-selected='true'] kbd { background: rgba(42, 28, 31, 0.18); }
.mn-body { flex: 1; min-height: 0; display: grid; gap: calc(var(--u) * 1.6); padding: calc(var(--u) * 1.6) calc(var(--u) * 1.8) calc(var(--u) * 1.8); }
.mn-panel { min-height: 0; min-width: 0; display: flex; flex-direction: column; border-radius: calc(var(--u) * 1.4); background: rgba(14, 11, 34, 0.55); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(242, 195, 91, 0.16); padding: calc(var(--u) * 1.2); }
.mn-panel h3 { margin: 0 0 calc(var(--u) * 0.9); font-size: calc(var(--u) * 1.6); letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold); font-weight: 700; display: flex; justify-content: space-between; align-items: baseline; gap: calc(var(--u) * 1); }
.mn-panel h3 small { letter-spacing: 0.04em; text-transform: none; color: var(--sand); font-weight: 400; font-size: calc(var(--u) * 1.5); }
.mn-scroll { flex: 1; min-height: 0; overflow: auto; scrollbar-width: thin; scrollbar-color: var(--gold-lo) transparent; padding-right: calc(var(--u) * 0.4); }
.mn-muted { color: #a59cc8; margin: calc(var(--u) * 0.4) 0; }
.mn-help { color: #8a82ad; font-size: calc(var(--u) * 1.5); margin: calc(var(--u) * 0.8) 0 0; font-style: italic; }
.mn-note { position: absolute; left: 50%; bottom: calc(var(--u) * 3.2); transform: translateX(-50%); z-index: 5; padding: calc(var(--u) * 0.8) calc(var(--u) * 2.2); border-radius: 999px; font-weight: 700; color: var(--cream); background: rgba(138, 31, 38, 0.95); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 0 calc(var(--u) * 0.6) #ff9a85; animation: rl-fade 0.15s ease-out; white-space: nowrap; pointer-events: none; }
.mn-note.ok { background: rgba(26, 82, 64, 0.95); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 0 calc(var(--u) * 0.6) #72dcc8; }
.r-normal { --rar: #e9dfc6; } .r-magic { --rar: #8fb0ff; } .r-rare { --rar: #ffd75a; } .r-unique { --rar: #f0954a; }

/* ---- Floating tooltip ---- */
.mn-tip { position: fixed; z-index: 760; width: calc(var(--u) * 40); max-width: calc(100vw - 16px); pointer-events: none; padding: calc(var(--u) * 1.2) calc(var(--u) * 1.4); border-radius: calc(var(--u) * 1.2); font-size: calc(var(--u) * 1.75); color: var(--sand);
  background: linear-gradient(180deg, rgba(36, 30, 77, 0.98), rgba(18, 14, 40, 0.99)); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--rar), 0 calc(var(--u) * 1) calc(var(--u) * 3) rgba(0, 0, 0, 0.6); }
.mn-tip h4 { margin: 0; font-size: calc(var(--u) * 2.2); color: var(--rar); }
.mn-tip .mn-base { margin: 0 0 calc(var(--u) * 0.7); color: #a59cc8; font-size: calc(var(--u) * 1.55); }
.mn-tip ul { margin: 0; padding: 0; list-style: none; }
.mn-tip li { padding: calc(var(--u) * 0.15) 0; color: var(--cream); }
.mn-tip .mn-sep { margin: calc(var(--u) * 0.9) 0 calc(var(--u) * 0.5); font-size: calc(var(--u) * 1.4); letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold); }
.mn-tip .good { color: #8ff0b0; } .mn-tip .bad { color: #ff9a85; }
.mn-tip .mn-hint { margin-top: calc(var(--u) * 0.8); color: #8a82ad; font-style: italic; font-size: calc(var(--u) * 1.5); }
.mn-tip .mn-cur { color: #b9b0d8; }

/* ---- Dialog ---- */
.mn-dialog-bg { position: absolute; inset: 0; z-index: 750; display: flex; align-items: center; justify-content: center; background: rgba(8, 6, 20, 0.55); animation: rl-fade 0.12s ease-out; }
.mn-dialog { width: calc(var(--u) * 54); max-width: calc(100vw - 32px); padding: calc(var(--u) * 2.4) calc(var(--u) * 2.8); border-radius: calc(var(--u) * 1.8); color: var(--sand);
  background: linear-gradient(180deg, rgba(43, 37, 87, 0.99), rgba(26, 22, 56, 0.99)); box-shadow: 0 0 0 calc(var(--u) * 0.45) var(--ink), 0 0 0 calc(var(--u) * 0.9) var(--gold-lo), 0 0 0 calc(var(--u) * 1.35) var(--ink), 0 calc(var(--u) * 2) calc(var(--u) * 5) rgba(0, 0, 0, 0.6); }
.mn-dialog h3 { margin: 0 0 calc(var(--u) * 1); font-size: calc(var(--u) * 2.6); color: var(--gold-hi); }
.mn-dialog p { margin: 0 0 calc(var(--u) * 1.2); }
.mn-dialog .mn-acts { display: flex; gap: calc(var(--u) * 1.2); justify-content: flex-end; flex-wrap: wrap; margin-top: calc(var(--u) * 1.8); }
.mn-dialog .mn-why { color: #ff9a85; font-size: calc(var(--u) * 1.6); }

@media (max-width: 760px) {
  .mn-root { --u: 4.4px; }
  .mn-card { margin: 6px; }
  .mn-body { grid-template-columns: 1fr !important; overflow: auto; }
  .mn-body > .mn-panel { min-height: auto; }
  .mn-tabs { margin-left: 0; flex-wrap: wrap; }
}
`;

export function injectMenuStyle(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
