import type { Texture } from 'pixi.js';
import { mixRgb } from '../ailmentPalette';
import type { Atlas } from '../atlas';
import { INK } from '../combatPalette';
import type { ImmediatePool } from '../particles';
import { glyphName } from './formShapes';

/** Short-lived spell effects that need more than a free particle: they animate a shape. */
export type ShotKind = 'beam' | 'chain' | 'swath' | 'glyph' | 'mote';

export interface Shot {
  kind: ShotKind;
  /** Seconds alive and total. */
  t: number;
  life: number;
  /** Start point and end point (beam, chain), or origin and unit direction (swath: x2, y2 = dir). */
  x: number;
  y: number;
  x2: number;
  y2: number;
  /** Width (beam, swath) or length (swath). */
  w: number;
  len: number;
  rim: number;
  core: number;
  glow: number;
  /** Alpha multiplier (Echo repeats are fainter). */
  alpha: number;
  /** Storm: drawn as jagged arcs re-rolled every frame. */
  crackle: boolean;
  tex: Texture | null;
}

/** Where the shots draw: `ground` under the bodies, `air` above them, `airAdd` additive above them. */
export interface ShotPools {
  ground: ImmediatePool;
  air: ImmediatePool;
  airAdd: ImmediatePool;
}

const SWATH_GROW = 0.09;

/**
 * Pooled one-shot spell effects (beam flashes, chain arcs, swath sweeps, trigger glyphs, mana
 * motes), redrawn each frame into immediate particle pools. No per-frame allocation.
 */
export class OneShots {
  private readonly live: Shot[] = [];
  private readonly free: Shot[] = [];
  private readonly t: Record<'line' | 'elongGlow' | 'zapA' | 'zapB' | 'strip' | 'glow' | 'dot', Texture>;

  constructor(private readonly atlas: Atlas) {
    this.t = {
      line: atlas.get('line'),
      elongGlow: atlas.get('elong_glow'),
      zapA: atlas.get('zap_a'),
      zapB: atlas.get('zap_b'),
      strip: atlas.get('swath_strip'),
      glow: atlas.get('glow'),
      dot: atlas.get('dot'),
    };
  }

  get count(): number {
    return this.live.length;
  }

  clear(): void {
    for (const s of this.live) this.free.push(s);
    this.live.length = 0;
  }

  /** A new shot with neutral fields; the caller fills in what its kind uses. */
  add(kind: ShotKind, life: number, x: number, y: number): Shot {
    const s: Shot = this.free.pop() ?? {
      kind,
      t: 0,
      life,
      x,
      y,
      x2: 0,
      y2: 0,
      w: 1,
      len: 0,
      rim: 0xffffff,
      core: 0xffffff,
      glow: 0xffffff,
      alpha: 1,
      crackle: false,
      tex: null,
    };
    s.kind = kind;
    s.t = 0;
    s.life = life;
    s.x = s.x2 = x;
    s.y = s.y2 = y;
    s.w = 1;
    s.len = 0;
    s.alpha = 1;
    s.crackle = false;
    s.tex = null;
    this.live.push(s);
    return s;
  }

  glyph(trigger: string, x: number, y: number, tint: number): void {
    const s = this.add('glyph', 0.5, x, y);
    s.tex = this.atlas.get(glyphName(trigger));
    s.core = tint;
  }

