/**
 * Styles for the bag's tiles, toolbar, status line and empty states, the side-by-side compare
 * tooltip and the bulk salvage dialog (M7.5). Same dark purple and gold, sizes in --u, text 11 px
 * or more (invStyle.ts defines --t-xs, --t-s and --t-m).
 *
 * Item pictures come from ItemArt / PartArt / CurrencyArt (items/itemArt.tsx). `.inv-art` only
 * gives them a box to fill; the :where() rules are fallbacks with no weight, so the art's own
 * `.ia-*` styles always win.
 */
import { injectMenuStyle } from '../menus/menuStyle';

const bagCss = `
.mn-root { --tile: max(46px, calc(var(--u) * 8.6)); }

/* ---- Art boxes ---- */
.inv-art { display: grid; place-items: center; width: 100%; height: 100%; min-width: 0; min-height: 0; }
.inv-art.sm { flex: none; width: max(38px, calc(var(--u) * 5.4)); height: max(38px, calc(var(--u) * 5.4)); }
.inv-art.xs { flex: none; width: max(24px, calc(var(--u) * 3.4)); height: max(24px, calc(var(--u) * 3.4)); }
:where(.inv-art > .ia-frame) { display: grid; place-items: center; width: 100%; height: 100%; box-sizing: border-box; }

/* ---- Toolbar ---- */
.inv-tools { display: flex; align-items: center; flex-wrap: wrap; gap: calc(var(--u) * 0.8) calc(var(--u) * 1.2); margin-bottom: calc(var(--u) * 1); }
.inv-sel { display: inline-flex; align-items: center; gap: calc(var(--u) * 0.6); color: var(--sand); font-size: var(--t-s); }
.inv-sel select { font: inherit; font-size: var(--t-s); color: var(--cream); color-scheme: dark; background: #1d1840; border: 0; border-radius: calc(var(--u) * 0.9); padding: calc(var(--u) * 0.45) calc(var(--u) * 0.8); max-width: 100%;
  box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.45) var(--gold-lo); cursor: pointer; }
.inv-tog { font: inherit; font-size: var(--t-s); font-weight: 700; cursor: pointer; border: 0; display: inline-flex; align-items: center; gap: calc(var(--u) * 0.5); padding: calc(var(--u) * 0.45) calc(var(--u) * 1); border-radius: 999px; color: var(--sand); background: #1d1840;
  box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.45) rgba(242, 195, 91, 0.35); }
.inv-tog[aria-pressed='true'] { color: var(--ink); background: linear-gradient(180deg, var(--gold-hi), var(--gold)); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink); }
.inv-tog .inv-arrow { width: max(14px, calc(var(--u) * 1.8)); height: max(14px, calc(var(--u) * 1.8)); }
.inv-count-note { margin-left: auto; color: #a59cc8; font-size: var(--t-s); white-space: nowrap; }
.inv-bulk { font-size: var(--t-s); padding: calc(var(--u) * 0.45) calc(var(--u) * 1.2); }

/* ---- Tiles ---- */
.inv-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--tile), 1fr)); gap: calc(var(--u) * 1.1); padding: calc(var(--u) * 0.6) calc(var(--u) * 0.4) calc(var(--u) * 1); }
.inv-tiles.labeled { grid-template-columns: repeat(auto-fill, minmax(max(88px, calc(var(--u) * 13)), 1fr)); }
.inv-tilewrap { position: relative; min-width: 0; }
.inv-tile { --rar: #e9dfc6; font: inherit; color: var(--cream); cursor: pointer; border: 0; display: block; position: relative; width: 100%; aspect-ratio: 1; padding: calc(var(--u) * 0.5); border-radius: calc(var(--u) * 1.1);
  background: radial-gradient(circle at 40% 30%, #3b3380, #1a1638); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.5) color-mix(in srgb, var(--rar) 70%, transparent); transition: filter 0.1s, transform 0.1s; }
.inv-tile:hover { filter: brightness(1.18); transform: translateY(-1px); }
.inv-tile.kept { box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.5) color-mix(in srgb, var(--rar) 70%, transparent), 0 0 calc(var(--u) * 1.2) rgba(255, 215, 90, 0.35); }
.inv-tile .inv-art { width: 100%; height: 100%; }
.inv-lv { position: absolute; right: calc(var(--u) * 0.5); bottom: calc(var(--u) * 0.2); font-size: var(--t-xs); font-weight: 700; line-height: 1.1; color: var(--cream); text-shadow: 0 1px 0 #000, 0 0 3px #000, 0 0 3px #000; pointer-events: none; font-variant-numeric: tabular-nums; }
.inv-mark { position: absolute; top: calc(var(--u) * 0.4); left: calc(var(--u) * 0.4); display: block; pointer-events: none; line-height: 0; }
.inv-arrow { width: max(15px, calc(var(--u) * 2.2)); height: max(15px, calc(var(--u) * 2.2)); display: block; filter: drop-shadow(0 1px 0 #000); }
.inv-arrow polygon { stroke: #0b1f12; stroke-width: 1.2; stroke-linejoin: round; }
.inv-arrow.up polygon { fill: #72e89a; }
.inv-arrow.down polygon { fill: #ff7a6a; stroke: #2a0c0c; }
.inv-pips { position: absolute; left: calc(var(--u) * 0.6); bottom: calc(var(--u) * 0.6); display: flex; gap: 2px; pointer-events: none; }
.inv-pips i { width: max(6px, calc(var(--u) * 0.9)); height: max(6px, calc(var(--u) * 0.9)); border-radius: 50%; box-shadow: 0 0 0 1px #000; background: transparent; border: 1px solid #dfd6ff; box-sizing: border-box; }
.inv-pips i.on { background: #8fb0ff; border-color: #fff; }
.inv-lock { position: absolute; top: calc(var(--u) * 0.4); right: calc(var(--u) * 0.4); width: max(20px, calc(var(--u) * 2.8)); height: max(20px, calc(var(--u) * 2.8)); padding: 3px; border: 0; border-radius: calc(var(--u) * 0.7); cursor: pointer; color: var(--sand); background: rgba(10, 8, 24, 0.82); opacity: 0; transition: opacity 0.1s; }
.inv-tilewrap:hover .inv-lock, .inv-tilewrap:focus-within .inv-lock, .inv-lock:focus-visible, .inv-lock.on { opacity: 1; }
.inv-lock.on { color: var(--gold-hi); }
.inv-lock:hover { background: rgba(60, 50, 120, 0.95); }
.inv-padlock { width: 100%; height: 100%; display: block; fill: currentColor; }
@media (hover: none) { .inv-lock { opacity: 0.8; } }

/* Labeled tiles: Fuse parts and runes, which need their names. */
.inv-tile.labeled { aspect-ratio: auto; display: flex; flex-direction: column; align-items: center; gap: calc(var(--u) * 0.5); padding: calc(var(--u) * 0.9) calc(var(--u) * 0.6) calc(var(--u) * 0.8); text-align: center; min-height: calc(var(--tile) * 1.5); }
.inv-tile.labeled .inv-art { width: var(--tile); height: var(--tile); flex: none; max-width: 100%; }
.inv-tile.rune { --rar: var(--k); }
.inv-tile.rune .lm-medal { width: 82%; height: 82%; }
.inv-cap { font-size: var(--t-s); font-weight: 700; line-height: 1.15; color: var(--cream); overflow-wrap: anywhere; }
.inv-sub { font-size: var(--t-xs); color: #a59cc8; line-height: 1.15; }
.inv-n { position: absolute; top: calc(var(--u) * 0.4); right: calc(var(--u) * 0.5); min-width: 1.6em; padding: 0 calc(var(--u) * 0.6); border-radius: 999px; font-size: var(--t-xs); font-weight: 700; line-height: 1.5; color: var(--ink); background: var(--gold-hi); box-shadow: 0 0 0 1px var(--ink); font-variant-numeric: tabular-nums; }

/* ---- Status line and empty states ---- */
.inv-status { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0 calc(var(--u) * 1); margin: calc(var(--u) * 0.8) 0 0; min-height: calc(var(--t-s) * 2.6); color: var(--sand); font-size: var(--t-s); line-height: 1.3; }
.inv-status.mn-help { color: #8a82ad; font-size: var(--t-s); }
.inv-status b { color: var(--rar); font-size: var(--t-m); }
.inv-status em { font-style: normal; font-weight: 700; font-size: var(--t-xs); text-transform: uppercase; letter-spacing: 0.1em; }
.inv-status em.up { color: var(--good); }
.inv-status em.down { color: var(--bad); }
.inv-empty { display: flex; flex-direction: column; align-items: center; gap: calc(var(--u) * 0.8); text-align: center; margin: calc(var(--u) * 1) calc(var(--u) * 0.6); padding: calc(var(--u) * 4) calc(var(--u) * 2); border-radius: calc(var(--u) * 1.4); color: #a59cc8; font-size: var(--t-m); box-shadow: inset 0 0 0 calc(var(--u) * 0.25) rgba(185, 176, 216, 0.28); }
.inv-empty b { color: var(--sand); font-size: calc(var(--t-m) * 1.15); }

/* ---- Compare tooltip: two cards and a table of changes ---- */
.tc-wrap { display: flex; flex-direction: column; gap: calc(var(--u) * 1); }
.tc-row { display: flex; gap: calc(var(--u) * 1.2); align-items: stretch; }
.tc-card, .tc-delta { box-sizing: border-box; padding: calc(var(--u) * 1.2) calc(var(--u) * 1.5); border-radius: calc(var(--u) * 1.2); font-size: var(--t-m); color: var(--sand);
  background: linear-gradient(180deg, rgba(36, 30, 77, 0.98), rgba(18, 14, 40, 0.99)); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--rar), 0 calc(var(--u) * 1) calc(var(--u) * 3) rgba(0, 0, 0, 0.6); }
.tc-card { width: max(calc(var(--u) * 36), min(290px, calc(100vw - 40px))); }
.tc-card.empty { --rar: #5b5480; opacity: 0.9; }
.tc-delta { --rar: var(--gold-lo); width: 0; min-width: 100%; }
.tc-tag { margin: 0 0 calc(var(--u) * 0.6); display: flex; align-items: center; gap: calc(var(--u) * 1); font-size: var(--t-xs); letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold); }
.tc-verdict { letter-spacing: 0.06em; padding: 0 calc(var(--u) * 0.9); border-radius: 999px; font-size: var(--t-xs); }
.tc-verdict.up { color: #0b1f12; background: #72e89a; }
.tc-verdict.down { color: #2a0c0c; background: #ff9a85; }
.tc-card h4 { overflow-wrap: anywhere; }
.tc-card .mn-muted, .tc-delta .mn-muted { font-size: var(--t-s); }
.tl-lines { margin: 0; padding: 0; list-style: none; }
.tl-lines li { padding: calc(var(--u) * 0.15) 0; color: var(--cream); }
.tl-lines li.tl-implicit { color: #d8d0f0; }
.tl-lines li.tl-fused, .tl-lines li.tl-unique { color: #c7bff0; }
.tl-tier { margin-left: 0.7em; font-size: var(--t-xs); color: #9a91c0; white-space: nowrap; font-variant-numeric: tabular-nums; cursor: help; }
.tc-rows { margin: 0; padding: 0; list-style: none; }
.tc-rows li { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: calc(var(--u) * 1.2); padding: calc(var(--u) * 0.2) 0; align-items: baseline; }
.tc-rows .tc-from { color: #a59cc8; font-size: var(--t-s); font-variant-numeric: tabular-nums; white-space: nowrap; }
.tc-rows b { min-width: 3.4em; text-align: right; font-variant-numeric: tabular-nums; }
.mn-tip .tc-delta .mn-hint { margin: calc(var(--u) * 0.8) 0 0; font-size: var(--t-xs); }

/* ---- Bulk salvage dialog ---- */
.inv-presets { display: flex; flex-direction: column; gap: calc(var(--u) * 0.8); margin-bottom: calc(var(--u) * 1.4); }
.inv-preset { font: inherit; font-size: var(--t-m); cursor: pointer; border: 0; display: flex; justify-content: space-between; align-items: baseline; gap: calc(var(--u) * 1.4); flex-wrap: wrap; text-align: left; padding: calc(var(--u) * 0.9) calc(var(--u) * 1.4); border-radius: calc(var(--u) * 1.1); color: var(--cream); background: #1d1840;
  box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.45) rgba(185, 176, 216, 0.3); }
.inv-preset small { color: #a59cc8; font-size: var(--t-s); }
.inv-preset[aria-checked='true'] { background: linear-gradient(180deg, #3b3380, #2a2460); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--gold-hi); }
.inv-preset:disabled { opacity: 0.45; cursor: not-allowed; }
.inv-root .mn-dialog { font-size: var(--t-m); }
.inv-root .mn-dialog h3 { font-size: calc(var(--t-m) * 1.4); }

/* ---- Readable text on the inventory screen ---- */
.inv-root { font-size: max(12px, calc(var(--u) * 1.9)); }
.inv-root .mn-tab, .inv-root .mn-btn { font-size: max(12px, calc(var(--u) * 1.8)); }
.inv-root .mn-tab kbd, .inv-root .mn-btn kbd { font-size: 0.85em; }
.inv-root .mn-panel h3 { font-size: var(--t-s); }
.inv-root .mn-panel h3 small { font-size: var(--t-s); }
.inv-root .mn-help { font-size: var(--t-s); }
.inv-root .mn-muted { font-size: var(--t-s); }
.inv-root .mn-note { font-size: var(--t-m); }
.inv-root .mn-tip { font-size: var(--t-m); }
.inv-root .mn-tip h4 { font-size: max(14px, calc(var(--u) * 2.2)); }
.inv-root .mn-tip .mn-base { font-size: var(--t-s); }
.inv-root .mn-tip .mn-sep { font-size: var(--t-xs); }
.inv-root .mn-tip .mn-hint { font-size: var(--t-s); }
.inv-root .mn-tip li { font-size: var(--t-m); }
@media (max-width: 760px) {
  .inv-root .mn-head h2 { font-size: 22px; }
  .tc-row { flex-direction: column; }
  .tc-card { width: min(calc(100vw - 40px), 330px); }
  .inv-count-note { margin-left: 0; }
}
`;

export function injectBagStyle(): void {
  injectMenuStyle('rl-bag-style', bagCss);
}
