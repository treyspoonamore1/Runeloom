/** Stylesheet for the region map. */
import { injectMenuStyle } from '../menus/menuStyle';

const mapCss = `
.mp-body { grid-template-columns: minmax(0, 1fr) calc(var(--u) * 36); }
.mp-main { padding: calc(var(--u) * 1); }
.mp-svg { width: 100%; height: 100%; display: block; }
.mp-region rect { fill: rgba(255, 255, 255, 0.03); stroke: rgba(242, 195, 91, 0.25); stroke-width: 2; stroke-dasharray: 3 7; }
.mp-region-name { font-size: 15px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; fill: var(--gold); paint-order: stroke fill; stroke: #120e2a; stroke-width: 5px; stroke-linejoin: round; }
.mp-region-name.g-kiln { fill: #ff9a6a; }
.mp-link line { stroke: #4a4270; stroke-width: 5; stroke-linecap: round; stroke-dasharray: 2 8; }
.mp-link.known line { stroke: #b9b0d8; stroke-dasharray: none; }
.mp-link circle { fill: #f2c35b; stroke: #2a1c1f; stroke-width: 2.5; }
.mp-link.door-big circle { fill: #ff7a2f; }
.mp-room rect { stroke: #2a1c1f; stroke-width: 3; }
.mp-room.visited rect { fill: #3d3580; }
.mp-room.visited.g-kiln rect { fill: #5a3044; }
.mp-room.current rect { fill: #5a4a9e; stroke: var(--gold-hi); stroke-width: 4; filter: drop-shadow(0 0 8px rgba(255, 220, 120, 0.6)); }
.mp-room.current.g-kiln rect { fill: #7a3e52; }
.mp-room.unknown rect { fill: rgba(20, 16, 44, 0.6); stroke: #6d6596; stroke-width: 2; stroke-dasharray: 6 6; }
.mp-room.side.visited rect { stroke-dasharray: 10 4; }
.mp-name { text-anchor: middle; font-weight: 700; fill: var(--cream); paint-order: stroke fill; stroke: #120e2a; stroke-width: 3px; stroke-linejoin: round; }
.mp-q { text-anchor: middle; font-weight: 700; fill: #6d6596; }
.mp-stone path { fill: #6d6596; stroke: #2a1c1f; stroke-width: 2; }
.mp-stone .mp-gem { fill: #2a1c1f; }
.mp-stone.on path { fill: #b9b0d8; }
.mp-stone.on .mp-gem { fill: #ffe9a8; filter: drop-shadow(0 0 3px #ffd75a); }
.mp-stone.go { cursor: pointer; }
.mp-stone.go:hover path, .mp-stone.go:focus path { fill: var(--gold-hi); }
.mp-stone:focus { outline: none; }
.mp-you { fill: #ff8a62; stroke: #2a1c1f; stroke-width: 3; animation: mp-blink 1.2s ease-in-out infinite; }
@keyframes mp-blink { 50% { opacity: 0.35; } }
.mp-side { gap: calc(var(--u) * 0.6); overflow: auto; }
.mp-here { margin: 0; font-size: calc(var(--u) * 3); font-weight: 700; color: var(--gold-hi); }
.mp-sub { margin-top: calc(var(--u) * 1.6) !important; }
.mp-rest { align-self: flex-start; margin-top: calc(var(--u) * 0.6); }
.mp-travel { display: flex; flex-direction: column; gap: calc(var(--u) * 0.8); align-items: flex-start; }
.mp-legend { margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; gap: calc(var(--u) * 0.5) calc(var(--u) * 1.2); padding-top: calc(var(--u) * 1); font-size: calc(var(--u) * 1.5); color: var(--sand); }
.mp-legend i { display: inline-block; width: calc(var(--u) * 2.4); height: calc(var(--u) * 1.6); border-radius: calc(var(--u) * 0.4); vertical-align: middle; box-shadow: 0 0 0 calc(var(--u) * 0.2) var(--ink); }
.mp-legend .current i { background: #5a4a9e; box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--gold-hi); }
.mp-legend .visited i { background: #3d3580; }
.mp-legend .unknown i { background: transparent; box-shadow: inset 0 0 0 calc(var(--u) * 0.2) #6d6596; }
.mp-legend .stone i { width: calc(var(--u) * 1.4); background: #b9b0d8; border-radius: calc(var(--u) * 0.7) calc(var(--u) * 0.7) 0 0; }
.mp-region-name.g-rift { fill: #cdb8ff; }
.mp-room.visited.g-rift rect { fill: #3a2c5c; }
.mp-room.current.g-rift rect { fill: #5c4392; }
.rf-panel { display: flex; flex-direction: column; gap: calc(var(--u) * 0.6); }
.rf-list { display: flex; flex-direction: column; gap: calc(var(--u) * 1); }
.rf-sigil { display: flex; flex-direction: column; gap: calc(var(--u) * 0.4); padding: calc(var(--u) * 1); border-radius: calc(var(--u) * 0.8); background: rgba(42, 34, 54, 0.85); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) #b48cff; }
.rf-sigil.blocked { box-shadow: inset 0 0 0 calc(var(--u) * 0.2) #4a4270; }
.rf-sigil.locked { opacity: 0.55; filter: grayscale(0.85); }
.rf-sigil.locked .rf-open { cursor: help; }
.rf-lock { width: calc(var(--u) * 2.2); height: calc(var(--u) * 2.2); vertical-align: -0.2em; margin-right: calc(var(--u) * 0.6); color: #9a93b8; }
.rf-locked-line { margin: 0; font-size: calc(var(--u) * 1.5); color: #b9b0d8; font-style: italic; }
.rf-head { display: flex; justify-content: space-between; align-items: baseline; gap: calc(var(--u) * 1); }
.rf-head b { color: #e6d8ff; }
.rf-head small { color: var(--sand); white-space: nowrap; }
.rf-mods { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: calc(var(--u) * 0.2); font-size: calc(var(--u) * 1.6); color: var(--cream); }
.rf-mod b { color: #ff9a6a; }
.rf-mod.suffix b { color: #7fd6ff; }
.rf-none { margin: 0; }
.rf-bonus { margin: 0; font-size: calc(var(--u) * 1.5); color: var(--gold-hi); }
.rf-open { align-self: flex-start; }
.rf-open:disabled { opacity: 0.6; cursor: default; }
@media (prefers-reduced-motion: reduce) { .mp-you { animation: none; } }
@media (max-width: 760px) { .mp-main { min-height: 50vh !important; } }
`;

export function injectMapStyle(): void {
  injectMenuStyle('rl-map-style', mapCss);
}
