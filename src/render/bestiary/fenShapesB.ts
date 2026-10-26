import type { AtlasEntry } from '../atlas';
import { ENEMY, INK } from '../combatPalette';
import { blob } from '../enemyShapes';
import type { Pen } from '../pen';
import { FEN_BEAST as B } from './fenBeastPalette';

/**
 * Baked parts of the Fen's bigger enemies (CONTENT §5): Slagshell, Mirebull, Bellows Toad and
 * Bellshell. Conventions as fenShapesA.ts. White parts are tinted per state by the rigs.
 */
type K = (color: number) => number;
const N: K = (c) => c;
const W: K = () => 0xffffff;
const O = ENEMY.outline;

// ---- Slagshell: a Foundry bruiser in a glowing slag crust --------------------------------

const SLAG_RADII = [1, 0.93, 1.05, 0.95, 1.04, 0.92, 1.03, 0.97, 1.06, 0.94, 1.02, 0.96];

function slagBody(p: Pen, k: K): void {
  const c = B.slagshell;
  // Stubby feet, then the hunched crust.
  for (const s of [-1, 1])
    p.ellipse(s * 1.4, 1.55, 0.75, 0.45)
      .fill(k(c.crustDark))
      .stroke(O * 0.8, k(INK));
  blob(p, 0, -0.85, 2.45, 2.35, SLAG_RADII).fill(k(c.crust));
  if (k === N) {
    // Shade on the right, lit lumps on top, a low head with ember eyes.
    p.moveTo(0.4, 1.4).quad(2.4, 0.8, 2.4, -1.0).quad(2.0, -2.6, 0.9, -3.1).quad(1.9, -0.6, 0.4, 1.4).close();
    p.fill(c.crustDark);
    for (const [x, y, rx, ry] of [
      [-1.0, -2.3, 0.65, 0.42],
      [0.35, -2.75, 0.5, 0.32],
      [-1.7, -0.8, 0.4, 0.5],
      [1.2, -1.5, 0.45, 0.35],
    ] as const)
      p.ellipse(x, y, rx, ry).fill(c.crustLight).stroke(0.1, c.crustDark);
    p.ellipse(0, 0.75, 1.1, 0.6).fill(c.crustDark).stroke(0.12, INK);
    for (const s of [-1, 1]) p.ellipse(s * 0.42, 0.65, 0.2, 0.13).fill(c.eye);
  }
  blob(p, 0, -0.85, 2.45, 2.35, SLAG_RADII).stroke(O * 1.1, k(INK));
}

/** Veins across the crust, white: amber and pulsing when Hot, pale cracks when Cracked. */
function slagVeins(p: Pen): void {
  const lines = [
    [-1.8, -1.6, -1.1, -1.0, -1.4, -0.2, -0.7, 0.3],
    [-0.2, -3.0, 0.1, -2.0, -0.4, -1.2, 0.3, -0.5, 0.1, 0.2],
    [1.9, -1.9, 1.3, -1.1, 1.7, -0.3, 1.2, 0.6],
    [-0.6, -1.7, 0.6, -1.5, 1.3, -1.1],
    [-2.1, 0.0, -1.5, 0.5],
  ];
  for (const [w, a] of [
    [0.42, 0.35],
    [0.16, 1],
  ] as const)
    for (const l of lines) {
      p.moveTo(l[0]!, l[1]!);
      for (let i = 2; i < l.length; i += 2) p.lineTo(l[i]!, l[i + 1]!);
      p.stroke(w, 0xffffff, a);
    }
}

function slagFist(p: Pen): void {
  const c = B.slagshell;
  blob(p, 0, 0, 0.9, 0.8, [1, 0.9, 1.06, 0.94, 1.02, 0.9]).fill(c.crust).stroke(O, INK);
  p.moveTo(-0.5, -0.3).lineTo(0.1, 0.05).lineTo(0.4, -0.25).stroke(0.12, c.vein);
}

// ---- Mirebull: a shaggy marsh ox ---------------------------------------------------------

const BULL_RADII = [1, 0.97, 1.04, 1.0, 0.95, 1.02, 1.05, 0.98, 1.03, 0.96];

function bullBody(p: Pen, k: K): void {
  const c = B.mire_bull;
  // Four stubby mud-caked legs.
  for (const [x, y] of [
    [-1.55, 1.0],
    [-0.6, 1.25],
    [0.6, 1.25],
    [1.55, 1.0],
  ] as const) {
    p.roundRect(x - 0.32, y - 0.6, 0.64, 1.1, 0.25)
      .fill(k(c.hideDark))
      .stroke(O * 0.7, k(INK));
    if (k === N) p.roundRect(x - 0.32, y + 0.05, 0.64, 0.45, 0.2).fill(c.mud);
  }
  blob(p, 0, -0.7, 2.35, 1.75, BULL_RADII).fill(k(c.hide));
  if (k === N) {
    p.moveTo(0.5, 0.95)
      .quad(2.3, 0.6, 2.35, -0.8)
      .quad(2.0, -2.2, 0.9, -2.4)
      .quad(1.8, -0.5, 0.5, 0.95)
      .close();
    p.fill(c.hideDark);
    // Shaggy fringe strands down the flanks and the back's ridge.
    for (let i = 0; i < 9; i++) {
      const x = -2.0 + i * 0.5;
      const y = 0.35 + Math.sin(i * 1.7) * 0.15;
      p.moveTo(x, y - 0.5)
        .quad(x + 0.12, y, x - 0.05, y + 0.4)
        .stroke(0.16, c.shag);
    }
    p.moveTo(-1.6, -1.6).quad(0, -2.75, 1.6, -1.6).stroke(0.3, c.shag, 0.8);
  }
  blob(p, 0, -0.7, 2.35, 1.75, BULL_RADII).stroke(O * 1.05, k(INK));
}

