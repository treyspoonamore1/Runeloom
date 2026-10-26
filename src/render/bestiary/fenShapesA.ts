import type { AtlasEntry } from '../atlas';
import { ENEMY, INK } from '../combatPalette';
import { blob } from '../enemyShapes';
import type { Pen } from '../pen';
import { FEN_BEAST as B } from './fenBeastPalette';

/**
 * Baked parts of the Fen's smaller enemies (CONTENT §5): Glasspike, Copperback, Spark Heron and
 * Sparkfly. Same conventions as smallBeasts.ts: cells, (0, 0) the collision center, +y south,
 * thick ink outlines; `<kind>_flash` is the white silhouette. Side-on bodies (pike, heron) face +x;
 * the rig mirrors them.
 */
type K = (color: number) => number;
const N: K = (c) => c;
const W: K = () => 0xffffff;
const O = ENEMY.outline;

// ---- Glasspike: a glass-clear pike, needle-snouted ---------------------------------------

function pikePath(p: Pen): Pen {
  return p
    .moveTo(2.05, -0.02)
    .quad(1.25, -0.72, 0.05, -0.68)
    .quad(-0.95, -0.62, -1.35, -0.12)
    .lineTo(-1.35, 0.12)
    .quad(-0.9, 0.58, 0.1, 0.55)
    .quad(1.25, 0.5, 2.05, 0.04)
    .close();
}

function pikeBody(p: Pen, k: K): void {
  const c = B.glasspike;
  // Tail and fins first, the body over them.
  p.poly([-1.25, 0, -2.15, -0.75, -1.85, 0, -2.15, 0.7])
    .fill(k(c.glassShade))
    .stroke(O * 0.7, k(INK));
  p.poly([-0.35, -0.6, 0.15, -1.2, 0.55, -0.64])
    .fill(k(c.fin))
    .stroke(O * 0.6, k(INK));
  p.poly([0.2, 0.5, 0.45, 0.95, 0.75, 0.48])
    .fill(k(c.fin))
    .stroke(O * 0.6, k(INK));
  pikePath(p).fill(k(c.glass));
  if (k === N) {
    // The lower half shaded, the spine seen through the glass, a long highlight.
    p.moveTo(-1.3, 0.1)
      .quad(-0.9, 0.55, 0.1, 0.53)
      .quad(1.25, 0.48, 2.0, 0.04)
      .quad(0.6, 0.15, -1.3, 0.1)
      .close();
    p.fill(c.glassShade);
    p.moveTo(-1.2, -0.02).quad(0.3, -0.18, 1.5, -0.08).stroke(0.12, c.spine, 0.9);
    for (let i = 0; i < 6; i++) {
      const x = -0.9 + i * 0.4;
      p.moveTo(x, -0.28)
        .lineTo(x + 0.12, 0.16)
        .stroke(0.06, c.spine, 0.7);
    }
    p.moveTo(-0.6, -0.45).quad(0.4, -0.62, 1.2, -0.44).stroke(0.12, 0xffffff, 0.85);
    // Eye and a row of needle teeth on the jaw.
    p.circle(1.2, -0.2, 0.2).fill(0xffffff).stroke(0.06, INK);
    p.circle(1.24, -0.2, 0.11).fill(c.eye);
    for (let i = 0; i < 4; i++) {
      const x = 1.35 + i * 0.16;
      p.poly([x, 0.08, x + 0.06, 0.24, x + 0.12, 0.07]).fill(c.tooth);
    }
  }
  pikePath(p).stroke(O, k(INK));
}

// ---- Copperback: a rusty copper crab ------------------------------------------------------

function crabShell(p: Pen): Pen {
  return blob(p, 0, -0.35, 1.7, 1.12, [1, 0.96, 0.92, 0.96, 1, 1.02, 1.05, 1.02]);
}

