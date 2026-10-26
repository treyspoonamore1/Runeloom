import type { Enemy } from '../../sim';
import { lookKind } from '../../../data/enemies';
import type { AtlasEntry } from '../atlas';
import { ELEMENT, INK } from '../combatPalette';
import type { Pen } from '../pen';
import { FEN_BEAST as B } from './fenBeastPalette';

/**
 * M8 status icons (DESIGN §14): Stranded (swimmers out of water), Charged (Copperback), Hot or
 * Cracked (Slagshell) and Rung (Bellshell). Same size and ink as the M3 Wet and Oiled icons
 * (1.2 cells across at scale 1); StatusIcons.row draws them after the grid states.
 */
const W = 0xffffff;

function disc(p: Pen, fill: number): void {
  p.circle(0, 0, 0.58).fill(fill).stroke(0.14, INK);
}

/** A fish on dry sand, with a sweat drop. */
function strandedIcon(p: Pen): void {
  disc(p, 0xd8c08a);
  p.moveTo(0.42, 0.02)
    .quad(0.05, -0.28, -0.25, -0.02)
    .quad(0.05, 0.26, 0.42, 0.02)
    .close()
    .fill(B.glasspike.glass)
    .stroke(0.07, INK);
  p.poly([-0.22, 0, -0.45, -0.18, -0.45, 0.18]).fill(B.glasspike.glassShade).stroke(0.06, INK);
  p.circle(0.22, -0.04, 0.04).fill(INK);
  p.moveTo(0.05, -0.42).quad(0.15, -0.26, 0.05, -0.2).quad(-0.05, -0.26, 0.05, -0.42).close().fill(0x8fe3ff);
}

/** A copper shell disc with a lightning bolt across it. */
function chargedIcon(p: Pen): void {
  disc(p, B.copperback.shell);
  p.poly([0.08, -0.48, -0.22, 0.04, 0.0, 0.04, -0.1, 0.48, 0.24, -0.08, 0.02, -0.08, 0.14, -0.48])
    .fill(ELEMENT.storm)
    .stroke(0.06, INK);
}

/** Dark slag with glowing amber veins. */
function hotIcon(p: Pen): void {
  disc(p, B.slagshell.crust);
  p.moveTo(-0.35, -0.2).lineTo(-0.05, 0.0).lineTo(-0.2, 0.3).stroke(0.13, B.slagshell.vein);
  p.moveTo(0.05, -0.4).lineTo(0.15, -0.05).lineTo(0.38, 0.12).stroke(0.13, B.slagshell.veinHot);
}

/** Cooled grey slag split by pale cracks, a wisp of steam. */
function crackedIcon(p: Pen): void {
  disc(p, B.slagshell.cooled);
  p.moveTo(-0.38, 0.05).lineTo(-0.05, 0.12).lineTo(0.1, 0.42).stroke(0.08, W);
  p.moveTo(-0.05, 0.12).lineTo(0.2, -0.15).lineTo(0.42, -0.1).stroke(0.08, W);
  p.moveTo(-0.15, -0.2).quad(-0.3, -0.35, -0.12, -0.5).stroke(0.07, W, 0.9);
}

/** A brass bell ringing. */
function rungIcon(p: Pen): void {
  disc(p, 0x3a3240);
  p.moveTo(-0.3, 0.22)
    .quad(-0.3, -0.35, 0, -0.38)
    .quad(0.3, -0.35, 0.3, 0.22)
    .close()
    .fill(B.bellshell.brassLight)
    .stroke(0.07, INK);
  p.circle(0, 0.28, 0.08).fill(B.bellshell.brassDark);
  for (const s of [-1, 1])
    p.moveTo(s * 0.4, -0.25)
      .quad(s * 0.52, 0, s * 0.4, 0.22)
      .stroke(0.06, B.bellshell.ring);
}

export function fenIconEntries(): AtlasEntry[] {
  const e = (name: string, draw: (p: Pen) => void): AtlasEntry => ({
    name,
    x0: -0.65,
    y0: -0.65,
    x1: 0.65,
    y1: 0.65,
    draw,
  });
  return [
    e('icon_stranded', strandedIcon),
    e('icon_charged', chargedIcon),
    e('icon_hot', hotIcon),
    e('icon_cracked', crackedIcon),
    e('icon_rung', rungIcon),
  ];
}

/** Status icon bits of the Fen states (after statusIcons.ts ICON_WET, ICON_OIL, ICON_BLIND). */
export const ICON_STRANDED = 8;
export const ICON_CHARGED = 16;
export const ICON_HOT = 32;
export const ICON_CRACKED = 64;
export const ICON_RUNG = 128;

/** The Fen state icons an enemy shows now. */
export function fenIconFlags(e: Enemy): number {
  const s = e.special;
  let f = 0;
  if (s.stranded) f |= ICON_STRANDED;
  if (s.chargedLeft > 0) f |= ICON_CHARGED;
  if (s.openLeft > 0) f |= ICON_RUNG;
  if (lookKind(e.kind) === 'slagshell') f |= s.hot && s.crackedLeft <= 0 ? ICON_HOT : ICON_CRACKED;
  return f;
}
