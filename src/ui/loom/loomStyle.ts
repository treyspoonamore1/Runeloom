/**
 * Stylesheet for the Loom. Same Loomwright look as the HUD (hudStyle.ts): indigo plates, gold
 * trim, dark outlines. Sizes use the HUD's --u (1% of the view height, capped by width), so the
 * panel keeps its proportions from 1280×720 to 1920×1080; panels scroll inside when content is long.
 */
export const loomCss = `
/* The dev stats panel would cover the pouch; it comes back when the Loom closes. */
#ui.rl-looming .dbg-left { visibility: hidden !important; }
.lm-root { --k: var(--sand); --kd: #4a3a5e;
  position: absolute; inset: 0; z-index: 700; pointer-events: auto !important; display: flex; align-items: stretch; justify-content: center;
  background: radial-gradient(ellipse at 50% 40%, rgba(30, 24, 70, 0.78), rgba(10, 8, 24, 0.9)); animation: rl-fade 0.18s ease-out; outline: none;
  font-size: calc(var(--u) * 1.9); line-height: 1.3; }
.lm-root ::selection { background: rgba(242, 195, 91, 0.45); }
.lm-root input, .lm-root textarea { user-select: text; -webkit-user-select: text; }
.lm-root :focus-visible { outline: calc(var(--u) * 0.35) solid var(--gold-hi); outline-offset: calc(var(--u) * 0.25); }
.lm-card { position: relative; margin: calc(var(--u) * 2); flex: 1; display: flex; flex-direction: column; min-height: 0; border-radius: calc(var(--u) * 2.2);
  background: linear-gradient(180deg, rgba(43, 37, 87, 0.98), rgba(24, 20, 52, 0.99));
  box-shadow: 0 0 0 calc(var(--u) * 0.45) var(--ink), 0 0 0 calc(var(--u) * 0.9) var(--gold-lo), 0 0 0 calc(var(--u) * 1.35) var(--ink), 0 calc(var(--u) * 2) calc(var(--u) * 5) rgba(0, 0, 0, 0.55); }

/* ---- Header ---- */
.lm-head { display: flex; align-items: center; justify-content: space-between; gap: calc(var(--u) * 2); padding: calc(var(--u) * 1.2) calc(var(--u) * 2.2); border-bottom: calc(var(--u) * 0.25) solid rgba(242, 195, 91, 0.25); }
.lm-title { display: flex; align-items: center; gap: calc(var(--u) * 1.2); min-width: 0; }
.lm-title .rl-emblem { width: calc(var(--u) * 5.2); height: calc(var(--u) * 5.2); margin: 0; flex: none; }
.lm-title h2 { margin: 0; font-size: calc(var(--u) * 3.4); letter-spacing: 0.08em; text-transform: uppercase; color: var(--gold-hi); line-height: 1; text-shadow: 0 calc(var(--u) * 0.3) 0 var(--terra), 0 calc(var(--u) * 0.6) 0 var(--ink); }
.lm-title p { margin: calc(var(--u) * 0.5) 0 0; font-size: calc(var(--u) * 1.6); color: #b9b0d8; font-style: italic; }
.lm-head-acts { display: flex; gap: calc(var(--u) * 1.2); align-items: center; }
.lm-btn { font: inherit; cursor: pointer; border: 0; color: var(--ink); font-weight: 700; letter-spacing: 0.03em; border-radius: calc(var(--u) * 1.1);
  padding: calc(var(--u) * 0.7) calc(var(--u) * 1.8); font-size: calc(var(--u) * 1.8); line-height: 1.2;
  background: linear-gradient(180deg, var(--gold-hi), var(--gold) 55%, #e0a23a);
  box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 calc(var(--u) * 0.45) 0 calc(var(--u) * 0.3) var(--ink); }
.lm-btn:hover { filter: brightness(1.08); }
.lm-btn:active { transform: translateY(calc(var(--u) * 0.3)); }
.lm-btn.quiet, .lm-btn.close { background: linear-gradient(180deg, var(--indigo-3), var(--indigo-1)); color: var(--cream); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--gold-lo), 0 0 0 calc(var(--u) * 0.9) var(--ink); }
.lm-btn kbd, .lm-help kbd { font: inherit; font-size: 0.85em; padding: 0 calc(var(--u) * 0.5); border-radius: calc(var(--u) * 0.5); color: var(--ink); background: var(--sand); margin-left: calc(var(--u) * 0.4); }

/* ---- Body: pouch | center | details ---- */
.lm-body { flex: 1; min-height: 0; display: grid; grid-template-columns: calc(var(--u) * 37) minmax(0, 1fr) calc(var(--u) * 44); gap: calc(var(--u) * 1.6); padding: calc(var(--u) * 1.6) calc(var(--u) * 1.8) calc(var(--u) * 1.8); }
.lm-panel { min-height: 0; display: flex; flex-direction: column; border-radius: calc(var(--u) * 1.4); background: rgba(14, 11, 34, 0.55); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(242, 195, 91, 0.16); padding: calc(var(--u) * 1.2); }
.lm-scroll { flex: 1; min-height: 0; overflow: auto; scrollbar-width: thin; scrollbar-color: var(--gold-lo) transparent; padding-right: calc(var(--u) * 0.4); }
.lm-panel-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: calc(var(--u) * 0.8); }
.lm-panel h3, .lm-sec h4 { margin: 0; font-size: calc(var(--u) * 1.6); letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold); font-weight: 700; }
.lm-inf { font-size: calc(var(--u) * 1.5); color: var(--sand); }
.lm-muted { color: #a59cc8; margin: calc(var(--u) * 0.4) 0; }
.lm-fine { color: #8a82ad; font-size: calc(var(--u) * 1.45); margin: calc(var(--u) * 0.8) 0 0; font-style: italic; }

/* ---- Rune chips ---- */
.lm-chip { font: inherit; display: inline-flex; align-items: center; gap: calc(var(--u) * 0.6); min-width: 0; cursor: pointer; border: 0; color: var(--cream);
  padding: calc(var(--u) * 0.35) calc(var(--u) * 0.8) calc(var(--u) * 0.35) calc(var(--u) * 0.35); border-radius: 999px; font-size: calc(var(--u) * 1.7); line-height: 1.1; text-align: left;
  background: linear-gradient(180deg, #3a3172, #241e4d); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.45) color-mix(in srgb, var(--k) 55%, transparent);
  transition: transform 0.08s, filter 0.1s, box-shadow 0.1s; }
.lm-chip:hover { filter: brightness(1.15); }
.lm-chip .lm-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lm-medal { flex: none; display: inline-flex; align-items: center; justify-content: center; width: calc(var(--u) * 2.7); height: calc(var(--u) * 2.7); border-radius: 50%; color: var(--k); background: var(--kd); box-shadow: 0 0 0 calc(var(--u) * 0.2) var(--ink); }
.lm-glyph { width: 72%; height: 72%; }
.lm-cx { flex: none; min-width: calc(var(--u) * 2.1); height: calc(var(--u) * 2.1); padding: 0 calc(var(--u) * 0.35); display: inline-flex; align-items: center; justify-content: center; border-radius: calc(var(--u) * 0.5); font-size: calc(var(--u) * 1.4); font-weight: 700; color: var(--ink); background: var(--sand); }
.lm-chip.armed { background: linear-gradient(180deg, #6b5520, #3d2f12); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.55) var(--gold-hi), 0 0 calc(var(--u) * 1.6) rgba(255, 220, 120, 0.55); }
.lm-chip.nofit { opacity: 0.62; }
.lm-chip.sm { font-size: calc(var(--u) * 1.6); }
.lm-chip.xs { font-size: calc(var(--u) * 1.5); cursor: default; padding-right: calc(var(--u) * 0.7); }
.lm-chip.xs .lm-medal { width: calc(var(--u) * 2.2); height: calc(var(--u) * 2.2); }
.lm-chip.lg { font-size: calc(var(--u) * 2.1); padding: calc(var(--u) * 0.5) calc(var(--u) * 1.3) calc(var(--u) * 0.5) calc(var(--u) * 0.5); }
.lm-chip.lg .lm-medal { width: calc(var(--u) * 3.8); height: calc(var(--u) * 3.8); }
.lm-chip.lg .lm-name { overflow: visible; }
.k-trigger { --k: #f2c35b; --kd: #5a4216; }
.k-form { --k: #fff0cf; --kd: #4f3f63; }
.k-element { --k: #ff8f52; --kd: #5a2a1c; }
.k-modifier { --k: #bfaeff; --kd: #352c6e; }
.k-branch { --k: #72dcc8; --kd: #17464a; }
.r-frost { --k: #8fd3ff; --kd: #173f5e; }
.r-storm { --k: #ffe36a; --kd: #43306e; }
.r-tide { --k: #6fb2ff; --kd: #173058; }
.r-gale { --k: #8be3b0; --kd: #1a4a36; }
h4.k-trigger, h4.k-form, h4.k-element, h4.k-modifier, h4.k-branch { color: var(--k); }

/* ---- Pouch ---- */
.lm-search { font: inherit; width: 100%; margin-bottom: calc(var(--u) * 1); padding: calc(var(--u) * 0.6) calc(var(--u) * 1.1); border-radius: calc(var(--u) * 1); border: 0; color: var(--cream); background: #120e2a; box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(242, 195, 91, 0.35); font-size: calc(var(--u) * 1.7); }
.lm-search::placeholder { color: #7d74a3; }
.lm-group + .lm-group { margin-top: calc(var(--u) * 1.2); }
.lm-group h4 { margin: 0 0 calc(var(--u) * 0.6); font-size: calc(var(--u) * 1.45); letter-spacing: 0.18em; text-transform: uppercase; }
.lm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: calc(var(--u) * 0.75) calc(var(--u) * 0.9); padding: calc(var(--u) * 0.4); }
.lm-pouch-hint { margin: calc(var(--u) * 0.8) 0 0; font-size: calc(var(--u) * 1.5); color: var(--sand); text-align: center; min-height: 2.6em; }

/* ---- Center: tabs, tree, notation ---- */
.lm-center { gap: calc(var(--u) * 1.1); }
.lm-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: calc(var(--u) * 0.9); }
.lm-tab { font: inherit; position: relative; cursor: pointer; border: 0; text-align: left; display: flex; flex-direction: column; gap: calc(var(--u) * 0.2); padding: calc(var(--u) * 0.7) calc(var(--u) * 1.1); border-radius: calc(var(--u) * 1); color: var(--sand);
  background: #17122f; box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.45) rgba(168, 120, 42, 0.5); }
.lm-tab.on { color: var(--cream); background: linear-gradient(180deg, #4a3f95, #2d2663); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.55) var(--gold); }
.lm-tab-key { font-size: calc(var(--u) * 1.6); font-weight: 700; letter-spacing: 0.12em; color: var(--gold); }
.lm-tab-sum { font-size: calc(var(--u) * 1.55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lm-dot { position: absolute; top: calc(var(--u) * 0.7); right: calc(var(--u) * 0.8); width: calc(var(--u) * 1.3); height: calc(var(--u) * 1.3); border-radius: 50%; background: var(--danger); box-shadow: 0 0 0 calc(var(--u) * 0.2) var(--ink), 0 0 calc(var(--u) * 0.8) rgba(255, 90, 74, 0.8); }
.lm-treewrap { border-radius: calc(var(--u) * 1.2); background: radial-gradient(ellipse at 30% 0%, rgba(80, 68, 160, 0.25), transparent 70%), #110d27; box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(242, 195, 91, 0.12); padding: calc(var(--u) * 1.6); }
.lm-weave { min-height: 100%; display: flex; flex-direction: column; }
.lm-weave > .lm-node { flex: none; }
.lm-legend { margin-top: auto !important; padding-top: calc(var(--u) * 2); }
.lm-row { display: flex; flex-wrap: wrap; align-items: center; gap: calc(var(--u) * 0.9); min-height: calc(var(--u) * 5.6); }
.lm-node + .lm-node { margin-top: calc(var(--u) * 1); }
.lm-kids { position: relative; margin-left: calc(var(--u) * 2.4); padding-left: calc(var(--u) * 3.4); margin-top: calc(var(--u) * 1); }
.lm-kids > .lm-node { position: relative; }
.lm-kids > .lm-node::before { content: ''; position: absolute; left: calc(var(--u) * -3.4); top: calc(var(--u) * -1); height: calc(var(--u) * 3.8); width: calc(var(--u) * 2.8); border-left: calc(var(--u) * 0.3) solid var(--gold-lo); border-bottom: calc(var(--u) * 0.3) solid var(--gold-lo); border-bottom-left-radius: calc(var(--u) * 1.2); }
.lm-kids > .lm-node:not(:last-child)::after { content: ''; position: absolute; left: calc(var(--u) * -3.4); top: calc(var(--u) * 1); bottom: calc(var(--u) * -1); border-left: calc(var(--u) * 0.3) solid var(--gold-lo); }
.lm-arrow { color: var(--gold); font-size: calc(var(--u) * 2.2); font-weight: 700; margin: 0 calc(var(--u) * 0.1); }
.lm-spot { font: inherit; cursor: pointer; border: 0; }
.lm-spot.empty, .lm-spot.plus { display: inline-flex; align-items: center; justify-content: center; min-width: calc(var(--u) * 8); height: calc(var(--u) * 4.8); padding: 0 calc(var(--u) * 1.2); border-radius: 999px; color: #9a90c8; background: rgba(255, 255, 255, 0.03);
  border: calc(var(--u) * 0.25) dashed rgba(185, 176, 216, 0.55); font-size: calc(var(--u) * 1.7); font-style: italic; }
.lm-spot.plus { min-width: calc(var(--u) * 4.8); font-style: normal; font-weight: 700; font-size: calc(var(--u) * 2); }
.lm-spot.empty:hover, .lm-spot.plus:hover { color: var(--cream); border-color: var(--sand); }
.lm-spot.bad { box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.65) var(--danger), 0 0 calc(var(--u) * 1.6) rgba(255, 90, 74, 0.7); }
.lm-spot.empty.bad { border-color: var(--danger); color: #ffb3a8; }
.lm-spot.lit { animation: lm-lit 1.1s ease-in-out infinite; }
.lm-spot.empty.lit, .lm-spot.plus.lit { color: var(--gold-hi); border-color: var(--gold-hi); border-style: solid; background: rgba(242, 195, 91, 0.14); }
.lm-chip.lit { box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.55) var(--gold-hi), 0 0 calc(var(--u) * 1.4) rgba(255, 220, 120, 0.6); }
.lm-spot.over { transform: scale(1.08); filter: brightness(1.25); }
@keyframes lm-lit { 50% { filter: brightness(1.3) drop-shadow(0 0 calc(var(--u) * 0.8) rgba(255, 220, 120, 0.7)); } }
.lm-spot.dim { opacity: 0.4; }
.lm-spot.blocked { opacity: 0.6; cursor: not-allowed; border-color: rgba(255, 120, 100, 0.5) !important; }
.lm-chip.blocked { box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.5) rgba(255, 120, 100, 0.55); }
.lm-chip.sel { box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--cream), 0 0 calc(var(--u) * 1.2) rgba(255, 244, 214, 0.5); }
.lm-selwrap { position: relative; display: inline-flex; }
.lm-chipacts { position: absolute; top: calc(var(--u) * -1.6); right: calc(var(--u) * -1.2); display: flex; gap: calc(var(--u) * 0.4); z-index: 2; }
.lm-act { font: inherit; cursor: pointer; border: 0; width: calc(var(--u) * 2.6); height: calc(var(--u) * 2.6); padding: 0; border-radius: 50%; font-size: calc(var(--u) * 1.6); font-weight: 700; line-height: 1; color: var(--ink); background: var(--sand); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink); }
.lm-act.del { color: var(--cream); background: #c43c30; }
.lm-nospot { color: #ffb3a8; margin: calc(var(--u) * 1.2) 0 0; }

.lm-notation label { display: block; font-size: calc(var(--u) * 1.4); letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold); margin-bottom: calc(var(--u) * 0.4); }
.lm-nbox { position: relative; border-radius: calc(var(--u) * 0.9); background: #0c0920; box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(242, 195, 91, 0.35); }
.lm-nbox textarea:focus-visible { outline: none; }
.lm-nbox:focus-within { box-shadow: inset 0 0 0 calc(var(--u) * 0.25) var(--gold-hi), 0 0 calc(var(--u) * 1) rgba(255, 220, 120, 0.3); }
.lm-notation.err .lm-nbox { box-shadow: inset 0 0 0 calc(var(--u) * 0.25) var(--danger); }
.lm-nback, .lm-nbox textarea { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: calc(var(--u) * 1.65); line-height: 1.5; padding: calc(var(--u) * 0.7) calc(var(--u) * 1); margin: 0; white-space: pre-wrap; word-break: break-word; letter-spacing: 0; }
.lm-nback { position: absolute; inset: 0; color: transparent; pointer-events: none; overflow: hidden; }
.lm-nback mark { color: transparent; background: rgba(255, 90, 74, 0.35); border-bottom: calc(var(--u) * 0.3) solid var(--danger); border-radius: 2px; }
.lm-nbox textarea { position: relative; display: block; width: 100%; resize: none; border: 0; outline: none; overflow: hidden; color: var(--cream); background: transparent; field-sizing: content; min-height: 2.6em; caret-color: var(--gold-hi); }
.lm-nerr { margin: calc(var(--u) * 0.5) 0 0; color: #ffb3a8; font-size: calc(var(--u) * 1.6); }
.lm-nerr::before { content: '✕ '; color: var(--danger); font-weight: 700; }
.lm-status { border-radius: calc(var(--u) * 0.9); padding: calc(var(--u) * 0.7) calc(var(--u) * 1.1); background: rgba(255, 255, 255, 0.04); font-size: calc(var(--u) * 1.65); color: var(--sand); }
.lm-status.ok b { color: #9fe3a5; }
.lm-status.warn { background: rgba(255, 90, 74, 0.1); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(255, 90, 74, 0.4); }
.lm-status.warn b { color: #ffb3a8; }
.lm-status-live { display: flex; align-items: center; justify-content: space-between; gap: calc(var(--u) * 1); margin-top: calc(var(--u) * 0.5); color: #b9b0d8; }
.lm-status code, .lm-ref code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.9em; color: var(--cream); }
.lm-mini { font: inherit; flex: none; cursor: pointer; border: 0; padding: calc(var(--u) * 0.3) calc(var(--u) * 1); border-radius: calc(var(--u) * 0.7); font-size: calc(var(--u) * 1.5); font-weight: 700; color: var(--ink); background: var(--sand); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink); }
.lm-help { margin: 0; font-size: calc(var(--u) * 1.5); color: #9a90c8; }
.lm-help b { color: var(--sand); }

/* ---- Details ---- */
.lm-sec { padding: calc(var(--u) * 0.6) 0 calc(var(--u) * 1.2); }
.lm-sec + .lm-sec, .lm-valid + .lm-sec { border-top: calc(var(--u) * 0.2) solid rgba(242, 195, 91, 0.12); padding-top: calc(var(--u) * 1.1); }
.lm-sec h4 { margin-bottom: calc(var(--u) * 0.8); display: flex; align-items: center; gap: calc(var(--u) * 0.8); }
.lm-spindles { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: calc(var(--u) * 0.6); }
.lm-spindle { font: inherit; cursor: pointer; border: 0; display: flex; flex-direction: column; align-items: center; gap: calc(var(--u) * 0.2); padding: calc(var(--u) * 0.5) calc(var(--u) * 0.2); border-radius: calc(var(--u) * 0.9); color: var(--sand); background: #17122f; box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.45) rgba(168, 120, 42, 0.5); }
.lm-spindle.on { color: var(--ink); background: linear-gradient(180deg, var(--gold-hi), var(--gold)); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.5) var(--gold-lo); }
.lm-sp-name { font-size: calc(var(--u) * 1.4); white-space: nowrap; }
.lm-sp-cap { font-size: calc(var(--u) * 2.3); font-weight: 700; line-height: 1; }
.lm-sp-imp { font-size: calc(var(--u) * 1.45); }
.lm-cxbar { margin-bottom: calc(var(--u) * 0.8); }
.lm-cxlabel { display: flex; justify-content: space-between; color: var(--sand); margin-bottom: calc(var(--u) * 0.4); }
.lm-cxlabel b { color: var(--cream); font-variant-numeric: tabular-nums; }
.lm-cxbar.over .lm-cxlabel b { color: var(--danger); }
.lm-cxsegs { display: flex; gap: calc(var(--u) * 0.35); }
.lm-cxsegs i { flex: 1; height: calc(var(--u) * 1.5); border-radius: calc(var(--u) * 0.35); background: rgba(255, 255, 255, 0.08); box-shadow: 0 0 0 calc(var(--u) * 0.15) var(--ink); }
.lm-cxsegs i.f { background: linear-gradient(180deg, var(--gold-hi), var(--gold)); }
.lm-cxsegs i.x { background: rgba(255, 90, 74, 0.2); }
.lm-cxsegs i.f.x, .lm-cxbar.over .lm-cxsegs i.f { background: linear-gradient(180deg, #ff8a74, var(--danger)); }
.lm-kv { display: flex; justify-content: space-between; align-items: baseline; gap: calc(var(--u) * 1); padding: calc(var(--u) * 0.25) 0; color: var(--sand); }
.lm-kv b { color: var(--cream); text-align: right; font-variant-numeric: tabular-nums; }
.lm-kv.sm { font-size: calc(var(--u) * 1.6); padding: calc(var(--u) * 0.1) 0; }
.lm-kv.more b { color: #9fe3a5; }
.lm-kv.less b { color: #ffb08a; }
.lm-valid { margin: calc(var(--u) * 0.2) 0 calc(var(--u) * 1); padding: calc(var(--u) * 0.8) calc(var(--u) * 1); border-radius: calc(var(--u) * 0.9); color: var(--sand); background: rgba(255, 255, 255, 0.04); }
.lm-valid.ok b { color: #9fe3a5; }
.lm-valid.bad { background: rgba(255, 90, 74, 0.12); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(255, 90, 74, 0.5); }
.lm-valid.bad b { display: block; color: #ffc4b8; }
.lm-at { display: flex; align-items: center; gap: calc(var(--u) * 0.6); margin-top: calc(var(--u) * 0.5); color: #b9b0d8; font-size: calc(var(--u) * 1.55); }
.lm-dps { display: grid; grid-template-columns: 1fr 1fr; gap: calc(var(--u) * 1); margin-bottom: calc(var(--u) * 0.6); }
.lm-dps > div { display: flex; flex-direction: column; padding: calc(var(--u) * 0.7) calc(var(--u) * 1); border-radius: calc(var(--u) * 0.9); background: rgba(255, 255, 255, 0.05); }
.lm-dps span { font-size: calc(var(--u) * 1.45); color: var(--sand); }
.lm-big { font-size: calc(var(--u) * 3.2); color: var(--gold-hi); line-height: 1.1; font-variant-numeric: tabular-nums; }
.lm-big.dim { color: #6e6696; }
.lm-big.stale { color: #8f86b8; }
.lm-legend { position: sticky; bottom: 0; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: calc(var(--u) * 0.4) calc(var(--u) * 1.4); margin-top: calc(var(--u) * 2); font-size: calc(var(--u) * 1.4); color: #8a82ad; pointer-events: none; }
.lm-legend span { display: inline-flex; align-items: center; gap: calc(var(--u) * 0.5); }
.lm-legend i { width: calc(var(--u) * 1.1); height: calc(var(--u) * 1.1); border-radius: 50%; background: var(--k); box-shadow: 0 0 0 calc(var(--u) * 0.2) var(--ink); }
.lm-spin { display: inline-block; width: calc(var(--u) * 1.6); height: calc(var(--u) * 1.6); border-radius: 50%; border: calc(var(--u) * 0.3) solid rgba(242, 195, 91, 0.25); border-top-color: var(--gold-hi); animation: lm-spin 0.8s linear infinite; }
@keyframes lm-spin { to { transform: rotate(360deg); } }
.lm-notes { margin: calc(var(--u) * 0.6) 0 0; padding-left: calc(var(--u) * 2); color: #b9b0d8; font-size: calc(var(--u) * 1.5); }
.lm-bd { padding: calc(var(--u) * 0.7) calc(var(--u) * 1); border-radius: calc(var(--u) * 0.9); background: rgba(255, 255, 255, 0.04); }
.lm-bd + .lm-bd { margin-top: calc(var(--u) * 0.7); }
.lm-bd.d1 { margin-left: calc(var(--u) * 1.4); } .lm-bd.d2 { margin-left: calc(var(--u) * 2.8); } .lm-bd.d3 { margin-left: calc(var(--u) * 4.2); }
.lm-bd-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: calc(var(--u) * 0.5); }
.lm-bd-head b { color: var(--cream); }
.lm-bd-hit { color: var(--gold-hi); font-weight: 700; font-variant-numeric: tabular-nums; }
.lm-share { display: flex; gap: calc(var(--u) * 0.3); margin-bottom: calc(var(--u) * 0.5); }
.lm-share i { font-style: normal; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; padding: calc(var(--u) * 0.15) calc(var(--u) * 0.7); border-radius: calc(var(--u) * 0.5); font-size: calc(var(--u) * 1.4); font-weight: 700; color: var(--ink); background: #d9c9a3; }
.lm-share i.e-fire { background: #ff9a5c; } .lm-share i.e-frost { background: #9bd8ff; } .lm-share i.e-storm { background: #ffe36a; } .lm-share i.e-tide { background: #7cb8ff; } .lm-share i.e-gale { background: #9be8bb; }

/* ---- Popovers ---- */
.lm-tip, .lm-pop { position: fixed; z-index: 760; border-radius: calc(var(--u) * 1.2); color: var(--sand);
  background: linear-gradient(180deg, #2f2866, #1c1741); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--gold-lo), 0 calc(var(--u) * 1) calc(var(--u) * 2.4) rgba(0, 0, 0, 0.55); }
.lm-tip { width: calc(var(--u) * 36); padding: calc(var(--u) * 1.1) calc(var(--u) * 1.3); pointer-events: none; font-size: calc(var(--u) * 1.65); }
.lm-tip-head { display: flex; align-items: center; gap: calc(var(--u) * 0.8); }
.lm-tip-head b { font-size: calc(var(--u) * 2); color: var(--k); }
.lm-tip-kind { margin-left: auto; font-size: calc(var(--u) * 1.3); letter-spacing: 0.16em; text-transform: uppercase; color: #9a90c8; }
.lm-tip p { margin: calc(var(--u) * 0.6) 0; color: var(--cream); }
.lm-tip dl { display: grid; grid-template-columns: auto 1fr; gap: calc(var(--u) * 0.2) calc(var(--u) * 1.2); margin: 0; }
.lm-tip dt { color: var(--gold); } .lm-tip dd { margin: 0; }
.lm-tip .lm-tip-note { color: #ffb3a8; font-style: italic; margin-bottom: 0; }
.lm-pop { padding: calc(var(--u) * 1) calc(var(--u) * 1.2); }
.lm-pop-head { display: flex; align-items: center; gap: calc(var(--u) * 1); justify-content: space-between; font-weight: 700; color: var(--gold-hi); margin-bottom: calc(var(--u) * 0.7); }
.lm-pop-head small { font-weight: 400; color: #b9b0d8; margin-right: auto; }
.lm-x { font: inherit; cursor: pointer; border: 0; background: none; color: var(--sand); font-size: calc(var(--u) * 2.4); line-height: 1; padding: 0 calc(var(--u) * 0.4); }
.lm-picker { width: calc(var(--u) * 40); max-height: 70vh; overflow: auto; }
.lm-pick-group h5 { margin: calc(var(--u) * 0.6) 0 calc(var(--u) * 0.4); font-size: calc(var(--u) * 1.35); letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold); }
.lm-pick-list { display: grid; grid-template-columns: 1fr 1fr; gap: calc(var(--u) * 0.7); padding: calc(var(--u) * 0.3); }
.lm-refmenu { right: calc(var(--u) * 4); top: calc(var(--u) * 10.5); width: calc(var(--u) * 62); max-height: calc(100% - var(--u) * 14); display: flex; flex-direction: column; }
.lm-ref-list { overflow: auto; display: flex; flex-direction: column; gap: calc(var(--u) * 0.4); }
.lm-ref { font: inherit; cursor: pointer; border: 0; display: flex; align-items: center; gap: calc(var(--u) * 1); text-align: left; padding: calc(var(--u) * 0.6) calc(var(--u) * 0.9); border-radius: calc(var(--u) * 0.8); color: var(--sand); background: rgba(255, 255, 255, 0.04); }
.lm-ref:hover, .lm-ref:focus-visible { background: rgba(242, 195, 91, 0.16); }
.lm-ref-n { flex: none; width: calc(var(--u) * 2.8); height: calc(var(--u) * 2.8); display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 700; color: var(--ink); background: var(--gold); }
.lm-ref-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.lm-ref-body b { color: var(--cream); }
.lm-ref-body code { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #b9b0d8; }
.lm-ref-cx { flex: none; min-width: calc(var(--u) * 3); text-align: center; font-weight: 700; color: var(--ink); background: var(--sand); border-radius: calc(var(--u) * 0.5); padding: 0 calc(var(--u) * 0.4); }
.lm-ref-cx.over { background: #ff8a74; }
@media (prefers-reduced-motion: reduce) { .lm-spot.lit, .lm-spin { animation: none; } }
`;

export function injectLoomStyle(): void {
  if (document.getElementById('lm-style')) return;
  const el = document.createElement('style');
  el.id = 'lm-style';
  el.textContent = loomCss;
  document.head.appendChild(el);
}