function crabBody(p: Pen, k: K): void {
  const c = B.copperback;
  // Three walking legs a side under the shell.
  for (const s of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const y = -0.2 + i * 0.42;
      p.moveTo(s * 1.2, y)
        .lineTo(s * 2.0, y - 0.25 + i * 0.1)
        .lineTo(s * 2.25, y + 0.55)
        .stroke(0.32, k(INK));
      if (k === N)
        p.moveTo(s * 1.2, y)
          .lineTo(s * 2.0, y - 0.25 + i * 0.1)
          .lineTo(s * 2.25, y + 0.55)
          .stroke(0.15, c.leg);
    }
  crabShell(p).fill(k(c.shell));
  if (k === N) {
    // Lit top, darker rim, verdigris blooms and two ridges.
    p.ellipse(-0.3, -0.75, 1.0, 0.45).fill({ color: c.shellLight, alpha: 0.8 });
    p.moveTo(-1.55, 0.05).quad(0, 1.05, 1.55, 0.05).quad(0, 0.65, -1.55, 0.05).close().fill(c.shellDark);
    for (const [x, y, rx, ry] of [
      [0.75, -0.55, 0.42, 0.25],
      [-0.95, -0.1, 0.32, 0.2],
      [0.2, 0.15, 0.25, 0.15],
    ] as const)
      p.ellipse(x, y, rx, ry).fill(c.verdigris);
    p.moveTo(-0.9, -1.15).quad(0, -0.65, 0.9, -1.15).stroke(0.1, c.shellDark, 0.8);
    // Mouthparts at the front edge.
    p.moveTo(-0.35, 0.62).lineTo(0, 0.8).lineTo(0.35, 0.62).stroke(0.1, INK);
  }
  crabShell(p).stroke(O, k(INK));
  // Eye stalks.
  for (const s of [-1, 1]) {
    p.moveTo(s * 0.4, -1.1)
      .lineTo(s * 0.5, -1.55)
      .stroke(0.14, k(INK));
    p.circle(s * 0.5, -1.62, 0.2)
      .fill(k(c.eye))
      .stroke(0.06, k(INK));
    if (k === N) p.circle(s * 0.5 - 0.06, -1.68, 0.06).fill(0xffffff);
  }
}

/** The left claw, hinge at (0, 0), pincers pointing out (−x) and forward. */
function crabClaw(p: Pen): void {
  const c = B.copperback;
  p.moveTo(0, 0).lineTo(-0.55, 0.15).stroke(0.3, INK);
  p.moveTo(-0.5, 0.2)
    .quad(-1.2, -0.35, -1.25, -0.95)
    .lineTo(-0.85, -0.7)
    .quad(-0.8, -0.3, -0.5, -0.25)
    .quad(-0.3, -0.75, -0.5, -1.15)
    .quad(0.05, -0.7, 0.05, -0.1)
    .quad(-0.15, 0.3, -0.5, 0.2)
    .close();
  p.fill(c.claw).stroke(O * 0.8, INK);
  p.circle(-0.35, -0.25, 0.1).fill(c.verdigris);
}

/** Two antennae with bulb tips, base at (0, 0): they spark when Charged. */
function crabAntenna(p: Pen): void {
  const c = B.copperback;
  for (const s of [-1, 1]) {
    p.moveTo(s * 0.15, 0)
      .quad(s * 0.3, -0.8, s * 0.75, -1.25)
      .stroke(0.1, c.antenna);
    p.circle(s * 0.75, -1.3, 0.16)
      .fill(0xffffff)
      .stroke(0.07, INK);
  }
}

// ---- Spark Heron: a tall heron of rusted pylon metal -------------------------------------

function heronBody(p: Pen, k: K): void {
  const c = B.spark_heron;
  // Stilt legs with a back knee, feet splayed.
  for (const s of [-1, 1]) {
    const x = s * 0.35;
    p.moveTo(x, -0.2)
      .lineTo(x + 0.2, 0.55)
      .lineTo(x, 1.45)
      .stroke(0.28, k(INK));
    if (k === N)
      p.moveTo(x, -0.2)
        .lineTo(x + 0.2, 0.55)
        .lineTo(x, 1.45)
        .stroke(0.13, c.leg);
    p.moveTo(x - 0.3, 1.5)
      .lineTo(x + 0.35, 1.45)
      .stroke(0.18, k(INK));
  }
  // The neck: an S from the shoulder up to the head, with insulator discs.
  p.moveTo(0.25, -1.1).quad(-0.35, -2.2, 0.15, -3.0).quad(0.55, -3.6, 0.45, -4.0).stroke(0.62, k(INK));
  p.moveTo(0.25, -1.1).quad(-0.35, -2.2, 0.15, -3.0).quad(0.55, -3.6, 0.45, -4.0).stroke(0.36, k(c.metal));
  for (const [x, y] of [
    [0.02, -1.75],
    [-0.02, -2.4],
    [0.3, -3.2],
  ] as const)
    p.ellipse(x, y, 0.36, 0.14).fill(k(c.insulator)).stroke(0.07, k(INK));
  // Body: a plated teardrop with a folded wing.
  blob(p, -0.15, -0.6, 1.15, 0.78, [1, 0.95, 0.9, 0.95, 1.05, 1.1, 1.0, 0.95]).fill(k(c.metal));
  if (k === N) {
    p.moveTo(-1.2, -0.5).quad(-0.2, -1.4, 0.8, -0.8).quad(0.1, -0.2, -1.2, -0.5).close().fill(c.metalDark);
    p.moveTo(-0.9, -0.9).quad(-0.1, -1.3, 0.6, -1.05).stroke(0.1, c.metalLight, 0.9);
    p.circle(0.55, -0.35, 0.12).fill(c.rust);
    p.circle(-0.7, -0.25, 0.09).fill(c.rust);
    p.moveTo(-1.25, -0.55).lineTo(-1.75, -0.3).lineTo(-1.25, -0.25).stroke(0.12, c.metalDark);
  }
  blob(p, -0.15, -0.6, 1.15, 0.78, [1, 0.95, 0.9, 0.95, 1.05, 1.1, 1.0, 0.95]).stroke(O, k(INK));
  // Head with a crest plate and a lamp eye.
  p.circle(0.45, -4.1, 0.42)
    .fill(k(c.metal))
    .stroke(O * 0.8, k(INK));
  p.poly([0.2, -4.45, -0.45, -4.75, 0.05, -4.15]).fill(k(c.metalDark)).stroke(0.08, k(INK));
  if (k === N) p.circle(0.6, -4.18, 0.13).fill(c.eye);
}

