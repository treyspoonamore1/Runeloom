import type { Graphics } from 'pixi.js';
import { TILE_CELLS as T } from '../sim';
import { BLOCK, LINE, PAL } from './palette';

/** Prop looks for the baked room layer, drawn into a tile at (x, y) in cells. */

export function darken(color: number, f: number): number {
  const r = ((color >> 16) & 255) * f;
  const gg = ((color >> 8) & 255) * f;
  const b = (color & 255) * f;
  return (Math.round(r) << 16) | (Math.round(gg) << 8) | Math.round(b);
}

export function lighten(color: number, f: number): number {
  const ch = (c: number): number => Math.round(c + (255 - c) * f);
  return (ch((color >> 16) & 255) << 16) | (ch((color >> 8) & 255) << 8) | ch(color & 255);
}

/** A raised box inset in its tile: lighter top, darker front, planks for crates. */
export function drawBox(g: Graphics, x: number, y: number, top: number, front: number, planks: boolean): void {
  const inset = 0.3;
  const bx = x + inset;
  const by = y + inset;
  const w = T - inset * 2;
  const h = T - inset * 2;
  const fh = 0.95;
  g.rect(bx + 0.3, by + 0.5, w, h).fill({ color: PAL.shadow, alpha: BLOCK.shadowAlpha * 1.4 });
  g.rect(bx, by, w, h - fh).fill(top);
  g.rect(bx, by + h - fh, w, fh).fill(front);
  if (planks) {
    g.moveTo(bx, by + (h - fh) / 2).lineTo(bx + w, by + (h - fh) / 2);
    g.moveTo(bx + 0.3, by + 0.3).lineTo(bx + w - 0.3, by + h - fh - 0.3);
    g.stroke({ width: LINE.detail, color: PAL.crateTopDark, cap: 'round' });
    g.moveTo(bx + w * 0.33, by + h - fh).lineTo(bx + w * 0.33, by + h);
    g.moveTo(bx + w * 0.66, by + h - fh).lineTo(bx + w * 0.66, by + h);
    g.stroke({ width: LINE.detail, color: darken(front, 0.75), cap: 'round' });
  }
  g.moveTo(bx, by + h - fh)
    .lineTo(bx + w, by + h - fh)
    .stroke({ width: LINE.detail, color: PAL.ink });
  g.rect(bx, by, w, h).stroke({ width: LINE.outline * 0.85, color: PAL.ink, join: 'round' });
}

/** A wooden barricade: two posts with three planks across, nailed. */
export function drawBarricade(g: Graphics, x: number, y: number): void {
  const plank = PAL.crateTop;
  const dark = PAL.crateFront;
  g.roundRect(x + 0.5, y + 1.0, 3.3, 2.7, 0.3).fill({ color: PAL.shadow, alpha: BLOCK.shadowAlpha * 1.4 });
  for (const px of [0.55, 2.85]) {
    g.roundRect(x + px, y + 0.35, 0.6, 3.3, 0.15).fill(dark).stroke({ width: LINE.detail, color: PAL.ink });
  }
  for (const py of [0.75, 1.75, 2.75]) {
    g.roundRect(x + 0.25, y + py, 3.5, 0.75, 0.15)
      .fill(plank)
      .stroke({ width: LINE.outline * 0.6, color: PAL.ink, join: 'round' });
    g.moveTo(x + 0.6, y + py + 0.5)
      .lineTo(x + 3.3, y + py + 0.5)
      .stroke({ width: LINE.detail * 0.8, color: PAL.crateTopDark, cap: 'round' });
    for (const nx of [0.85, 3.15]) g.circle(x + nx, y + py + 0.37, 0.1).fill(PAL.ink);
  }
}

/** An oil barrel: a dark purple drum with metal bands and an oil drip on top. */
export function drawBarrel(g: Graphics, x: number, y: number): void {
  const cx = x + T / 2;
  const body = 0x4a3560;
  const band = 0x8f8794;
  g.ellipse(cx + 0.3, y + 3.45, 1.55, 0.6).fill({ color: PAL.shadow, alpha: BLOCK.shadowAlpha * 1.6 });
  g.roundRect(cx - 1.4, y + 0.9, 2.8, 2.6, 0.5)
    .fill(body)
    .stroke({ width: LINE.outline * 0.85, color: PAL.ink, join: 'round' });
  for (const by of [1.65, 2.85]) {
    g.moveTo(cx - 1.4, y + by)
      .lineTo(cx + 1.4, y + by)
      .stroke({ width: LINE.detail * 1.6, color: band });
  }
  g.ellipse(cx, y + 0.95, 1.4, 0.55)
    .fill(lighten(body, 0.2))
    .stroke({ width: LINE.outline * 0.7, color: PAL.ink });
  g.ellipse(cx - 0.35, y + 0.95, 0.4, 0.2).fill(0x1e1428);
  g.moveTo(cx - 0.9, y + 1.3)
    .lineTo(cx - 0.9, y + 2.4)
    .stroke({ width: LINE.detail, color: lighten(body, 0.35), cap: 'round' });
}

export function drawBrazierBowl(g: Graphics, cx: number, cy: number): void {
  g.ellipse(cx + 0.25, cy + 0.45, 1.75, 1.45).fill({ color: PAL.shadow, alpha: 0.22 });
  // Three stubby legs peeking out under the bowl.
  for (const dx of [-1.1, 0, 1.1]) g.roundRect(cx + dx - 0.25, cy + 0.6, 0.5, 0.9, 0.2);
  g.fill(PAL.brazierRim).stroke({ width: LINE.detail, color: PAL.ink });
  g.ellipse(cx, cy, 1.6, 1.3)
    .fill(PAL.brazierStone)
    .stroke({ width: LINE.outline * 0.85, color: PAL.ink });
  g.ellipse(cx, cy - 0.15, 1.1, 0.8)
    .fill(PAL.brazierCoal)
    .stroke({ width: LINE.detail, color: PAL.brazierRim });
}

export function drawLoomStone(g: Graphics, cx: number, cy: number): void {
  g.circle(cx, cy, 1.85).fill({ color: PAL.loomStoneRune, alpha: 0.18 });
  g.circle(cx, cy, 1.35)
    .fill(PAL.loomStone)
    .stroke({ width: LINE.outline * 0.8, color: PAL.ink });
  g.circle(cx, cy, 0.95).stroke({ width: LINE.detail, color: darken(PAL.loomStone, 0.75) });
  // A four-point rune.
  g.poly([
    cx,
    cy - 0.7,
    cx + 0.22,
    cy - 0.22,
    cx + 0.7,
    cy,
    cx + 0.22,
    cy + 0.22,
    cx,
    cy + 0.7,
    cx - 0.22,
    cy + 0.22,
    cx - 0.7,
    cy,
    cx - 0.22,
    cy - 0.22,
  ]);
  g.fill(PAL.loomStoneRune).stroke({ width: LINE.detail * 0.8, color: PAL.ink });
}
