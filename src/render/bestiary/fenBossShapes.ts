import type { AtlasEntry } from '../atlas';
import { ENEMY, INK } from '../combatPalette';
import { blob } from '../enemyShapes';
import type { Pen } from '../pen';
import { FEN_BOSS as B } from './fenBossPalette';

/**
 * Baked parts of the Drowned Foundry's bosses (M8, CONTENT §5): the Old Bellwether, a colossal
 * brass-belled turtle (the Foundry's old shift bell, its yoke still on top), and the Glasswater
 * Coil, a glass eel with a lightning spine and one electric eye. Conventions as fenShapesB.ts:
 * cells at art radius 2.5 (the view scales them to the sim), (0, 0) the collision center, +y
 * south, thick ink outlines; `<kind>_flash` is the white silhouette. The Coil's head is drawn
 * pointing +x; its rig turns it to the facing.
 */
type K = (color: number) => number;
const N: K = (c) => c;
const W: K = () => 0xffffff;
const O = ENEMY.outline;

// ---- Old Bellwether ------------------------------------------------------------------------

/** Four elephant legs, a stub tail and the underbody with its pale plastron (seen when the shell lifts). */
function bellBody(p: Pen, k: K): void {
  const c = B.bellwether;
  p.poly([-0.3, -0.5, 0, -1.6, 0.3, -0.5])
    .fill(k(c.skinDark))
    .stroke(O * 0.7, k(INK));
  for (const [x, y, s] of [
    [-2.0, 0.9, 1],
    [2.0, 0.9, 1],
    [-1.35, 1.55, 1.1],
    [1.35, 1.55, 1.1],
  ] as const) {
    p.roundRect(x - 0.55 * s, y - 0.7, 1.1 * s, 1.15, 0.45)
      .fill(k(c.skin))
      .stroke(O * 0.8, k(INK));
    if (k === N) for (const dx of [-0.3, 0, 0.3]) p.circle(x + dx * s, y + 0.35, 0.12).fill(c.belly);
  }
  p.ellipse(0, 0.6, 2.45, 1.05)
    .fill(k(c.skinDark))
    .stroke(O * 0.85, k(INK));
  p.ellipse(0, 0.35, 1.9, 0.75).fill(k(c.belly));
  if (k === N) {
    p.moveTo(-1.6, 0.35).lineTo(1.6, 0.35).stroke(0.08, c.beak, 0.8);
    for (const x of [-0.95, 0, 0.95]) p.moveTo(x, -0.3).lineTo(x, 1.0).stroke(0.08, c.beak, 0.8);
  }
  p.ellipse(0, 0.35, 1.9, 0.75).stroke(O * 0.6, k(INK));
}

function bellShellPath(p: Pen): Pen {
  return p
    .moveTo(-2.75, 0.75)
    .quad(-2.5, 0.1, -2.25, -0.9)
    .quad(-1.95, -2.75, -0.9, -3.15)
    .quad(0, -3.35, 0.9, -3.15)
    .quad(1.95, -2.75, 2.25, -0.9)
    .quad(2.5, 0.1, 2.75, 0.75)
    .quad(0, 1.45, -2.75, 0.75)
    .close();
}

