import { Container, type Texture } from 'pixi.js';
import { TILE_CELLS, type Enemy, type GameState } from '../../sim';
import type { M4Cue, M4Signals } from '../../app/m4Signals';
import { HULK_FUSE, m4AttackKey } from '../../app/m4Wiring';
import type { Atlas, AtlasEntry } from '../atlas';
import { rand } from '../ailmentBursts';
import { mixRgb } from '../ailmentPalette';
import { ELEMENT, INK, TELEGRAPH as T } from '../combatPalette';
import { FxLayer, ImmediatePool, type FxParticle } from '../particles';
import type { Pen } from '../pen';
import { BESTIARY as B } from './bestiaryPalette';

const TAU = Math.PI * 2;
const W = 0xffffff;

/** Telegraph ring at radius 1: dark halo and a white edge (tinted red-magenta), as TelegraphView's edge. */
function teleRing(p: Pen): void {
  p.circle(0, 0, 1).stroke(0.1, T.edgeDark, 0.5);
  p.circle(0, 0, 1).stroke(0.055, W);
}

/** A forward chevron (points +x), for charge lines. */
function chevron(p: Pen): void {
  p.poly([-0.5, -0.7, 0.35, 0, -0.5, 0.7, -0.15, 0, -0.5, -0.7]).fill(W).stroke(0.08, INK, 0.6);
}

/** A lightning strike from the sky: base at (0, 0), 14 cells tall. */
function strike(p: Pen): void {
  const pts = [0, 0, 0.6, -2.2, -0.4, -4.1, 0.7, -6.3, -0.3, -8.4, 0.5, -10.6, -0.2, -14];
  for (const [w, c, a] of [
    [0.9, ELEMENT.stormGlow, 0.55],
    [0.42, ELEMENT.storm, 1],
    [0.16, W, 1],
  ] as const) {
    p.moveTo(pts[0]!, pts[1]!);
    for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i]!, pts[i + 1]!);
    p.stroke(w, c, a);
  }
}

function tarGlob(p: Pen): void {
  p.circle(0, 0, 1).fill(B.tar.body).stroke(0.2, INK);
  p.ellipse(-0.35, -0.35, 0.35, 0.2).fill({ color: B.tar.sheen, alpha: 0.6 });
}

export function telegraphAccentEntries(): AtlasEntry[] {
  return [
    { name: 'tele_ring', x0: -1.15, y0: -1.15, x1: 1.15, y1: 1.15, draw: teleRing },
    { name: 'chevron', x0: -0.7, y0: -0.85, x1: 0.55, y1: 0.85, draw: chevron },
    { name: 'sky_strike', x0: -1, y0: -14.5, x1: 1.2, y1: 0.5, draw: strike },
    { name: 'tar_glob', x0: -1.2, y0: -1.2, x1: 1.2, y1: 1.2, draw: tarGlob },
  ];
}

/**
 * Telegraph accents for the M4 attacks (CONTENT §5), over TelegraphView's ground shapes and never
 * dimmed (DESIGN §14): the Tar Hulk's fuse circle (a world hazard, so it has its own red-magenta
 * ring), crackle where lightning will land, the tar glob's arc to its marker, frost crystals
 * along the Wisp's line, chevrons along the Warden's charge, embers in his slam and breath, and
 * the braziers glowing before his storm.
 */
export class BeastTelegraphs {
  readonly root = new Container();
  private readonly pool: ImmediatePool;
  private readonly over: ImmediatePool;
  private readonly fx: FxLayer;
  private readonly t: Record<'dot' | 'ring' | 'glow' | 'chevron' | 'strike' | 'glob' | 'crystal' | 'zapA' | 'zapB' | 'shadow', Texture>;
  private time = 0;
  private braziers: Array<{ x: number; y: number }> = [];
  private brazierRoom = '';
  /** A storm windup this frame (brazier glow strength 0–1). */
  private storm = 0;

  constructor(atlas: Atlas) {
    this.pool = new ImmediatePool(atlas.get('dot'), 600);
    this.over = new ImmediatePool(atlas.get('dot'), 200, 'add');
    this.fx = new FxLayer(atlas.get('dot'), 300);
    this.root.addChild(this.pool.container, this.fx.container, this.over.container);
    this.t = {
      dot: atlas.get('dot'),
      ring: atlas.get('tele_ring'),
      glow: atlas.get('glow'),
      chevron: atlas.get('chevron'),
      strike: atlas.get('sky_strike'),
      glob: atlas.get('tar_glob'),
      crystal: atlas.get('frost_crystal'),
      zapA: atlas.get('zap_a'),
      zapB: atlas.get('zap_b'),
      shadow: atlas.get('shadow'),
    };
  }

  reset(): void {
    this.fx.clear();
    this.brazierRoom = '';
  }

