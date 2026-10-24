import { GraphicsContext } from 'pixi.js';
import type { BuildingId } from '../../../data/hearth';
import { INK } from '../combatPalette';
import { Pen } from '../pen';
import { HUB } from './hubPalette';
import { K } from './npcShapes';

/**
 * Shared drawing helpers for the hub, the empty building plots and the Hearth fire's stone ring.
 * Units are cells; (0, 0) is the center of the station's tile rectangle (buildings 3×2 tiles:
 * x −6..6, y −4..4; the fire 3×3: ±6). Raised parts use the walls' 3/4 look: a light top face and
 * a darker front face on the south side.
 */
export const O = 0.32;

export function ctx(draw: (p: Pen) => void): GraphicsContext {
  const c = new GraphicsContext();
  draw(new Pen(c, K));
  return c;
}

/** A 3/4 block: top face from y to y + h − front, front face below it. */
export function block(p: Pen, x: number, y: number, w: number, h: number, front: number, top: number, face: number): void {
  p.rect(x, y, w, h - front).fill(top);
  p.rect(x, y + h - front, w, front).fill(face);
  p.moveTo(x, y + h - front).lineTo(x + w, y + h - front).stroke(0.1, INK);
  p.rect(x, y, w, h).stroke(O, INK);
}

/** An upright post from y0 down to y1. */
export function post(p: Pen, x: number, y0: number, y1: number, w = 0.55, color: number = HUB.wood): void {
  p.rect(x - w / 2, y0, w, y1 - y0).fill(color).stroke(O * 0.8, INK);
}

/** A soft ground shadow under a structure. */
export function groundShadow(p: Pen, w: number, y = 3.4): void {
  p.ellipse(0.4, y, w, 1.1).fill({ color: 0x000000, alpha: 0.2 });
}

/** A stone pad under built structures. */
export function pad(p: Pen, w = 5.6, h = 3.6): void {
  p.roundRect(-w, -h, w * 2, h * 2, 0.8).fill(HUB.stoneLight).stroke(0.2, HUB.stoneDark);
  for (const [x, y] of [
    [-3.6, -1.8],
    [1.2, 2.2],
    [3.9, -0.6],
    [-1.4, 0.9],
  ] as const)
    p.roundRect(x, y, 1.1, 0.5, 0.2).fill({ color: HUB.stoneDark, alpha: 0.35 });
}

// ---- Plot icons, on the plot's sign ----------------------------------------------------------

function flameIcon(p: Pen): void {
  p.moveTo(0, -0.55).bez(0.35, -0.2, 0.5, 0.1, 0.4, 0.35).quad(0, 0.65, -0.4, 0.35).bez(-0.5, 0.1, -0.35, -0.2, 0, -0.55).close();
  p.fill(HUB.ember).stroke(0.08, INK);
}
function sproutIcon(p: Pen): void {
  p.moveTo(0, 0.5).lineTo(0, -0.1).stroke(0.12, 0x4e9a38);
  p.ellipse(-0.25, -0.25, 0.28, 0.14).fill(0x8ad65e).stroke(0.06, INK);
  p.ellipse(0.25, -0.35, 0.28, 0.14).fill(0x8ad65e).stroke(0.06, INK);
}
function noticeIcon(p: Pen): void {
  p.rect(-0.38, -0.45, 0.76, 0.9).fill(HUB.cloth).stroke(0.08, INK);
  p.circle(0, -0.42, 0.11).fill(0xff4f7a);
  for (const y of [-0.12, 0.08, 0.28]) p.moveTo(-0.24, y).lineTo(0.24, y).stroke(0.05, HUB.clothShade);
}
function spoolIcon(p: Pen): void {
  p.rect(-0.38, -0.45, 0.76, 0.18).fill(HUB.woodDark);
  p.rect(-0.38, 0.27, 0.76, 0.18).fill(HUB.woodDark);
  p.rect(-0.26, -0.27, 0.52, 0.54).fill(0x9fb4ff).stroke(0.06, INK);
}

const ICON: Readonly<Record<BuildingId, (p: Pen) => void>> = {
  kindling_pit: flameIcon,
  rune_garden: sproutIcon,
  expedition_board: noticeIcon,
  salvage_loom: spoolIcon,
};

