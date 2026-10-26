import { Container, Sprite } from 'pixi.js';
import type { CoilMode } from '../../sim/actors/bossStateFen';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import { mixRgb } from '../ailmentPalette';
import { ELEMENT } from '../combatPalette';
import { smoothstep } from '../mathx';
import { BeastRig, type BeastCtx } from './beastRig';
import { FEN_BOSS as P, FEN_BOSS_FEEL as F } from './fenBossPalette';
import { ease, glowSprite, splash, StunStars } from './fenRigParts';
import { CoilTrail } from './coilTrail';
import { CoilBody, type BodyPoint } from './coilBody';

const TAU = Math.PI * 2;
const C = P.glasswater_coil;

/**
 * The Glasswater Coil (DESIGN §10.5): a glass eel whose head is its sim body (the hit circle);
 * the trailing body is drawn only, segments laid along the path the head swam (CoilTrail). Its
 * states read at a glance:
 * - submerged: a dark shape under the water, ripples along it, only the eye lit;
 * - surfaced and exposed: clear glass with a pale lightning spine, splashing as it breaks water;
 * - stranded: grey and drying, thrashing hard on the stone;
 * - iced: frosted white and still; overloaded: crackling, the spine flickering, stars.
 * Before a pulse its eye (Eye pulse) or its whole spine (Body pulse) brightens.
 */