  /** One-shots: lightning lands, the storm hits the braziers, a fuse blows. */
  handle(cues: readonly M4Cue[], s: GameState): void {
    for (const c of cues) {
      if (c.type !== 'attackLanded') continue;
      if (c.attack === 'stormStrike') this.bolt(c.x, c.y);
      else if (c.attack === 'brazierStorm') for (const b of this.brazierList(s)) this.bolt(b.x, b.y);
    }
  }

  update(s: GameState, signals: M4Signals, dt: number): void {
    this.time += dt;
    this.fx.update(dt);
    this.pool.begin();
    this.over.begin();
    this.storm = 0;
    for (const e of s.enemies) {
      if (e.dead) continue;
      const fuse = signals.enemy(e.id)?.fuse ?? -1;
      if (fuse >= 0 && fuse <= HULK_FUSE.seconds + 0.1) this.fuse(e, fuse / HULK_FUSE.seconds);
      const a = e.attack;
      if (a.phase !== 'windup') continue;
      const key = m4AttackKey(a.name);
      if (!key) continue;
      const u = this.progress(e);
      if (key === 'stormStrike') this.crackle(a.originX, a.originY, u);
      else if (key === 'tarGlob') this.glob(e, u);
      else if (key === 'wispFrostLine') this.frostLine(e, u);
      else if (key === 'wardenCharge') this.chevrons(e, u);
      else if (key === 'fireSlam' || key === 'fireBreath') this.embers(e, u);
      else if (key === 'brazierStorm') this.storm = Math.max(this.storm, u);
    }
    if (this.storm > 0) this.brazierGlow(s, this.storm);
    this.pool.end();
    this.over.end();
  }

  /** Windup progress from the enemy's own timer (the view's tracked length). */
  private progress(e: Enemy): number {
    const k = e.attack as { timeLeft: number; total?: number };
    const prev = this.totals.get(e.id);
    if (!prev || prev.name !== e.attack.name || k.timeLeft > prev.left) this.totals.set(e.id, { name: e.attack.name, total: k.timeLeft + 1 / 60, left: k.timeLeft });
    const t = this.totals.get(e.id)!;
    t.left = k.timeLeft;
    if (this.totals.size > 256) this.totals.clear();
    return Math.max(0, Math.min(1, 1 - k.timeLeft / t.total));
  }
  private readonly totals = new Map<number, { name: string; total: number; left: number }>();

  private put(pool: ImmediatePool, tex: Texture, x: number, y: number, sx: number, sy: number, tint: number, alpha: number, rot = 0): FxParticle | null {
    const p = pool.next(tex);
    if (!p) return null;
    p.x = x;
    p.y = y;
    p.scaleX = sx;
    p.scaleY = sy;
    p.rotation = rot;
    p.paint(tint, alpha);
    return p;
  }