/** An unbuilt plot: a faint dashed outline, corner stakes and a little sign with the building's icon. */
export function plot(id: BuildingId): GraphicsContext {
  return ctx((p) => {
    p.roundRect(-5.3, -3.1, 10.6, 6.4, 0.7).fill({ color: HUB.soil, alpha: 0.28 });
    const dash = (x0: number, y0: number, x1: number, y1: number): void => {
      const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 0.9);
      for (let i = 0; i < n; i += 2)
        p.moveTo(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)
          .lineTo(x0 + ((x1 - x0) * (i + 1)) / n, y0 + ((y1 - y0) * (i + 1)) / n)
          .stroke(0.16, HUB.plotLine, 0.55);
    };
    dash(-4.8, -2.7, 4.8, -2.7);
    dash(4.8, -2.7, 4.8, 2.9);
    dash(4.8, 2.9, -4.8, 2.9);
    dash(-4.8, 2.9, -4.8, -2.7);
    for (const [x, y] of [
      [-4.8, -2.7],
      [4.8, -2.7],
      [-4.8, 2.9],
      [4.8, 2.9],
    ] as const)
      post(p, x, y - 0.9, y + 0.25, 0.4, HUB.woodLight);
    // The sign, front and center.
    post(p, 0, 0.6, 3.0, 0.32, HUB.woodDark);
    p.roundRect(-1.2, -0.75, 2.4, 1.7, 0.25).fill(HUB.wood).stroke(O * 0.8, INK);
    p.moveTo(-0.9, -0.5).lineTo(0.9, -0.5).stroke(0.08, HUB.woodLight);
    ICON[id](new ShiftPen(p, 0, 0.1));
  });
}

/** A Pen that offsets everything it draws (icons placed on a sign). */
class ShiftPen extends Pen {
  constructor(
    p: Pen,
    private readonly dx: number,
    private readonly dy: number,
  ) {
    super(p.c, p.k);
  }
  override moveTo(x: number, y: number): this {
    return super.moveTo(x + this.dx, y + this.dy);
  }
  override lineTo(x: number, y: number): this {
    return super.lineTo(x + this.dx, y + this.dy);
  }
  override quad(cx: number, cy: number, x: number, y: number): this {
    return super.quad(cx + this.dx, cy + this.dy, x + this.dx, y + this.dy);
  }
  override bez(a: number, b: number, c: number, d: number, x: number, y: number): this {
    return super.bez(a + this.dx, b + this.dy, c + this.dx, d + this.dy, x + this.dx, y + this.dy);
  }
  override circle(x: number, y: number, r: number): this {
    return super.circle(x + this.dx, y + this.dy, r);
  }
  override ellipse(x: number, y: number, rx: number, ry: number): this {
    return super.ellipse(x + this.dx, y + this.dy, rx, ry);
  }
  override rect(x: number, y: number, w: number, h: number): this {
    return super.rect(x + this.dx, y + this.dy, w, h);
  }
}

/** The Hearth fire's pit: a ring of big stones around glowing coals, on a 3×3 tile stone pad. */
export function firePit(): GraphicsContext {
  return ctx((p) => {
    p.circle(0, 0.3, 5.7).fill({ color: HUB.stoneDark, alpha: 0.35 });
    p.ellipse(0, 0.6, 4.7, 3.6).fill(HUB.coal).stroke(O, INK);
    p.ellipse(0, 0.5, 3.4, 2.4).fill(0x7a2e18);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      p.circle(Math.cos(a) * 2.0, 0.5 + Math.sin(a) * 1.3, 0.5).fill(0xa8401e);
    }
    // Stones of the ring, the front ones drawn last and taller.
    const stones = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);
    stones.sort((a, b) => Math.sin(a) - Math.sin(b));
    for (const a of stones) {
      const x = Math.cos(a) * 4.6;
      const y = 0.6 + Math.sin(a) * 3.5;
      const r = 1.05 + 0.15 * Math.cos(a * 3);
      p.roundRect(x - r, y - r * 0.85, r * 2, r * 1.6, r * 0.6).fill(HUB.stone).stroke(O, INK);
      p.roundRect(x - r * 0.7, y - r * 0.7, r * 1.2, r * 0.5, r * 0.25).fill(HUB.stoneLight);
    }
  });
}

/** An Ember mote for the pile in the pit (and the glow under the flame): warm dots. */
export function coals(): GraphicsContext {
  return ctx((p) => {
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const r = 0.6 + (i % 3) * 0.55;
      p.circle(Math.cos(a) * r * 1.3, 0.5 + Math.sin(a) * r * 0.8, 0.32).fill(i % 2 ? HUB.ember : HUB.emberCore);
    }
  });
}
