import { Container, Graphics } from 'pixi.js';
import { ENEMY, INK } from '../combatPalette';
import { FEN_BOSS as P } from './fenBossPalette';

const C = P.glasswater_coil;
const O = ENEMY.outline;

/** A point of the drawn body in art units: center, unit normal (left of the direction to the head), half-width. */
export interface BodyPoint {
  x: number;
  y: number;
  nx: number;
  ny: number;
  w: number;
}

/**
 * The Glasswater Coil's trailing body as one tapered glass tube, redrawn each frame from its
 * points (head end first): clear glass with a shaded belly, ribs, an ink outline and a highlight,
 * and on top its lightning spine as a separate layer the rig tints and brightens before a pulse.
 * The rig tints the whole tube per state (dark under water, grey stranded, frosted iced) and
 * fades the water veil over it while it is submerged.
 */
export class CoilBody {
  readonly root = new Container();
  readonly tube = new Graphics();
  readonly spine = new Graphics();
  /** Submerged: a film of water over the whole body (the rig sets its tint and alpha). */
  readonly veil = new Graphics();
  private readonly left: number[] = [];
  private readonly right: number[] = [];

  constructor() {
    this.root.addChild(this.tube, this.spine, this.veil);
  }

  /** Draw the veil this frame (the rig turns it off when it's invisible). */
  veilOn = false;

  draw(pts: readonly BodyPoint[]): void {
    const t = this.tube;
    const sp = this.spine;
    t.clear();
    sp.clear();
    this.veil.clear();
    const n = pts.length;
    if (n < 2) return;
    const L = this.left;
    const R = this.right;
    L.length = R.length = 0;
    for (const p of pts) {
      L.push(p.x + p.nx * p.w, p.y + p.ny * p.w);
      R.push(p.x - p.nx * p.w, p.y - p.ny * p.w);
    }
    const outline: number[] = [...L];
    for (let i = n - 1; i >= 0; i--) outline.push(R[i * 2]!, R[i * 2 + 1]!);
    t.poly(outline).fill(C.glass);
    // The shaded belly: the right third of the tube.
    const belly: number[] = [];
    for (const p of pts) belly.push(p.x - p.nx * p.w * 0.25, p.y - p.ny * p.w * 0.25);
    for (let i = n - 1; i >= 0; i--) belly.push(R[i * 2]!, R[i * 2 + 1]!);
    t.poly(belly).fill(C.glassShade);
    // Ribs seen through the glass.
    for (let i = 1; i < n - 1; i++) {
      const p = pts[i]!;
      t.moveTo(p.x + p.nx * p.w * 0.7, p.y + p.ny * p.w * 0.7)
        .lineTo(p.x - p.nx * p.w * 0.7, p.y - p.ny * p.w * 0.7)
        .stroke({ width: 0.12, color: C.glassDeep, alpha: 0.45 });
    }
    t.poly(outline).stroke({ width: O * 0.7, color: INK, join: 'round' });
    // White, so the rig's tint gives it the water's color; widened to cover the outline.
    if (this.veilOn)
      this.veil.poly(outline).fill(0xffffff).stroke({ width: O, color: 0xffffff, join: 'round' });
    // A long highlight along the upper flank.
    const p0 = pts[0]!;
    t.moveTo(p0.x + p0.nx * p0.w * 0.55, p0.y + p0.ny * p0.w * 0.55);
    for (let i = 1; i < n - 2; i++) {
      const p = pts[i]!;
      t.lineTo(p.x + p.nx * p.w * 0.55, p.y + p.ny * p.w * 0.55);
    }
    t.stroke({ width: 0.16, color: 0xffffff, alpha: 0.75, cap: 'round', join: 'round' });
    // The spine: a zigzag down the middle.
    sp.moveTo(p0.x, p0.y);
    for (let i = 1; i < n; i++) {
      const p = pts[i]!;
      const z = (i % 2 ? 1 : -1) * p.w * 0.22;
      sp.lineTo(p.x + p.nx * z, p.y + p.ny * z);
    }
    sp.stroke({ width: 0.24, color: 0xffffff, cap: 'round', join: 'round' });
  }
}