  /** The fuse: a 6-cell world-hazard circle, filling as the 1.5 s run out, edge pulsing faster. */
  private fuse(e: Enemy, u: number): void {
    const r = HULK_FUSE.radius;
    const hz = 3 + 9 * u * u;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * TAU * hz);
    this.put(this.pool, this.t.dot, e.x, e.y, r, r, mixRgb(T.fill, 0xff7a2f, 0.35), 0.14 + 0.06 * pulse);
    const g = Math.min(1, u) * r;
    this.put(this.pool, this.t.dot, e.x, e.y, g, g, mixRgb(T.fill, 0xff7a2f, 0.5), 0.3 + 0.15 * u);
    this.put(this.pool, this.t.ring, e.x, e.y, r, r, T.edge, u > 0.8 ? 1 : 0.65 + 0.35 * pulse);
  }

  private crackle(x: number, y: number, u: number): void {
    const n = 1 + Math.floor(u * 3);
    for (let i = 0; i < n; i++) {
      if (Math.random() > 0.35 + 0.6 * u) continue;
      const z = this.put(this.over, Math.random() < 0.5 ? this.t.zapA : this.t.zapB, x + rand(-1.6, 1.6), y + rand(-1.2, 1.2), rand(0.6, 1.1), rand(0.6, 1.1), Math.random() < 0.5 ? ELEMENT.storm : ELEMENT.stormGlow, 0.9, rand(0, TAU));
      void z;
    }
    if (u > 0.75 && Math.random() < 0.5) this.put(this.pool, this.t.strike, x, y, 0.5, 1, 0xffffff, 0.25 + 0.4 * (u - 0.75) * 4);
  }

  private bolt(x: number, y: number): void {
    const p = this.fx.spawn(this.t.strike, x, y, 0, 0, 0.18, 0xffffff, 1.1, 1);
    if (p) p.hold = 0.5;
    const g = this.fx.spawn(this.t.glow, x, y, 0, 0, 0.25, ELEMENT.storm, 3, 5);
    if (g) g.a0 = 0.8;
    for (let i = 0; i < 6; i++) {
      const a = rand(0, TAU);
      const s = this.fx.spawn(this.t.zapA, x, y, Math.cos(a) * 8, Math.sin(a) * 8, 0.12, ELEMENT.storm, 1, 0.5);
      if (s) s.rotation = a;
    }
  }

  /** The glob arcs from her hand to its marker; its shadow grows on the marker as it falls. */
  private glob(e: Enemy, u: number): void {
    const a = e.attack;
    const sx = e.x + 3;
    const sy = e.y - 6;
    const x = sx + (a.originX - sx) * u;
    const y = sy + (a.originY - sy) * u - Math.sin(u * Math.PI) * 9;
    this.put(this.pool, this.t.shadow, a.originX, a.originY, 0.6 + 1.6 * u, 0.3 + 0.8 * u, 0xffffff, 0.5 + 0.5 * u);
    this.put(this.pool, this.t.glob, x, y, 0.9, 0.9, 0xffffff, 1, u * 6);
  }

  private frostLine(e: Enemy, u: number): void {
    const s = e.attack.shape;
    if (s.kind !== 'line') return;
    const n = Math.floor(s.length / 1.6);
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const grow = Math.max(0, Math.min(1, u * 1.4 - f * 0.6));
      if (grow <= 0) continue;
      const d = (i + 0.5) * 1.6;
      const side = (i % 2 ? 1 : -1) * s.width * 0.18;
      this.put(this.pool, this.t.crystal, e.attack.originX + s.dirX * d - s.dirY * side, e.attack.originY + s.dirY * d + s.dirX * side, grow * 1.1, grow * 1.1, 0xffffff, 0.95, i * 0.7);
    }
  }

  private chevrons(e: Enemy, u: number): void {
    const s = e.attack.shape;
    if (s.kind !== 'line') return;
    const rot = Math.atan2(s.dirY, s.dirX);
    const step = 3.2;
    const off = (this.time * 9) % step;
    for (let d = off + 1; d < s.length - 0.5; d += step) {
      const fade = Math.min(1, d / 3) * Math.min(1, (s.length - d) / 3);
      this.put(this.pool, this.t.chevron, e.attack.originX + s.dirX * d, e.attack.originY + s.dirY * d, 1.6 + u, 1.6 + u, T.edge, 0.8 * fade, rot);
    }
  }

  private embers(e: Enemy, u: number): void {
    if (Math.random() > 0.5 + u) return;
    const a = e.attack;
    const s = a.shape;
    let x = a.originX;
    let y = a.originY;
    if (s.kind === 'circle') {
      const ang = rand(0, TAU);
      const r = Math.sqrt(Math.random()) * s.r;
      x += Math.cos(ang) * r;
      y += Math.sin(ang) * r;
    } else if (s.kind === 'cone') {
      const d = rand(1, s.r);
      const half = Math.acos(s.halfAngleCos);
      const ang = Math.atan2(s.dirY, s.dirX) + rand(-half, half);
      x += Math.cos(ang) * d;
      y += Math.sin(ang) * d;
    }
    const p = this.fx.spawn(this.t.dot, x, y, rand(-1, 1), -rand(2, 5), rand(0.35, 0.6), Math.random() < 0.5 ? B.cinder_warden.flameOuter : B.cinder_warden.flameInner, 0.35, 0.08);
    if (p) p.hold = 0.3;
  }

  private brazierList(s: GameState): Array<{ x: number; y: number }> {
    const key = `${s.room.id}|${s.objects.length}`;
    if (key === this.brazierRoom) return this.braziers;
    this.brazierRoom = key;
    const list: Array<{ x: number; y: number }> = [];
    const objs = s.objects.filter((o) => o.kind === 'brazier');
    if (objs.length > 0) for (const o of objs) list.push({ x: (o.tx + 0.5) * TILE_CELLS, y: (o.ty + 0.5) * TILE_CELLS });
    else {
      const r = s.room;
      for (let ty = 0; ty < r.tilesH; ty++)
        for (let tx = 0; tx < r.tilesW; tx++)
          if (r.tiles[ty * r.tilesW + tx] === 66) list.push({ x: (tx + 0.5) * TILE_CELLS, y: (ty + 0.5) * TILE_CELLS });
    }
    this.braziers = list;
    return list;
  }

  /** The storm's 1.2 s warning: every brazier glows storm-yellow inside a pulsing danger ring. */
  private brazierGlow(s: GameState, u: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.time * TAU * (4 + 8 * u));
    for (const b of this.brazierList(s)) {
      this.put(this.over, this.t.glow, b.x, b.y - 0.5, 3 + 2.5 * u, 3 + 2.5 * u, ELEMENT.storm, 0.35 + 0.45 * u * pulse);
      this.put(this.pool, this.t.ring, b.x, b.y, 3.2, 3.2, T.edge, u > 0.8 ? 1 : 0.55 + 0.45 * pulse);
      if (Math.random() < 0.3 + 0.6 * u)
        this.put(this.over, Math.random() < 0.5 ? this.t.zapA : this.t.zapB, b.x + rand(-1.2, 1.2), b.y - rand(0.5, 2.5), 0.8, 0.8, ELEMENT.storm, 0.9, rand(0, TAU));
    }
  }
}
