import type { Texture } from 'pixi.js';
import type { Enemy, GameState } from '../../sim';
import type { M4Cue } from '../../app/m4Signals';
import type { M4AttackKey } from '../../app/m4Wiring';
import type { Atlas, AtlasEntry } from '../atlas';
import { ELEMENT, INK, TELEGRAPH as T } from '../combatPalette';
import type { Pen } from '../pen';
import { ATMO } from '../terrain/regionLook';
import { BeastTelegraphs } from './beastTelegraphs';
import { FEN_BEAST as B } from './fenBeastPalette';

/**
 * Telegraph accents of the Fen attacks (CONTENT §5), over the ground telegraphs and never dimmed
 * (DESIGN §14): the Glasspike's leap arc and, while it flies, the circle it lands in; the Spark
 * Heron's strike marker (a ring closing on the target water, crackle, the bolt) and its spit's
 * arc to the landing marker; embers in the Slagshell's slam; chevrons down the Mirebull's charge
 * line; pale wind chevrons blowing through the Bellows Toad's croak cone.
 */
const TAU = Math.PI * 2;

function waterGlob(p: Pen): void {
  p.circle(0, 0, 1).fill(0xcfeef2).stroke(0.2, INK);
  p.ellipse(-0.35, -0.35, 0.35, 0.2).fill({ color: 0xffffff, alpha: 0.85 });
}

export function fenTelegraphEntries(): AtlasEntry[] {
  return [{ name: 'water_glob', x0: -1.2, y0: -1.2, x1: 1.2, y1: 1.2, draw: waterGlob }];
}

export class FenTelegraphs extends BeastTelegraphs {
  private readonly globTex: Texture;

  constructor(atlas: Atlas) {
    super(atlas);
    this.globTex = atlas.get('water_glob');
  }

  override handle(cues: readonly M4Cue[], s: GameState): void {
    super.handle(cues, s);
    for (const c of cues) if (c.type === 'attackLanded' && c.attack === 'heronBeak') this.bolt(c.x, c.y);
  }

  protected override accent(e: Enemy, key: M4AttackKey, u: number): boolean {
    switch (key) {
      case 'pikeLeap':
        this.leapArc(e.x, e.y, e.attack.originX, e.attack.originY, u, u);
        return true;
      case 'heronBeak':
        this.strikeMarker(e.attack.originX, e.attack.originY, u);
        return true;
      case 'puddleSpit':
        this.spit(e, u);
        return true;
      case 'slagSlam':
        this.embers(e, u);
        return true;
      case 'bullCharge':
        this.chevrons(e, u);
        return true;
      case 'toadCroak':
        this.croak(e, u);
        return true;
      default:
        return false;
    }
  }

  /** A Glasspike in the air: its landing circle stays marked until it touches down. */
  protected override ongoing(s: GameState): void {
    for (const e of s.enemies) {
      const sp = e.special;
      if (e.dead || sp.leapLeft <= 0 || sp.leapTime <= 0) continue;
      const u = 1 - sp.leapLeft / sp.leapTime;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * TAU * 8);
      this.put(this.pool, this.t.dot, sp.leapToX, sp.leapToY, 3, 3, T.fill, 0.18 + 0.12 * u);
      this.put(this.pool, this.t.ring, sp.leapToX, sp.leapToY, 3, 3, T.edge, 0.7 + 0.3 * pulse);
      this.put(
        this.pool,
        this.t.shadow,
        sp.leapToX,
        sp.leapToY,
        0.6 + 1.2 * u,
        0.3 + 0.6 * u,
        0xffffff,
        0.4 + 0.5 * u,
      );
    }
  }

  /** Dots along the leap's arc from the pike to its landing circle, drawn in as the flash builds. */
  private leapArc(x0: number, y0: number, x1: number, y1: number, u: number, reveal: number): void {
    const n = 9;
    for (let i = 1; i < n; i++) {
      const f = i / n;
      if (f > reveal * 1.2) break;
      const x = x0 + (x1 - x0) * f;
      const y = y0 + (y1 - y0) * f - Math.sin(Math.PI * f) * 4;
      this.put(this.pool, this.t.dot, x, y, 0.32, 0.32, INK, 0.45 * u);
      this.put(this.pool, this.t.dot, x, y, 0.2, 0.2, T.edge, 0.9 * u);
    }
    this.put(this.over, this.t.glow, x0, y0 - 0.4, 1.5 + 2 * u, 1.5 + 2 * u, B.glasspike.glint, 0.5 * u);
  }

  /** The Heron's strike: a ring closing on the target water, crackle, the bolt's ghost near the end. */
  private strikeMarker(x: number, y: number, u: number): void {
    const r = 4.2 - 1.6 * u;
    this.put(this.pool, this.t.ring, x, y, r, r * 0.95, ELEMENT.storm, 0.5 + 0.5 * u);
    this.put(this.over, this.t.glow, x, y, 2 + 2 * u, 2 + 2 * u, ELEMENT.stormGlow, 0.25 + 0.35 * u);
    this.crackle(x, y, u);
  }

  /** The spit: a water glob arcing from the beak to its marker, its shadow growing there. */
  private spit(e: Enemy, u: number): void {
    const a = e.attack;
    const side = a.originX >= e.x ? 1 : -1;
    const sx = e.x + side * 2.2;
    const sy = e.y - 4;
    const x = sx + (a.originX - sx) * u;
    const y = sy + (a.originY - sy) * u - Math.sin(u * Math.PI) * 6;
    this.put(
      this.pool,
      this.t.shadow,
      a.originX,
      a.originY,
      0.5 + 1.3 * u,
      0.25 + 0.65 * u,
      0xffffff,
      0.45 + 0.5 * u,
    );
    this.put(this.pool, this.globTex, x, y, 0.7, 0.7, 0xffffff, 1, u * 4);
  }

  /** The croak's cone: pale wind chevrons blowing outward, faster as the toad swells. */
  private croak(e: Enemy, u: number): void {
    const s = e.attack.shape;
    if (s.kind !== 'cone') return;
    const half = Math.acos(s.halfAngleCos);
    const base = Math.atan2(s.dirY, s.dirX);
    const step = 3.5;
    const off = (this.time * (6 + 10 * u)) % step;
    for (const da of [-0.6, 0, 0.6]) {
      const ang = base + da * half;
      for (let d = off + 2; d < s.r - 0.5; d += step) {
        const fade = Math.min(1, d / 3) * Math.min(1, (s.r - d) / 3) * (0.4 + 0.6 * u);
        this.put(
          this.pool,
          this.t.chevron,
          e.attack.originX + Math.cos(ang) * d,
          e.attack.originY + Math.sin(ang) * d,
          1.3,
          1.3,
          ATMO.gale,
          0.9 * fade,
          ang,
        );
      }
    }
  }
}
