import type { AtlasEntry } from '../atlas';
import { ENEMY, INK } from '../combatPalette';
import { blob } from '../enemyShapes';
import type { Pen } from '../pen';
import { BESTIARY as B } from './bestiaryPalette';

/**
 * Baked parts of the smaller M4 enemies (CONTENT §5): Bog Lurker, Tar Hulk, Frost Wisp,
 * Stormcaller and Kiln Mite. Same conventions as enemyShapes.ts: cells, (0, 0) is the collision
 * center unless noted, +y south, thick ink outlines; `<kind>_flash` is the white silhouette.
 */
type K = (color: number) => number;
const N: K = (c) => c;
const W: K = () => 0xffffff;
const O = ENEMY.outline;

// ---- Bog Lurker: a flat swamp ambusher, mostly eyes when submerged ------------------------

const LURK_RADII = [1, 0.95, 0.9, 0.96, 1.04, 0.97, 0.92, 0.97, 1.02, 1.05];

function lurkerBody(p: Pen, k: K): void {
  const c = B.bog_lurker;
  // Front claws under the body.
  for (const s of [-1, 1])
    p.ellipse(s * 1.35, 1.0, 0.5, 0.34)
      .fill(k(c.skinShade))
      .stroke(O * 0.7, k(INK));
  blob(p, 0, -0.1, 2.05, 1.3, LURK_RADII).fill(k(c.skin));
  if (k === N) {
    // Belly band, darker flank, moss frills down the back.
    p.moveTo(-1.6, 0.55).quad(0, 1.45, 1.6, 0.55).quad(0, 0.95, -1.6, 0.55).close().fill(c.belly);
    p.moveTo(0.4, 1.1).quad(1.8, 0.8, 2.0, -0.1).quad(1.6, 0.5, 0.4, 1.1).close().fill(c.skinShade);
    for (const [x, y, r] of [
      [-0.9, -0.55, 0.22],
      [0.15, -0.75, 0.26],
      [1.1, -0.45, 0.2],
      [-0.3, 0.05, 0.16],
    ] as const)
      p.circle(x, y, r).fill(c.moss);
    p.ellipse(-1.1, -0.65, 0.4, 0.16).fill(c.skinLight);
    // A wide mouth line with two teeth.
    p.moveTo(-1.2, 0.35).quad(0, 0.75, 1.2, 0.35).stroke(0.14, INK);
    for (const s of [-1, 1]) p.poly([s * 0.55, 0.52, s * 0.42, 0.78, s * 0.7, 0.5]).fill(c.tooth);
  }
  blob(p, 0, -0.1, 2.05, 1.3, LURK_RADII).stroke(O, k(INK));
  // Eye domes on top of the head.
  for (const s of [-1, 1]) {
    p.circle(s * 0.68, -1.15, 0.52)
      .fill(k(c.skin))
      .stroke(O * 0.8, k(INK));
    if (k === N) {
      p.ellipse(s * 0.68, -1.22, 0.32, 0.3).fill(c.eye);
      p.ellipse(s * 0.68 + 0.04, -1.2, 0.09, 0.22).fill(c.pupil);
    }
  }
}

/** Submerged: two eye domes and a brow just above the waterline, anchor between the eyes. */
function lurkerEyes(p: Pen): void {
  const c = B.bog_lurker;
  p.ellipse(0, 0.25, 1.35, 0.42).fill({ color: c.skinShade, alpha: 0.85 });
  for (const s of [-1, 1]) {
    p.arc(s * 0.68, 0.2, 0.5, Math.PI, 0)
      .close()
      .fill(c.skin)
      .stroke(O * 0.8, INK);
    p.ellipse(s * 0.68, 0.02, 0.3, 0.24).fill(c.eye);
    p.ellipse(s * 0.7, 0.04, 0.08, 0.2).fill(c.pupil);
  }
  // Waterline.
  p.moveTo(-1.45, 0.32).quad(0, 0.5, 1.45, 0.32).stroke(0.12, c.ripple, 0.9);
}

/** The lunge: a gaping jaw over the lower face, anchor at its center. */
function lurkerJaw(p: Pen): void {
  const c = B.bog_lurker;
  p.ellipse(0, 0, 1.3, 0.62)
    .fill(c.mouth)
    .stroke(O * 0.8, INK);
  p.ellipse(0, 0.12, 0.8, 0.3).fill(0x3a1820);
  for (let i = -3; i <= 3; i++) {
    const x = i * 0.32;
    p.poly([x - 0.12, -0.46, x, -0.12, x + 0.12, -0.46]).fill(c.tooth);
    if (Math.abs(i) < 3) p.poly([x - 0.1, 0.5, x + 0.06, 0.2, x + 0.16, 0.48]).fill(c.tooth);
  }
}