export class CoilRig extends BeastRig {
  private readonly trail: CoilTrail;
  private readonly tube = new CoilBody();
  private readonly pts: BodyPoint[];
  private readonly tail: Sprite;
  private readonly eye: Sprite;
  private readonly eyeGlow: Sprite;
  private readonly mouthGlow: Sprite;
  private readonly bodyGlow: Sprite;
  private readonly stars: StunStars;
  private readonly back = new Container();
  private sub = 1;
  private wave = 0;
  private mode: CoilMode = 'submerged';
  private glowT = 0;
  private glowTotal = 1;
  private wasGlowing = false;

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    root.addChildAt(this.back, 0);
    this.bodyGlow = glowSprite(atlas, this.back, C.glow);
    this.tail = new Sprite(atlas.get('coil_tail'));
    this.back.addChild(this.tail, this.tube.root);
    const n = F.coilSegments;
    this.pts = Array.from({ length: n + 1 }, () => ({ x: 0, y: 0, nx: 0, ny: 1, w: 1 }));
    this.trail = new CoilTrail(n, F.coilSpacing);
    this.mouthGlow = glowSprite(atlas, lift, C.glow, false);
    this.eyeGlow = glowSprite(atlas, lift, C.glow, false);
    this.eye = this.sprite('coil_eye', lift);
    lift.setChildIndex(this.flash, lift.children.length - 1);
    this.stars = new StunStars(atlas, lift);
  }

  override reset(): void {
    this.trail.clear();
    this.sub = 1;
    this.wave = 0;
    this.mode = 'submerged';
    this.glowT = 0;
    this.wasGlowing = false;
  }

  update(c: BeastCtx): void {
    const f = c.e.boss?.fen ?? null;
    const mode: CoilMode = f?.coil ?? 'surfaced';
    if (mode !== this.mode) this.changed(c, this.mode, mode);
    this.mode = mode;
    const under = mode === 'submerged';
    this.sub = ease(this.sub, under ? 1 : 0, c.dt, under ? 0.35 : 0.12);
    const stranded = mode === 'stranded';
    const still = mode === 'iced';
    const thrashing = stranded || mode === 'overloaded' || (c.attack === 'tailThrash' && c.phase !== 'none');
    const hz = thrashing ? F.thrashHz : F.coilWaveHz * (0.6 + 0.8 * c.run);
    if (!still) this.wave += c.dt * TAU * hz;
    const amp = thrashing ? F.thrashAmp : F.coilWaveAmp * (0.4 + 0.6 * c.run);
    this.trail.update(c.x, c.y, c.cx, c.cy);
    const glow = this.glow(c, f?.pulseGlowing ?? false, f?.pulseLeft ?? 0);
    const body = (c.e.boss?.phase ?? 1) >= 3;
    this.layBody(c, amp, glow * (body ? 1 : 0.35));
    this.head(c, glow * (body ? 0.6 : 1));
    this.ambient(c, mode);
    this.stars.update(mode === 'overloaded' || (c.e.terrain.stunLeft > 0 && !stranded), c.t, 0, -2.4, 1.3);
  }

  /** Glow progress 0–1 of a pulse windup (eye or body), from the sim's pulse timer. */
  private glow(c: BeastCtx, on: boolean, left: number): number {
    if (on && !this.wasGlowing) {
      this.glowTotal = Math.max(0.1, left);
      this.glowT = 0;
    }
    this.wasGlowing = on;
    if (!on) return 0;
    this.glowT += c.dt;
    return 0.35 + 0.65 * smoothstep(0, 1, Math.min(1, this.glowT / this.glowTotal));
  }

  private tint(base: number): number {
    switch (this.mode) {
      case 'stranded':
        return mixRgb(base, C.stranded, 0.45);
      case 'iced':
        return C.iced;
      case 'overloaded':
        return Math.random() < 0.3 ? 0xffffff : base;
      default:
        return mixRgb(base, C.deep, 0.75 * this.sub);
    }
  }

  /** The tube and tail along the trail, with the swim (or thrash) wave across it. */
  private layBody(c: BeastCtx, amp: number, glow: number): void {
    const s = c.scale;
    const n = this.pts.length;
    const alpha = 1 - (1 - F.submergedAlpha) * this.sub;
    const flash = this.flash.alpha;
    const tint = this.tint(0xffffff);
    // The neck starts under the head's center.
    const h = this.pts[0]!;
    h.x = 0;
    h.y = 0;
    h.nx = -c.cy;
    h.ny = c.cx;
    h.w = F.coilNeck;
    let gx = 0;
    let gy = 0;
    for (let i = 1; i < n; i++) {
      const p = this.trail.at(i - 1);
      const u = i / (n - 1);
      const off = Math.sin(this.wave - i * 0.6) * amp * (0.25 + 0.75 * u);
      const wx = p.x - p.dy * off;
      const wy = p.y + p.dx * off;
      const q = this.pts[i]!;
      q.x = (wx - c.x) / s;
      q.y = (wy - c.y) / s;
      q.nx = -p.dy;
      q.ny = p.dx;
      q.w = F.coilNeck * (1 - (1 - F.coilTailWidth) * u * u);
      if (i === Math.floor(n / 3)) {
        gx = q.x;
        gy = q.y;
      }
      const r = q.w * s;
      if (glow > 0.5 && c.fx.take(5 * glow, c.dt)) this.zap(c, wx, wy, r, ELEMENT.storm);
      if (this.mode === 'overloaded' && c.fx.take(6, c.dt)) this.zap(c, wx, wy, r, ELEMENT.stormGlow);
    }
    // Smooth the normals so the tube doesn't pinch where the path bends.
    for (let i = 1; i < n - 1; i++) {
      const a = this.pts[i - 1]!;
      const b = this.pts[i + 1]!;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const l = Math.hypot(dx, dy) || 1;
      this.pts[i]!.nx = -dy / l;
      this.pts[i]!.ny = dx / l;
    }
    this.tube.draw(this.pts);
    this.tube.tube.tint = flash > 0.05 ? mixRgb(tint, 0xffffff, flash) : tint;
    this.tube.root.alpha = alpha;
    const flick = this.mode === 'overloaded' ? 0.4 + 0.6 * Math.random() : 1;
    this.tube.spine.tint = mixRgb(C.spine, C.spineHot, glow);
    this.tube.spine.alpha = (0.45 + 0.55 * glow) * flick * (this.mode === 'stranded' ? 0.4 : 1);
    const last = this.pts[n - 1]!;
    this.tail.position.set(last.x, last.y);
    this.tail.rotation = Math.atan2(-last.nx, last.ny) + Math.sin(this.wave - n * 0.6) * 0.35;
    this.tail.alpha = alpha;
    this.tail.tint = tint;
    // The body pulse's glow along the whole body.
    this.bodyGlow.position.set(gx, gy);
    this.bodyGlow.scale.set(14 / s, 10 / s);
    this.bodyGlow.alpha = glow * 0.5 * (0.85 + 0.15 * Math.sin(c.t * 25));
  }

  private head(c: BeastCtx, eyeGlow: number): void {
    const a = Math.atan2(c.cy, c.cx);
    // Stranded, the head whips side to side with the thrash.
    const lean = this.mode === 'stranded' ? Math.sin(this.wave * 1.3) * 0.45 : 0;
    this.body.rotation = this.flash.rotation = a + lean;
    const alpha = 1 - (1 - F.submergedAlpha) * this.sub;
    this.body.alpha = alpha;
    this.body.tint = this.tint(0xffffff);
    this.flash.alpha *= alpha;
    // Pulled back through the lunge's windup, raised to call the pylons.
    const w = c.phase === 'windup' ? smoothstep(0, 1, c.wind) : 0;
    if (c.attack === 'coilLunge') this.lift.position.x -= c.cx * 0.6 * w;
    if (c.attack === 'callPylons' || c.attack === 'coilDive') this.lift.position.y -= (c.attack === 'callPylons' ? 0.8 : -0.4) * w;
    const ex = Math.cos(a + lean) * 0.55;
    const ey = Math.sin(a + lean) * 0.55;
    this.eye.position.set(ex, ey);
    this.eye.alpha = Math.max(alpha, 0.85);
    this.eye.tint = this.mode === 'iced' ? C.iced : this.mode === 'stranded' ? 0xd8d0b0 : 0xffffff;
    const call = c.attack === 'callPylons' && c.phase !== 'none' ? 1 : 0;
    const g = Math.max(eyeGlow, 0.25 * this.sub, call, c.attack === 'coilLunge' ? 0.4 * w : 0);
    this.eyeGlow.position.set(ex, ey);
    this.eyeGlow.scale.set(1.2 + 2.6 * g);
    this.eyeGlow.alpha = 0.25 + 0.6 * g * (0.8 + 0.2 * Math.sin(c.t * 30));
    // The spit: the mouth glows.
    const spit = c.attack === 'glassSpit' && c.phase === 'windup' ? w : 0;
    this.mouthGlow.tint = mixRgb(C.glassLight, C.glow, 0.5);
    this.mouthGlow.position.set(Math.cos(a) * 2.4, Math.sin(a) * 2.4);
    this.mouthGlow.scale.set(0.8 + 1.6 * spit);
    this.mouthGlow.alpha = 0.9 * spit;
    if (c.shadow) c.shadow.fade(0.35 + 0.65 * (1 - this.sub * 0.4));
  }

  /** Ripples while submerged, drips and droplets out of water, frost glints, dust when stranded. */
  private ambient(c: BeastCtx, mode: CoilMode): void {
    const fx = c.fx;
    if (this.sub > 0.5 && fx.take(F.rippleRate, c.dt)) {
      const p = this.trail.at(Math.floor(rand(0, F.coilSegments)));
      fx.ripple(p.x, p.y, 1.2, 4.5, 1.1, C.ripple, 0.55);
    }
    if (this.sub > 0.5 && c.run > 0.3 && fx.take(6, c.dt))
      fx.ripple(c.x + c.cx * 3, c.y + c.cy * 3, 1.5, 5, 0.7, C.ripple, 0.7);
    if (mode === 'stranded' && fx.take(10, c.dt)) {
      const p = this.trail.at(Math.floor(rand(0, F.coilSegments)));
      const d = fx.spawn(fx.body, fx.tex.dot, p.x, p.y, rand(-5, 5), -rand(4, 8), rand(0.3, 0.5), C.ripple, 0.3, 0.1);
      if (d) d.grav = 26;
    }
    if (mode === 'iced' && fx.take(14, c.dt)) {
      // Frost glints all along the frozen body.
      const p = this.trail.at(Math.floor(rand(0, F.coilSegments)));
      const g = fx.spawn(fx.add, fx.tex.star, p.x + rand(-1.5, 1.5), p.y + rand(-1.5, 1.5), 0, 0, 0.5, 0xffffff, 0.7, 0.1);
      if (g) g.rotation = rand(0, TAU);
    }
  }

  private zap(c: BeastCtx, x: number, y: number, r: number, tint: number): void {
    const z = c.fx.spawn(
      c.fx.add,
      Math.random() < 0.5 ? c.fx.tex.zapA : c.fx.tex.zapB,
      x + rand(-r, r) * 0.6,
      y + rand(-r, r) * 0.6,
      0,
      0,
      0.09,
      tint,
      rand(0.7, 1.2),
      rand(0.7, 1.2),
    );
    if (z) z.rotation = rand(0, TAU);
  }

  /** Breaking the surface splashes; diving leaves a ring; stranding a slap of droplets. */
  private changed(c: BeastCtx, from: CoilMode, to: CoilMode): void {
    if (from === 'submerged' && to !== 'submerged') splash(c, c.x, c.y, 12, C.ripple, 7);
    else if (to === 'submerged') c.fx.ripple(c.x, c.y, 2, 9, 0.8, C.ripple, 0.9);
    if (to === 'stranded') splash(c, c.x, c.y, 10, C.ripple, 0);
  }

  override die(): void {
    this.eyeGlow.alpha = this.mouthGlow.alpha = this.bodyGlow.alpha = 0;
    this.back.visible = true;
  }
}
