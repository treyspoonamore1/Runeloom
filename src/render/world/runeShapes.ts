import type { AtlasEntry } from '../atlas';
import { INK } from '../combatPalette';
import { PAL } from '../palette';
import type { Pen } from '../pen';
import { OBJ as C } from './worldPalette';

/**
 * Baked art for the rune shrine (`R`) and the dungeon-item moment: the altar, its socket, a rune
 * tablet and the element glyphs drawn on it (the Loom's glyphs, src/ui/loom/glyphs.tsx, redrawn in
 * cells), plus a light ray for the "item get" burst. Anchor (0, 0) is the tile center; white parts
 * are tinted per rune.
 */
const O = 0.32;
const W = 0xffffff;

/** A stone altar in the walls' 3/4 look: a wide step, a column with a light top face, carved front. */
function shrineBase(p: Pen): void {
  p.ellipse(0.25, 1.55, 2.1, 0.6).fill({ color: PAL.shadow, alpha: 0.3 });
  // Step.
  p.rect(-1.9, 0.55, 3.8, 0.5).fill(C.stoneLight);
  p.rect(-1.9, 1.05, 3.8, 0.6).fill(C.stoneDark);
  p.rect(-1.9, 0.55, 3.8, 1.1).stroke(O * 0.8, INK);
  // Column: top face, then the front face down to the step.
  p.rect(-1.25, -0.55, 2.5, 1.35).fill(C.stone);
  p.rect(-1.25, -0.55, 0.45, 1.35).fill({ color: W, alpha: 0.18 });
  p.rect(-1.25, 0.55, 2.5, 0.25).fill({ color: INK, alpha: 0.18 });
  p.rect(-1.45, -1.85, 2.9, 1.3).fill(C.stoneLight);
  p.rect(-1.45, -0.75, 2.9, 0.2).fill(C.stoneDark);
  p.rect(-1.45, -1.85, 2.9, 1.3).stroke(O * 0.8, INK);
  p.rect(-1.25, -0.55, 2.5, 1.35).stroke(O * 0.8, INK);
  // Carving on the front: a diamond between two grooves.
  p.moveTo(-0.8, -0.35).lineTo(-0.8, 0.55).stroke(0.1, C.stoneDark);
  p.moveTo(0.8, -0.35).lineTo(0.8, 0.55).stroke(0.1, C.stoneDark);
  p.poly([0, -0.35, 0.32, 0.1, 0, 0.55, -0.32, 0.1]).stroke(0.1, C.stoneDark);
}

/** The cup on the altar's top face where the rune rests (white; lit with the rune, dark when empty). */
function shrineSocket(p: Pen): void {
  p.ellipse(0, -1.3, 0.95, 0.42).fill(W).stroke(0.14, INK);
  p.ellipse(0, -1.22, 0.62, 0.24).fill({ color: INK, alpha: 0.35 });
}

/** A rune tablet: a faceted stone (white, tinted the rune's light color). */
function runeTablet(p: Pen): void {
  const pts = [0, -1.15, 0.85, -0.55, 0.85, 0.55, 0, 1.15, -0.85, 0.55, -0.85, -0.55];
  p.poly(pts).fill(W).stroke(0.16, INK);
  p.poly([0, -1.15, 0.85, -0.55, 0, -0.3, -0.85, -0.55]).fill({ color: W, alpha: 0.45 });
  p.poly([0, 1.15, 0.85, 0.55, 0.6, 0.45, 0, 0.85]).fill({ color: INK, alpha: 0.12 });
}

/** Glyphs: 24-unit Loom icons mapped onto ±0.62 cells. */
const G = 0.62 / 12;
const gx = (v: number): number => (v - 12) * G;

function frostGlyph(p: Pen): void {
  const seg = (x0: number, y0: number, x1: number, y1: number): void => {
    p.moveTo(gx(x0), gx(y0)).lineTo(gx(x1), gx(y1)).stroke(0.13, W);
  };
  seg(12, 2, 12, 22);
  seg(3.3, 7, 20.7, 17);
  seg(3.3, 17, 20.7, 7);
  p.moveTo(gx(9.5), gx(3.5)).lineTo(gx(12), gx(6)).lineTo(gx(14.5), gx(3.5)).stroke(0.12, W);
  p.moveTo(gx(9.5), gx(20.5)).lineTo(gx(12), gx(18)).lineTo(gx(14.5), gx(20.5)).stroke(0.12, W);
}

function stormGlyph(p: Pen): void {
  const pts = [14, 2, 5, 14, 11, 14, 9, 22, 18, 10, 12, 10].map(gx);
  p.poly(pts).fill(W);
}

function fireGlyph(p: Pen): void {
  p.moveTo(gx(12), gx(2))
    .bez(gx(13), gx(6), gx(18), gx(8), gx(18), gx(14))
    .bez(gx(18), gx(22), gx(6), gx(22), gx(6), gx(14))
    .bez(gx(6), gx(11), gx(8), gx(9.5), gx(9), gx(7.5))
    .quad(gx(10), gx(10), gx(11.2), gx(10.2))
    .quad(gx(12.5), gx(6), gx(12), gx(2))
    .close()
    .fill(W);
}

/** Any other rune: a four-point star. */
function plainGlyph(p: Pen): void {
  p.poly([0, -0.6, 0.15, -0.15, 0.6, 0, 0.15, 0.15, 0, 0.6, -0.15, 0.15, -0.6, 0, -0.15, -0.15]).fill(W);
}

/** One ray of the item-get burst, from the origin up (white; drawn additive). */
function lightRay(p: Pen): void {
  p.poly([-0.06, 0, 0.06, 0, 0.42, -4.2, -0.42, -4.2]).fill(W);
}

/** Glyph atlas name for a rune id. */
export function glyphName(rune: string): string {
  return rune === 'frost' || rune === 'storm' || rune === 'fire' ? `glyph_${rune}` : 'glyph_plain';
}

function e(name: string, x0: number, y0: number, x1: number, y1: number, draw: (p: Pen) => void): AtlasEntry {
  return { name, x0, y0, x1, y1, draw };
}

export function runeAtlasEntries(): AtlasEntry[] {
  return [
    e('shrine_base', -2.15, -2.05, 2.4, 2.2, shrineBase),
    e('shrine_socket', -1.1, -1.85, 1.1, -0.75, shrineSocket),
    e('rune_tablet', -1.0, -1.3, 1.0, 1.3, runeTablet),
    e('glyph_frost', -0.7, -0.7, 0.7, 0.7, frostGlyph),
    e('glyph_storm', -0.7, -0.7, 0.7, 0.7, stormGlyph),
    e('glyph_fire', -0.7, -0.7, 0.7, 0.7, fireGlyph),
    e('glyph_plain', -0.7, -0.7, 0.7, 0.7, plainGlyph),
    e('light_ray', -0.5, -4.3, 0.5, 0.1, lightRay),
  ];
}
