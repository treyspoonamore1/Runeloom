/** Stylesheet for the crafting bench (C). Builds on menuStyle.ts; sizes in the HUD's --u. */
import { injectInvStyle } from '../inventory/invStyle';
import { injectMenuStyle } from '../menus/menuStyle';

const craftCss = `
.mn-root.cr-root { --good: #8ff0b0; --bad: #ff9a85; --dim: #a59cc8; }
.cr-body { grid-template-columns: calc(var(--u) * 37) minmax(0, 1fr) calc(var(--u) * 54); }
.cr-body .mn-panel h3 { font-size: calc(var(--u) * 1.6); }
.cr-body .mn-panel h3 small { font-size: calc(var(--u) * 1.6); }
.cr-art { flex: none; width: calc(var(--u) * 5); height: calc(var(--u) * 5); }
.cr-art.lg { width: calc(var(--u) * 7); height: calc(var(--u) * 7); }
.cr-art > .ia-frame { display: block; width: 100%; height: 100%; }
.cr-text { min-width: 0; display: flex; flex-direction: column; line-height: 1.25; text-align: left; }
.cr-text b { color: var(--rar, var(--cream)); font-size: calc(var(--u) * 1.8); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cr-text small { color: var(--dim); font-size: calc(var(--u) * 1.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ---- Wallet ---- */
.cr-scrap { display: inline-flex; align-items: center; gap: calc(var(--u) * 0.5); color: var(--cream); }
.cr-scrap .ad-ico { width: calc(var(--u) * 2.6); height: calc(var(--u) * 2.6); }
.cr-body .cr-list { display: flex; flex-direction: column; gap: calc(var(--u) * 0.9); padding: calc(var(--u) * 0.8); }
.cr-cur { --rar: #b9b0d8; font: inherit; cursor: pointer; border: 0; display: flex; align-items: center; gap: calc(var(--u) * 1); padding: calc(var(--u) * 0.8); border-radius: calc(var(--u) * 1.2); color: var(--cream); text-align: left;
  background: linear-gradient(180deg, #2f2866, #1d1840); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.5) color-mix(in srgb, var(--rar) 55%, transparent); }
.cr-cur .cr-text { flex: 1; }
.cr-cur:hover { filter: brightness(1.15); }
.cr-cur.sel { --rar: var(--gold-hi); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--gold-hi), 0 0 calc(var(--u) * 1.6) rgba(255, 220, 120, 0.4); }
.cr-cur.cur:not(.sel) { --rar: #e6d8ff; }
.cr-cur.none .cr-art, .cr-cur.none .cr-text { opacity: 0.5; }
.cr-count { margin-left: auto; flex: none; font-weight: 700; font-size: calc(var(--u) * 1.9); color: var(--gold-hi); font-variant-numeric: tabular-nums; }
.cr-cur.none .cr-count { color: var(--dim); }
.cr-buy { margin-top: calc(var(--u) * 0.9); display: flex; flex-direction: column; gap: calc(var(--u) * 0.5); }
.cr-buy .mn-btn { justify-content: center; }
.cr-bench .cr-buy { display: none; }
.cr-hint { margin: 0; color: var(--dim); font-size: calc(var(--u) * 1.6); }
.cr-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.cr-art .lm-medal, .cr-art > svg { width: 100%; height: 100%; display: block; }
.cr-tip-lines li { padding: calc(var(--u) * 0.2) 0; }

/* ---- Item list ---- */
.cr-tabs { display: flex; gap: calc(var(--u) * 0.8); margin-bottom: calc(var(--u) * 1); }
.cr-tab { font: inherit; cursor: pointer; border: 0; flex: 1; padding: calc(var(--u) * 0.6) calc(var(--u) * 1.2); border-radius: calc(var(--u) * 1); font-weight: 700; font-size: calc(var(--u) * 1.8); color: var(--sand); background: rgba(14, 11, 34, 0.7); box-shadow: inset 0 0 0 calc(var(--u) * 0.25) rgba(242, 195, 91, 0.25); }
.cr-tab[aria-selected='true'] { color: var(--ink); background: linear-gradient(180deg, var(--gold-hi), var(--gold)); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink); }
.cr-tab small { font-size: calc(var(--u) * 1.6); font-weight: 400; margin-left: calc(var(--u) * 0.4); }
.cr-search { width: 100%; box-sizing: border-box; font: inherit; font-size: calc(var(--u) * 1.8); padding: calc(var(--u) * 0.7) calc(var(--u) * 1.2); border: 0; border-radius: calc(var(--u) * 1); color: var(--cream); background: rgba(8, 6, 20, 0.6); box-shadow: inset 0 0 0 calc(var(--u) * 0.25) rgba(242, 195, 91, 0.3); margin-bottom: calc(var(--u) * 0.9); }
.cr-search::placeholder { color: #8a82ad; }
.cr-chips { display: flex; flex-wrap: wrap; gap: calc(var(--u) * 0.6); margin-bottom: calc(var(--u) * 0.8); align-items: center; }
.cr-chip { font: inherit; cursor: pointer; border: 0; padding: calc(var(--u) * 0.25) calc(var(--u) * 1); border-radius: 999px; font-size: calc(var(--u) * 1.6); color: var(--sand); background: rgba(14, 11, 34, 0.7); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(185, 176, 216, 0.4); }
.cr-chip[aria-pressed='true'] { color: var(--ink); font-weight: 700; background: var(--sand); }
.cr-chip.clear { color: var(--gold-hi); }
.cr-banner { margin: 0 0 calc(var(--u) * 1); padding: calc(var(--u) * 0.6) calc(var(--u) * 1); border-radius: calc(var(--u) * 1); font-size: calc(var(--u) * 1.7); color: var(--cream); background: rgba(14, 11, 34, 0.7); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(242, 195, 91, 0.25); }
.cr-banner.armed { background: rgba(120, 90, 20, 0.35); box-shadow: inset 0 0 0 calc(var(--u) * 0.25) var(--gold-hi); }
.cr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(var(--u) * 29), 1fr)); gap: calc(var(--u) * 1.1); padding: calc(var(--u) * 0.8); }
.cr-item { font: inherit; cursor: pointer; border: 0; display: flex; align-items: center; gap: calc(var(--u) * 1); min-width: 0; padding: calc(var(--u) * 0.8); border-radius: calc(var(--u) * 1.2); color: var(--cream); text-align: left;
  background: linear-gradient(180deg, #2f2866, #1d1840); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.5) color-mix(in srgb, var(--rar) 55%, transparent); transition: filter 0.1s; }
.cr-item .cr-text { flex: 1; }
.cr-item:hover { filter: brightness(1.15); }
.cr-item.ok { box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.5) color-mix(in srgb, var(--gold-hi) 75%, transparent); }
.cr-item.no { --rar: #6d6596; background: linear-gradient(180deg, #25204f, #181435); }
.cr-item.no .cr-art { opacity: 0.55; filter: grayscale(0.7); }
.cr-item.no .cr-text b { color: #a79fcb; font-weight: 600; }
.cr-item.no .cr-text small { color: #ffb4a3; }
.cr-item.sel { box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--gold-hi), 0 0 calc(var(--u) * 1.6) rgba(255, 220, 120, 0.45); }
.cr-nameline { display: flex; align-items: center; gap: calc(var(--u) * 0.6); min-width: 0; }
.cr-nameline b { min-width: 0; }
.cr-item .cr-text small { white-space: normal; }
.cr-eq { flex: none; display: inline-block; padding: 0 calc(var(--u) * 0.6); border-radius: 999px; font-size: calc(var(--u) * 1.55); font-weight: 700; color: var(--ink); background: #72dcc8; }
.cr-empty { margin: calc(var(--u) * 1); text-align: center; }
.cr-empty .mn-btn { margin-top: calc(var(--u) * 0.8); }

/* ---- Bench ---- */
.cr-bench .mn-scroll { padding: calc(var(--u) * 0.4) calc(var(--u) * 0.8); }
.cr-using { display: flex; align-items: center; gap: calc(var(--u) * 1); margin-bottom: calc(var(--u) * 1); padding: calc(var(--u) * 0.7); border-radius: calc(var(--u) * 1.1); background: rgba(8, 6, 20, 0.5); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(242, 195, 91, 0.3); }
.cr-using .cr-art { width: calc(var(--u) * 4.2); height: calc(var(--u) * 4.2); }
.cr-using .cr-text { flex: 1; }
.cr-using .cr-text small { white-space: normal; }
.cr-head { display: flex; align-items: center; gap: calc(var(--u) * 1.2); }
.cr-name { margin: 0; font-size: calc(var(--u) * 2.4); line-height: 1.15; color: var(--rar, var(--cream)); }
.cr-meta { margin: calc(var(--u) * 0.2) 0 0; color: var(--dim); font-size: calc(var(--u) * 1.6); }
.cr-lines { margin: calc(var(--u) * 1) 0 0; padding: 0; list-style: none; }
.cr-lines li { display: flex; align-items: baseline; gap: calc(var(--u) * 0.8); padding: calc(var(--u) * 0.35) calc(var(--u) * 0.6); border-radius: calc(var(--u) * 0.6); color: var(--cream); font-size: calc(var(--u) * 1.75); line-height: 1.25; }
.cr-lines .cr-txt { flex: 1; min-width: 0; }
.cr-lines .cr-range { flex: none; color: var(--dim); font-size: calc(var(--u) * 1.55); font-variant-numeric: tabular-nums; }
.cr-lines li.cr-new { background: rgba(143, 240, 176, 0.15); box-shadow: inset calc(var(--u) * 0.4) 0 0 var(--good); }
.cr-lines li.cr-new .cr-txt { color: var(--good); }
.cr-lines li.cr-gone { background: rgba(255, 154, 133, 0.12); box-shadow: inset calc(var(--u) * 0.4) 0 0 var(--bad); }
.cr-lines li.cr-gone .cr-txt { color: var(--bad); text-decoration: line-through; text-decoration-thickness: 0.12em; }
.cr-lines li.cr-gone .cr-tier { opacity: 0.6; }
.cr-tier { flex: none; min-width: calc(var(--u) * 3.6); text-align: center; padding: 0 calc(var(--u) * 0.5); border-radius: calc(var(--u) * 0.5); font-size: calc(var(--u) * 1.55); font-weight: 700; color: var(--ink); background: #8a82ad; font-variant-numeric: tabular-nums; }
.cr-tier.t1 { background: var(--gold-hi); } .cr-tier.t2 { background: #ffd9a0; } .cr-tier.t3 { background: #e6d8ff; } .cr-tier.t4 { background: #b9b0d8; }
.cr-result { margin-top: calc(var(--u) * 1); padding: calc(var(--u) * 0.9); border-radius: calc(var(--u) * 1.1); background: rgba(8, 6, 20, 0.45); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(143, 240, 176, 0.35); }
.cr-result h4 { margin: 0; font-size: calc(var(--u) * 1.6); letter-spacing: 0.14em; text-transform: uppercase; color: var(--good); }
.cr-outcome { margin: calc(var(--u) * 0.3) 0 0; font-size: calc(var(--u) * 2); font-weight: 700; color: var(--cream); }
.cr-rename { margin: calc(var(--u) * 0.2) 0 0; color: var(--dim); font-size: calc(var(--u) * 1.6); }
.cr-cols { display: grid; grid-template-columns: 1fr 1fr; gap: calc(var(--u) * 1); margin-top: calc(var(--u) * 0.8); }
.cr-cols h5 { margin: 0; font-size: calc(var(--u) * 1.55); letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold); }
.cr-cols .cr-lines { margin-top: calc(var(--u) * 0.3); }
.cr-cols .cr-lines li { font-size: calc(var(--u) * 1.6); }
.cr-range.inline { color: var(--dim); font-size: calc(var(--u) * 1.55); white-space: nowrap; }
.cr-cols .cr-tier { min-width: calc(var(--u) * 3.2); }
.cr-past { margin: calc(var(--u) * 0.9) 0 0; display: flex; align-items: center; justify-content: space-between; gap: calc(var(--u) * 1); color: var(--dim); font-size: calc(var(--u) * 1.6); }
.cr-link { font: inherit; font-size: inherit; cursor: pointer; border: 0; padding: 0; background: none; color: var(--gold-hi); text-decoration: underline; }
.cr-actions { border-top: calc(var(--u) * 0.2) solid rgba(241, 219, 170, 0.14); padding-top: calc(var(--u) * 1); margin-top: calc(var(--u) * 0.8); display: flex; flex-direction: column; gap: calc(var(--u) * 0.8); }
.cr-actions .mn-btn { justify-content: center; }
.cr-actions .row { display: flex; gap: calc(var(--u) * 0.8); }
.cr-actions .row .mn-btn { flex: 1; min-width: 0; white-space: normal; text-align: center; }
.cr-why { margin: 0; color: var(--bad); font-size: calc(var(--u) * 1.6); }
.cr-ask { display: flex; align-items: center; gap: calc(var(--u) * 0.8); margin-top: calc(var(--u) * 1.2); color: var(--sand); font-size: calc(var(--u) * 1.7); cursor: pointer; }
.cr-ask input { width: calc(var(--u) * 2); height: calc(var(--u) * 2); accent-color: var(--gold-hi); }

@media (max-width: 760px) {
  .mn-root.cr-root { --u: 7.2px; }
  .cr-body { grid-template-columns: 1fr; overflow: auto; align-content: start; }
  .cr-body > .mn-panel { overflow: visible; }
  .cr-body > .cr-bench { order: 2; position: sticky; top: 0; z-index: 3; max-height: 60vh; align-self: start; background: #17122f; }
  .cr-body > .cr-targets { order: 3; }
  .cr-body > .cr-wallet { order: 1; }
  .cr-bench .cr-buy { display: flex; }
  .cr-wallet .cr-buy.twin { display: none; }
  .cr-cols { grid-template-columns: 1fr; }
  .cr-grid { grid-template-columns: 1fr; }
}
`;

export function injectCraftStyle(): void {
  injectInvStyle();
  injectMenuStyle('rl-craft-style', craftCss);
}
