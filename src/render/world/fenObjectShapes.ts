import type { AtlasEntry } from '../atlas';
import { INK } from '../combatPalette';
import { PAL } from '../palette';
import type { Pen } from '../pen';
import { FEN } from '../terrain/regionLook';
import { OBJ as C } from './worldPalette';

/**
 * M8 puzzle objects (CONTENT §6.1): the sealed conduit switch (`Q`, a crystal in a glass case that
 * only charge on a touching cell powers) and the wind vane (`Y`). Anchor (0, 0) is the tile
 * center, a tile spans -2..2 cells; white parts are tinted per state.
 */
const O = 0.32;
const W = 0xffffff;

/** The glass case's back: a faint dome behind the crystal. */
function domeBack(p: Pen): void {
  p.moveTo(-1.05, -0.95)
    .lineTo(-1.05, -2.0)
    .quad(-1.05, -3.05, 0, -3.1)
    .quad(1.05, -3.05, 1.05, -2.0)
    .lineTo(1.05, -0.95)
    .close()
    .fill({ color: 0xbfe6ee, alpha: 0.28 });
}

/** The glass case's front: outline, a long highlight and a small glint. */
function domeFront(p: Pen): void {
  p.moveTo(-1.05, -0.95)
    .lineTo(-1.05, -2.0)
    .quad(-1.05, -3.05, 0, -3.1)
    .quad(1.05, -3.05, 1.05, -2.0)
    .lineTo(1.05, -0.95)
    .stroke(0.16, INK);
  p.moveTo(-0.7, -1.15).lineTo(-0.7, -2.05).quad(-0.65, -2.6, -0.25, -2.78).stroke(0.16, W, 0.75);
  p.circle(0.55, -2.45, 0.11).fill({ color: W, alpha: 0.85 });
}

/** The seal: a riveted copper collar clamping the case to the plinth, with a stamped seal plate. */
function collar(p: Pen): void {
  p.roundRect(-1.3, -1.12, 2.6, 0.5, 0.18)
    .fill(FEN.rust)
    .stroke(O * 0.6, INK);
  p.rect(-1.2, -1.07, 2.4, 0.12).fill({ color: W, alpha: 0.25 });
  for (const x of [-0.95, 0.95]) p.circle(x, -0.87, 0.11).fill(FEN.rustDark);
  p.poly([0, -1.17, 0.32, -0.87, 0, -0.57, -0.32, -0.87]).fill(FEN.metal).stroke(0.1, INK);
  p.circle(0, -0.87, 0.09).fill(FEN.metalDark);
}

/** The plinth under a sealed switch: verdigris metal, a heavy foot. */
function sealedBase(p: Pen): void {
  p.ellipse(0.2, 1.2, 1.7, 0.6).fill({ color: PAL.shadow, alpha: 0.25 });
  p.ellipse(0, 1.0, 1.5, 0.62)
    .fill(FEN.metalDark)
    .stroke(O * 0.7, INK);
  p.roundRect(-0.85, -0.9, 1.7, 2.0, 0.3)
    .fill(FEN.metal)
    .stroke(O * 0.7, INK);
  p.rect(-0.85, 0.35, 1.7, 0.18).fill(FEN.metalDark);
  p.moveTo(-0.5, -0.8).lineTo(-0.5, 0.9).stroke(0.1, FEN.metalLight);
  p.circle(0.45, -0.1, 0.16).fill(FEN.rust);
}

// ---- Wind vane: a post on a stone foot with a four-cup rotor --------------------------------

function vanePost(p: Pen): void {
  p.ellipse(0.25, 1.3, 1.6, 0.6).fill({ color: PAL.shadow, alpha: 0.25 });
  p.ellipse(0, 1.1, 1.35, 0.6)
    .fill(C.stoneDark)
    .stroke(O * 0.7, INK);
  p.ellipse(0, 0.98, 1.05, 0.42).fill(C.stone);
  p.roundRect(-0.22, -3.0, 0.44, 4.0, 0.15)
    .fill(C.iron)
    .stroke(O * 0.6, INK);
  p.moveTo(-0.08, -2.8).lineTo(-0.08, 0.8).stroke(0.08, C.ironLight);
  // A little arrow fin under the rotor, pointing the way the vane faces.
  p.poly([-0.2, -2.35, 1.25, -2.55, 1.25, -2.05]).fill(C.brass).stroke(0.1, INK);
}

/** The rotor, seen from above: four arms with cups (scaled flat by the look). */
function vaneRotor(p: Pen): void {
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    p.moveTo(0, 0)
      .lineTo(cx * 1.45, cy * 1.45)
      .stroke(0.16, INK);
    // Each cup is a half-disc open along the spin.
    const ux = cx * 1.6;
    const uy = cy * 1.6;
    const tx = -cy;
    const ty = cx;
    p.moveTo(ux + tx * 0.45, uy + ty * 0.45)
      .quad(ux + cx * 0.6, uy + cy * 0.6, ux - tx * 0.45, uy - ty * 0.45)
      .quad(ux + tx * 0.1 - cx * 0.1, uy + ty * 0.1 - cy * 0.1, ux + tx * 0.45, uy + ty * 0.45)
      .close()
      .fill(W)
      .stroke(0.12, INK);
  }
  p.circle(0, 0, 0.32).fill(C.brassDark).stroke(0.1, INK);
}

function e(name: string, x0: number, y0: number, x1: number, y1: number, draw: (p: Pen) => void): AtlasEntry {
  return { name, x0, y0, x1, y1, draw };
}

export function fenObjectAtlasEntries(): AtlasEntry[] {
  return [
    e('sealed_base', -1.8, -1.1, 2.0, 1.9, sealedBase),
    e('sealed_dome_back', -1.15, -3.2, 1.15, -0.85, domeBack),
    e('sealed_dome_front', -1.2, -3.25, 1.2, -0.8, domeFront),
    e('sealed_collar', -1.45, -1.25, 1.45, -0.45, collar),
    e('vane_post', -1.5, -3.1, 1.9, 2.0, vanePost),
    e('vane_rotor', -2.15, -2.15, 2.15, 2.15, vaneRotor),
  ];
}