/** The head, anchor at its center: broad brow, curled horns, a dark muzzle. */
function bullHead(p: Pen): void {
  const c = B.mire_bull;
  for (const s of [-1, 1]) {
    p.moveTo(s * 0.7, -0.45)
      .quad(s * 1.7, -0.75, s * 1.65, -1.45)
      .quad(s * 1.45, -0.95, s * 0.75, -0.05)
      .close()
      .fill(c.horn)
      .stroke(0.12, INK);
    p.moveTo(s * 1.45, -1.2)
      .lineTo(s * 1.62, -1.38)
      .stroke(0.12, c.hornDark);
  }
  blob(p, 0, 0, 0.95, 0.85, [1, 0.95, 1.05, 1.0, 0.95, 1.0])
    .fill(c.hide)
    .stroke(O * 0.9, INK);
  p.moveTo(-0.7, -0.55).quad(0, -1.0, 0.7, -0.55).stroke(0.28, c.shag);
  p.ellipse(0, 0.45, 0.62, 0.42).fill(c.nose).stroke(0.1, INK);
  for (const s of [-1, 1]) {
    p.circle(s * 0.22, 0.5, 0.09).fill(0x120c0a);
    p.ellipse(s * 0.45, -0.15, 0.13, 0.11).fill(c.eye);
  }
}

// ---- Bellows Toad: a fat marsh toad with a throat sac ------------------------------------

const TOAD_RADII = [1, 0.97, 0.94, 0.98, 1.03, 1.06, 1.02, 0.97];

function toadBody(p: Pen, k: K): void {
  const c = B.bellows_toad;
  // Folded hind legs to the sides, front feet.
  for (const s of [-1, 1]) {
    p.ellipse(s * 1.55, 0.7, 0.8, 0.5)
      .fill(k(c.skinDark))
      .stroke(O * 0.8, k(INK));
    p.ellipse(s * 0.7, 1.15, 0.38, 0.22)
      .fill(k(c.skinDark))
      .stroke(O * 0.6, k(INK));
  }
  blob(p, 0, -0.45, 1.9, 1.45, TOAD_RADII).fill(k(c.skin));
  if (k === N) {
    p.moveTo(-1.6, 0.3).quad(0, 1.25, 1.6, 0.3).quad(0, 0.75, -1.6, 0.3).close().fill(c.skinDark);
    p.ellipse(-0.55, -1.2, 0.7, 0.3).fill({ color: c.skinLight, alpha: 0.8 });
    for (const [x, y, r] of [
      [-1.1, -0.55, 0.16],
      [0.9, -0.85, 0.18],
      [0.25, -0.2, 0.13],
      [-0.4, -0.95, 0.12],
      [1.3, -0.15, 0.14],
    ] as const)
      p.circle(x, y, r).fill(c.wart);
    p.moveTo(-1.0, 0.0).quad(0, 0.4, 1.0, 0.0).stroke(0.12, INK);
  }
  blob(p, 0, -0.45, 1.9, 1.45, TOAD_RADII).stroke(O, k(INK));
}

/** Two bulging eyes, anchor between them. */
function toadEyes(p: Pen): void {
  const c = B.bellows_toad;
  for (const s of [-1, 1]) {
    p.circle(s * 0.6, 0, 0.45)
      .fill(c.skin)
      .stroke(O * 0.7, INK);
    p.ellipse(s * 0.6, -0.04, 0.3, 0.27).fill(c.eye);
    p.ellipse(s * 0.6, -0.04, 0.24, 0.08).fill(c.pupil);
  }
}

/** The throat sac (white, tinted), anchor at its top under the jaw. */
function toadSac(p: Pen): void {
  p.ellipse(0, 0.45, 0.85, 0.55)
    .fill(0xffffff)
    .stroke(O * 0.7, INK);
  p.moveTo(-0.45, 0.25).quad(0, 0.1, 0.45, 0.25).stroke(0.07, INK, 0.4);
  p.ellipse(-0.3, 0.3, 0.22, 0.1).fill({ color: 0xffffff, alpha: 0.8 });
}

// ---- Bellshell: a brass-shelled turtle ---------------------------------------------------

