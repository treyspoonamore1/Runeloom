import type { AtlasEntry } from './atlas';
import { INK } from './combatPalette';
import { CREATURE } from './creaturePalette';
import { SHIELD_HALF_ANGLE } from './enemyShapes';
import { PLAYER } from './palette';
import type { Pen } from './pen';

/**
 * Baked shapes for entities on the chemistry grid: Wet / Oiled / Blind status icons, the oil
 * sheen, the charge zap, the shield's scorch marks and the player's falling silhouette. Units
 * are cells, (0, 0) is the anchor.
 */
const W = 0xffffff;

/** Droplet, point up, centered, about 1 cell tall. */
function dropPath(p: Pen, k = 1): Pen {
  return p
    .moveTo(0, -0.55 * k)
    .bez(0.12 * k, -0.3 * k, 0.42 * k, -0.05 * k, 0.42 * k, 0.18 * k)
    .bez(0.42 * k, 0.42 * k, 0.22 * k, 0.55 * k, 0, 0.55 * k)
    .bez(-0.22 * k, 0.55 * k, -0.42 * k, 0.42 * k, -0.42 * k, 0.18 * k)
    .bez(-0.42 * k, -0.05 * k, -0.12 * k, -0.3 * k, 0, -0.55 * k)
    .close();
}

function wetIcon(p: Pen): void {
  dropPath(p).stroke(0.24, INK);
  dropPath(p).fill(CREATURE.iconWet);
  p.moveTo(-0.2, 0.05).quad(-0.2, 0.3, 0.02, 0.36).stroke(0.09, W);
}

function oilIcon(p: Pen): void {
  dropPath(p).stroke(0.24, INK);
  dropPath(p).fill(0x3a2d48);
  // Rainbow sheen band.
  const band = [0xff7ad0, 0xffe066, 0x7affc8, 0x7ab8ff];
  for (let i = 0; i < band.length; i++) p.moveTo(-0.3 + i * 0.05, 0.28 - i * 0.07).quad(0, 0.05 - i * 0.07, 0.3 - i * 0.04, -0.08 - i * 0.06).stroke(0.06, band[i]!);
}

/** A closed eye with lashes on a dark disc. */
function blindIcon(p: Pen): void {
  p.circle(0, 0, 0.55).fill({ color: INK, alpha: 0.85 });
  p.moveTo(-0.38, -0.05).quad(0, 0.3, 0.38, -0.05).stroke(0.11, W);
  for (const x of [-0.22, 0, 0.22]) p.moveTo(x, 0.13).lineTo(x * 1.3, 0.3).stroke(0.07, W);
}

/** Curved sheen band, 1 wide, soft (tinted per frame through the hues). */
function sheen(p: Pen): void {
  for (const [w, a] of [
    [0.42, 0.25],
    [0.26, 0.45],
    [0.12, 0.85],
  ] as const)
    p.moveTo(-0.9, 0.25).quad(-0.1, -0.55, 0.9, -0.1).stroke(w, W, a);
}

/** Charge zap: like the Shock arcs, but cyan halo and a white core. */
function chargeZap(p: Pen): void {
  const pts = [-1, 0, -0.5, 0.28, -0.15, -0.22, 0.3, 0.2, 0.62, -0.18, 1, 0.04];
  const path = (): Pen => {
    p.moveTo(pts[0]!, pts[1]!);
    for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i]!, pts[i + 1]!);
    return p;
  };
  path().stroke(0.46, CREATURE.chargeGlow, 0.45);
  path().stroke(0.22, CREATURE.charge);
  path().stroke(0.08, W);
}

/** Char blotches and ember cracks on the shield band (same anchor as shieldbearer_shield). */
function shieldScorch(p: Pen): void {
  const a = SHIELD_HALF_ANGLE;
  const spots = [
    [-0.75, 2.6, 0.5],
    [-0.35, 2.85, 0.42],
    [0.05, 2.5, 0.38],
    [0.4, 2.8, 0.5],
    [0.8, 2.55, 0.4],
  ] as const;
  for (const [t, r, s] of spots) {
    const ang = t * a;
    p.circle(Math.cos(ang) * r, Math.sin(ang) * r, s).fill({ color: CREATURE.charred, alpha: 0.85 });
  }
  for (const [t0, t1] of [
    [-0.6, -0.2],
    [0.2, 0.65],
  ] as const) {
    p.moveTo(Math.cos(t0 * a) * 2.5, Math.sin(t0 * a) * 2.5)
      .lineTo(Math.cos(((t0 + t1) / 2) * a) * 2.9, Math.sin(((t0 + t1) / 2) * a) * 2.9)
      .lineTo(Math.cos(t1 * a) * 2.6, Math.sin(t1 * a) * 2.6)
      .stroke(0.1, 0xff7a2f);
  }
}

/** The Loomwright as one baked silhouette (for the fall animation). */
function playerFall(p: Pen): void {
  const P = PLAYER;
  p.moveTo(-1.45, 1.1).quad(-1.3, -0.6, 0, -0.9).quad(1.3, -0.6, 1.45, 1.1).quad(0, 1.55, -1.45, 1.1).close();
  p.fill(P.cloak).stroke(0.3, P.ink);
  p.circle(0, -1.05, 1).fill(P.hood).stroke(0.3, P.ink);
  p.ellipse(0, -0.95, 0.56, 0.5).fill(P.hoodInner);
  p.circle(-0.2, -0.92, 0.1).circle(0.2, -0.92, 0.1).fill(P.eye);
}

function e(name: string, x0: number, y0: number, x1: number, y1: number, draw: (p: Pen) => void): AtlasEntry {
  return { name, x0, y0, x1, y1, draw };
}

export function creatureAtlasEntries(): AtlasEntry[] {
  return [
    e('icon_wet', -0.6, -0.7, 0.6, 0.7, wetIcon),
    e('icon_oil', -0.6, -0.7, 0.6, 0.7, oilIcon),
    e('icon_blind', -0.62, -0.62, 0.62, 0.62, blindIcon),
    e('oil_sheen', -1.1, -0.7, 1.1, 0.55, sheen),
    e('zap_charge', -1.2, -0.5, 1.2, 0.5, chargeZap),
    e('shield_scorch', -0.5, -3.4, 4.2, 3.4, shieldScorch),
    e('player_fall', -1.7, -2.25, 1.7, 1.75, playerFall),
  ];
}
