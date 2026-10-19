import type { AtlasEntry } from '../atlas';
import { ENEMY, INK } from '../combatPalette';
import { blob } from '../enemyShapes';
import type { Pen } from '../pen';
import { BESTIARY as B } from './bestiaryPalette';

/**
 * Baked parts of the Brood Kiln, the Tar Matriarch and the Cinder Warden (CONTENT §5,
 * DESIGN §10.3). Conventions as smallBeasts.ts.
 */
type K = (color: number) => number;
const N: K = (c) => c;
const W: K = () => 0xffffff;
const O = ENEMY.outline;

// ---- Brood Kiln: a squat brick furnace that hatches Kiln Mites ----------------------------

function kilnDome(p: Pen): Pen {
  return p.moveTo(-2.1, 0.7).bez(-2.3, -1.8, -1.2, -3.1, 0, -3.15).bez(1.2, -3.1, 2.3, -1.8, 2.1, 0.7).close();
}

function kilnBody(p: Pen, k: K): void {
  const c = B.brood_kiln;
  // Stone plinth.
  p.roundRect(-2.45, 0.35, 4.9, 1.55, 0.4).fill(k(c.base)).stroke(O, k(INK));
  if (k === N) p.roundRect(-2.2, 1.3, 4.4, 0.45, 0.2).fill(c.baseShade);
  // Chimney behind the dome top.
  p.roundRect(-0.5, -4.15, 1.0, 1.4, 0.2).fill(k(c.brickShade)).stroke(O * 0.8, k(INK));
  if (k === N) p.ellipse(0, -4.1, 0.38, 0.16).fill(c.mouth);
  kilnDome(p).fill(k(c.brick));
  if (k === N) {
    p.moveTo(0.4, 0.7).bez(1.6, -0.6, 1.4, -2.4, 0.3, -3.1).bez(1.4, -2.9, 2.3, -1.6, 2.1, 0.7).close();
    p.fill(c.brickShade);
    // Brick courses: curved mortar rows plus staggered joints.
    for (const [y, half] of [
      [-0.2, 2.08],
      [-1.15, 1.95],
      [-2.05, 1.55],
      [-2.7, 0.95],
    ] as const) {
      p.moveTo(-half, y).quad(0, y + 0.35, half, y).stroke(0.1, c.mortar);
    }
    for (const [x, y] of [
      [-1.5, 0.25],
      [-0.4, 0.3],
      [0.8, 0.3],
      [1.7, 0.2],
      [-1.0, -0.7],
      [0.2, -0.65],
      [1.3, -0.75],
      [-0.6, -1.65],
      [0.6, -1.65],
      [0, -2.4],
    ] as const)
      p.moveTo(x, y - 0.42).lineTo(x, y + 0.02).stroke(0.08, c.mortar);
    p.moveTo(-1.6, -1.6).quad(-1.2, -2.6, -0.4, -2.85).stroke(0.2, c.brickLight);
  }
  kilnDome(p).stroke(O * 1.05, k(INK));
  // Arched mouth (the fire sprite sits inside it).
  p.moveTo(-1.05, 0.75).lineTo(-1.05, -0.35).arc(0, -0.35, 1.05, Math.PI, 0).lineTo(1.05, 0.75).close();
  p.fill(k(c.mouth)).stroke(O * 0.8, k(INK));
  if (k === N) {
    p.moveTo(-1.25, 0.78).lineTo(-1.25, -0.35).arc(0, -0.35, 1.25, Math.PI, 0).lineTo(1.25, 0.78);
    p.stroke(0.16, c.brickLight);
  }
}

/** Glow inside the mouth (anchor at the kiln's anchor); alpha follows the spawn cycle. */
function kilnFire(p: Pen): void {
  const c = B.brood_kiln;
  p.moveTo(-0.85, 0.7).lineTo(-0.85, -0.35).arc(0, -0.35, 0.85, Math.PI, 0).lineTo(0.85, 0.7).close().fill(c.fire);
  p.ellipse(0, 0.25, 0.65, 0.55).fill(c.fireHot);
  for (const [x, h] of [
    [-0.45, 0.55],
    [0.05, 0.85],
    [0.45, 0.5],
  ] as const) {
    p.moveTo(x - 0.2, 0.5).quad(x, 0.5 - h * 1.3, x + 0.2, 0.5).close().fill(0xfff8e0);
  }
}

