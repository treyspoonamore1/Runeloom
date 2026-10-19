/** Stylesheet for the passive tree. Area colors follow the element palette (DESIGN §14). */
import { injectMenuStyle } from '../menus/menuStyle';

const treeCss = `
.tr-body { grid-template-columns: minmax(0, 1fr) calc(var(--u) * 40); }
.tr-points { padding: calc(var(--u) * 0.5) calc(var(--u) * 1.6); border-radius: 999px; font-size: calc(var(--u) * 1.8); color: var(--sand); background: rgba(14, 11, 34, 0.6); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(242, 195, 91, 0.3); }
.tr-points b { color: var(--cream); font-size: calc(var(--u) * 2.2); }
.tr-points.has b { color: var(--gold-hi); }
.tr-points small { color: #8a82ad; }
.tr-main { padding: 0; overflow: hidden; position: relative; }
.tr-view { position: absolute; inset: 0; cursor: grab; touch-action: none; outline: none; border-radius: inherit;
  background: radial-gradient(ellipse at 50% 50%, rgba(61, 53, 128, 0.35), rgba(10, 8, 24, 0.2) 70%); }
.tr-view:active { cursor: grabbing; }
.tr-view:focus-visible { box-shadow: inset 0 0 0 calc(var(--u) * 0.35) var(--gold-hi); }
.tr-svg { display: block; }
.tr-zoom { position: absolute; left: calc(var(--u) * 1.2); bottom: calc(var(--u) * 1); font-size: calc(var(--u) * 1.4); color: #8a82ad; pointer-events: none; }

.a-ember { --ac: #ff7a2f; --ad: #5a2a1c; }
.a-rime { --ac: #8fe3ff; --ad: #173f5e; }
.a-tempest { --ac: #f5e04a; --ad: #43306e; }
.a-weaver { --ac: #f2c35b; --ad: #5a4216; }
.a-warden { --ac: #7fd36b; --ad: #1f4a26; }

.tr-edge { fill: none; stroke-linecap: round; }
.tr-edge.locked { stroke: #3a3366; stroke-width: 4; }
.tr-edge.available { stroke: #8c82b8; stroke-width: 5; stroke-dasharray: 2 9; }
.tr-edge.allocated { stroke: #f2c35b; stroke-width: 7; filter: drop-shadow(0 0 4px rgba(255, 210, 100, 0.55)); }

.tr-node .tr-body { stroke: #2a1c1f; stroke-width: 4; }
.tr-node.locked .tr-body { fill: #1d1838; stroke: #4a4270; }
.tr-node.locked .tr-inner { fill: none; stroke: #4a4270; stroke-width: 2; }
.tr-node.locked .tr-label { fill: #6d6596; }
.tr-node.available .tr-body { fill: var(--ad); stroke: var(--ac); stroke-width: 4; }
.tr-node.available .tr-inner { fill: none; stroke: var(--ac); stroke-width: 2; opacity: 0.8; }
.tr-node.available .tr-halo { fill: none; stroke: var(--ac); stroke-width: 2; opacity: 0.5; animation: tr-pulse 1.6s ease-in-out infinite; }
.tr-node.allocated .tr-body { fill: var(--ac); stroke: #2a1c1f; }
.tr-node.allocated .tr-inner { fill: #fff4d6; stroke: #2a1c1f; stroke-width: 2; }
.tr-node.allocated.t-small .tr-body, .tr-node.allocated.t-start .tr-body { filter: drop-shadow(0 0 6px var(--ac)); }
.tr-node.allocated.t-notable .tr-body, .tr-node.allocated.t-keystone .tr-body { filter: drop-shadow(0 0 10px var(--ac)); }
.tr-node.t-keystone .tr-body { stroke-width: 5; }
.tr-label { font-size: 15px; font-weight: 700; text-anchor: middle; fill: var(--sand); paint-order: stroke fill; stroke: #120e2a; stroke-width: 4px; stroke-linejoin: round; pointer-events: none; }
.tr-node.allocated .tr-label { fill: var(--gold-hi); }
.tr-focus { fill: none; stroke: var(--gold-hi); stroke-width: 3; stroke-dasharray: 6 5; }
@keyframes tr-pulse { 50% { opacity: 0.1; } }
@media (prefers-reduced-motion: reduce) { .tr-node.available .tr-halo { animation: none; } }

.tr-side { gap: calc(var(--u) * 0.8); overflow: auto; }
.tr-modes { display: flex; gap: calc(var(--u) * 0.8); }
.tr-detail { margin-top: calc(var(--u) * 0.6); padding: calc(var(--u) * 1.2); border-radius: calc(var(--u) * 1); background: rgba(255, 255, 255, 0.04); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) color-mix(in srgb, var(--ac) 45%, transparent); }
.tr-detail h4 { margin: 0; font-size: calc(var(--u) * 2.4); color: var(--ac); }
.tr-kind { margin: 0 0 calc(var(--u) * 0.6); color: #a59cc8; font-size: calc(var(--u) * 1.5); }
.tr-detail ul { margin: 0; padding: 0 0 0 calc(var(--u) * 2); color: var(--cream); }
.tr-act { margin: calc(var(--u) * 1) 0 0; color: #8ff0b0; font-size: calc(var(--u) * 1.6); }
.tr-act.no { color: #ff9a85; }
.tr-legend { margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; gap: calc(var(--u) * 0.5) calc(var(--u) * 1.2); font-size: calc(var(--u) * 1.5); color: var(--sand); padding-top: calc(var(--u) * 1); }
.tr-legend i { display: inline-block; width: calc(var(--u) * 1.6); height: calc(var(--u) * 1.6); border-radius: 50%; vertical-align: middle; background: var(--ac); box-shadow: 0 0 0 calc(var(--u) * 0.2) var(--ink); }
.tr-legend .st.allocated i { background: var(--gold); }
.tr-legend .st.available i { background: #2b2557; box-shadow: 0 0 0 calc(var(--u) * 0.25) #8c82b8; }
.tr-legend .st.locked i { background: #1d1838; box-shadow: 0 0 0 calc(var(--u) * 0.25) #4a4270; }
@media (max-width: 760px) { .tr-main { min-height: 62vh !important; } }
`;

export function injectTreeStyle(): void {
  injectMenuStyle('rl-tree-style', treeCss);
}
