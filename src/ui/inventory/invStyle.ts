/**
 * Stylesheet for the inventory, character sheet and Fuse panel (see menuStyle.ts for the frame and
 * bagStyle.ts for the bag's tiles, toolbar and compare tooltip). The `.inv-card`, `.inv-ico`,
 * `.inv-slot-txt` and `.inv-grid` classes are shared with the crafting bench.
 *
 * Text never goes below 11 px: `--t-xs`, `--t-s` and `--t-m` are the usual sizes in --u units with that floor.
 */
import { injectMenuStyle } from '../menus/menuStyle';
import { injectBagStyle } from './bagStyle';

const invCss = `
.mn-root { --t-xs: max(11px, calc(var(--u) * 1.5)); --t-s: max(11px, calc(var(--u) * 1.65)); --t-m: max(12px, calc(var(--u) * 1.85)); --good: #8ff0b0; --bad: #ff9a85; }
.inv-body { grid-template-columns: calc(var(--u) * 38) minmax(0, 1fr) calc(var(--u) * 40); }
.ad-ico { width: 100%; height: 100%; display: block; }
.inv-ico { flex: none; width: calc(var(--u) * 4.4); height: calc(var(--u) * 4.4); padding: calc(var(--u) * 0.4); border-radius: calc(var(--u) * 1); background: radial-gradient(circle at 40% 35%, #3d3580, #1a1638); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink); }
.inv-slot-txt { min-width: 0; display: flex; flex-direction: column; line-height: 1.2; text-align: left; }
.inv-slot-txt b { color: var(--rar, var(--cream)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: var(--t-m); }
.inv-slot-txt small { color: #a59cc8; font-size: var(--t-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.inv-slot-txt em { font-style: normal; color: #a59cc8; font-size: var(--t-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.inv-doll { display: grid; grid-template-columns: 1fr; gap: calc(var(--u) * 0.9); }
.inv-left .mn-scroll, .inv-bag .mn-scroll, .inv-sheet .mn-scroll { padding: calc(var(--u) * 0.7); }
.inv-slot, .inv-card, .inv-socket { font: inherit; cursor: pointer; border: 0; display: flex; align-items: center; gap: calc(var(--u) * 1); min-width: 0; padding: calc(var(--u) * 0.8); border-radius: calc(var(--u) * 1.2); color: var(--cream);
  background: linear-gradient(180deg, #2f2866, #1d1840); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.5) color-mix(in srgb, var(--rar) 55%, transparent); transition: filter 0.1s, box-shadow 0.1s; }
.inv-slot { --rar: #6d6596; position: relative; min-height: calc(var(--u) * 7); }
.inv-slot.s-spindle { min-height: calc(var(--u) * 7.6); }
.inv-slot:not(.filled) b { color: #8a82ad; font-weight: 400; font-style: italic; }
.inv-ghost { display: block; width: 100%; height: 100%; padding: 18%; opacity: 0.3; filter: grayscale(1); border-radius: calc(var(--u) * 1); box-shadow: inset 0 0 0 calc(var(--u) * 0.25) rgba(185, 176, 216, 0.4); border: 0; box-sizing: border-box; }
.inv-kept { position: absolute; top: calc(var(--u) * 0.5); right: calc(var(--u) * 0.6); width: max(14px, calc(var(--u) * 2)); height: max(14px, calc(var(--u) * 2)); color: var(--gold-hi); }
.inv-kept svg { width: 100%; height: 100%; fill: currentColor; display: block; }
.inv-slot:hover, .inv-card:hover, .inv-socket.full:hover { filter: brightness(1.15); }
.inv-slot.lit, .inv-socket.lit, .inv-bag.lit { box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--gold-hi), 0 0 calc(var(--u) * 1.6) rgba(255, 220, 120, 0.5); }
.over { filter: brightness(1.3) !important; }

.inv-fuse { margin-top: calc(var(--u) * 1.8); padding-top: calc(var(--u) * 1.2); border-top: calc(var(--u) * 0.2) solid rgba(241, 219, 170, 0.14); }
.inv-fuse h3 { margin: 0 0 calc(var(--u) * 0.9); font-size: var(--t-s); letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold); display: flex; justify-content: space-between; gap: calc(var(--u) * 1); }
.inv-fuse h3 small { letter-spacing: 0; text-transform: none; color: var(--sand); font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: var(--t-s); }
.inv-sockets { display: flex; flex-direction: column; gap: calc(var(--u) * 0.9); }
.inv-socket { --rar: #8fb0ff; width: 100%; min-height: calc(var(--u) * 7); }
.inv-socket.empty { cursor: default; background: rgba(20, 16, 44, 0.7); box-shadow: inset 0 0 0 calc(var(--u) * 0.25) rgba(185, 176, 216, 0.35); }
.inv-socket.empty b { color: #8a82ad; font-weight: 400; font-style: italic; }
.inv-ring { flex: none; width: max(34px, calc(var(--u) * 5)); height: max(34px, calc(var(--u) * 5)); border-radius: 50%; border: calc(var(--u) * 0.35) dashed rgba(143, 176, 255, 0.55); box-sizing: border-box; }
.inv-unfuse { margin-left: auto; flex: none; padding: calc(var(--u) * 0.3) calc(var(--u) * 1); border-radius: 999px; font-size: var(--t-xs); font-weight: 700; color: var(--ink); background: var(--sand); box-shadow: 0 0 0 calc(var(--u) * 0.2) var(--ink); }

.inv-tabs { display: flex; gap: calc(var(--u) * 0.8); margin-bottom: calc(var(--u) * 1.2); flex-wrap: wrap; }
.inv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(var(--u) * 28), 1fr)); gap: calc(var(--u) * 1.2); }
.inv-card { flex: 1; min-height: calc(var(--u) * 6.4); }
.inv-card.rune { --rar: var(--k); }
.inv-card.rune .lm-medal { width: calc(var(--u) * 4); height: calc(var(--u) * 4); }
.inv-count { margin-left: auto; flex: none; font-weight: 700; color: var(--gold-hi); font-variant-numeric: tabular-nums; }

.inv-sheet h3 { font-size: var(--t-m); }
.inv-wallet { display: flex; gap: calc(var(--u) * 1.4); flex-wrap: wrap; margin-bottom: calc(var(--u) * 1.2); padding-bottom: calc(var(--u) * 1); border-bottom: calc(var(--u) * 0.2) solid rgba(241, 219, 170, 0.14); }
.inv-wallet span { display: inline-flex; align-items: center; gap: calc(var(--u) * 0.5); color: var(--sand); font-size: var(--t-s); }
.inv-wallet .ad-ico { width: max(16px, calc(var(--u) * 2.8)); height: max(16px, calc(var(--u) * 2.8)); }
.inv-wallet b { color: var(--cream); font-size: var(--t-m); }
.inv-previewing { margin: 0 0 calc(var(--u) * 0.8); padding: calc(var(--u) * 0.5) calc(var(--u) * 1); border-radius: calc(var(--u) * 0.8); background: rgba(242, 195, 91, 0.1); color: var(--sand); font-size: var(--t-s); }
.inv-previewing b { color: var(--rar); }
.inv-group + .inv-group { margin-top: calc(var(--u) * 1.4); }
.inv-group h4 { margin: 0 0 calc(var(--u) * 0.4); font-size: var(--t-xs); letter-spacing: 0.18em; text-transform: uppercase; color: #72dcc8; }
.inv-kv { display: flex; justify-content: space-between; gap: calc(var(--u) * 1); padding: calc(var(--u) * 0.25) calc(var(--u) * 0.4); color: var(--sand); font-size: var(--t-m); border-radius: calc(var(--u) * 0.6); }
.inv-kv b { color: var(--cream); font-variant-numeric: tabular-nums; white-space: nowrap; }
.inv-kv.up { background: rgba(143, 240, 176, 0.09); }
.inv-kv.down { background: rgba(255, 154, 133, 0.1); }
.inv-delta { font-style: normal; margin-left: 0.6em; font-size: var(--t-s); font-weight: 700; }
.inv-delta.good { color: var(--good); }
.inv-delta.bad { color: var(--bad); }
.inv-curs { margin-bottom: calc(var(--u) * 1.6); }
.inv-curgrid { display: flex; flex-wrap: wrap; gap: calc(var(--u) * 0.9); }
.inv-cur { font: inherit; cursor: pointer; border: 0; display: inline-flex; align-items: center; gap: calc(var(--u) * 0.5); padding: calc(var(--u) * 0.4) calc(var(--u) * 1) calc(var(--u) * 0.4) calc(var(--u) * 0.5); border-radius: 999px; color: var(--cream); background: rgba(14, 11, 34, 0.7); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(242, 195, 91, 0.3); font-size: var(--t-s); }
.inv-cur:hover { filter: brightness(1.2); }
.inv-cur b { font-variant-numeric: tabular-nums; }
.inv-hidden { display: flex; align-items: center; justify-content: space-between; gap: calc(var(--u) * 1); margin-top: calc(var(--u) * 0.8); padding: calc(var(--u) * 0.6) calc(var(--u) * 1); border-radius: calc(var(--u) * 1); background: rgba(255, 122, 106, 0.1); color: var(--sand); font-size: var(--t-s); flex-wrap: wrap; }
@media (max-width: 760px) {
  .inv-doll { grid-template-columns: 1fr 1fr; }
  .inv-slot { min-height: 54px; }
  .inv-grid { grid-template-columns: 1fr; }
}
`;

export function injectInvStyle(): void {
  injectMenuStyle('rl-inv-style', invCss);
  injectBagStyle();
}