/** The bell: a flared brass lip, two bands, rivets, verdigris runs, moss, a crack, the yoke on top. */
function bellShell(p: Pen, k: K): void {
  const c = B.bellwether;
  // The yoke it hung from, still bolted to the crown.
  p.roundRect(-1.25, -3.85, 2.5, 0.5, 0.2)
    .fill(k(c.brassDark))
    .stroke(O * 0.8, k(INK));
  p.roundRect(-0.45, -3.55, 0.9, 0.5, 0.15)
    .fill(k(c.brass))
    .stroke(O * 0.7, k(INK));
  bellShellPath(p).fill(k(c.brass));
  if (k === N) {
    // Shade on the right, a broad highlight on the left shoulder.
    p.moveTo(0.7, -3.05).quad(2.2, -2.2, 2.6, 0.8).quad(1.2, 1.0, 0.7, -3.05).close().fill(c.brassDark);
    p.ellipse(-1.0, -2.3, 0.75, 0.38).fill({ color: c.brassLight, alpha: 0.9 });
    // Bands and the lip.
    for (const [y, w] of [
      [-1.6, 1.95],
      [-0.4, 2.35],
    ] as const)
      p.moveTo(-w, y).quad(0, y + 0.6, w, y).stroke(0.2, c.brassDark);
    p.moveTo(-2.65, 0.7).quad(0, 1.35, 2.65, 0.7).stroke(0.24, c.brassLight, 0.8);
    for (const x of [-1.6, -0.8, 0, 0.8, 1.6]) p.circle(x, -0.6 + Math.abs(x) * 0.1 + 0.3, 0.12).fill(c.brassLight);
    // Verdigris patches with runs, moss on the crown, a crack.
    for (const [x, y, rx, ry] of [
      [1.35, -1.15, 0.5, 0.3],
      [-1.75, -0.2, 0.35, 0.25],
      [-0.4, -2.6, 0.55, 0.22],
    ] as const) {
      p.ellipse(x, y, rx, ry).fill(c.verdigris);
      p.moveTo(x - rx * 0.3, y).lineTo(x - rx * 0.3, y + ry + 0.45).stroke(0.12, c.verdigris, 0.9);
      p.moveTo(x + rx * 0.4, y).lineTo(x + rx * 0.4, y + ry + 0.25).stroke(0.1, c.verdigrisDark, 0.8);
    }
    blob(p, 0.4, -3.05, 0.9, 0.3, [1, 0.8, 1.1, 0.9, 1, 1.15, 0.85, 1]).fill(c.moss);
    p.moveTo(0.2, -2.0).lineTo(0.45, -1.4).lineTo(0.2, -0.9).lineTo(0.5, -0.3).stroke(0.1, INK, 0.8);
  }
  bellShellPath(p).stroke(O * 1.05, k(INK));
}

/** The head on a thick neck, anchor at the neck's base, pointing +y: hooked beak, brows, glowing eyes. */
function bellHead(p: Pen): void {
  const c = B.bellwether;
  p.roundRect(-0.55, -0.3, 1.1, 1.05, 0.45)
    .fill(c.skin)
    .stroke(O * 0.8, INK);
  p.ellipse(0, 1.0, 0.95, 0.75)
    .fill(c.skin)
    .stroke(O * 0.9, INK);
  p.ellipse(0, 1.15, 0.6, 0.38).fill(c.skinLight);
  // Hooked beak, mossy chin tufts.
  p.poly([-0.42, 1.45, 0, 1.95, 0.42, 1.45, 0, 1.6])
    .fill(c.beak)
    .stroke(O * 0.6, INK);
  for (const s of [-1, 1]) {
    p.poly([s * 0.6, 1.4, s * 0.75, 1.8, s * 0.35, 1.55]).fill(c.moss);
    // Heavy brow over a glowing eye.
    p.circle(s * 0.42, 0.85, 0.2).fill(c.eye).stroke(0.08, INK);
    p.circle(s * 0.42, 0.88, 0.08).fill(c.pupil);
    p.moveTo(s * 0.7, 0.62).quad(s * 0.4, 0.5, s * 0.15, 0.7).stroke(0.18, c.skinDark);
  }
}

function bellFlash(p: Pen): void {
  bellBody(p, W);
  bellShell(p, W);
}

// ---- Glasswater Coil -----------------------------------------------------------------------

function coilHeadPath(p: Pen): Pen {
  return p
    .moveTo(2.55, 0)
    .quad(2.35, -0.95, 1.2, -1.2)
    .quad(-0.2, -1.45, -1.3, -1.05)
    .quad(-1.55, 0, -1.3, 1.05)
    .quad(-0.2, 1.45, 1.2, 1.2)
    .quad(2.35, 0.95, 2.55, 0)
    .close();
}

