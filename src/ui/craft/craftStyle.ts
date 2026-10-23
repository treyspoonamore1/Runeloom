/** Stylesheet for the crafting bench (C). Builds on menuStyle.ts and the inventory's card look. */
import { injectInvStyle } from '../inventory/invStyle';
import { injectMenuStyle } from '../menus/menuStyle';

const craftCss = `
.cr-body { grid-template-columns: calc(var(--u) * 40) minmax(0, 1fr) calc(var(--u) * 46); }
.cr-list { display: flex; flex-direction: column; gap: calc(var(--u) * 0.9); padding: calc(var(--u) * 0.7); }
.cr-cur { --rar: #b9b0d8; font: inherit; cursor: pointer; border: 0; display: flex; align-items: center; gap: calc(var(--u) * 1); padding: calc(var(--u) * 0.8); border-radius: calc(var(--u) * 1.2); color: var(--cream); text-align: left;
  background: linear-gradient(180deg, #2f2866, #1d1840); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.5) color-mix(in srgb, var(--rar) 55%, transparent); }
.cr-cur .inv-slot-txt small { white-space: normal; }
.cr-cur.sel { --rar: var(--gold-hi); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--gold-hi), 0 0 calc(var(--u) * 1.6) rgba(255, 220, 120, 0.4); }
.cr-cur.none { opacity: 0.55; }
.cr-cur:hover { filter: brightness(1.15); }
.cr-wallet h3 small { display: inline-flex; align-items: center; gap: calc(var(--u) * 0.4); }
.cr-wallet h3 .ad-ico { width: calc(var(--u) * 2.4); height: calc(var(--u) * 2.4); }
.cr-targets .mn-scroll { padding: calc(var(--u) * 0.7); }
.inv-card.cr-sel { box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--gold-hi), 0 0 calc(var(--u) * 1.6) rgba(255, 220, 120, 0.45); }
.inv-card.cr-no { opacity: 0.45; }
.inv-card .lm-medal, .inv-ico svg { width: 100%; height: 100%; }
.cr-bench .mn-scroll { padding: calc(var(--u) * 0.4) calc(var(--u) * 0.8); }
.cr-name { margin: 0; font-size: calc(var(--u) * 2.4); color: var(--rar, var(--cream)); }
.cr-lines { margin: calc(var(--u) * 0.8) 0 0; padding: 0; list-style: none; }
.cr-lines li { display: flex; align-items: baseline; gap: calc(var(--u) * 0.8); padding: calc(var(--u) * 0.3) calc(var(--u) * 0.5); border-radius: calc(var(--u) * 0.6); color: var(--cream); }
.cr-lines li.cr-new { background: rgba(114, 220, 200, 0.16); box-shadow: inset calc(var(--u) * 0.4) 0 0 #72dcc8; }
.cr-tier { flex: none; min-width: calc(var(--u) * 3.6); text-align: center; padding: 0 calc(var(--u) * 0.5); border-radius: calc(var(--u) * 0.5); font-size: calc(var(--u) * 1.3); font-weight: 700; color: var(--ink); background: #8a82ad; font-variant-numeric: tabular-nums; }
.cr-tier.t1 { background: var(--gold-hi); } .cr-tier.t2 { background: #ffd9a0; } .cr-tier.t3 { background: #e6d8ff; } .cr-tier.t4 { background: #b9b0d8; }
.cr-use { border-top: calc(var(--u) * 0.2) solid rgba(241, 219, 170, 0.14); padding-top: calc(var(--u) * 1); margin-top: calc(var(--u) * 0.8); display: flex; flex-direction: column; gap: calc(var(--u) * 0.9); }
.cr-what { margin: 0; display: flex; gap: calc(var(--u) * 1); align-items: center; color: var(--sand); font-size: calc(var(--u) * 1.6); }
.cr-what b { color: var(--cream); }
.cr-use .mn-btn { align-self: stretch; justify-content: center; }
.cr-why { margin: 0; color: #ff9a85; font-size: calc(var(--u) * 1.6); }
@media (max-width: 760px) { .cr-body { grid-template-columns: 1fr; overflow: auto; } }
`;

export function injectCraftStyle(): void {
  injectInvStyle();
  injectMenuStyle('rl-craft-style', craftCss);
}
