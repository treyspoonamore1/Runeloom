import { Container, Graphics, Text } from 'pixi.js';
import type { LabStation } from '../../data/lab';
import { TILE_CELLS as T } from '../sim';
import { LINE, PAL } from './palette';

/** Lab plaque look. Lengths in cells. */
const PLAQUE = {
  /** Text cap height, cells. */
  textCells: 1.5,
  /** Font size the text is rasterized at (then scaled to textCells). */
  fontPx: 36,
  padX: 0.7,
  padY: 0.35,
  /** Gap between the plaque bottom and the station's top edge. */
  gap: 0.5,
  wood: 0x5a3a26,
  woodLight: 0x7a5236,
  text: 0xfff2d6,
  pin: 0xf4c54f,
} as const;

/**
 * Chemistry Lab station labels (BUILD_PLAN M3 task 9): a small wooden plaque above each station's
 * area, in world space, drawn above the entities so it stays readable.
 */
export class LabLabels {
  readonly root = new Container();
  private key = '';

  set(stations: readonly LabStation[]): void {
    const key = stations.map((s) => `${s.label}@${s.rect.tx},${s.rect.ty},${s.rect.w}`).join('|');
    if (key === this.key) return;
    this.key = key;
    for (const c of this.root.removeChildren()) c.destroy({ children: true });
    for (const s of stations) this.root.addChild(plaque(s));
  }
}

function plaque(s: LabStation): Container {
  const c = new Container();
  const text = new Text({
    text: s.label,
    resolution: 2,
    style: {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: PLAQUE.fontPx,
      fill: PLAQUE.text,
      fontWeight: '900',
    },
  });
  const k = PLAQUE.textCells / PLAQUE.fontPx;
  text.scale.set(k);
  const tw = text.width;
  const th = text.height;
  const w = tw + PLAQUE.padX * 2;
  const h = th + PLAQUE.padY * 2;
  const g = new Graphics();
  g.roundRect(0.25, 0.35, w, h, 0.45).fill({ color: PAL.shadow, alpha: 0.35 });
  g.roundRect(0, 0, w, h, 0.45)
    .fill(PLAQUE.wood)
    .stroke({ width: LINE.outline * 0.7, color: PAL.ink, join: 'round' });
  g.moveTo(0.45, 0.32)
    .lineTo(w - 0.45, 0.32)
    .stroke({ width: LINE.detail, color: PLAQUE.woodLight, cap: 'round' });
  for (const px of [0.32, w - 0.32]) g.circle(px, h / 2, 0.14).fill(PLAQUE.pin);
  text.position.set(PLAQUE.padX, PLAQUE.padY);
  c.addChild(g, text);
  const cx = (s.rect.tx + s.rect.w / 2) * T;
  const top = s.rect.ty * T;
  c.position.set(cx - w / 2, Math.max(0.2, top - PLAQUE.gap - h));
  return c;
}