/** Frozen: frost caps on the dome, icicles on the arch and plinth (anchor as the body). */
function kilnFrost(p: Pen): void {
  const c = B.brood_kiln;
  p.moveTo(-1.7, -1.6).bez(-1.3, -2.9, 1.3, -2.9, 1.7, -1.6).quad(1.0, -1.9, 0.4, -1.5).quad(-0.3, -2.0, -1.0, -1.55);
  p.quad(-1.4, -1.85, -1.7, -1.6).close().fill(c.frost).stroke(0.12, c.frostShade);
  p.ellipse(-2.0, 0.3, 0.45, 0.3).ellipse(1.9, -0.2, 0.35, 0.45).fill({ color: c.frost, alpha: 0.85 });
  for (const [x, y, h] of [
    [-0.7, -1.15, 0.55],
    [-0.25, -1.38, 0.75],
    [0.3, -1.36, 0.6],
    [0.75, -1.1, 0.45],
    [-1.8, 0.5, 0.5],
    [1.6, 0.5, 0.6],
    [0.2, 1.85, 0.45],
  ] as const) {
    p.poly([x - 0.13, y, x, y + h, x + 0.13, y]).fill(c.frost).stroke(0.07, c.frostShade);
  }
  p.roundRect(-2.4, 0.35, 4.8, 0.32, 0.15).fill({ color: c.frost, alpha: 0.9 });
}

// ---- Tar Matriarch: the Tar Hulk elite, crowned and swollen --------------------------------

const MAT_RADII = [1, 0.95, 1.04, 0.97, 1.05, 0.94, 1.02, 1.05, 0.95, 1.03, 0.97, 1.04, 0.96, 1.02];

function matriarchBody(p: Pen, k: K): void {
  const c = B.tar;
  // Crown of hardened tar spikes behind the head.
  for (const [x, h, lean] of [
    [-2.3, 1.5, -0.5],
    [-1.2, 2.1, -0.2],
    [0, 2.5, 0],
    [1.2, 2.1, 0.2],
    [2.3, 1.5, 0.5],
  ] as const) {
    p.poly([x - 0.5, -4.4, x + lean, -4.6 - h, x + 0.5, -4.4]).fill(k(c.shade)).stroke(O * 0.8, k(INK));
    if (k === N) p.circle(x + lean * 0.6, -4.7 - h * 0.55, 0.14).fill(c.eye);
  }
  blob(p, 0, -1.5, 4.25, 4.4, MAT_RADII).fill(k(c.body));
  if (k === N) {
    p.moveTo(1.0, 2.8).quad(4.1, 2.0, 4.25, -1.5).quad(3.9, -4.0, 2.2, -5.0).quad(3.2, -1.2, 1.0, 2.8).close();
    p.fill(c.shade);
    p.moveTo(-3.0, -3.1).quad(-2.2, -5.0, -0.4, -5.6).stroke(0.4, c.sheen, 0.5);
    p.moveTo(-3.5, -1.0).quad(-3.6, 0.5, -3.0, 1.6).stroke(0.25, c.sheen, 0.4);
    for (const [x, y, r] of [
      [-2.2, 1.0, 0.4],
      [2.4, -2.4, 0.34],
      [1.0, 1.9, 0.3],
      [-1.0, -4.3, 0.26],
    ] as const)
      p.circle(x, y, r).fill(c.stone).stroke(0.1, INK);
    // Brow and three amber eyes.
    p.moveTo(-2.1, -3.85).quad(0, -3.1, 2.1, -3.85).stroke(0.5, c.light);
    for (const [x, y, r] of [
      [-1.05, -3.25, 0.3],
      [0, -3.55, 0.4],
      [1.05, -3.25, 0.3],
    ] as const) {
      p.circle(x, y, r * 1.9).fill({ color: c.eye, alpha: 0.16 });
      p.ellipse(x, y, r, r * 0.72).fill(c.eye);
    }
    for (const [x, len] of [
      [-2.8, 0.9],
      [-1.4, 1.3],
      [0.1, 0.8],
      [1.5, 1.2],
      [2.7, 0.7],
    ] as const)
      p.moveTo(x - 0.3, 2.6).quad(x, 2.7 + len, x + 0.3, 2.6).close().fill(c.drip);
  }
  blob(p, 0, -1.5, 4.25, 4.4, MAT_RADII).stroke(O * 1.25, k(INK));
}

