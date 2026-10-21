import type { AtlasEntry } from '../atlas';
import { INK } from '../combatPalette';
import type { Pen } from '../pen';

/**
 * Baked loot drops (DESIGN §8): rune stones with a glyph per rune kind, an item satchel, a Fuse
 * part, a Thread Scrap spool, a currency knot and the light beam of rare and unique drops. Anchor at the drop's
 * resting point; white parts are tinted per drop.
 */
const W = 0xffffff;

/** A carved rune stone: dark slate with a white rim (tinted by the rune's kind). */
function runeStone(p: Pen): void {
  p.ellipse(0, 0.15, 0.95, 0.9).fill(0x2e2838).stroke(0.18, INK);
  p.ellipse(0, 0.1, 0.78, 0.72).stroke(0.12, W);
  p.ellipse(-0.3, -0.3, 0.22, 0.12).fill({ color: W, alpha: 0.25 });
}

function glyph(p: Pen, kind: string): void {
  switch (kind) {
    case 'trigger':
      p.poly([-0.1, -0.5, 0.3, -0.5, 0.05, -0.05, 0.3, -0.05, -0.2, 0.55, 0, 0.1, -0.25, 0.1]).fill(W);
      break;
    case 'form':
      p.circle(0, 0.05, 0.38).stroke(0.14, W);
      p.circle(0, 0.05, 0.12).fill(W);
      break;
    case 'element':
      p.moveTo(0, -0.5)
        .quad(0.45, 0.05, 0.25, 0.35)
        .quad(0, 0.55, -0.25, 0.35)
        .quad(-0.45, 0.05, 0, -0.5)
        .close()
        .fill(W);
      break;
    case 'modifier':
      p.poly([0, -0.45, 0.4, 0.05, 0, 0.55, -0.4, 0.05]).stroke(0.13, W);
      p.circle(0, 0.05, 0.1).fill(W);
      break;
    default:
      // Branch: a fork.
      p.moveTo(0, 0.5).lineTo(0, 0.05).lineTo(-0.32, -0.4).moveTo(0, 0.05).lineTo(0.32, -0.4).stroke(0.14, W);
  }
}

/** A cloth satchel tied with cord (tinted rim marks rarity). */
function satchel(p: Pen): void {
  p.moveTo(-0.8, 0.6)
    .quad(-0.95, -0.2, -0.45, -0.45)
    .lineTo(0.45, -0.45)
    .quad(0.95, -0.2, 0.8, 0.6)
    .quad(0, 0.9, -0.8, 0.6)
    .close();
  p.fill(0x9a6a42).stroke(0.16, INK);
  p.moveTo(-0.45, -0.45)
    .lineTo(-0.25, -0.8)
    .lineTo(0.25, -0.8)
    .lineTo(0.45, -0.45)
    .close()
    .fill(0xb8844f)
    .stroke(0.12, INK);
  p.moveTo(-0.5, -0.42).lineTo(0.5, -0.42).stroke(0.14, 0xe0b450);
  p.ellipse(-0.35, 0.05, 0.18, 0.28).fill({ color: W, alpha: 0.18 });
}

/** The rarity gem on an item's satchel (white, tinted by rarity). */
function gem(p: Pen): void {
  p.poly([0, -0.32, 0.3, 0, 0, 0.32, -0.3, 0]).fill(W).stroke(0.1, INK);
  p.poly([0, -0.32, 0.3, 0, 0, -0.05]).fill({ color: W, alpha: 0.6 });
}

/** A Fuse part: a small brass cog. */
function part(p: Pen): void {
  const pts: number[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 ? 0.62 : 0.8;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  p.poly(pts).fill(0xc8a050).stroke(0.14, INK);
  p.circle(0, 0, 0.3).fill(0x5a4a3a).stroke(0.08, INK);
  p.circle(0, 0, 0.5).stroke(0.08, W);
}

/** Thread Scrap: a spool with loose thread. */
function scrap(p: Pen): void {
  p.roundRect(-0.55, -0.45, 1.1, 0.9, 0.15).fill(0xe8dcc8).stroke(0.12, INK);
  p.rect(-0.55, -0.2, 1.1, 0.4).fill(0xc9b9a6);
  for (const y of [-0.12, 0.05])
    p.moveTo(-0.5, y)
      .lineTo(0.5, y + 0.05)
      .stroke(0.06, 0x8f7f6c);
  p.moveTo(0.5, 0.1).bez(0.9, 0.3, 0.6, 0.7, 0.95, 0.75).stroke(0.08, 0xc9b9a6);
}

/** Crafting currency: a wound knot of thread with a bright core (white parts tinted per currency). */
function currency(p: Pen): void {
  p.circle(0, 0, 0.62).fill(0x3a3040).stroke(0.14, INK);
  p.ellipse(0, 0, 0.5, 0.22).stroke(0.1, W);
  p.ellipse(0, 0, 0.22, 0.5).stroke(0.1, W);
  p.circle(0, 0, 0.16).fill(W);
  p.ellipse(-0.22, -0.26, 0.14, 0.08).fill({ color: W, alpha: 0.4 });
}

/** Light beam of rare and unique drops: a soft column, white (tinted), base at (0, 0). */
function beam(p: Pen): void {
  for (let i = 0; i < 6; i++) {
    const w = 0.5 - i * 0.07;
    p.moveTo(-w, 0)
      .lineTo(-w * 0.4, -1)
      .lineTo(w * 0.4, -1)
      .lineTo(w, 0)
      .close()
      .fill({ color: W, alpha: 0.12 });
  }
}

export function lootAtlasEntries(): AtlasEntry[] {
  const g = (kind: string): AtlasEntry => ({
    name: `glyph_${kind}`,
    x0: -0.6,
    y0: -0.65,
    x1: 0.6,
    y1: 0.7,
    draw: (p) => glyph(p, kind),
  });
  return [
    { name: 'rune_stone', x0: -1.15, y0: -0.95, x1: 1.15, y1: 1.2, draw: runeStone },
    g('trigger'),
    g('form'),
    g('element'),
    g('modifier'),
    g('branch'),
    { name: 'loot_satchel', x0: -1.1, y0: -1.0, x1: 1.1, y1: 1.0, draw: satchel },
    { name: 'loot_gem', x0: -0.45, y0: -0.45, x1: 0.45, y1: 0.45, draw: gem },
    { name: 'loot_part', x0: -0.95, y0: -0.95, x1: 0.95, y1: 0.95, draw: part },
    { name: 'loot_scrap', x0: -0.75, y0: -0.65, x1: 1.1, y1: 0.95, draw: scrap },
    { name: 'loot_currency', x0: -0.8, y0: -0.8, x1: 0.8, y1: 0.8, draw: currency },
    { name: 'loot_beam', x0: -0.6, y0: -1.1, x1: 0.6, y1: 0.1, draw: beam },
  ];
}