// ---- Tar Hulk: a slow mound of dripping tar ------------------------------------------------

const HULK_RADII = [1, 0.94, 1.03, 0.97, 1.06, 0.95, 1.0, 1.04, 0.96, 1.02, 0.98, 1.05];

function hulkBody(p: Pen, k: K): void {
  const c = B.tar;
  blob(p, 0, -0.9, 2.75, 3.0, HULK_RADII).fill(k(c.body));
  if (k === N) {
    p.moveTo(0.6, 2.0).quad(2.6, 1.4, 2.7, -0.9).quad(2.4, -2.6, 1.3, -3.4).quad(2.0, -0.6, 0.6, 2.0).close();
    p.fill(c.shade);
    // Sheen arcs and stuck stones.
    p.moveTo(-1.9, -2.0).quad(-1.4, -3.2, -0.2, -3.6).stroke(0.28, c.sheen, 0.55);
    p.moveTo(-2.2, -0.6).quad(-2.3, 0.3, -1.9, 1.0).stroke(0.18, c.sheen, 0.4);
    for (const [x, y, r] of [
      [-1.2, 0.6, 0.3],
      [1.4, -1.6, 0.24],
      [0.5, 1.1, 0.2],
    ] as const)
      p.circle(x, y, r).fill(c.stone).stroke(0.08, INK);
    // Heavy brow and two small amber eyes deep in the tar.
    p.moveTo(-1.4, -2.55).quad(0, -2.1, 1.4, -2.55).stroke(0.34, c.light);
    for (const s of [-1, 1]) {
      p.ellipse(s * 0.62, -2.12, 0.26, 0.19).fill(c.eye);
      p.circle(s * 0.62, -2.12, 0.42).fill({ color: c.eye, alpha: 0.18 });
    }
    // Drips hanging from the bottom edge.
    for (const [x, len] of [
      [-1.7, 0.6],
      [-0.6, 0.9],
      [0.7, 0.55],
      [1.6, 0.75],
    ] as const) {
      p.moveTo(x - 0.22, 1.7)
        .quad(x, 1.8 + len, x + 0.22, 1.7)
        .close()
        .fill(c.drip);
    }
  }
  blob(p, 0, -0.9, 2.75, 3.0, HULK_RADII).stroke(O * 1.1, k(INK));
}

function hulkFist(p: Pen, k: K = N): void {
  const c = B.tar;
  blob(p, 0, 0, 0.95, 0.85, [1, 0.92, 1.05, 0.95, 1.03, 0.9]).fill(k(c.body)).stroke(O, k(INK));
  if (k === N) {
    p.ellipse(-0.3, -0.35, 0.35, 0.16).fill({ color: c.sheen, alpha: 0.5 });
    p.circle(0.35, 0.2, 0.2).fill(c.stone).stroke(0.06, INK);
  }
}

/** Fuse lit: glowing fissures across the body (same anchor as tar_hulk_body), tinted per frame. */
function hulkCracks(p: Pen): void {
  const lines = [
    [-1.6, -1.8, -0.9, -1.2, -1.2, -0.3, -0.4, 0.4],
    [0.3, -3.0, 0.6, -2.0, 0.1, -1.1, 0.8, -0.2, 0.5, 0.9],
    [1.9, -1.2, 1.2, -0.6, 1.6, 0.5],
    [-2.0, 0.4, -1.3, 1.0, -0.6, 1.3],
  ];
  for (const [w, col, a] of [
    [0.5, B.tar.crack, 0.45],
    [0.18, B.tar.crackHot, 1],
  ] as const) {
    for (const l of lines) {
      p.moveTo(l[0]!, l[1]!);
      for (let i = 2; i < l.length; i += 2) p.lineTo(l[i]!, l[i + 1]!);
      p.stroke(w, col, a);
    }
  }
}

function tarDrip(p: Pen): void {
  p.moveTo(0, -0.45)
    .quad(0.32, 0.05, 0, 0.32)
    .quad(-0.32, 0.05, 0, -0.45)
    .close()
    .fill(B.tar.drip)
    .stroke(0.08, INK);
}

// ---- Frost Wisp: a floating cold spirit --------------------------------------------------