  /** Advances and draws every shot. (px, py): where mana motes fly to (the player). */
  update(dt: number, P: ShotPools, px: number, py: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const s = this.live[i]!;
      s.t += dt;
      if (s.t >= s.life) {
        this.live[i] = this.live[this.live.length - 1]!;
        this.live.pop();
        this.free.push(s);
        continue;
      }
      if (s.kind === 'beam' || s.kind === 'chain') this.line(s, P);
      else if (s.kind === 'swath') this.swath(s, P);
      else if (s.kind === 'glyph') this.drawGlyph(s, P);
      else this.mote(s, P, px, py);
    }
  }

  private line(s: Shot, P: ShotPools): void {
    const dx = s.x2 - s.x;
    const dy = s.y2 - s.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-3) return;
    const ang = Math.atan2(dy, dx);
    const u = s.t / s.life;
    const a = (1 - u) ** 1.5 * s.alpha;
    const T = this.t;
    const g = P.air.next(T.elongGlow);
    if (g) {
      g.x = s.x + dx / 2;
      g.y = s.y + dy / 2;
      g.rotation = ang;
      g.scaleX = len / 2 + s.w;
      g.scaleY = (s.w * 2.4) / 0.7;
      g.paint(s.glow, 0.45 * a);
    }
    if (s.crackle) {
      // Jagged arcs along the line, re-rolled every frame.
      const n = Math.max(1, Math.round(len / 4));
      for (let k = 0; k < n; k++) {
        const z = P.air.next(k % 2 ? T.zapB : T.zapA);
        if (!z) return;
        const m = (k + 0.5) / n;
        z.x = s.x + dx * m;
        z.y = s.y + dy * m;
        z.rotation = ang + (Math.random() - 0.5) * 0.5;
        z.scaleX = (len / n / 2) * 1.15;
        z.scaleY = (0.6 + s.w * 0.5) * (Math.random() < 0.5 ? -1 : 1);
        z.paint(0xffffff, a);
      }
      return;
    }
    const thin = 1 - 0.5 * u;
    for (const [c, k, al] of [
      [s.rim, 0.8, 0.85],
      [s.core, 0.32, 1],
    ] as const) {
      const p = P.air.next(T.line);
      if (!p) return;
      p.x = s.x;
      p.y = s.y;
      p.rotation = ang;
      p.scaleX = len;
      p.scaleY = ((s.w * k) / 0.14) * thin;
      p.paint(c, al * a);
    }
  }

  private swath(s: Shot, P: ShotPools): void {
    const grow = Math.min(1, s.t / SWATH_GROW);
    const fade = s.t < SWATH_GROW ? 1 : 1 - (s.t - SWATH_GROW) / (s.life - SWATH_GROW);
    const a = fade ** 1.2 * s.alpha;
    const ang = Math.atan2(s.y2, s.x2);
    const T = this.t;
    for (const [c, k, al] of [
      [s.rim, 1, 0.8],
      [s.core, 0.45, 0.9],
    ] as const) {
      const p = P.ground.next(T.strip);
      if (!p) return;
      p.x = s.x;
      p.y = s.y;
      p.rotation = ang;
      p.scaleX = s.len * grow;
      p.scaleY = s.w * k;
      p.paint(c, al * a);
    }
    // Darker edges give the strip a shape on light ground (frost on sand is pale).
    const edge = mixRgb(s.rim, INK, 0.45);
    for (const side of [-0.5, 0.5]) {
      const p = P.ground.next(T.line);
      if (!p) return;
      p.x = s.x - s.y2 * s.w * side;
      p.y = s.y + s.x2 * s.w * side;
      p.rotation = ang;
      p.scaleX = s.len * grow;
      p.scaleY = 1.4;
      p.paint(edge, 0.55 * a);
    }
    // The sweeping front edge.
    const e = P.air.next(T.elongGlow);
    if (e) {
      e.x = s.x + s.x2 * s.len * grow;
      e.y = s.y + s.y2 * s.len * grow;
      e.rotation = ang + Math.PI / 2;
      e.scaleX = s.w * 0.6;
      e.scaleY = 1.6;
      e.paint(s.core, a * (grow < 1 ? 1 : 0.5));
    }
  }

  private drawGlyph(s: Shot, P: ShotPools): void {
    const u = s.t / s.life;
    const p = P.air.next(s.tex!);
    if (!p) return;
    const pop = 1 - (1 - Math.min(1, u * 4)) ** 2;
    p.x = s.x;
    p.y = s.y - 0.6 * u;
    p.scaleX = p.scaleY = 0.9 + 0.5 * pop;
    p.paint(s.core, u < 0.5 ? 1 : (1 - u) / 0.5);
  }

  private mote(s: Shot, P: ShotPools, px: number, py: number): void {
    // Flies from the hit point into the player along a little arc, speeding up.
    const u = s.t / s.life;
    const k = u * u;
    const dx = px - s.x;
    const dy = py - 0.8 - s.y;
    const arc = Math.sin(Math.PI * u) * 1.8;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const x = s.x + dx * k - (dy / len) * arc;
    const y = s.y + dy * k + (dx / len) * arc;
    // Normal blend: an additive blue bleaches to white on light ground.
    const g = P.air.next(this.t.glow);
    if (g) {
      g.x = x;
      g.y = y;
      g.scaleX = g.scaleY = 1.2;
      g.paint(s.glow, 0.6);
    }
    const c = P.air.next(this.t.dot);
    if (c) {
      c.x = x;
      c.y = y;
      c.scaleX = c.scaleY = 0.36;
      c.paint(s.core, 1);
    }
  }
}