/** Her swollen brood sac (anchor at its center), tinted and pulsed while she summons. */
function matriarchSac(p: Pen): void {
  const c = B.tar;
  p.ellipse(0, 0, 1.55, 1.25).fill(0x5a3a2e).stroke(O, INK);
  p.ellipse(0, 0, 1.2, 0.95).fill(c.crack);
  p.ellipse(-0.2, -0.15, 0.75, 0.55).fill(c.crackHot);
  for (const [x, y] of [
    [-0.5, 0.2],
    [0.45, -0.25],
    [0.3, 0.45],
  ] as const)
    p.circle(x, y, 0.2).fill(0x5a3a2e);
}

function matriarchFist(p: Pen): void {
  const c = B.tar;
  blob(p, 0, 0, 1.45, 1.3, [1, 0.92, 1.05, 0.95, 1.03, 0.9, 1.02]).fill(c.body).stroke(O * 1.1, INK);
  p.ellipse(-0.45, -0.55, 0.55, 0.22).fill({ color: c.sheen, alpha: 0.5 });
  p.circle(0.55, 0.3, 0.28).fill(c.stone).stroke(0.08, INK);
}

// ---- Cinder Warden: an iron brazier-knight -------------------------------------------------

function torsoPath(p: Pen): Pen {
  return p.moveTo(-3.0, -3.1).quad(-3.7, 0, -2.5, 2.5).quad(0, 3.5, 2.5, 2.5).quad(3.7, 0, 3.0, -3.1).quad(0, -3.9, -3.0, -3.1).close();
}

function helmPath(p: Pen): Pen {
  // A brazier bowl for a head, wider at its rim.
  return p.moveTo(-1.9, -5.55).quad(-1.9, -3.4, 0, -3.3).quad(1.9, -3.4, 1.9, -5.55).quad(0, -5.15, -1.9, -5.55).close();
}

function wardenBody(p: Pen, k: K): void {
  const c = B.cinder_warden;
  torsoPath(p).fill(k(c.iron));
  if (k === N) {
    p.moveTo(0.6, 3.2).quad(2.2, 2.9, 2.5, 2.5).quad(3.7, 0, 3.0, -3.1).quad(2.6, 0.2, 0.6, 3.2).close().fill(c.ironShade);
    // Chest plates and the belt.
    p.moveTo(0, -3.4).lineTo(0, 1.5).stroke(0.24, c.ironLight);
    p.moveTo(-2.6, -0.4).quad(0, 0.5, 2.6, -0.4).stroke(0.16, c.ironShade);
    p.moveTo(-2.9, 1.4).quad(0, 2.3, 2.9, 1.4).stroke(0.55, c.ironShade, 1, 'butt');
    p.roundRect(-0.55, 1.55, 1.1, 0.75, 0.15).fill(c.rim).stroke(0.12, INK);
    for (const [x, y] of [
      [-2.2, -2.2],
      [2.2, -2.2],
      [-1.6, 0.7],
      [1.6, 0.7],
    ] as const)
      p.circle(x, y, 0.16).fill(c.rim);
  }
  torsoPath(p).stroke(O * 1.3, k(INK));
  // Pauldrons.
  for (const s of [-1, 1]) {
    p.circle(s * 3.0, -2.75, 1.5).fill(k(c.ironLight)).stroke(O * 1.2, k(INK));
    if (k === N) {
      p.arc(s * 3.0, -2.75, 1.15, s > 0 ? -0.4 : Math.PI + 0.4, s > 0 ? 1.6 : Math.PI - 1.6, s < 0).stroke(0.22, c.rim);
      p.poly([s * 3.1, -4.1, s * 3.55, -5.0, s * 3.75, -3.95]).fill(c.horn).stroke(0.12, INK);
    }
  }
  // Brazier helm with horns.
  for (const s of [-1, 1]) {
    p.moveTo(s * 1.6, -5.0).quad(s * 2.9, -5.6, s * 2.6, -7.0).quad(s * 2.4, -5.9, s * 1.4, -5.6).close();
    p.fill(k(c.horn)).stroke(O * 0.8, k(INK));
  }
  helmPath(p).fill(k(c.ironLight));
  if (k === N) {
    p.moveTo(-1.9, -5.55).quad(0, -5.15, 1.9, -5.55).quad(0, -4.8, -1.9, -5.55).close().fill(0x2a1c1f);
    p.moveTo(0.4, -3.35).quad(1.9, -3.4, 1.9, -5.4).quad(1.3, -3.9, 0.4, -3.35).close().fill(c.iron);
    p.roundRect(-1.15, -4.55, 2.3, 0.42, 0.18).fill(0x1a1014);
  }
  helmPath(p).stroke(O * 1.1, k(INK));
}