function wispPath(p: Pen): Pen {
  return p
    .moveTo(0.15, -2.55)
    .bez(0.9, -1.8, 1.3, -0.9, 1.15, -0.05)
    .quad(1.0, 0.85, 0, 0.95)
    .quad(-1.0, 0.85, -1.15, -0.05)
    .bez(-1.25, -1.0, -0.7, -1.6, -0.25, -1.95)
    .quad(-0.05, -2.3, 0.15, -2.55)
    .close();
}

function crystal(p: Pen, x: number, y: number, h: number, lean: number, k: K): void {
  p.poly([x, y + 0.2, x + lean - 0.18, y - h * 0.55, x + lean, y - h, x + lean + 0.18, y - h * 0.55]);
  p.fill(k(B.frost_wisp.crystal)).stroke(0.1, k(INK));
}

function wispBody(p: Pen, k: K): void {
  const c = B.frost_wisp;
  wispPath(p).fill(k(c.body));
  if (k === N) {
    p.moveTo(0.2, 0.92).quad(1.0, 0.8, 1.15, -0.05).bez(1.3, -0.9, 0.9, -1.8, 0.15, -2.55);
    p.quad(0.8, -1.0, 0.2, 0.92).close().fill(c.shade);
    p.moveTo(-0.75, -0.9).quad(-0.9, -0.2, -0.6, 0.4).stroke(0.16, 0xffffff, 0.8);
    // Dark face hollow.
    p.ellipse(0, -0.25, 0.7, 0.55).fill(c.core);
  }
  wispPath(p).stroke(O, k(INK));
  crystal(p, -0.55, -1.55, 0.95, -0.25, k);
  crystal(p, 0.55, -1.45, 0.85, 0.3, k);
}

function wispEyes(p: Pen): void {
  const c = B.frost_wisp;
  for (const s of [-1, 1]) p.poly([s * 0.42, -0.06, s * 0.12, -0.14, s * 0.14, 0.08]).fill(c.eye);
}

/** Two trailing tendrils under the body, anchor at the body's bottom, hanging +y. */
function wispTail(p: Pen): void {
  const c = B.frost_wisp;
  for (const [s, len] of [
    [-1, 1.25],
    [1, 1.0],
  ] as const) {
    p.moveTo(s * 0.55, -0.1)
      .quad(s * 0.85, len * 0.5, s * 0.3, len)
      .quad(s * 0.25, len * 0.45, s * 0.05, -0.1)
      .close();
    p.fill({ color: c.shade, alpha: 0.85 }).stroke(0.12, INK, 0.7);
  }
}

// ---- Stormcaller: a robed caster with a crackling staff -----------------------------------

function robePath(p: Pen): Pen {
  return p
    .moveTo(-0.7, -0.95)
    .bez(-1.05, -0.3, -1.35, 0.6, -1.25, 1.1)
    .quad(0, 1.55, 1.25, 1.1)
    .bez(1.35, 0.6, 1.05, -0.3, 0.7, -0.95)
    .quad(0, -1.25, -0.7, -0.95)
    .close();
}

function callerBody(p: Pen, k: K): void {
  const c = B.stormcaller;
  robePath(p).fill(k(c.robe));
  if (k === N) {
    p.moveTo(0.1, 1.45).quad(0.9, 1.35, 1.25, 1.1).bez(1.35, 0.6, 1.05, -0.3, 0.7, -0.95);
    p.quad(1.0, 0.3, 0.1, 1.45).close().fill(c.robeShade);
    p.moveTo(-1.15, 1.02).quad(0, 1.42, 1.15, 1.02).stroke(0.22, c.trim);
    p.moveTo(0, -0.9).lineTo(0, 1.4).stroke(0.16, c.trim);
    // A zigzag sigil on the chest, brass.
    p.moveTo(-0.3, -0.25).lineTo(0.1, -0.05).lineTo(-0.15, 0.15).lineTo(0.3, 0.4).stroke(0.12, c.trim);
  }
  robePath(p).stroke(O, k(INK));
  // Pointed hood with a high collar.
  p.moveTo(-0.6, -1.7)
    .quad(0.1, -3.0, 0.65, -1.65)
    .close()
    .fill(k(c.hood))
    .stroke(O * 0.8, k(INK));
  p.circle(0, -1.2, 0.86).fill(k(c.hood)).stroke(O, k(INK));
}

function callerFace(p: Pen): void {
  const c = B.stormcaller;
  p.ellipse(0, 0, 0.52, 0.42).fill(c.hoodInner);
  for (const s of [-1, 1]) p.ellipse(s * 0.19, 0.02, 0.1, 0.06).fill(c.eye);
}

