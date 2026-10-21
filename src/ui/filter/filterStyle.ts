/** Stylesheet for the loot filter editor (L). Builds on menuStyle.ts. */
import { injectMenuStyle } from '../menus/menuStyle';

const filterCss = `
.lf-body { grid-template-columns: minmax(0, 1fr) calc(var(--u) * 44); }
.lf-list { list-style: none; margin: 0 0 calc(var(--u) * 1.2); padding: 0; display: flex; flex-direction: column; gap: calc(var(--u) * 0.9); }
.lf-rule { --act: #b9b0d8; display: flex; flex-wrap: wrap; align-items: flex-end; gap: calc(var(--u) * 1); padding: calc(var(--u) * 0.9) calc(var(--u) * 1.1); border-radius: calc(var(--u) * 1.2);
  background: linear-gradient(180deg, #2f2866, #1d1840); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), inset calc(var(--u) * 0.5) 0 0 var(--act); }
.lf-rule.a-highlight, .lf-preview .a-highlight { --act: var(--gold-hi); }
.lf-rule.a-hide, .lf-preview .a-hide { --act: #ff7a6a; }
.lf-rule.a-show, .lf-preview .a-show { --act: #72dcc8; }
.lf-num { align-self: center; min-width: calc(var(--u) * 2.6); font-weight: 700; color: var(--gold); text-align: center; }
.lf-field { display: flex; flex-direction: column; gap: calc(var(--u) * 0.3); font-size: calc(var(--u) * 1.4); color: #a59cc8; }
.lf-field select { font: inherit; font-size: calc(var(--u) * 1.7); color: var(--cream); background: #171334; border: 0; border-radius: calc(var(--u) * 0.7); padding: calc(var(--u) * 0.4) calc(var(--u) * 0.8); box-shadow: 0 0 0 calc(var(--u) * 0.2) rgba(242, 195, 91, 0.35); }
.lf-acts { margin-left: auto; display: flex; gap: calc(var(--u) * 0.5); align-self: center; }
.lf-mini { font: inherit; cursor: pointer; border: 0; width: calc(var(--u) * 3.2); height: calc(var(--u) * 3.2); border-radius: calc(var(--u) * 0.7); color: var(--cream); background: rgba(255, 255, 255, 0.08); }
.lf-mini:disabled { opacity: 0.3; cursor: default; }
.lf-mini:hover:not(:disabled) { background: rgba(255, 255, 255, 0.18); }
.lf-mini.del:hover { background: #a8322a; }
.lf-presets { display: flex; flex-direction: column; gap: calc(var(--u) * 0.8); margin-bottom: calc(var(--u) * 1.4); }
.lf-presets .mn-btn { justify-content: center; }
.lf-prev-h { margin-top: calc(var(--u) * 0.6); }
.lf-preview { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr; gap: calc(var(--u) * 0.4); }
.lf-preview li { --act: #72dcc8; display: flex; justify-content: space-between; padding: calc(var(--u) * 0.3) calc(var(--u) * 0.8); border-radius: calc(var(--u) * 0.6); background: rgba(255, 255, 255, 0.04); box-shadow: inset calc(var(--u) * 0.35) 0 0 var(--act); color: var(--sand); }
.lf-preview li b { color: var(--act); }
.lf-preview li.a-hide span { text-decoration: line-through; opacity: 0.6; }
@media (max-width: 760px) { .lf-body { grid-template-columns: 1fr; overflow: auto; } }
`;

export function injectFilterStyle(): void {
  injectMenuStyle('rl-filter-style', filterCss);
}
