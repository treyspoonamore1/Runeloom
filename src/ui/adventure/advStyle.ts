/** Stylesheet for the adventure HUD additions (same look and --u units as hudStyle.ts). */
const advCss = `
.ad-ico { width: 100%; height: 100%; display: block; }
.ad-plate { position: absolute; top: calc(var(--u) * 1.8); right: calc(var(--u) * 2); z-index: 100; display: flex; align-items: center; gap: calc(var(--u) * 1.2); padding: calc(var(--u) * 0.9) calc(var(--u) * 1.8) calc(var(--u) * 0.9) calc(var(--u) * 1); border-radius: calc(var(--u) * 1.8);
  background: linear-gradient(180deg, rgba(43, 37, 87, 0.9), rgba(26, 22, 56, 0.92));
  box-shadow: 0 0 0 calc(var(--u) * 0.4) var(--ink), 0 0 0 calc(var(--u) * 0.85) var(--gold-lo), 0 0 0 calc(var(--u) * 1.25) var(--ink), 0 calc(var(--u) * 0.8) calc(var(--u) * 1.8) rgba(0, 0, 0, 0.3); }
.ad-level { position: relative; width: calc(var(--u) * 6.4); height: calc(var(--u) * 6.4); flex: none; }
.ad-level b { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding-top: calc(var(--u) * 0.5); font-size: calc(var(--u) * 2.6); font-weight: 700; color: var(--cream); font-variant-numeric: tabular-nums; }
.ad-right { display: flex; flex-direction: column; gap: calc(var(--u) * 0.7); }
.ad-xp { position: relative; width: calc(var(--u) * 26); height: calc(var(--u) * 2.4); border-radius: 99px; overflow: hidden; background: #14102c; box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 0 calc(var(--u) * 0.55) var(--gold-lo); }
.ad-xp i { position: absolute; left: 0; top: 0; bottom: 0; width: calc(var(--f) * 100%); background: linear-gradient(180deg, #c8f59a, #6fc46a 55%, #2f7a45); transition: width 0.25s ease-out; }
.ad-xp span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: calc(var(--u) * 1.45); font-weight: 700; color: var(--cream); font-variant-numeric: tabular-nums; paint-order: stroke fill; -webkit-text-stroke: calc(var(--u) * 0.35) var(--ink); }
.ad-counts { display: flex; gap: calc(var(--u) * 1.4); }
.ad-count { display: inline-flex; align-items: center; gap: calc(var(--u) * 0.4); font-size: calc(var(--u) * 1.9); font-weight: 700; color: var(--cream); font-variant-numeric: tabular-nums; }
.ad-count .ad-ico { width: calc(var(--u) * 2.8); height: calc(var(--u) * 2.8); }
.ad-embers b { color: var(--ember-hi, #ffd75a); text-shadow: 0 0 calc(var(--u) * 0.9) rgba(255, 138, 58, 0.55); }
.ad-ready { animation: hx-beat 1.6s ease-in-out infinite; filter: drop-shadow(0 0 calc(var(--u) * 0.7) rgba(255, 190, 90, 0.9)); }
.ad-prompt { position: absolute; left: 50%; bottom: calc(var(--u) * 17); transform: translateX(-50%); z-index: 104; padding: calc(var(--u) * 0.5) calc(var(--u) * 1.6); border-radius: 999px; font-size: calc(var(--u) * 1.9); font-weight: 700; color: var(--cream); background: rgba(26, 22, 56, 0.9); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--gold-lo); white-space: nowrap; pointer-events: none; }
.ad-prompt kbd { font: inherit; padding: 0 calc(var(--u) * 0.7); margin-right: calc(var(--u) * 0.4); border-radius: calc(var(--u) * 0.5); color: var(--ink); background: var(--gold); }
.ad-rift { display: flex; flex-direction: column; gap: calc(var(--u) * 0.2); margin-top: calc(var(--u) * 0.6); padding: calc(var(--u) * 0.6) calc(var(--u) * 1); border-radius: calc(var(--u) * 0.8); background: rgba(42, 34, 54, 0.82); box-shadow: 0 0 0 calc(var(--u) * 0.25) #b48cff; color: var(--cream); font-size: calc(var(--u) * 1.7); max-width: calc(var(--u) * 36); }
.ad-rift b { display: inline-flex; align-items: center; gap: calc(var(--u) * 0.5); color: #e6d8ff; letter-spacing: 0.04em; }
.ad-rift .ad-ico { width: calc(var(--u) * 2.4); height: calc(var(--u) * 2.4); }
.ad-rift small { color: #cdb8ff; font-size: 0.9em; }

.ad-boss { position: absolute; top: calc(var(--u) * 2); left: 50%; transform: translateX(-50%); z-index: 105; width: min(calc(var(--u) * 80), 70vw); text-align: center; }
.ad-boss-name { font-size: calc(var(--u) * 2.8); font-weight: 700; letter-spacing: 0.08em; color: #ffd9c8; margin-bottom: calc(var(--u) * 0.6); }
.ad-boss-name small { margin-left: calc(var(--u) * 1.2); font-size: 0.6em; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold-hi); }
.ad-boss-bar { position: relative; height: calc(var(--u) * 2.4); border-radius: calc(var(--u) * 0.6); background: #2a0f1c; box-shadow: 0 0 0 calc(var(--u) * 0.35) var(--ink), 0 0 0 calc(var(--u) * 0.75) var(--gold-lo), 0 0 0 calc(var(--u) * 1.1) var(--ink); }
.ad-boss-bar i { position: absolute; left: 0; top: 0; bottom: 0; width: calc(var(--f) * 100%); border-radius: inherit; background: linear-gradient(180deg, #ff9a6a, #d23a2c 50%, #7d1a22); transition: width 0.2s ease-out; }
.ad-boss-bar b { position: absolute; top: calc(var(--u) * -0.7); bottom: calc(var(--u) * -0.7); width: calc(var(--u) * 0.6); margin-left: calc(var(--u) * -0.3); background: var(--gold-hi); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink); border-radius: 99px; }
.ad-boss-bar b.past { background: #6d6596; }

.ad-toasts { position: absolute; right: calc(var(--u) * 2); top: 26%; z-index: 110; display: flex; flex-direction: column; align-items: flex-end; gap: calc(var(--u) * 0.9); }
.ad-toast { --rar: var(--gold); display: flex; align-items: center; gap: calc(var(--u) * 1); min-width: calc(var(--u) * 26); max-width: calc(var(--u) * 40); padding: calc(var(--u) * 0.6) calc(var(--u) * 1.6) calc(var(--u) * 0.6) calc(var(--u) * 0.6); border-radius: calc(var(--u) * 1.4);
  background: linear-gradient(90deg, rgba(43, 37, 87, 0.95), rgba(26, 22, 56, 0.9)); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--rar), 0 calc(var(--u) * 0.6) calc(var(--u) * 1.4) rgba(0, 0, 0, 0.35);
  animation: ad-in 0.28s ease-out, ad-out 0.5s ease-in var(--out, 2.7s) forwards; }
.ad-toast.k-level { --rar: var(--gold-hi); }
.ad-toast.r-magic { --rar: #8fb0ff; } .ad-toast.r-rare { --rar: #ffd75a; } .ad-toast.r-normal { --rar: #e9dfc6; }
.ad-toast.k-hearth { --rar: #ff8a3a; } .ad-toast.k-salvage { --rar: #8a82ad; } .ad-toast.k-salvage .ad-toast-txt b { color: var(--sand); font-size: calc(var(--u) * 1.8); }
.ad-toast.k-heart { --rar: #ff6a5a; } .ad-toast.k-shard { --rar: #bfaeff; } .ad-toast.k-rune { --rar: #72dcc8; }
.ad-toast-ico { flex: none; width: calc(var(--u) * 4.2); height: calc(var(--u) * 4.2); padding: calc(var(--u) * 0.35); border-radius: 50%; background: radial-gradient(circle at 40% 35%, #3d3580, #1a1638); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink); }
.ad-toast-txt { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
.ad-toast-txt b { font-size: calc(var(--u) * 2.1); color: var(--rar); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ad-toast.k-scrap b, .ad-toast.k-key b { color: var(--cream); }
.ad-toast-txt small { font-size: calc(var(--u) * 1.5); color: var(--sand); }
@keyframes ad-in { 0% { opacity: 0; transform: translateX(calc(var(--u) * 3)); } 100% { opacity: 1; transform: none; } }
@keyframes ad-out { 100% { opacity: 0; transform: translateX(calc(var(--u) * 2)); } }

.ad-dead small { display: block; margin-top: calc(var(--u) * 1.6); font-size: calc(var(--u) * 2.1); font-weight: 700; color: var(--cream); paint-order: stroke fill; -webkit-text-stroke: calc(var(--u) * 0.5) var(--ink); white-space: normal; max-width: calc(var(--u) * 60); margin-left: auto; margin-right: auto; }
@media (max-width: 760px) {
  .ad-plate { --u: 3.6px; }
  .ad-toasts { --u: 3.6px; top: 18%; }
  .ad-boss { --u: 3.6px; top: 64px; }
  .ad-prompt { --u: 3.6px; bottom: 150px; }
}
@media (prefers-reduced-motion: reduce) { .ad-toast { animation: none; } }
/* Screenshots hold toasts and banners in place (HudDebug.hold). */
#ui.rl-hold .ad-toast, #ui.rl-hold .rl-banner { animation: none !important; opacity: 1 !important; }
#ui.rl-hold .rl-banner { transform: translateX(-50%) !important; }
`;

export function injectAdventureHudStyle(): void {
  if (document.getElementById('rl-adv-style')) return;
  const el = document.createElement('style');
  el.id = 'rl-adv-style';
  el.textContent = advCss;
  document.head.appendChild(el);
}
