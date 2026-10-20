/**
 * Stylesheet for the player-facing UI (HUD, start screen, pause menu). Warm Loomwright look:
 * indigo plates, gold trim, thick dark outlines like the game's shapes (DESIGN §15).
 * Sizes use --u (1% of the viewport height, capped by width) so the UI scales with the view:
 * 1u = 7.2 px at 1280x720 and 10.8 px at 1920x1080.
 */
export const hudCss = `
.rl-root {
  --u: min(1vh, 0.5625vw);
  --ink: #2a1c1f; --gold: #f2c35b; --gold-hi: #ffe9a8; --gold-lo: #a8782a;
  --indigo-1: #2b2557; --indigo-2: #1a1638; --indigo-3: #3d3580;
  --sand: #f1dbab; --cream: #fff4d6; --terra: #c4623a; --danger: #ff5a4a;
  --life-1: #ff8a62; --life-2: #d23a2c; --life-3: #7d1a22;
  --mana-1: #9ab8ff; --mana-2: #4e63e6; --mana-3: #241d78;
  position: fixed; inset: 0; pointer-events: none !important; overflow: hidden;
  font-family: 'Palatino Linotype', Palatino, 'Book Antiqua', 'Iowan Old Style', Georgia, serif;
  color: var(--cream); user-select: none; -webkit-user-select: none;
}
.rl-root *, .rl-root *::before, .rl-root *::after { box-sizing: border-box; }
.rl-outline { paint-order: stroke fill; -webkit-text-stroke: calc(var(--u) * 0.55) var(--ink); }

/* ---- Bottom bar ---- */
.rl-bar { position: absolute; left: 50%; bottom: calc(var(--u) * 2.4); transform: translateX(-50%); display: flex; align-items: flex-end; gap: calc(var(--u) * 2.6); z-index: 100; }
.rl-globe { position: relative; width: calc(var(--u) * 13.5); height: calc(var(--u) * 13.5); border-radius: 50%; overflow: hidden; isolation: isolate;
  background: radial-gradient(circle at 50% 35%, #35283f, #150f1d 70%);
  box-shadow: 0 0 0 calc(var(--u) * 0.55) var(--ink), 0 0 0 calc(var(--u) * 1.1) var(--gold), 0 0 0 calc(var(--u) * 1.65) var(--ink), 0 calc(var(--u) * 1) calc(var(--u) * 2) calc(var(--u) * 1.4) rgba(0, 0, 0, 0.4); }
.rl-fill { position: absolute; left: 0; right: 0; bottom: 0; height: calc(var(--f) * 100%); transition: height 0.18s ease-out; }
.rl-fill.empty { display: none; }
.rl-fill::before { content: ''; position: absolute; left: -10%; right: -10%; top: calc(var(--u) * -0.9); height: calc(var(--u) * 1.8); border-radius: 50%; background: rgba(255, 238, 205, 0.5); }
.rl-life .rl-fill { background: linear-gradient(180deg, var(--life-1), var(--life-2) 45%, var(--life-3)); }
.rl-mana .rl-fill { background: linear-gradient(180deg, var(--mana-1), var(--mana-2) 45%, var(--mana-3)); }
.rl-mana .rl-fill::before { background: rgba(215, 230, 255, 0.55); }
.rl-globe::after { content: ''; position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
  background: radial-gradient(ellipse 58% 38% at 33% 21%, rgba(255, 255, 255, 0.36), transparent 72%), radial-gradient(circle at 50% 118%, rgba(0, 0, 0, 0.38), transparent 56%); }
.rl-num { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: calc(var(--u) * 3.2); font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.rl-num b { font-size: calc(var(--u) * 3.8); font-weight: 700; }
.rl-num span { font-size: calc(var(--u) * 1.9); margin-top: calc(var(--u) * 0.35); color: var(--sand); }
.rl-deny { position: absolute; inset: 0; z-index: 3; border-radius: inherit; background: var(--danger); opacity: 0; animation: rl-deny 0.42s ease-out; pointer-events: none; }
@keyframes rl-deny { 0% { opacity: 0.75; } 100% { opacity: 0; } }
.rl-life.low { animation: rl-throb 1s ease-in-out infinite; }
@keyframes rl-throb { 50% { filter: brightness(1.25) saturate(1.15); } }

.rl-plate { display: flex; flex-direction: column; align-items: center; gap: calc(var(--u) * 2.6); padding: calc(var(--u) * 1.6) calc(var(--u) * 3) calc(var(--u) * 1.8); border-radius: calc(var(--u) * 2);
  background: linear-gradient(180deg, rgba(43, 37, 87, 0.94), rgba(26, 22, 56, 0.96));
  box-shadow: 0 0 0 calc(var(--u) * 0.4) var(--ink), 0 0 0 calc(var(--u) * 0.85) var(--gold-lo), 0 0 0 calc(var(--u) * 1.25) var(--ink), 0 calc(var(--u) * 1) calc(var(--u) * 2) rgba(0, 0, 0, 0.35); }
.rl-pips { display: flex; align-items: center; gap: calc(var(--u) * 0.9); }
.rl-pips small { font-size: calc(var(--u) * 1.5); letter-spacing: 0.12em; text-transform: uppercase; color: var(--gold); margin: 0 calc(var(--u) * 0.2); }
.rl-pip { position: relative; width: calc(var(--u) * 2.6); height: calc(var(--u) * 2.6); border-radius: 50%;
  background: conic-gradient(var(--gold-hi) calc(var(--p) * 360deg), rgba(255, 255, 255, 0.1) 0);
  box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink); }
.rl-pip::after { content: ''; position: absolute; inset: calc(var(--u) * 0.6); border-radius: 50%; background: var(--indigo-2); }
.rl-pip.full { background: var(--gold); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 calc(var(--u) * 1.2) rgba(255, 220, 120, 0.6); }
.rl-pip.full::after { background: radial-gradient(circle at 40% 35%, #fff6d0, var(--gold) 70%); }
.rl-slots { display: flex; gap: calc(var(--u) * 3); }
.rl-slotwrap { display: flex; flex-direction: column; align-items: center; gap: calc(var(--u) * 0.7); }
.rl-slotwrap .rl-key { margin-top: calc(var(--u) * 1.5); }
.rl-slot { position: relative; width: calc(var(--u) * 8.6); height: calc(var(--u) * 8.6); border-radius: calc(var(--u) * 1.6);
  background: linear-gradient(160deg, var(--indigo-3), var(--indigo-2));
  box-shadow: 0 0 0 calc(var(--u) * 0.4) var(--ink), 0 0 0 calc(var(--u) * 0.8) var(--gold-lo), 0 0 0 calc(var(--u) * 1.2) var(--ink); transition: filter 0.15s; }
.rl-slot svg { position: absolute; inset: calc(var(--u) * 1.1); width: calc(100% - var(--u) * 2.2); height: calc(100% - var(--u) * 2.2); }
.rl-slot.poor svg { filter: saturate(0.3) brightness(0.7); }
.rl-slot.casting { box-shadow: 0 0 0 calc(var(--u) * 0.4) var(--ink), 0 0 0 calc(var(--u) * 0.8) var(--gold-hi), 0 0 0 calc(var(--u) * 1.2) var(--ink), 0 0 calc(var(--u) * 2) rgba(255, 220, 120, 0.7); }
.rl-sweep { position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: conic-gradient(from 0deg, transparent calc(var(--p) * 360deg), rgba(12, 8, 30, 0.7) 0); }
.rl-sweep.idle { display: none; }
.rl-cost { position: absolute; top: calc(var(--u) * -1.5); right: calc(var(--u) * -1.7); min-width: calc(var(--u) * 3.1); height: calc(var(--u) * 3.1); padding: 0 calc(var(--u) * 0.5); border-radius: calc(var(--u) * 1.6);
  display: flex; align-items: center; justify-content: center; font-size: calc(var(--u) * 1.9); font-weight: 700; color: var(--cream);
  background: linear-gradient(180deg, var(--mana-2), var(--mana-3)); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--mana-1); }
.rl-slot.poor .rl-cost { background: linear-gradient(180deg, #e0523f, #8a1f26); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 0 calc(var(--u) * 0.6) #ff9a85; }
.rl-slot.empty { background: rgba(26, 22, 56, 0.6); box-shadow: 0 0 0 calc(var(--u) * 0.4) var(--ink), 0 0 0 calc(var(--u) * 0.8) rgba(168, 120, 42, 0.45), 0 0 0 calc(var(--u) * 1.2) var(--ink); }
.rl-slot.empty::after { content: ''; position: absolute; inset: calc(var(--u) * 1.4); border-radius: calc(var(--u) * 1); border: calc(var(--u) * 0.3) dashed rgba(185, 176, 216, 0.35); }
.rl-slot.warn svg { filter: saturate(0.2) brightness(0.55); }
.rl-cd { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: conic-gradient(from 0deg, rgba(12, 8, 30, 0.72) calc(var(--p) * 360deg), transparent 0); }
.rl-cd.idle { display: none; }
.rl-auto { position: absolute; left: 50%; bottom: calc(var(--u) * -1.1); transform: translateX(-50%); padding: calc(var(--u) * 0.15) calc(var(--u) * 0.7); border-radius: 999px; font-size: calc(var(--u) * 1.3); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; line-height: 1.1; color: var(--ink); background: #72dcc8; box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink); }
.rl-warn { position: absolute; bottom: calc(var(--u) * -0.9); left: calc(var(--u) * -1.1); width: calc(var(--u) * 2.6); height: calc(var(--u) * 2.6); border-radius: 50%; background: var(--danger); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 calc(var(--u) * 1) rgba(255, 90, 74, 0.8); }
.rl-warn::after { content: '!'; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: calc(var(--u) * 1.9); font-weight: 700; font-style: normal; color: var(--cream); }
.rl-loomhint { position: absolute; right: calc(var(--u) * 2.2); top: calc(var(--u) * 1.3); display: flex; align-items: center; gap: calc(var(--u) * 0.6); font-size: calc(var(--u) * 1.5); color: var(--gold); letter-spacing: 0.08em; text-transform: uppercase; }
.rl-loomhint .rl-cap { min-width: 0; margin: 0; padding: calc(var(--u) * 0.15) calc(var(--u) * 0.6); font-size: calc(var(--u) * 1.3); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink); }
.rl-key { font-size: calc(var(--u) * 1.8); font-weight: 700; letter-spacing: 0.1em; color: var(--gold); text-transform: uppercase; line-height: 1; }
.rl-spellname { font-size: calc(var(--u) * 1.6); color: var(--sand); line-height: 1; margin-top: calc(var(--u) * -0.1); max-width: calc(var(--u) * 11); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rl-godtag { white-space: nowrap; position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(100% + var(--u) * 1.2); padding: calc(var(--u) * 0.3) calc(var(--u) * 1.2); border-radius: 999px; font-size: calc(var(--u) * 1.5); font-weight: 700; letter-spacing: 0.14em; color: var(--ink); background: var(--gold); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink); }

/* ---- Top wave panel and banner ---- */
.rl-wave { position: absolute; top: calc(var(--u) * 1.8); left: 50%; transform: translateX(-50%); z-index: 100; text-align: center; padding: calc(var(--u) * 0.9) calc(var(--u) * 3.6) calc(var(--u) * 1); border-radius: calc(var(--u) * 1.8); white-space: nowrap;
  background: linear-gradient(180deg, rgba(43, 37, 87, 0.92), rgba(26, 22, 56, 0.94));
  box-shadow: 0 0 0 calc(var(--u) * 0.4) var(--ink), 0 0 0 calc(var(--u) * 0.85) var(--gold-lo), 0 0 0 calc(var(--u) * 1.25) var(--ink), 0 calc(var(--u) * 0.8) calc(var(--u) * 1.8) rgba(0, 0, 0, 0.3); }
.rl-wave-title { font-size: calc(var(--u) * 3); font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold-hi); line-height: 1.15; }
.rl-wave-detail { font-size: calc(var(--u) * 1.9); color: var(--sand); line-height: 1.2; font-variant-numeric: tabular-nums; }
.rl-banner { padding: calc(var(--u) * 2.4) calc(var(--u) * 8) calc(var(--u) * 1.6); background: radial-gradient(ellipse 50% 50% at 50% 50%, rgba(26, 22, 56, 0.8), rgba(26, 22, 56, 0.55) 55%, transparent 100%); position: absolute; top: 15%; left: 50%; z-index: 110; text-align: center; white-space: nowrap; transform: translateX(-50%); opacity: 0; animation: rl-banner 2.6s ease-out forwards; }
.rl-banner h2 { margin: 0; font-size: calc(var(--u) * 6); font-weight: 700; letter-spacing: 0.06em; color: var(--gold-hi); paint-order: stroke fill; -webkit-text-stroke: calc(var(--u) * 1) var(--ink); text-shadow: 0 calc(var(--u) * 0.6) 0 var(--terra); }
.rl-banner p { margin: calc(var(--u) * 0.4) 0 0; font-size: calc(var(--u) * 2.2); letter-spacing: 0.2em; text-transform: uppercase; color: var(--sand); }
.rl-banner::after { content: ''; display: block; height: calc(var(--u) * 0.5); margin: calc(var(--u) * 1) auto 0; width: 70%; border-radius: 99px; background: linear-gradient(90deg, transparent, var(--gold), transparent); }
@keyframes rl-banner { 0% { opacity: 0; transform: translate(-50%, calc(var(--u) * -1.6)) scale(0.94); } 10% { opacity: 1; transform: translate(-50%, 0) scale(1); } 74% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, calc(var(--u) * 0.8)); } }

/* ---- Screen-edge feedback ---- */
.rl-hurt { position: absolute; inset: 0; z-index: 90; opacity: 0; box-shadow: inset 0 0 calc(var(--u) * 14) calc(var(--u) * 2) rgba(210, 40, 30, 0.7); animation: rl-hurt 0.4s ease-out; }
@keyframes rl-hurt { 0% { opacity: 1; } 100% { opacity: 0; } }
.rl-lowlife { position: absolute; inset: 0; z-index: 89; box-shadow: inset 0 0 calc(var(--u) * 12) calc(var(--u) * 0.5) rgba(200, 30, 30, 0.35); animation: rl-low 1.1s ease-in-out infinite; }
@keyframes rl-low { 50% { opacity: 0.35; } }
.rl-dead { position: absolute; inset: 0; z-index: 120; background: radial-gradient(ellipse at 50% 50%, rgba(40, 10, 30, 0) 25%, rgba(60, 10, 30, 0.82) 100%); animation: rl-fade 0.6s ease-out; }
.rl-dead div { position: absolute; top: 24%; left: 50%; transform: translateX(-50%); text-align: center; white-space: nowrap; }
.rl-dead h2 { margin: 0; font-size: calc(var(--u) * 7); letter-spacing: 0.04em; color: #ffd9c8; paint-order: stroke fill; -webkit-text-stroke: calc(var(--u) * 1) var(--ink); text-shadow: 0 calc(var(--u) * 0.6) 0 #7d1a22, 0 calc(var(--u) * 1.6) calc(var(--u) * 2.4) rgba(0, 0, 0, 0.6); }
.rl-dead p { margin: calc(var(--u) * 0.6) 0 0; font-size: calc(var(--u) * 3.2); font-weight: 700; color: var(--cream); paint-order: stroke fill; -webkit-text-stroke: calc(var(--u) * 0.7) var(--ink); text-shadow: 0 calc(var(--u) * 0.3) calc(var(--u) * 0.8) rgba(0, 0, 0, 0.8); }
@keyframes rl-fade { 0% { opacity: 0; } 100% { opacity: 1; } }

/* ---- Start screen and pause menu ---- */
.rl-screen { position: absolute; inset: 0; z-index: 800; pointer-events: auto !important; overflow: auto; display: flex; align-items: center; justify-content: center; text-align: center; animation: rl-fade 0.35s ease-out; }
.rl-start { background: radial-gradient(ellipse at 50% 40%, rgba(61, 53, 128, 0.95), rgba(34, 27, 74, 0.9) 55%, rgba(20, 15, 44, 0.8) 100%); }
/* The dev stats panel would crowd the title card; it comes back on play. */
#ui.rl-starting .dbg-left { visibility: hidden !important; }
.rl-pausebg { background: rgba(16, 11, 34, 0.62); }
.rl-col { display: flex; flex-direction: column; align-items: center; padding: calc(var(--u) * 3) calc(var(--u) * 2); }
.rl-emblem { width: calc(var(--u) * 11); height: calc(var(--u) * 11); margin-bottom: calc(var(--u) * 0.6); filter: drop-shadow(0 calc(var(--u) * 0.6) calc(var(--u) * 1) rgba(0, 0, 0, 0.45)); }
.rl-title { margin: 0; font-size: calc(var(--u) * 12); font-weight: 700; letter-spacing: 0.04em; line-height: 1; color: var(--gold-hi);
  text-shadow: 0 calc(var(--u) * 0.5) 0 var(--gold-lo), 0 calc(var(--u) * 1) 0 var(--terra), 0 calc(var(--u) * 1.5) 0 var(--ink), 0 calc(var(--u) * 2.6) calc(var(--u) * 3) rgba(0, 0, 0, 0.55); }
.rl-sub { margin: calc(var(--u) * 2.4) 0 0; font-size: calc(var(--u) * 2.6); letter-spacing: 0.3em; text-transform: uppercase; color: var(--sand); }
.rl-rule { display: flex; align-items: center; gap: calc(var(--u) * 1.2); margin: calc(var(--u) * 2.2) 0; width: calc(var(--u) * 44); }
.rl-rule::before, .rl-rule::after { content: ''; flex: 1; height: calc(var(--u) * 0.35); border-radius: 99px; background: linear-gradient(90deg, transparent, var(--gold-lo)); }
.rl-rule::after { transform: scaleX(-1); }
.rl-rule i { width: calc(var(--u) * 1.2); height: calc(var(--u) * 1.2); background: var(--gold); transform: rotate(45deg); box-shadow: 0 0 0 calc(var(--u) * 0.25) var(--ink); }
.rl-controls { display: grid; grid-template-columns: repeat(3, auto); gap: calc(var(--u) * 1.3) calc(var(--u) * 4.5); text-align: left; margin: 0 0 calc(var(--u) * 3.2); }
.rl-pause .rl-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: calc(var(--u) * 0.9) calc(var(--u) * 3); margin: 0; }
.rl-pause .rl-ctl { white-space: normal; min-width: 0; line-height: 1.15; }
.rl-ctl { display: flex; align-items: center; gap: calc(var(--u) * 1.1); font-size: calc(var(--u) * 2.2); color: var(--sand); white-space: nowrap; }
.rl-keys { display: flex; gap: calc(var(--u) * 0.4); }
.rl-cap { min-width: calc(var(--u) * 3.2); padding: calc(var(--u) * 0.45) calc(var(--u) * 0.9); border-radius: calc(var(--u) * 0.8); font-size: calc(var(--u) * 1.8); font-weight: 700; color: var(--ink); text-align: center; line-height: 1.1;
  background: linear-gradient(180deg, #fff1cc, var(--sand)); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 calc(var(--u) * 0.55) 0 calc(var(--u) * 0.3) var(--ink); margin-bottom: calc(var(--u) * 0.5); }
.rl-btn { font: inherit; cursor: pointer; border: 0; color: var(--ink); font-weight: 700; letter-spacing: 0.06em; border-radius: calc(var(--u) * 1.6);
  padding: calc(var(--u) * 1.3) calc(var(--u) * 4); font-size: calc(var(--u) * 2.6);
  background: linear-gradient(180deg, var(--gold-hi), var(--gold) 55%, #e0a23a);
  box-shadow: 0 0 0 calc(var(--u) * 0.45) var(--ink), 0 calc(var(--u) * 0.9) 0 calc(var(--u) * 0.45) var(--ink), inset 0 calc(var(--u) * -0.4) 0 rgba(168, 120, 42, 0.5);
  transition: transform 0.1s, filter 0.1s; }
.rl-btn:hover, .rl-btn:focus-visible { transform: translateY(calc(var(--u) * -0.3)); filter: brightness(1.08); outline: 0; }
.rl-btn:active { transform: translateY(calc(var(--u) * 0.4)); }
.rl-btn.quiet { background: linear-gradient(180deg, var(--indigo-3), var(--indigo-1)); color: var(--cream); box-shadow: 0 0 0 calc(var(--u) * 0.45) var(--ink), 0 0 0 calc(var(--u) * 0.9) var(--gold-lo), 0 0 0 calc(var(--u) * 1.35) var(--ink); }
.rl-play { font-size: calc(var(--u) * 3.6); padding: calc(var(--u) * 1.6) calc(var(--u) * 7); animation: rl-glow 2.2s ease-in-out infinite; }
@keyframes rl-glow { 50% { filter: brightness(1.12) drop-shadow(0 0 calc(var(--u) * 1.4) rgba(255, 210, 100, 0.65)); } }
.rl-hint { margin-top: calc(var(--u) * 2.6); font-size: calc(var(--u) * 1.8); color: #b9b0d8; letter-spacing: 0.04em; }
.rl-hint kbd { font: inherit; color: var(--gold); }

.rl-pause .rl-card { width: calc(var(--u) * 56); max-width: 92vw; padding: calc(var(--u) * 3) calc(var(--u) * 4) calc(var(--u) * 3.2); border-radius: calc(var(--u) * 2.4); text-align: left;
  background: linear-gradient(180deg, rgba(43, 37, 87, 0.97), rgba(26, 22, 56, 0.98));
  box-shadow: 0 0 0 calc(var(--u) * 0.5) var(--ink), 0 0 0 calc(var(--u) * 1) var(--gold-lo), 0 0 0 calc(var(--u) * 1.5) var(--ink), 0 calc(var(--u) * 2) calc(var(--u) * 4) rgba(0, 0, 0, 0.5); }
.rl-card h2 { margin: 0 0 calc(var(--u) * 2); text-align: center; font-size: calc(var(--u) * 5); letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold-hi); text-shadow: 0 calc(var(--u) * 0.4) 0 var(--terra), 0 calc(var(--u) * 0.9) 0 var(--ink); }
.rl-row { display: flex; align-items: center; justify-content: space-between; gap: calc(var(--u) * 2); min-height: calc(var(--u) * 5); font-size: calc(var(--u) * 2.3); color: var(--sand); }
.rl-row + .rl-row { border-top: calc(var(--u) * 0.2) solid rgba(241, 219, 170, 0.14); }
.rl-actions { display: flex; gap: calc(var(--u) * 2); justify-content: center; margin-bottom: calc(var(--u) * 2.4); }
.rl-actions .rl-btn { font-size: calc(var(--u) * 2.3); padding: calc(var(--u) * 1.1) calc(var(--u) * 3); }
.rl-slider { display: flex; align-items: center; gap: calc(var(--u) * 1.4); }
.rl-slider input { width: calc(var(--u) * 22); height: calc(var(--u) * 2.4); accent-color: var(--gold); cursor: pointer; margin: 0; pointer-events: auto; }
.rl-slider output { min-width: calc(var(--u) * 5); text-align: right; color: var(--cream); font-variant-numeric: tabular-nums; }
.rl-switch { position: relative; width: calc(var(--u) * 6.4); height: calc(var(--u) * 3.2); border: 0; padding: 0; cursor: pointer; border-radius: 99px; background: #14102c; box-shadow: 0 0 0 calc(var(--u) * 0.35) var(--ink), 0 0 0 calc(var(--u) * 0.7) var(--gold-lo); transition: background 0.15s; }
.rl-switch::after { content: ''; position: absolute; top: calc(var(--u) * 0.4); left: calc(var(--u) * 0.4); width: calc(var(--u) * 2.4); height: calc(var(--u) * 2.4); border-radius: 50%; background: #8c82b8; transition: transform 0.15s, background 0.15s; }
.rl-switch[aria-checked='true'] { background: #5a4a1c; }
.rl-switch[aria-checked='true']::after { transform: translateX(calc(var(--u) * 3.2)); background: var(--gold-hi); }
.rl-seg { display: flex; gap: calc(var(--u) * 0.7); }
.rl-seg button { font: inherit; cursor: pointer; border: 0; padding: calc(var(--u) * 0.6) calc(var(--u) * 1.6); border-radius: calc(var(--u) * 1); font-size: calc(var(--u) * 2.1); font-weight: 700; color: var(--sand); background: #14102c; box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 0 calc(var(--u) * 0.6) rgba(168, 120, 42, 0.6); }
.rl-seg button[aria-pressed='true'] { color: var(--ink); background: linear-gradient(180deg, var(--gold-hi), var(--gold)); box-shadow: 0 0 0 calc(var(--u) * 0.3) var(--ink), 0 0 0 calc(var(--u) * 0.6) var(--gold-lo); }
.rl-subhead { margin: calc(var(--u) * 2.2) 0 calc(var(--u) * 1.2); font-size: calc(var(--u) * 1.8); letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold); text-align: center; }
@media (prefers-reduced-motion: reduce) { .rl-play, .rl-life.low, .rl-lowlife { animation: none; } }
`;

export function injectHudStyle(): void {
  if (document.getElementById('rl-hud-style')) return;
  const el = document.createElement('style');
  el.id = 'rl-hud-style';
  el.textContent = hudCss;
  document.head.appendChild(el);
}
