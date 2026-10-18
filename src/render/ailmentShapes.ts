import type { AtlasEntry } from './atlas';
import { AIL } from './ailmentPalette';
import { INK } from './combatPalette';
import type { Pen } from './pen';

/**
 * Baked ailment shapes: flames, ice, frost crystals, arcs, shards and the status icons with
 * their digits. White parts are tinted per use; the rest carry their own colors. Units are
 * cells, (0, 0) is the anchor.
 */
const W = 0xffffff;

/** Flame tongue with its base at (0, dy), pointing up, scaled by k. */
function flamePath(p: Pen, k: number, dy = 0, lean = 0): Pen {
  const X = (x: number, y: number): number => (x + lean * -y) * k;
  const Y = (y: number): number => y * k + dy;
  return p
    .moveTo(X(0, 0.38), Y(0.38))
    .bez(X(-0.55, 0.38), Y(0.38), X(-0.78, -0.22), Y(-0.22), X(-0.3, -0.72), Y(-0.72))
    .bez(X(-0.12, -0.95), Y(-0.95), X(-0.04, -1.2), Y(-1.2), X(0.06, -1.55), Y(-1.55))
    .bez(X(0.32, -1.12), Y(-1.12), X(0.78, -0.78), Y(-0.78), X(0.62, -0.15), Y(-0.15))
    .bez(X(0.52, 0.25), Y(0.25), X(0.26, 0.38), Y(0.38), X(0, 0.38), Y(0.38))
    .close();
}

/** Licking flame for Ignite: fire-colored, thin dark outline, base at (0, 0). */
function flame(p: Pen): void {
  flamePath(p, 1).fill(AIL.fire).stroke(0.13, INK);
  flamePath(p, 0.66, 0.12, 0.08).fill(AIL.fireInner);
  flamePath(p, 0.34, 0.2, 0.12).fill(AIL.fireCore);
}

/** Faceted ice block, half-extents 2 × 2: translucent body, facets, highlight, cold rim. */
const ICE_PTS = [-1.85, -1.3, -1.05, -2.0, 0.65, -1.95, 1.8, -1.2, 1.95, 1.05, 1.15, 1.95, -0.95, 2.0, -1.95, 1.15];
function iceBlock(p: Pen): void {
  p.poly(ICE_PTS).fill({ color: AIL.ice, alpha: 0.42 });
  // Facets: a lighter top-left plane and darker lower-right planes meeting at an inner point.
  p.poly([-1.85, -1.3, -1.05, -2.0, 0.65, -1.95, 0.2, -0.45, -0.9, -0.2]).fill({ color: W, alpha: 0.22 });
  p.poly([1.8, -1.2, 1.95, 1.05, 1.15, 1.95, 0.55, 0.6, 0.2, -0.45]).fill({ color: AIL.iceDeep, alpha: 0.22 });
  p.poly([-0.95, 2.0, -1.95, 1.15, -0.9, -0.2, -0.3, 0.75]).fill({ color: AIL.iceDeep, alpha: 0.12 });
  // Facet edges.
  for (const [x, y] of [
    [-1.05, -2.0],
    [0.65, -1.95],
    [1.8, -1.2],
    [-1.85, -1.3],
  ] as const)
    p.moveTo(x, y).lineTo(0.2, -0.45).stroke(0.06, W, 0.55);
  p.moveTo(0.2, -0.45).lineTo(0.55, 0.6).lineTo(1.15, 1.95).stroke(0.06, W, 0.4);
  // Glints.
  p.poly([-1.45, -1.05, -0.95, -1.65, -0.75, -1.5, -1.25, -0.85]).fill({ color: W, alpha: 0.85 });
  p.poly([1.45, 0.2, 1.6, -0.35, 1.7, -0.3, 1.58, 0.35]).fill({ color: W, alpha: 0.7 });
  // Rim: dark cold outline, then a bright inner edge.
  p.poly(ICE_PTS).stroke(0.2, AIL.iceRim, 0.9);
  p.poly(ICE_PTS.map((v) => v * 0.93)).stroke(0.08, 0xe8fbff, 0.8);
}