/** Staff with its grip at (0, 0), head up (-y): a forked brass head around a spark orb. */
function callerStaff(p: Pen): void {
  const c = B.stormcaller;
  p.moveTo(0, 1.1)
    .lineTo(0, -2.4)
    .stroke(0.24 + O, INK);
  p.moveTo(0, 1.1).lineTo(0, -2.4).stroke(0.24, c.staff);
  p.moveTo(-0.05, 0.9).lineTo(-0.05, -2.2).stroke(0.07, c.staffLight);
  for (const s of [-1, 1]) {
    p.moveTo(0, -2.3)
      .quad(s * 0.7, -2.5, s * 0.45, -3.25)
      .stroke(0.18 + O * 0.8, INK);
    p.moveTo(0, -2.3)
      .quad(s * 0.7, -2.5, s * 0.45, -3.25)
      .stroke(0.18, c.metal);
  }
  p.circle(0, -2.95, 0.36).fill(c.orb).stroke(0.1, INK);
  p.circle(0, -2.95, 0.16).fill(0xffffff);
}

// ---- Kiln Mite: tiny clay beetle with a hot back ----------------------------------------

/** Drawn a little larger than its 0.6 radius so a swarm still reads at 1× zoom. */
function miteBody(p: Pen, k: K): void {
  const c = B.kiln_mite;
  p.ellipse(0, -0.12, 0.86, 0.7).fill(k(c.shell));
  if (k === N) {
    p.ellipse(0.24, 0.03, 0.57, 0.52).fill(c.shellShade);
    p.ellipse(-0.1, -0.2, 0.62, 0.52).fill(c.shell);
    p.moveTo(0, -0.8).lineTo(0, 0.52).stroke(0.1, INK);
    p.circle(0, -0.26, 0.28).fill(c.glow).stroke(0.08, INK);
    p.ellipse(-0.4, -0.5, 0.18, 0.1).fill(c.shellLight);
  }
  p.ellipse(0, -0.12, 0.86, 0.7).stroke(O * 0.75, k(INK));
}

function miteEyes(p: Pen): void {
  for (const s of [-1, 1]) p.ellipse(s * 0.21, 0, 0.12, 0.08).fill(B.kiln_mite.glow);
}

function e(name: string, x0: number, y0: number, x1: number, y1: number, draw: (p: Pen) => void): AtlasEntry {
  return { name, x0, y0, x1, y1, draw };
}

export function smallBeastEntries(): AtlasEntry[] {
  return [
    e('bog_lurker_body', -2.5, -2.0, 2.5, 1.7, (p) => lurkerBody(p, N)),
    e('bog_lurker_flash', -2.5, -2.0, 2.5, 1.7, (p) => lurkerBody(p, W)),
    e('bog_lurker_eyes', -1.6, -0.5, 1.6, 0.65, lurkerEyes),
    e('bog_lurker_jaw', -1.5, -0.8, 1.5, 0.8, lurkerJaw),
    e('tar_hulk_body', -3.2, -4.3, 3.2, 3.0, (p) => hulkBody(p, N)),
    e('tar_hulk_flash', -3.2, -4.3, 3.2, 3.0, (p) => hulkBody(p, W)),
    e('tar_hulk_fist', -1.2, -1.1, 1.2, 1.1, (p) => hulkFist(p)),
    e('tar_hulk_cracks', -2.4, -3.3, 2.3, 1.6, hulkCracks),
    e('tar_drip', -0.45, -0.55, 0.45, 0.45, tarDrip),
    e('frost_wisp_body', -1.5, -3.0, 1.5, 1.3, (p) => wispBody(p, N)),
    e('frost_wisp_flash', -1.5, -3.0, 1.5, 1.3, (p) => wispBody(p, W)),
    e('frost_wisp_eyes', -0.55, -0.25, 0.55, 0.2, wispEyes),
    e('frost_wisp_tail', -1.1, -0.3, 1.1, 1.45, wispTail),
    e('stormcaller_body', -1.55, -3.1, 1.55, 1.75, (p) => callerBody(p, N)),
    e('stormcaller_flash', -1.55, -3.1, 1.55, 1.75, (p) => callerBody(p, W)),
    e('stormcaller_face', -0.6, -0.5, 0.6, 0.5, callerFace),
    e('stormcaller_staff', -0.9, -3.5, 0.9, 1.4, callerStaff),
    e('kiln_mite_body', -1.05, -1.05, 1.05, 0.8, (p) => miteBody(p, N)),
    e('kiln_mite_flash', -1.05, -1.05, 1.05, 0.8, (p) => miteBody(p, W)),
    e('kiln_mite_eyes', -0.4, -0.15, 0.4, 0.15, miteEyes),
  ];
}