/** The head, pointing +x, seen from above: frilled gills, glass skull, the spine's start. */
function coilHead(p: Pen, k: K): void {
  const c = B.glasswater_coil;
  // Gill frills behind the jaw.
  for (const s of [-1, 1])
    p.poly([-0.6, s * 0.95, -1.7, s * 1.75, -1.1, s * 1.05, -1.9, s * 1.25, -1.25, s * 0.6])
      .fill(k(c.fin))
      .stroke(O * 0.6, k(INK));
  coilHeadPath(p).fill(k(c.glass));
  if (k === N) {
    p.moveTo(-1.25, 0.25).quad(0.6, 1.1, 2.4, 0.2).quad(1.8, 1.15, 0.6, 1.3).quad(-0.6, 1.4, -1.25, 0.25).close();
    p.fill(c.glassShade);
    // The skull and the spine's first vertebrae through the glass.
    p.moveTo(-1.3, 0).quad(0, -0.1, 1.0, 0).stroke(0.16, c.spine, 0.85);
    for (const x of [-0.9, -0.45, 0])
      p.moveTo(x, -0.35)
        .lineTo(x + 0.15, 0.35)
        .stroke(0.07, c.spine, 0.6);
    // Nostrils, the mouth line, a highlight.
    p.moveTo(1.5, 0.75).quad(2.2, 0.55, 2.5, 0.08).stroke(0.09, INK, 0.7);
    for (const s of [-1, 1]) p.ellipse(2.05, s * 0.35, 0.1, 0.06).fill(c.glassDeep);
    p.moveTo(-0.6, -0.95).quad(0.6, -1.2, 1.7, -0.8).stroke(0.14, 0xffffff, 0.85);
  }
  coilHeadPath(p).stroke(O, k(INK));
}

/** Its one electric eye, centered on the brow (a separate sprite, so it can stay lit under water). */
function coilEye(p: Pen): void {
  const c = B.glasswater_coil;
  p.ellipse(0, 0, 0.7, 0.6).fill(c.eye).stroke(O * 0.6, INK);
  p.ellipse(0, 0, 0.48, 0.44).fill(c.iris);
  p.ellipse(0.04, 0, 0.12, 0.38).fill(c.pupil);
  p.circle(-0.2, -0.2, 0.12).fill(0xffffff);
}

/** The tail fin (pointing -x from the last segment). */
function coilTail(p: Pen, k: K): void {
  const c = B.glasswater_coil;
  const path = (q: Pen) =>
    q
      .moveTo(0.3, 0)
      .quad(-0.8, -1.2, -2.4, -0.9)
      .quad(-1.8, 0, -2.4, 0.9)
      .quad(-0.8, 1.2, 0.3, 0)
      .close();
  path(p).fill(k(c.fin));
  if (k === N) for (const s of [-0.5, 0, 0.5]) p.moveTo(0, 0).lineTo(-2.0, s).stroke(0.07, c.glassShade, 0.9);
  path(p).stroke(O * 0.6, k(INK));
}

function e(name: string, x0: number, y0: number, x1: number, y1: number, draw: (p: Pen) => void): AtlasEntry {
  return { name, x0, y0, x1, y1, draw };
}

export function fenBossShapes(): AtlasEntry[] {
  return [
    e('bellwether_body', -2.75, -1.75, 2.75, 2.25, (p) => bellBody(p, N)),
    e('bellwether_flash', -2.95, -4.05, 2.95, 2.25, bellFlash),
    e('bellwether_shell', -2.95, -4.05, 2.95, 1.6, (p) => bellShell(p, N)),
    e('bellwether_shell_lit', -2.95, -4.05, 2.95, 1.6, (p) => bellShell(p, W)),
    e('bellwether_head', -1.1, -0.45, 1.1, 2.1, bellHead),
    e('glasswater_coil_body', -2.05, -1.95, 2.75, 1.95, (p) => coilHead(p, N)),
    e('glasswater_coil_flash', -2.05, -1.95, 2.75, 1.95, (p) => coilHead(p, W)),
    e('coil_eye', -0.8, -0.7, 0.8, 0.7, coilEye),
    e('coil_tail', -2.6, -1.3, 0.5, 1.3, (p) => coilTail(p, N)),
  ];
}
