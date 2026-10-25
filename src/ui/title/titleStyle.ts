/** Title screen additions on top of the start screen's look (hudStyle.ts .rl-start, .rl-title). */
import { injectMenuStyle } from '../menus/menuStyle';

const titleCss = `
.tt-root { align-items: flex-start; }
.tt-col { min-height: 100%; justify-content: center; padding-top: calc(var(--u) * 2); }
.tt-menu { display: flex; flex-direction: column; align-items: stretch; gap: calc(var(--u) * 2.3); width: calc(var(--u) * 46); max-width: 86vw; }
.tt-menu .rl-btn { font-size: calc(var(--u) * 2.5); padding: calc(var(--u) * 0.8) calc(var(--u) * 3); }
.tt-menu .rl-btn:disabled { opacity: 0.45; cursor: default; transform: none; }
.tt-main { display: flex; flex-direction: column; align-items: center; gap: calc(var(--u) * 0.3); margin-bottom: calc(var(--u) * 0.8); }
.tt-menu .tt-main { font-size: calc(var(--u) * 3.4); padding: calc(var(--u) * 1.4) calc(var(--u) * 3); }
.tt-main small { font-size: calc(var(--u) * 1.7); font-weight: 400; letter-spacing: 0.02em; color: #5a3a1c; }
.tt-dev { opacity: 0.8; }
.tt-playtest { display: grid; grid-template-columns: 1fr 1fr; gap: calc(var(--u) * 1.2); margin: 0 calc(var(--u) * -16); margin-top: calc(var(--u) * 1); padding-top: calc(var(--u) * 1.6); border-top: calc(var(--u) * 0.2) solid rgba(242, 195, 91, 0.3); }
.tt-playtest h2 { grid-column: 1 / -1; margin: 0; text-align: center; font-size: calc(var(--u) * 2); letter-spacing: 0.14em; text-transform: uppercase; color: var(--sand); }
.tt-menu .tt-start { display: flex; flex-direction: column; align-items: center; gap: calc(var(--u) * 0.3); opacity: 0.85; }
.tt-menu .tt-start { font-size: calc(var(--u) * 2.1); padding: calc(var(--u) * 0.8) calc(var(--u) * 1.6); }
.tt-start small { font-size: calc(var(--u) * 1.6); font-weight: 400; letter-spacing: 0.02em; color: var(--sand); }
.tt-panel { width: calc(var(--u) * 72); max-width: 92vw; text-align: left; padding: calc(var(--u) * 2.4) calc(var(--u) * 3.2); border-radius: calc(var(--u) * 2.2);
  background: linear-gradient(180deg, rgba(43, 37, 87, 0.97), rgba(26, 22, 56, 0.98));
  box-shadow: 0 0 0 calc(var(--u) * 0.5) var(--ink), 0 0 0 calc(var(--u) * 1) var(--gold-lo), 0 0 0 calc(var(--u) * 1.5) var(--ink), 0 calc(var(--u) * 2) calc(var(--u) * 4) rgba(0, 0, 0, 0.5); }
.tt-panel h2 { margin: 0 0 calc(var(--u) * 1.6); text-align: center; font-size: calc(var(--u) * 4); letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold-hi); text-shadow: 0 calc(var(--u) * 0.4) 0 var(--terra), 0 calc(var(--u) * 0.9) 0 var(--ink); }
.tt-slots { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: calc(var(--u) * 1); }
.tt-slots li { display: flex; align-items: center; justify-content: space-between; gap: calc(var(--u) * 1.6); padding: calc(var(--u) * 1) calc(var(--u) * 1.4); border-radius: calc(var(--u) * 1.2); background: rgba(14, 11, 34, 0.55); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(242, 195, 91, 0.2); }
.tt-slots li.empty { opacity: 0.55; }
.tt-slot-txt { display: flex; flex-direction: column; min-width: 0; }
.tt-slot-txt b { font-size: calc(var(--u) * 2.3); color: var(--cream); }
.tt-slot-txt small { font-size: calc(var(--u) * 1.8); color: var(--sand); }
.tt-slot-acts { display: flex; gap: calc(var(--u) * 1.8); flex-wrap: wrap; justify-content: flex-end; }
.rl-small { font-size: calc(var(--u) * 1.9) !important; padding: calc(var(--u) * 0.7) calc(var(--u) * 1.8) !important; }
.tt-del.armed { background: linear-gradient(180deg, #e0523f, #8a1f26) !important; }
.tt-back { display: block; margin: calc(var(--u) * 2.4) auto 0; font-size: calc(var(--u) * 2) !important; padding: calc(var(--u) * 0.8) calc(var(--u) * 3) !important; }
.tt-back kbd { font: inherit; font-size: 0.8em; margin-left: calc(var(--u) * 0.6); padding: 0 calc(var(--u) * 0.5); border-radius: calc(var(--u) * 0.5); color: var(--ink); background: var(--sand); }
.tt-note, .tt-warn { margin: 0 0 calc(var(--u) * 1.4); font-size: calc(var(--u) * 2); color: var(--sand); }
.tt-warn { color: #ffb4a6; margin-top: calc(var(--u) * 1.4); }
.tt-paste { width: 100%; box-sizing: border-box; font: calc(var(--u) * 1.7) / 1.4 ui-monospace, Menlo, Consolas, monospace; color: var(--cream); background: #120e2a; border: 0; border-radius: calc(var(--u) * 1); padding: calc(var(--u) * 1) calc(var(--u) * 1.2); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(242, 195, 91, 0.35); resize: vertical; user-select: text; -webkit-user-select: text; }
.tt-row { display: flex; gap: calc(var(--u) * 1.2); justify-content: flex-end; flex-wrap: wrap; margin-top: calc(var(--u) * 1.4); }
.tt-scenes { display: flex; flex-direction: column; gap: calc(var(--u) * 1); }
.tt-scenes .rl-btn { text-align: left; }
.tt-panel.rl-pause { width: calc(var(--u) * 60); }
.tt-msg { min-height: calc(var(--u) * 3); margin: calc(var(--u) * 1.6) 0 0; font-size: calc(var(--u) * 2); color: #ffb4a6; }
@media (max-width: 760px) { .tt-root { --u: 4.4px; } .tt-playtest { grid-template-columns: 1fr; margin: 0; margin-top: calc(var(--u) * 1); } .tt-slots li { flex-direction: column; align-items: stretch; } }
`;

export function injectTitleStyle(): void {
  injectMenuStyle('rl-title-style', titleCss);
}
