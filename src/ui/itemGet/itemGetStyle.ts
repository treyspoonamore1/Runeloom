/**
 * Stylesheet for the item-get panel (same Loomwright look and --u units as the menus): a card in
 * the lower middle of the screen, so the hero holding the rune overhead stays visible above it,
 * over a dim that leaves the screen's center clear. Element colors from the Loom's rune palette.
 */
const css = `
.ig-root { --el: var(--gold-hi); --el-deep: #2b2557; --el-glow: rgba(255, 233, 168, 0.5);
  position: absolute; inset: 0; z-index: 720; pointer-events: auto !important; display: flex; align-items: flex-end; justify-content: center;
  padding: 0 16px calc(var(--u) * 5); box-sizing: border-box;
  background: radial-gradient(ellipse 34% 30% at 50% 40%, rgba(10, 8, 24, 0) 0, rgba(10, 8, 24, 0) 45%, rgba(10, 8, 24, 0.6) 100%);
  animation: rl-fade 0.2s ease-out; }
.ig-frost { --el: #8fe3ff; --el-deep: #173f5e; --el-glow: rgba(143, 227, 255, 0.55); }
.ig-storm { --el: #ffe36a; --el-deep: #43306e; --el-glow: rgba(155, 123, 255, 0.65); }
.ig-card { position: relative; display: grid; grid-template-columns: auto 1fr; column-gap: calc(var(--u) * 3); align-items: start;
  width: min(calc(var(--u) * 100), 100%); padding: calc(var(--u) * 2.4) calc(var(--u) * 3.2) calc(var(--u) * 2.2); border-radius: calc(var(--u) * 2.2); color: var(--sand);
  background: linear-gradient(180deg, rgba(43, 37, 87, 0.97), rgba(24, 20, 52, 0.98));
  box-shadow: 0 0 0 calc(var(--u) * 0.45) var(--ink), 0 0 0 calc(var(--u) * 0.9) var(--el), 0 0 0 calc(var(--u) * 1.35) var(--ink), 0 0 calc(var(--u) * 6) var(--el-glow), 0 calc(var(--u) * 2) calc(var(--u) * 5) rgba(0, 0, 0, 0.55);
  animation: ig-rise 0.35s cubic-bezier(0.2, 1.4, 0.4, 1); font-size: calc(var(--u) * 1.9); line-height: 1.3; }
.ig-card > :not(.ig-medal) { grid-column: 2; }
.ig-medal { grid-column: 1; grid-row: 1 / span 6; align-self: center; width: calc(var(--u) * 17); height: calc(var(--u) * 17); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--el);
  background: radial-gradient(circle at 42% 36%, color-mix(in srgb, var(--el-deep) 55%, white 12%), var(--el-deep) 70%);
  box-shadow: 0 0 0 calc(var(--u) * 0.45) var(--ink), 0 0 0 calc(var(--u) * 0.9) var(--el), 0 0 0 calc(var(--u) * 1.35) var(--ink), 0 0 calc(var(--u) * 5) var(--el-glow);
  animation: ig-pulse 2.2s ease-in-out infinite; }
.ig-glyph { width: 68%; height: 68%; filter: drop-shadow(0 0 calc(var(--u) * 1) var(--el-glow)); }
.ig-kicker { margin: 0; font-size: calc(var(--u) * 1.5); letter-spacing: 0.3em; text-transform: uppercase; color: var(--gold); font-weight: 700; }
.ig-card h2 { margin: calc(var(--u) * 0.2) 0 calc(var(--u) * 0.4); font-size: calc(var(--u) * 4.2); line-height: 1; letter-spacing: 0.04em; color: var(--el);
  text-shadow: 0 calc(var(--u) * 0.3) 0 var(--el-deep), 0 calc(var(--u) * 0.6) 0 var(--ink), 0 0 calc(var(--u) * 2.5) var(--el-glow); }
.ig-flavor { margin: 0 0 calc(var(--u) * 1); font-style: italic; color: #cfc6ea; }
.ig-does { margin: 0 0 calc(var(--u) * 1.2); padding: 0; list-style: none; color: var(--cream); }
.ig-does li { position: relative; padding: calc(var(--u) * 0.15) 0 calc(var(--u) * 0.15) calc(var(--u) * 2.2); }
.ig-does li::before { content: ''; position: absolute; left: calc(var(--u) * 0.4); top: 0.55em; width: calc(var(--u) * 0.9); height: calc(var(--u) * 0.9); transform: rotate(45deg); background: var(--el); box-shadow: 0 0 0 calc(var(--u) * 0.2) var(--ink); }
.ig-step { padding: calc(var(--u) * 1) calc(var(--u) * 1.4); border-radius: calc(var(--u) * 1.2); background: rgba(14, 11, 34, 0.6); box-shadow: inset 0 0 0 calc(var(--u) * 0.2) rgba(242, 195, 91, 0.25); }
.ig-step b { display: block; font-size: calc(var(--u) * 1.4); letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold); }
.ig-step-text { margin: calc(var(--u) * 0.2) 0 0; color: var(--cream); font-weight: 700; }
.ig-step code { font-family: ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace; font-size: 0.92em; padding: 0 calc(var(--u) * 0.5); border-radius: calc(var(--u) * 0.5); color: var(--el); background: rgba(0, 0, 0, 0.35); white-space: nowrap; }
.ig-step small { display: block; margin-top: calc(var(--u) * 0.3); color: #a59cc8; font-size: calc(var(--u) * 1.55); }
.ig-acts { display: flex; gap: calc(var(--u) * 1.4); justify-content: flex-end; flex-wrap: wrap; margin-top: calc(var(--u) * 1.6); }
.ig-btn { font: inherit; cursor: pointer; border: 0; display: inline-flex; align-items: center; gap: calc(var(--u) * 0.7); border-radius: calc(var(--u) * 1.1); padding: calc(var(--u) * 0.7) calc(var(--u) * 1.8); font-size: calc(var(--u) * 1.9); font-weight: 700; line-height: 1.2; white-space: nowrap;
  color: var(--cream); background: linear-gradient(180deg, var(--indigo-3), var(--indigo-1)); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--gold-lo), 0 0 0 calc(var(--u) * 0.9) var(--ink); }
.ig-btn.gold { color: var(--ink); background: linear-gradient(180deg, var(--gold-hi), var(--gold) 55%, #e0a23a); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 calc(var(--u) * 0.45) 0 calc(var(--u) * 0.3) var(--ink); }
.ig-btn:hover { filter: brightness(1.1); }
.ig-btn:focus-visible { outline: calc(var(--u) * 0.35) solid var(--el); outline-offset: calc(var(--u) * 0.35); }
.ig-btn kbd { font: inherit; font-size: 0.8em; padding: 0 calc(var(--u) * 0.5); border-radius: calc(var(--u) * 0.5); color: var(--ink); background: var(--sand); }
.ig-btn.gold kbd { background: rgba(42, 28, 31, 0.18); }
@keyframes ig-rise { 0% { opacity: 0; transform: translateY(calc(var(--u) * 4)) scale(0.96); } 100% { opacity: 1; transform: none; } }
@keyframes ig-pulse { 50% { box-shadow: 0 0 0 calc(var(--u) * 0.45) var(--ink), 0 0 0 calc(var(--u) * 0.9) var(--el), 0 0 0 calc(var(--u) * 1.35) var(--ink), 0 0 calc(var(--u) * 8) var(--el-glow); } }
@media (max-width: 760px) {
  .ig-root { --u: 4.4px; padding-bottom: 16px; }
  .ig-card { grid-template-columns: 1fr; text-align: center; }
  .ig-card > :not(.ig-medal) { grid-column: 1; }
  .ig-medal { grid-row: auto; justify-self: center; width: calc(var(--u) * 13); height: calc(var(--u) * 13); margin-bottom: calc(var(--u) * 1); }
  .ig-does { text-align: left; }
  .ig-acts { justify-content: center; }
}
@media (prefers-reduced-motion: reduce) { .ig-card, .ig-medal { animation: none; } }
`;

export function injectItemGetStyle(): void {
  if (document.getElementById('rl-itemget-style')) return;
  const el = document.createElement('style');
  el.id = 'rl-itemget-style';
  el.textContent = css;
  document.head.appendChild(el);
}
