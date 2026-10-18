import type { AtlasEntry } from './atlas';
import { ENEMY, FX, INK, PROJ } from './combatPalette';
import type { Pen } from './pen';

/**
 * Baked effect shapes. White ones are tinted per use; the rest carry their own colors.
 * Directional shapes point +x. Units are cells; (0, 0) is the anchor.
 */
const W = 0xffffff;

function glow(p: Pen): void {
  // Soft falloff from stacked discs.
  for (let i = 0; i < 9; i++) p.circle(0, 0, 1 - i * 0.1).fill({ color: W, alpha: 0.11 });
}

function star(p: Pen): void {
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? 1 : 0.24;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  p.poly(pts).fill(W);
}

function streak(p: Pen): void {
  // Head at (0, 0), tail at (-1, 0), 1 wide at the head; stacked for a fake gradient.
  for (const [len, a] of [
    [1, 0.3],
    [0.7, 0.35],
    [0.4, 0.5],
  ] as const) {
    p.moveTo(0, -0.5).quad(-len * 0.45, -0.32, -len, 0).quad(-len * 0.45, 0.32, 0, 0.5).close();
    p.fill({ color: W, alpha: a });
  }
}

function boltCore(p: Pen): void {
  p.circle(0, 0, 1).fill(PROJ.boltRim).stroke(0.16, INK);
  p.circle(0.12, 0, 0.66).fill(PROJ.boltCore);
  p.circle(0.2, 0, 0.36).fill(0xfff8e6);
}

function arrow(p: Pen): void {
  const c = ENEMY.ember_archer;
  const h = PROJ.arrowLen / 2;
  p.moveTo(-h, 0).lineTo(h - 0.3, 0).stroke(0.3, INK);
  p.moveTo(-h, 0).lineTo(h - 0.3, 0).stroke(0.13, c.arrowShaft);
  p.poly([-h - 0.1, -0.32, -h + 0.55, 0, -h - 0.1, 0.32, -h + 0.15, 0]).fill(c.string).stroke(0.08, INK);
  p.poly([h - 0.5, -0.3, h + 0.1, 0, h - 0.5, 0.3]).fill(c.arrowTip).stroke(0.1, INK);
  p.circle(h - 0.25, 0, 0.12).fill(0xffe0a0);
}

function elongGlow(p: Pen): void {
  for (let i = 0; i < 7; i++) p.ellipse(0, 0, 1 - i * 0.12, 0.34 - i * 0.04).fill({ color: W, alpha: 0.14 });
}

/** Strike swoosh: 120° crescent, caster at (0, 0), reach 5 cells. */
const ARC_A = Math.PI / 3;
function crescentPath(p: Pen, reach: number, inner: number): Pen {
  const tx = reach * Math.cos(ARC_A);
  const ty = reach * Math.sin(ARC_A);
  // Inner edge: a circle through both tips and (inner, 0), centered behind the caster.
  const c = (tx * tx + ty * ty - inner * inner) / (2 * (inner - tx));
  const r = inner + c;
  const ia = Math.atan2(ty, tx + c);
  return p.arc(0, 0, reach, -ARC_A, ARC_A).arc(-c, 0, r, ia, -ia, true).close();
}

function crescent(p: Pen): void {
  crescentPath(p, 5.2, 3.0).fill({ color: FX.strikeEdge, alpha: 0.35 });
  crescentPath(p, 5.0, 3.5).fill(FX.strikeCore);
  p.arc(0, 0, 4.95, -ARC_A * 0.92, ARC_A * 0.92).stroke(0.22, FX.strikeEdge);
}

function chip(p: Pen): void {
  p.poly([-0.5, -0.3, 0.2, -0.5, 0.5, 0.1, 0.05, 0.5, -0.45, 0.25]).fill(W).stroke(0.12, INK);
}

function splinter(p: Pen): void {
  const c = ENEMY.shieldbearer;
  p.poly([-0.6, -0.08, 0.45, -0.14, 0.62, 0, 0.4, 0.12, -0.6, 0.1]).fill(c.wood).stroke(0.09, INK);
}

function straw(p: Pen): void {
  p.moveTo(-0.5, 0).lineTo(0.5, 0).stroke(0.16, ENEMY.dummy.strawShade);
  p.moveTo(-0.45, 0).lineTo(0.45, 0).stroke(0.08, ENEMY.dummy.strawLight);
}

function thread(p: Pen): void {
  p.moveTo(-1, 0).bez(-0.4, -0.35, 0.3, 0.35, 1, 0).stroke(0.14, W);
}

function puff(p: Pen): void {
  p.circle(0, 0, 0.62).circle(-0.42, 0.18, 0.42).circle(0.4, 0.2, 0.44).circle(0.1, -0.35, 0.4).fill(W);
}

function e(name: string, x0: number, y0: number, x1: number, y1: number, draw: (p: Pen) => void): AtlasEntry {
  return { name, x0, y0, x1, y1, draw };
}

export function fxAtlasEntries(): AtlasEntry[] {
  return [
    e('glow', -1, -1, 1, 1, glow),
    e('dot', -1, -1, 1, 1, (p) => p.circle(0, 0, 1).fill(W)),
    e('ring', -1.1, -1.1, 1.1, 1.1, (p) => p.circle(0, 0, 1).stroke(0.16, W)),
    e('spark', -0.55, -0.15, 0.55, 0.15, (p) => p.poly([-0.5, 0, 0, -0.12, 0.5, 0, 0, 0.12]).fill(W)),
    e('star', -1, -1, 1, 1, star),
    e('streak', -1, -0.5, 0, 0.5, streak),
    e('shadow', -1, -1, 1, 1, (p) => p.circle(0, 0, 1).fill({ color: 0x000000, alpha: 0.26 })),
    e('bolt_core', -1.1, -1.1, 1.1, 1.1, boltCore),
    e('arrow', -PROJ.arrowLen / 2 - 0.25, -0.4, PROJ.arrowLen / 2 + 0.2, 0.4, arrow),
    e('elong_glow', -1, -0.35, 1, 0.35, elongGlow),
    e('crescent', -0.2, -4.6, 5.4, 4.6, crescent),
    e('chip', -0.6, -0.6, 0.6, 0.6, chip),
    e('splinter', -0.7, -0.22, 0.7, 0.22, splinter),
    e('straw', -0.6, -0.12, 0.6, 0.12, straw),
    e('thread', -1.1, -0.3, 1.1, 0.3, thread),
    e('puff', -0.9, -0.8, 0.9, 0.7, puff),
    e('line', 0, -0.1, 1, 0.1, (p) => p.rect(0, -0.07, 1, 0.14).fill(W)),
  ];
}
