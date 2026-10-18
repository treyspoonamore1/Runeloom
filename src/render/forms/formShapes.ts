import type { AtlasEntry } from '../atlas';
import { INK } from '../combatPalette';
import type { Pen } from '../pen';

/**
 * Baked shapes for the spell forms (Nova ring, Sigil circle, Swath strip) and the trigger
 * glyphs. All white, tinted per element at use. Units are cells, (0, 0) is the anchor.
 */
const W = 0xffffff;
const TAU = Math.PI * 2;

/** Nova ring, radius 4: a bright band with a soft inner falloff (scale = radius / 4). */
function novaRing(p: Pen): void {
  for (let i = 0; i < 6; i++) p.circle(0, 0, 3.7 - i * 0.28).stroke(0.3, W, 0.2 - i * 0.03);
  p.circle(0, 0, 3.85).stroke(0.5, W, 0.35);
  p.circle(0, 0, 3.9).stroke(0.2, W, 1);
}

/** Sigil: two rings, a hexagram and six rune ticks, radius 3.2. */
function sigilCircle(p: Pen): void {
  p.circle(0, 0, 3.1).stroke(0.34, INK, 0.35);
  p.circle(0, 0, 3.1).stroke(0.18, W);
  p.circle(0, 0, 2.45).stroke(0.1, W, 0.85);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // Rune tick between the rings: a short bar with a cross-stroke.
    p.moveTo(c * 2.55, s * 2.55).lineTo(c * 3.0, s * 3.0).stroke(0.12, W);
    const m = 2.78;
    p.moveTo(c * m - s * 0.16, s * m + c * 0.16).lineTo(c * m + s * 0.16, s * m - c * 0.16).stroke(0.08, W);
  }
  for (const off of [0, Math.PI / 3]) {
    const pts: number[] = [];
    for (let i = 0; i < 3; i++) {
      const a = off + (i / 3) * TAU - Math.PI / 2;
      pts.push(Math.cos(a) * 2.35, Math.sin(a) * 2.35);
    }
    p.poly(pts).stroke(0.1, W, 0.9);
  }
}

/** Sigil core rune, radius 1: a diamond eye. */
function sigilCore(p: Pen): void {
  p.poly([0, -1, 0.62, 0, 0, 1, -0.62, 0]).stroke(0.14, W);
  p.circle(0, 0, 0.28).fill(W);
}

/** Swath strip: 0..1 along +x, 1 wide, soft edges (stacked rounded rects). */
function swathStrip(p: Pen): void {
  for (let i = 0; i < 5; i++) {
    const h = 1 - i * 0.18;
    p.roundRect(0.02 * i, -h / 2, 1 - 0.04 * i, h, h / 2).fill({ color: W, alpha: 0.22 });
  }
}

/** Trigger glyphs (DESIGN §5: automatic triggers flash their rune where they fire). */
function glyphBase(p: Pen): void {
  p.circle(0, 0, 0.95).fill({ color: INK, alpha: 0.55 });
  p.circle(0, 0, 0.95).stroke(0.1, W);
}

const GLYPHS: Record<string, (p: Pen) => void> = {
  // Pulse: concentric arcs.
  pulse: (p) => {
    p.circle(0, 0, 0.18).fill(W);
    p.arc(0, 0, 0.42, -2.4, -0.7).stroke(0.1, W);
    p.arc(0, 0, 0.66, -2.5, -0.6).stroke(0.1, W);
    p.arc(0, 0, 0.42, 0.7, 2.4).stroke(0.1, W);
    p.arc(0, 0, 0.66, 0.6, 2.5).stroke(0.1, W);
  },
  // On Dodge: a double chevron.
  on_dodge: (p) => {
    p.moveTo(-0.5, -0.4).lineTo(-0.1, 0).lineTo(-0.5, 0.4).stroke(0.13, W);
    p.moveTo(0, -0.4).lineTo(0.4, 0).lineTo(0, 0.4).stroke(0.13, W);
  },
  // Harvest: a sickle.
  harvest: (p) => {
    p.arc(0.05, 0, 0.55, -2.6, 1.2).stroke(0.13, W);
    p.moveTo(-0.15, 0.2).lineTo(-0.5, 0.6).stroke(0.13, W);
  },
  // On Crit: a four-point star.
  on_crit: (p) => {
    p.poly([0, -0.7, 0.16, -0.16, 0.7, 0, 0.16, 0.16, 0, 0.7, -0.16, 0.16, -0.7, 0, -0.16, -0.16]).fill(W);
  },
  // On Hurt: a drop.
  on_hurt: (p) => {
    p.moveTo(0, -0.62).quad(0.48, 0.05, 0.3, 0.32).quad(0, 0.62, -0.3, 0.32).quad(-0.48, 0.05, 0, -0.62).close().fill(W);
  },
  // Channel: a wave.
  channel: (p) => {
    p.moveTo(-0.6, 0).bez(-0.3, -0.5, -0.1, -0.5, 0, 0).bez(0.1, 0.5, 0.3, 0.5, 0.6, 0).stroke(0.12, W);
  },
  // Shatter: a cracked diamond.
  shatter: (p) => {
    p.poly([0, -0.6, 0.45, 0, 0, 0.6, -0.45, 0]).stroke(0.11, W);
    p.moveTo(-0.15, -0.35).lineTo(0.1, -0.05).lineTo(-0.1, 0.15).lineTo(0.12, 0.4).stroke(0.08, W);
  },
  // Cast (only for completeness).
  cast: (p) => p.circle(0, 0, 0.3).fill(W),
};

function e(name: string, x0: number, y0: number, x1: number, y1: number, draw: (p: Pen) => void): AtlasEntry {
  return { name, x0, y0, x1, y1, draw };
}

export function formAtlasEntries(): AtlasEntry[] {
  const out = [
    e('nova_ring', -4.2, -4.2, 4.2, 4.2, novaRing),
    e('sigil_circle', -3.35, -3.35, 3.35, 3.35, sigilCircle),
    e('sigil_core', -1.1, -1.1, 1.1, 1.1, sigilCore),
    e('swath_strip', 0, -0.55, 1.05, 0.55, swathStrip),
  ];
  for (const [id, draw] of Object.entries(GLYPHS))
    out.push(
      e(`glyph_${id}`, -1.05, -1.05, 1.05, 1.05, (p) => {
        glyphBase(p);
        draw(p);
      }),
    );
  return out;
}

/** Atlas name of a trigger's glyph. */
export function glyphName(trigger: string): string {
  return GLYPHS[trigger] ? `glyph_${trigger}` : 'glyph_cast';
}
