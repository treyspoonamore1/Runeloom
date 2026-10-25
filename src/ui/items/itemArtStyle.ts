/**
 * Stylesheet for the item art frames (itemArt.tsx). The frame is a size container, so its rim,
 * ink line and tier pips scale with it (cq units) whether a caller sizes it with `size` or lets it
 * fill its box. Rim colors are the menus' rarity colors (.r-normal etc. in menuStyle.ts);
 * the currency and part frames are neutral.
 */
import { injectMenuStyle } from '../menus/menuStyle';

/**
 * Rim color of the magic, rare and unique frames: the same values as menuStyle.ts's --rar (a test
 * keeps them in step). The normal frame is plain dark, so it has none.
 */
export const RARITY_RIM = {
  magic: '#8fb0ff',
  rare: '#ffd75a',
  unique: '#f0954a',
} as const;

export const itemArtCss = `
.ia-frame { --ia-rim: #4d4578; --ia-bg1: #2c2554; --ia-bg2: #141030; --ia-glow: transparent;
  position: relative; display: inline-block; box-sizing: border-box; flex: none; vertical-align: middle; line-height: 0;
  width: 100%; height: 100%; aspect-ratio: 1 / 1; container-type: inline-size; }
.ia-frame::before { content: ''; position: absolute; inset: 0; box-sizing: border-box; border-radius: 22cqw;
  border: max(1px, 4.5cqw) solid #2a1c1f;
  background: radial-gradient(circle at 50% 36%, var(--ia-bg1), var(--ia-bg2) 78%);
  box-shadow: inset 0 0 0 max(1px, 5cqw) var(--ia-rim), inset 0 0 0 max(1.5px, 7cqw) rgba(20, 14, 30, 0.7), 0 0 14cqw 3cqw var(--ia-glow); }
.ia-frame > .ia-art { position: absolute; left: 11%; top: 11%; width: 78%; height: 78%; overflow: visible; display: block; }
.ia-frame.ia-sm > .ia-art { left: 9%; top: 9%; width: 82%; height: 82%; }
.ia-sm { width: calc(var(--u, 7.2px) * 3.4); height: calc(var(--u, 7.2px) * 3.4); min-width: 22px; min-height: 22px; }
.ia-md { width: calc(var(--u, 7.2px) * 6.8); height: calc(var(--u, 7.2px) * 6.8); }
.ia-lg { width: calc(var(--u, 7.2px) * 11); height: calc(var(--u, 7.2px) * 11); }
.ia-frame.r-normal { --ia-rim: #5a527f; }
.ia-frame.r-magic { --ia-rim: ${RARITY_RIM.magic}; --ia-bg1: #2a3f86; --ia-bg2: #121838; }
.ia-frame.r-rare { --ia-rim: ${RARITY_RIM.rare}; --ia-bg1: #57452c; --ia-bg2: #1c1428; }
.ia-frame.r-unique { --ia-rim: ${RARITY_RIM.unique}; --ia-bg1: #6a3420; --ia-bg2: #1e1022; --ia-glow: rgba(240, 149, 74, 0.5); }
.ia-frame.r-currency, .ia-frame.r-part { --ia-rim: #7a6f9e; --ia-bg1: #332c58; --ia-bg2: #17132f; }
.ia-tier { position: absolute; left: 0; right: 0; bottom: -6cqw; display: flex; justify-content: center; gap: 5cqw; pointer-events: none; }
.ia-tier i { display: block; width: 14cqw; height: 14cqw; min-width: 4px; min-height: 4px; transform: rotate(45deg); border-radius: 2cqw;
  background: #ffd75a; box-shadow: 0 0 0 max(1px, 3.5cqw) #2a1c1f; }
.ia-tier.t-1 i { background: #e9b48a; } .ia-tier.t-2 i { background: #dfe6f4; } .ia-tier.t-3 i { background: #ffd75a; }
`;

export function injectItemArtStyle(): void {
  if (typeof document === 'undefined') return;
  injectMenuStyle('rl-item-art', itemArtCss);
}