function bellBody(p: Pen, k: K): void {
  const c = B.bellshell;
  for (const [x, y] of [
    [-1.6, 0.9],
    [1.6, 0.9],
    [-1.1, 1.3],
    [1.1, 1.3],
  ] as const)
    p.ellipse(x, y, 0.5, 0.36)
      .fill(k(c.skin))
      .stroke(O * 0.7, k(INK));
  p.ellipse(0, 0.55, 1.9, 0.75)
    .fill(k(c.skinDark))
    .stroke(O * 0.8, k(INK));
}

function bellShellPath(p: Pen): Pen {
  return p
    .moveTo(-2.15, 0.55)
    .quad(-2.25, -0.4, -1.65, -1.4)
    .quad(-0.9, -2.55, 0, -2.6)
    .quad(0.9, -2.55, 1.65, -1.4)
    .quad(2.25, -0.4, 2.15, 0.55)
    .quad(0, 1.0, -2.15, 0.55)
    .close();
}

/** The bell-shaped brass shell, anchor at the body's center; flared lip, bands and rivets. */
function bellShell(p: Pen, k: K): void {
  const c = B.bellshell;
  bellShellPath(p).fill(k(c.brass));
  if (k === N) {
    p.moveTo(0.6, -2.4).quad(1.9, -1.5, 2.1, 0.5).quad(1.0, 0.6, 0.6, -2.4).close().fill(c.brassDark);
    p.ellipse(-0.75, -1.75, 0.6, 0.3).fill({ color: c.brassLight, alpha: 0.9 });
    for (const y of [-1.0, 0.0])
      p.moveTo(-2.0 + (y === 0 ? 0 : 0.3), y + 0.1)
        .quad(0, y + 0.55, 2.0 - (y === 0 ? 0 : 0.3), y + 0.1)
        .stroke(0.16, c.brassDark);
    for (const x of [-1.3, -0.45, 0.45, 1.3])
      p.circle(x, -0.35 + Math.abs(x) * 0.08, 0.11).fill(c.brassLight);
    p.ellipse(1.2, -0.9, 0.35, 0.2).fill(c.verdigris);
    p.ellipse(-1.5, 0.1, 0.25, 0.15).fill(c.verdigris);
    // The crown loop, as on a bell.
    p.moveTo(-0.3, -2.55).quad(0, -3.05, 0.3, -2.55).stroke(0.3, INK);
    p.moveTo(-0.3, -2.55).quad(0, -3.05, 0.3, -2.55).stroke(0.14, c.brassLight);
  }
  bellShellPath(p).stroke(O * 1.05, k(INK));
}

function bellFlash(p: Pen): void {
  bellBody(p, W);
  bellShell(p, W);
}

/** The head on a short neck, anchor at the neck's base. */
function bellHead(p: Pen): void {
  const c = B.bellshell;
  p.roundRect(-0.35, -0.2, 0.7, 0.8, 0.3)
    .fill(c.skin)
    .stroke(O * 0.7, INK);
  p.ellipse(0, 0.75, 0.62, 0.48)
    .fill(c.skin)
    .stroke(O * 0.8, INK);
  p.moveTo(-0.4, 0.95).quad(0, 1.12, 0.4, 0.95).stroke(0.1, INK);
  for (const s of [-1, 1]) p.circle(s * 0.27, 0.62, 0.09).fill(c.eye);
}

function e(name: string, x0: number, y0: number, x1: number, y1: number, draw: (p: Pen) => void): AtlasEntry {
  return { name, x0, y0, x1, y1, draw };
}

export function fenShapesB(): AtlasEntry[] {
  return [
    e('slagshell_body', -2.9, -3.65, 2.9, 2.2, (p) => slagBody(p, N)),
    e('slagshell_flash', -2.9, -3.65, 2.9, 2.2, (p) => slagBody(p, W)),
    e('slagshell_veins', -2.4, -3.3, 2.2, 0.9, slagVeins),
    e('slagshell_fist', -1.1, -1.0, 1.1, 1.0, slagFist),
    e('mire_bull_body', -2.8, -2.8, 2.8, 2.0, (p) => bullBody(p, N)),
    e('mire_bull_flash', -2.8, -2.8, 2.8, 2.0, (p) => bullBody(p, W)),
    e('mire_bull_head', -1.9, -1.65, 1.9, 1.05, bullHead),
    e('bellows_toad_body', -2.5, -2.1, 2.5, 1.5, (p) => toadBody(p, N)),
    e('bellows_toad_flash', -2.5, -2.1, 2.5, 1.5, (p) => toadBody(p, W)),
    e('bellows_toad_eyes', -1.2, -0.6, 1.2, 0.6, toadEyes),
    e('bellows_toad_sac', -1.05, -0.2, 1.05, 1.15, toadSac),
    e('bellshell_body', -2.3, -0.4, 2.3, 1.8, (p) => bellBody(p, N)),
    e('bellshell_flash', -2.5, -3.3, 2.5, 1.8, bellFlash),
    e('bellshell_shell', -2.5, -3.3, 2.5, 1.2, (p) => bellShell(p, N)),
    e('bellshell_head', -0.8, -0.4, 0.8, 1.35, bellHead),
  ];
}