/** Molten seams between the plates (white; tinted per state), anchor as the body. */
function wardenSeams(p: Pen): void {
  const lines = [
    [-2.4, -2.6, -1.6, -1.6, -2.0, -0.6],
    [2.4, -2.6, 1.6, -1.6, 2.0, -0.6],
    [-2.3, 0.6, -1.2, 1.1, -0.4, 0.8],
    [2.3, 0.6, 1.2, 1.1, 0.4, 0.8],
    [-1.0, -2.0, -0.4, -1.3],
    [1.0, -2.0, 0.4, -1.3],
  ];
  for (const [w, a] of [
    [0.55, 0.35],
    [0.2, 1],
  ] as const) {
    for (const l of lines) {
      p.moveTo(l[0]!, l[1]!);
      for (let i = 2; i < l.length; i += 2) p.lineTo(l[i]!, l[i + 1]!);
      p.stroke(w, 0xffffff, a);
    }
  }
  // Eye slit and the core in the chest.
  p.roundRect(-0.95, -4.48, 1.9, 0.26, 0.12).fill(0xffffff);
  p.circle(0, -0.85, 0.85).fill({ color: 0xffffff, alpha: 0.35 });
  p.circle(0, -0.85, 0.5).fill(0xffffff);
}

function wardenFist(p: Pen, k: K = N): void {
  const c = B.cinder_warden;
  p.roundRect(-1.15, -1.0, 2.3, 2.0, 0.6).fill(k(c.ironLight)).stroke(O * 1.1, k(INK));
  if (k === N) {
    for (const x of [-0.6, 0, 0.6]) p.roundRect(x - 0.24, -1.05, 0.48, 0.55, 0.15).fill(c.rim).stroke(0.08, INK);
    p.moveTo(-0.9, 0.55).lineTo(0.9, 0.55).stroke(0.14, c.ironShade);
  }
}

function wardenBoot(p: Pen): void {
  const c = B.cinder_warden;
  p.ellipse(0, 0, 1.15, 0.72).fill(c.ironShade).stroke(O, INK);
  p.ellipse(-0.2, -0.2, 0.6, 0.25).fill(c.iron);
}

function e(name: string, x0: number, y0: number, x1: number, y1: number, draw: (p: Pen) => void): AtlasEntry {
  return { name, x0, y0, x1, y1, draw };
}

export function bigBeastEntries(): AtlasEntry[] {
  return [
    e('brood_kiln_body', -2.8, -4.5, 2.8, 2.2, (p) => kilnBody(p, N)),
    e('brood_kiln_flash', -2.8, -4.5, 2.8, 2.2, (p) => kilnBody(p, W)),
    e('brood_kiln_fire', -1.0, -1.4, 1.0, 0.85, kilnFire),
    e('brood_kiln_frost', -2.6, -3.0, 2.6, 2.4, kilnFrost),
    e('tar_matriarch_body', -4.9, -7.6, 4.9, 4.2, (p) => matriarchBody(p, N)),
    e('tar_matriarch_flash', -4.9, -7.6, 4.9, 4.2, (p) => matriarchBody(p, W)),
    e('tar_matriarch_sac', -1.8, -1.5, 1.8, 1.5, matriarchSac),
    e('tar_matriarch_fist', -1.8, -1.6, 1.8, 1.6, matriarchFist),
    e('cinder_warden_body', -4.8, -7.4, 4.8, 3.9, (p) => wardenBody(p, N)),
    e('cinder_warden_flash', -4.8, -7.4, 4.8, 3.9, (p) => wardenBody(p, W)),
    e('cinder_warden_seams', -2.9, -4.8, 2.9, 1.6, wardenSeams),
    e('cinder_warden_fist', -1.4, -1.3, 1.4, 1.3, (p) => wardenFist(p)),
    e('cinder_warden_boot', -1.4, -1.0, 1.4, 1.0, wardenBoot),
  ];
}