/** Cracks spreading from the center (thaw), white. */
function iceCrack(p: Pen): void {
  const arms: Array<readonly number[]> = [
    [0, 0, -0.7, -0.5, -1.2, -0.45, -1.8, -1.1],
    [0, 0, 0.5, -0.8, 0.45, -1.4, 0.9, -1.9],
    [0, 0, 0.9, 0.2, 1.4, 0.75, 1.9, 0.7],
    [0, 0, -0.4, 0.7, -1.05, 1.0, -1.3, 1.8],
    [-0.7, -0.5, -0.95, 0.05, -1.6, 0.25],
    [0.9, 0.2, 1.3, -0.4],
  ];
  for (const a of arms) {
    p.moveTo(a[0]!, a[1]!);
    for (let i = 2; i < a.length; i += 2) p.lineTo(a[i]!, a[i + 1]!);
    p.stroke(0.2, AIL.iceRim, 0.6);
    p.moveTo(a[0]!, a[1]!);
    for (let i = 2; i < a.length; i += 2) p.lineTo(a[i]!, a[i + 1]!);
    p.stroke(0.09, W);
  }
}

/** Six-armed frost crystal, radius 0.5, ink-backed. */
function crystal(p: Pen, inkW: number, color: number, w: number): void {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    const c = Math.cos(a) * 0.5;
    const s = Math.sin(a) * 0.5;
    p.moveTo(-c, -s).lineTo(c, s).stroke(inkW, INK);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    const c = Math.cos(a) * 0.5;
    const s = Math.sin(a) * 0.5;
    p.moveTo(-c, -s).lineTo(c, s).stroke(w, color);
    // Little branches near each tip.
    for (const k of [-1, 1]) {
      const tx = c * k * 0.62;
      const ty = s * k * 0.62;
      const bx = Math.cos(a + 0.9) * 0.16;
      const by = Math.sin(a + 0.9) * 0.16;
      const cx2 = Math.cos(a - 0.9) * 0.16;
      const cy2 = Math.sin(a - 0.9) * 0.16;
      p.moveTo(tx, ty).lineTo(tx + bx * k, ty + by * k).stroke(w * 0.8, color);
      p.moveTo(tx, ty).lineTo(tx + cx2 * k, ty + cy2 * k).stroke(w * 0.8, color);
    }
  }
}

/** Jagged arc from (-1, 0) to (1, 0): violet halo, yellow core, white heart. */
function zap(p: Pen, pts: readonly number[]): void {
  const path = (): Pen => {
    p.moveTo(pts[0]!, pts[1]!);
    for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i]!, pts[i + 1]!);
    return p;
  };
  path().stroke(0.5, AIL.stormGlow, 0.4);
  path().stroke(0.3, AIL.stormGlow, 0.85);
  path().stroke(0.17, AIL.storm);
  path().stroke(0.06, W);
}

/** Chunky ice shard pointing +x: white body (tinted per use), a shaded facet and a cold rim. */
function shard(p: Pen): void {
  const pts = [-0.55, -0.3, 0.1, -0.36, 0.7, 0, 0.05, 0.34, -0.45, 0.22];
  p.poly(pts).fill(W);
  p.poly([0.1, -0.36, 0.7, 0, 0.05, 0.34, -0.05, 0]).fill({ color: 0x7cc4ea, alpha: 0.75 });
  p.moveTo(-0.35, -0.12).lineTo(0.3, -0.18).stroke(0.07, W);
  p.poly(pts).stroke(0.11, AIL.iceRim);
}

function shockIcon(p: Pen): void {
  const pts = [0.12, -0.5, -0.36, 0.06, -0.04, 0.06, -0.16, 0.5, 0.36, -0.1, 0.04, -0.1, 0.2, -0.5];
  p.poly(pts).stroke(0.24, INK);
  p.poly(pts).fill(AIL.storm);
}

