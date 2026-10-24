/**
 * Stylesheet for the Hearth menu (H) and the "While you were away" modal. Builds on menuStyle.ts:
 * indigo plates, gold trim, sizes in the HUD's --u. Embers are orange, Ash is grey-violet.
 */
import { injectMenuStyle } from '../menus/menuStyle';

const hearthCss = `
.hx-body { grid-template-columns: calc(var(--u) * 29) minmax(0, 1fr); }
.hx-nav { gap: calc(var(--u) * 0.8); }
.hx-nav .mn-scroll { display: flex; flex-direction: column; gap: calc(var(--u) * 0.8); }
.hx-wallet { display: grid; gap: calc(var(--u) * 0.5); }
.hx-coin { display: flex; align-items: center; gap: calc(var(--u) * 0.9); padding: calc(var(--u) * 0.5) calc(var(--u) * 1); border-radius: calc(var(--u) * 1); background: rgba(14, 11, 34, 0.7); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(242, 195, 91, 0.2); }
.hx-coin .ad-ico { width: calc(var(--u) * 3.2); height: calc(var(--u) * 3.2); flex: none; }
.hx-coin span { color: var(--sand); font-size: calc(var(--u) * 1.5); letter-spacing: 0.06em; text-transform: uppercase; flex: 1; }
.hx-coin .hx-num { font-size: calc(var(--u) * 2.6); }
.hx-coin.embers .hx-num { color: var(--ember-hi); text-shadow: 0 0 calc(var(--u) * 1.2) rgba(255, 138, 58, 0.55); }
.hx-coin.ash .hx-num { color: var(--ash); }
.hx-num { font-variant-numeric: tabular-nums; color: var(--cream); display: inline-block; }
.hx-num.up { animation: hx-pop 0.55s ease-out; }
.hx-num.down { animation: hx-dip 0.4s ease-out; }
@keyframes hx-pop { 0% { transform: scale(1); } 30% { transform: scale(1.22); color: var(--ember-hi); filter: drop-shadow(0 0 calc(var(--u) * 0.9) rgba(255, 190, 90, 0.9)); } 100% { transform: scale(1); } }
@keyframes hx-dip { 0% { opacity: 0.55; } 100% { opacity: 1; } }
.hx-rates { margin: 0; padding: calc(var(--u) * 0.7) calc(var(--u) * 1); list-style: none; border-radius: calc(var(--u) * 1); background: rgba(255, 138, 58, 0.09); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(255, 138, 58, 0.3); font-size: calc(var(--u) * 1.5); color: var(--sand); }
.hx-rates li { display: flex; justify-content: space-between; gap: calc(var(--u) * 1); padding: calc(var(--u) * 0.15) 0; }
.hx-rates b { color: var(--ember-hi); font-variant-numeric: tabular-nums; }
.hx-tabs { display: flex; flex-direction: column; gap: calc(var(--u) * 0.6); }
.hx-tab { font: inherit; cursor: pointer; text-align: left; display: flex; justify-content: space-between; align-items: center; gap: calc(var(--u) * 0.6); border: 0; padding: calc(var(--u) * 0.7) calc(var(--u) * 1.2); border-radius: calc(var(--u) * 1); font-size: calc(var(--u) * 1.8); font-weight: 700; color: var(--cream);
  background: rgba(61, 53, 128, 0.45); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(242, 195, 91, 0.18); }
.hx-tab:hover { background: rgba(61, 53, 128, 0.8); }
.hx-tab[aria-selected='true'] { color: var(--ink); background: linear-gradient(180deg, var(--gold-hi), var(--gold) 55%, #e0a23a); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink); }
.hx-badge { min-width: calc(var(--u) * 2.6); text-align: center; padding: 0 calc(var(--u) * 0.6); border-radius: 999px; font-size: calc(var(--u) * 1.4); color: var(--ink); background: var(--ember); box-shadow: 0 0 calc(var(--u) * 1) rgba(255, 138, 58, 0.8); animation: hx-beat 1.6s ease-in-out infinite; }
@keyframes hx-beat { 50% { transform: scale(1.18); } }

.hx-main { gap: calc(var(--u) * 0.4); }
.hx-main .mn-scroll { display: flex; flex-direction: column; gap: calc(var(--u) * 1.2); padding: calc(var(--u) * 0.4); }
.hx-away, .hx-err { margin: 0; padding: calc(var(--u) * 0.7) calc(var(--u) * 1.2); border-radius: calc(var(--u) * 1); font-size: calc(var(--u) * 1.6); }
.hx-away { color: var(--sand); background: rgba(14, 11, 34, 0.7); box-shadow: inset 0 0 0 calc(var(--u) * 0.25) var(--gold-lo); }
.hx-err { color: #ffd0c4; background: rgba(138, 31, 38, 0.55); box-shadow: inset 0 0 0 calc(var(--u) * 0.25) #ff9a85; animation: rl-fade 0.15s ease-out; }
.hx-ok { color: #c8f5ea; background: rgba(26, 82, 64, 0.6); box-shadow: inset 0 0 0 calc(var(--u) * 0.25) #72dcc8; }
.hx-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(var(--u) * 33), 1fr)); gap: calc(var(--u) * 1.2); }
.hx-grid.one { grid-template-columns: minmax(0, calc(var(--u) * 52)); }
.hx-card { position: relative; display: flex; flex-direction: column; gap: calc(var(--u) * 0.7); min-width: 0; padding: calc(var(--u) * 1.2); border-radius: calc(var(--u) * 1.3); color: var(--sand);
  background: linear-gradient(180deg, #2f2866, #1d1840); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.5) rgba(242, 195, 91, 0.35); }
.hx-card h4 { margin: 0; display: flex; justify-content: space-between; align-items: baseline; gap: calc(var(--u) * 1); font-size: calc(var(--u) * 2.1); color: var(--cream); }
.hx-card h4 small { font-size: calc(var(--u) * 1.5); color: var(--sand); font-weight: 400; }
.hx-card p { margin: 0; }
.hx-card .hx-lv { flex: none; padding: 0 calc(var(--u) * 0.9); border-radius: calc(var(--u) * 0.7); font-size: calc(var(--u) * 1.7); font-weight: 700; color: var(--ink); background: var(--gold); font-variant-numeric: tabular-nums; }
.hx-card .hx-lv .hx-num { color: var(--ink); }
.hx-card h4 .hx-lv small { color: rgba(42, 28, 31, 0.65); font-weight: 700; }
.hx-card.ready { box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--ember-hi), 0 0 calc(var(--u) * 2.4) rgba(255, 190, 90, 0.5); animation: hx-glow 1.8s ease-in-out infinite; }
@keyframes hx-glow { 50% { box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--ember-hi), 0 0 calc(var(--u) * 3.6) rgba(255, 190, 90, 0.8); } }
.hx-card.flash { animation: hx-flash 1s ease-out; }
@keyframes hx-flash { 0% { box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.6) #fff, 0 0 calc(var(--u) * 5) rgba(255, 215, 90, 0.95); transform: scale(1.02); } 100% { transform: none; } }
.hx-plus { position: absolute; right: calc(var(--u) * 1.4); top: calc(var(--u) * 0.2); pointer-events: none; font-weight: 700; font-size: calc(var(--u) * 2.4); color: var(--ember-hi); text-shadow: 0 0 calc(var(--u) * 1) rgba(255, 138, 58, 0.9), 0 calc(var(--u) * 0.2) 0 var(--ink); animation: hx-rise 1s ease-out forwards; }
@keyframes hx-rise { 0% { opacity: 0; transform: translateY(calc(var(--u) * 1.5)); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(calc(var(--u) * -3.5)); } }
.hx-cap { display: block; font-size: calc(var(--u) * 1.4); letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold); }
.hx-now { display: grid; grid-template-columns: auto 1fr; gap: calc(var(--u) * 0.2) calc(var(--u) * 0.9); font-size: calc(var(--u) * 1.6); }
.hx-now dt { color: #a59cc8; } .hx-now dd { margin: 0; color: var(--cream); }
.hx-now dd.next { color: #8ff0b0; }
.hx-bar { position: relative; height: calc(var(--u) * 1.5); border-radius: 99px; overflow: hidden; background: #14102c; box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.45) var(--gold-lo); }
.hx-bar i { position: absolute; left: 0; top: 0; bottom: 0; width: calc(var(--f) * 100%); border-radius: inherit; background: linear-gradient(180deg, #ffd75a, #ff8a3a 55%, #c4623a); transition: width 0.3s ease-out; }
.hx-bar.xp i { background: linear-gradient(180deg, #c8f59a, #6fc46a 55%, #2f7a45); }
.hx-bar.done i { background: linear-gradient(180deg, #fff1b0, #ffd75a 55%, #e0a23a); }
.hx-why { margin: 0; font-size: calc(var(--u) * 1.5); color: #ff9a85; }
.hx-why.soft { color: #a59cc8; }
.hx-row { display: flex; align-items: center; gap: calc(var(--u) * 1); flex-wrap: wrap; }
.hx-row.between { justify-content: space-between; }
.hx-row .grow { flex: 1; min-width: 0; }
.hx-btn { justify-content: center; }
.hx-chips { display: flex; flex-wrap: wrap; gap: calc(var(--u) * 0.8); }
.hx-chip { font: inherit; cursor: pointer; border: 0; display: inline-flex; flex-direction: column; align-items: center; min-width: calc(var(--u) * 8); padding: calc(var(--u) * 0.6) calc(var(--u) * 1.2); border-radius: calc(var(--u) * 1); color: var(--cream); font-size: calc(var(--u) * 1.8); font-weight: 700; background: linear-gradient(180deg, var(--indigo-3), var(--indigo-1)); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.5) var(--gold-lo); }
.hx-chip small { font-weight: 400; font-size: calc(var(--u) * 1.4); color: var(--sand); }
.hx-chip:hover:not(:disabled) { filter: brightness(1.15); }
.hx-chip:disabled { opacity: 0.4; cursor: not-allowed; }
.hx-chip.on { color: var(--ink); background: linear-gradient(180deg, var(--gold-hi), var(--gold)); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink); }
.hx-chip.on small { color: rgba(42, 28, 31, 0.8); }
.hx-plots { display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(var(--u) * 28), 1fr)); gap: calc(var(--u) * 1.2); }
.hx-plot.empty { align-items: center; justify-content: center; min-height: calc(var(--u) * 10); color: #8a82ad; font-style: italic; background: rgba(14, 11, 34, 0.5); box-shadow: inset 0 0 0 calc(var(--u) * 0.3) rgba(242, 195, 91, 0.2); border: calc(var(--u) * 0.25) dashed rgba(242, 195, 91, 0.3); }
.hx-pouch { display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(var(--u) * 24), 1fr)); gap: calc(var(--u) * 0.8); }
.hx-pick { font: inherit; cursor: pointer; text-align: left; border: 0; display: flex; justify-content: space-between; align-items: center; gap: calc(var(--u) * 0.8); padding: calc(var(--u) * 0.7) calc(var(--u) * 1); border-radius: calc(var(--u) * 1); color: var(--cream); font-size: calc(var(--u) * 1.7); background: rgba(61, 53, 128, 0.5); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(114, 220, 200, 0.4); }
.hx-pick:hover:not(:disabled) { background: rgba(61, 53, 128, 0.95); }
.hx-pick:disabled { opacity: 0.45; cursor: not-allowed; }
.hx-pick b { color: #72dcc8; font-size: calc(var(--u) * 1.5); }
.hx-wares { display: flex; flex-direction: column; gap: calc(var(--u) * 0.8); }
.hx-ware { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: calc(var(--u) * 1.2); padding: calc(var(--u) * 0.9) calc(var(--u) * 1.2); border-radius: calc(var(--u) * 1.2); background: linear-gradient(180deg, #2f2866, #1d1840); box-shadow: 0 0 0 calc(var(--u) * 0.2) var(--ink), 0 0 0 calc(var(--u) * 0.4) rgba(242, 195, 91, 0.3); }
.hx-ware b { color: var(--cream); font-size: calc(var(--u) * 1.9); display: block; }
.hx-ware small { color: #a59cc8; font-size: calc(var(--u) * 1.5); }
.hx-owned { color: var(--sand); font-size: calc(var(--u) * 1.5); text-align: right; }
.hx-owned b { display: inline; font-size: calc(var(--u) * 1.8); }
.hx-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: calc(var(--u) * 1.6); align-items: start; }
.hx-lists { display: grid; grid-template-columns: 1fr 1fr; gap: calc(var(--u) * 1.4); margin-bottom: calc(var(--u) * 1.2); }
.hx-lists h5 { margin: 0 0 calc(var(--u) * 0.4); font-size: calc(var(--u) * 1.4); letter-spacing: 0.14em; text-transform: uppercase; }
.hx-lists ul { margin: 0; padding-left: calc(var(--u) * 1.8); }
.hx-lists li { margin: calc(var(--u) * 0.25) 0; }
.hx-lists .resets h5 { color: #ff9a85; } .hx-lists .keeps h5 { color: #8ff0b0; }
.hx-big { font-size: calc(var(--u) * 3); font-weight: 700; color: var(--ash); font-variant-numeric: tabular-nums; }
.hx-pips { display: inline-flex; gap: calc(var(--u) * 0.3); }
.hx-pips i { width: calc(var(--u) * 1.1); height: calc(var(--u) * 1.1); border-radius: 50%; background: #14102c; box-shadow: 0 0 0 calc(var(--u) * 0.2) var(--gold-lo); }
.hx-pips i.on { background: var(--ember); box-shadow: 0 0 0 calc(var(--u) * 0.2) var(--ink), 0 0 calc(var(--u) * 0.8) rgba(255, 138, 58, 0.8); }
.hx-card.owned { opacity: 0.8; box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink), 0 0 0 calc(var(--u) * 0.5) rgba(143, 240, 176, 0.5); }
.hx-weavers { display: inline-flex; gap: calc(var(--u) * 0.4); }
.hx-weavers .ad-ico { width: calc(var(--u) * 3.2); height: calc(var(--u) * 3.2); }
.hx-weavers .busy { opacity: 0.35; filter: grayscale(0.8); }
.hx-sub { margin: calc(var(--u) * 0.6) 0 0; font-size: calc(var(--u) * 1.5); letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold); font-weight: 700; }
.hx-rates-inline { text-align: right; color: var(--sand); }
.hx-ember { color: var(--ember-hi); }
.hx-btn-ico { width: calc(var(--u) * 2.6); height: calc(var(--u) * 2.6); flex: none; }
.hx-rifts .rf-panel { max-width: calc(var(--u) * 80); }

/* ---- While you were away ---- */
.hx-away-bg { position: absolute; inset: 0; z-index: 780; display: flex; align-items: center; justify-content: center; background: rgba(8, 6, 20, 0.7); animation: rl-fade 0.2s ease-out; pointer-events: auto !important; font-size: calc(var(--u) * 1.9); }
.hx-away-card { width: calc(var(--u) * 56); max-width: calc(100vw - 32px); padding: calc(var(--u) * 2.6) calc(var(--u) * 3); border-radius: calc(var(--u) * 2); color: var(--sand); text-align: center;
  background: linear-gradient(180deg, rgba(60, 40, 70, 0.99), rgba(26, 22, 56, 0.99)); box-shadow: 0 0 0 calc(var(--u) * 0.45) var(--ink), 0 0 0 calc(var(--u) * 0.9) var(--ember), 0 0 0 calc(var(--u) * 1.35) var(--ink), 0 0 calc(var(--u) * 6) rgba(255, 138, 58, 0.45); animation: hx-rise-in 0.35s ease-out; }
@keyframes hx-rise-in { 0% { opacity: 0; transform: translateY(calc(var(--u) * 2)); } 100% { opacity: 1; transform: none; } }
.hx-away-card h2 { margin: 0 0 calc(var(--u) * 0.4); font-size: calc(var(--u) * 3.2); letter-spacing: 0.08em; text-transform: uppercase; color: var(--gold-hi); text-shadow: 0 calc(var(--u) * 0.3) 0 var(--terra); }
.hx-away-card .for { margin: 0 0 calc(var(--u) * 1.6); color: var(--sand); }
.hx-away-card .for b { color: var(--ember-hi); }
.hx-away-card ul { margin: 0 0 calc(var(--u) * 2); padding: 0; list-style: none; display: grid; gap: calc(var(--u) * 0.7); }
.hx-away-card li { padding: calc(var(--u) * 0.8) calc(var(--u) * 1.2); border-radius: calc(var(--u) * 1); background: rgba(14, 11, 34, 0.6); color: var(--cream); text-align: left; box-shadow: inset calc(var(--u) * 0.4) 0 0 var(--ember); }
.hx-away-card .none { color: #a59cc8; }

@media (max-width: 760px) {
  .mn-root.hx { --u: 5px; }
  .hx-away-bg { --u: 5px; }
  .hx-body { grid-template-columns: 1fr !important; }
  .hx-nav { flex: none; }
  .hx-tabs { flex-direction: row; flex-wrap: wrap; }
  .hx-tab { flex: 1 1 auto; }
  .hx-wallet { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .hx-coin { flex-direction: column; align-items: flex-start; gap: calc(var(--u) * 0.2); }
  .hx-coin span { flex: none; }
  .hx-split, .hx-lists { grid-template-columns: 1fr; }
  .hx-grid { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) { .hx-num.up, .hx-num.down, .hx-badge, .hx-card.ready, .hx-card.flash, .hx-plus { animation: none; } }
`;

export function injectHearthStyle(): void {
  injectMenuStyle('rl-hearth-style', hearthCss);
}