/** The beak, base at (0, 0) on the head, pointing +x. White tip is tinted by the glow. */
function heronBeak(p: Pen): void {
  const c = B.spark_heron;
  p.poly([0, -0.18, 1.75, 0.02, 0, 0.16]).fill(c.beak).stroke(0.1, INK);
  p.moveTo(0.1, 0).lineTo(1.5, 0.02).stroke(0.05, INK, 0.6);
}

// ---- Sparkfly: a firefly-bright swarmer --------------------------------------------------

function flyBody(p: Pen, k: K): void {
  const c = B.sparkfly;
  p.ellipse(0, -0.05, 0.32, 0.42)
    .fill(k(c.body))
    .stroke(O * 0.6, k(INK));
  p.circle(0, -0.55, 0.24)
    .fill(k(c.body))
    .stroke(O * 0.6, k(INK));
  if (k === N) {
    for (const s of [-1, 1]) p.circle(s * 0.11, -0.6, 0.07).fill(0xffffff);
    p.moveTo(-0.1, -0.75).quad(-0.25, -1.0, -0.35, -1.05).stroke(0.05, INK);
    p.moveTo(0.1, -0.75).quad(0.25, -1.0, 0.35, -1.05).stroke(0.05, INK);
  }
}

/** The lamp abdomen (white, tinted per frame). */
function flyLamp(p: Pen): void {
  p.ellipse(0, 0, 0.36, 0.42).fill(0xffffff).stroke(0.09, INK);
  p.ellipse(-0.1, -0.12, 0.12, 0.08).fill({ color: 0xffffff, alpha: 0.9 });
}

/** One wing, root at (0, 0), spreading out to +x. */
function flyWing(p: Pen): void {
  p.ellipse(0.42, -0.08, 0.45, 0.2).fill({ color: B.sparkfly.wing, alpha: 0.6 }).stroke(0.05, INK, 0.7);
}

function e(name: string, x0: number, y0: number, x1: number, y1: number, draw: (p: Pen) => void): AtlasEntry {
  return { name, x0, y0, x1, y1, draw };
}

export function fenShapesA(): AtlasEntry[] {
  return [
    e('glasspike_body', -2.4, -1.4, 2.3, 1.2, (p) => pikeBody(p, N)),
    e('glasspike_flash', -2.4, -1.4, 2.3, 1.2, (p) => pikeBody(p, W)),
    e('copperback_body', -2.5, -2.0, 2.5, 1.35, (p) => crabBody(p, N)),
    e('copperback_flash', -2.5, -2.0, 2.5, 1.35, (p) => crabBody(p, W)),
    e('copperback_claw', -1.5, -1.4, 0.35, 0.5, crabClaw),
    e('copperback_antenna', -1.05, -1.6, 1.05, 0.15, crabAntenna),
    e('spark_heron_body', -2.0, -5.0, 1.3, 1.75, (p) => heronBody(p, N)),
    e('spark_heron_flash', -2.0, -5.0, 1.3, 1.75, (p) => heronBody(p, W)),
    e('spark_heron_beak', -0.15, -0.3, 1.95, 0.3, heronBeak),
    e('sparkfly_body', -0.55, -1.2, 0.55, 0.55, (p) => flyBody(p, N)),
    e('sparkfly_flash', -0.55, -1.2, 0.55, 0.55, (p) => flyBody(p, W)),
    e('sparkfly_lamp', -0.5, -0.55, 0.5, 0.55, flyLamp),
    e('sparkfly_wing', -0.1, -0.35, 0.95, 0.2, flyWing),
  ];
}