function igniteIcon(p: Pen): void {
  flamePath(p, 0.5, 0.36).stroke(0.24, INK);
  flamePath(p, 0.5, 0.36).fill(AIL.fire);
  flamePath(p, 0.28, 0.4).fill(AIL.fireInner);
}

function freezeIcon(p: Pen): void {
  p.circle(0, 0, 0.5).fill({ color: INK, alpha: 0.85 });
  crystal(p, 0, AIL.frost, 0.11);
}

// Seven-segment digits (white, ink-backed), 0.5 wide and 0.9 tall, centered.
const SEG: Record<string, readonly [number, number, number, number]> = {
  a: [-0.22, -0.42, 0.22, -0.42],
  b: [0.22, -0.42, 0.22, 0],
  c: [0.22, 0, 0.22, 0.42],
  d: [-0.22, 0.42, 0.22, 0.42],
  e: [-0.22, 0, -0.22, 0.42],
  f: [-0.22, -0.42, -0.22, 0],
  g: [-0.22, 0, 0.22, 0],
};
const DIGITS = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];

function segments(p: Pen, segs: string, dx: number): void {
  for (const [w, c] of [
    [0.34, INK],
    [0.15, W],
  ] as const) {
    for (const s of segs) {
      const [x0, y0, x1, y1] = SEG[s]!;
      p.moveTo(x0 + dx, y0).lineTo(x1 + dx, y1).stroke(w, c);
    }
  }
}

function percent(p: Pen): void {
  for (const [w, c] of [
    [0.32, INK],
    [0.14, W],
  ] as const) {
    p.moveTo(0.22, -0.4).lineTo(-0.22, 0.4).stroke(w, c);
    p.circle(-0.16, -0.26, 0.1).stroke(w * 0.8, c);
    p.circle(0.16, 0.26, 0.1).stroke(w * 0.8, c);
  }
}

function e(name: string, x0: number, y0: number, x1: number, y1: number, draw: (p: Pen) => void): AtlasEntry {
  return { name, x0, y0, x1, y1, draw };
}

export function ailmentAtlasEntries(): AtlasEntry[] {
  const out = [
    e('ail_flame', -0.9, -1.7, 0.9, 0.55, flame),
    e('ice_block', -2.1, -2.15, 2.1, 2.15, iceBlock),
    e('ice_crack', -2, -2, 2, 2, iceCrack),
    e('frost_crystal', -0.65, -0.65, 0.65, 0.65, (p) => crystal(p, 0.26, 0xeafcff, 0.12)),
    e('zap_a', -1.2, -0.5, 1.2, 0.5, (p) => zap(p, [-1, 0, -0.55, -0.25, -0.2, 0.2, 0.25, -0.22, 0.6, 0.18, 1, 0])),
    e('zap_b', -1.2, -0.5, 1.2, 0.5, (p) => zap(p, [-1, 0.05, -0.4, 0.28, -0.1, -0.2, 0.45, 0.12, 0.7, -0.24, 1, 0])),
    e('shard', -0.65, -0.45, 0.8, 0.45, shard),
    e('icon_ignite', -0.6, -0.65, 0.6, 0.65, igniteIcon),
    e('icon_freeze', -0.6, -0.6, 0.6, 0.6, freezeIcon),
    e('icon_shock', -0.55, -0.65, 0.55, 0.65, shockIcon),
    e('meter_bg', -1.1, -0.35, 1.1, 0.35, (p) => p.roundRect(-1, -0.25, 2, 0.5, 0.2).fill({ color: INK, alpha: 0.85 })),
    e('meter_fill', 0, -0.2, 1, 0.2, (p) => p.rect(0, -0.15, 1, 0.3).fill(W)),
    e('digit_pct', -0.4, -0.55, 0.4, 0.55, percent),
  ];
  for (let d = 0; d < 10; d++) out.push(e(`digit_${d}`, -0.4, -0.6, 0.4, 0.6, (p) => segments(p, DIGITS[d]!, d === 1 ? -0.16 : 0)));
  return out;
}
