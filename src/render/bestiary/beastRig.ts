import { Container, Sprite } from 'pixi.js';
import type { AttackPhase, Enemy } from '../../sim';
import type { Tuning } from '../../../data/tuning';
import type { EnemySignal } from '../../app/m4Signals';
import { M4_STATE, type M4AttackKey } from '../../app/m4Wiring';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import { ELEMENT, TELEGRAPH } from '../combatPalette';
import { mixRgb } from '../ailmentPalette';
import { clamp, smoothstep } from '../mathx';
import type { FxParticle } from '../particles';
import type { BeastFx } from './beastFx';
import { BEAST_FEEL as F, BESTIARY as B, type M4Kind } from './bestiaryPalette';

/** What a beast rig reads each frame (filled by EnemyView, reused). */
export interface BeastCtx {
  e: Enemy;
  sig: EnemySignal | undefined;
  /** View time (slowed by chill, stopped by freeze) and frame dt. */
  t: number;
  dt: number;
  /** Windup progress 0–1 of the current attack (0 when not winding up). */
  wind: number;
  attack: M4AttackKey | undefined;
  phase: AttackPhase;
  /** 0–1 share of top speed, and the unit facing. */
  run: number;
  cx: number;
  cy: number;
  velX: number;
  velY: number;
  /** Root position (cells). */
  x: number;
  y: number;
  /** Feet height of the lift (cells, in art units). */
  foot: number;
  /** Art scale (sim radius ÷ art radius). */
  scale: number;
  shadow: FxParticle | null;
  glow: FxParticle | null;
  fx: BeastFx;
  /** The live tuning (render-feel sections such as bossReadout). */
  tuning: Tuning;
}

/** Kind-specific parts and poses over EnemyView's shared bob, flash and squash. */
export abstract class BeastRig {
  constructor(
    protected readonly atlas: Atlas,
    protected readonly root: Container,
    protected readonly lift: Container,
    protected readonly body: Sprite,
    protected readonly flash: Sprite,
  ) {}

  protected sprite(name: string, parent: Container, x = 0, y = 0): Sprite {
    const s = new Sprite(this.atlas.get(name));
    s.position.set(x, y);
    parent.addChild(s);
    return s;
  }

  /** Fresh state for a newly bound enemy. */
  reset(): void {}
  /** Adjusts parts after EnemyView's shared animation. */
  abstract update(c: BeastCtx): void;
  /** The enemy died (body topples; hide transient parts). */
  die(): void {}
}

// ---- Bog Lurker ---------------------------------------------------------------------------

export class LurkerRig extends BeastRig {
  private readonly eyes: Sprite;
  private readonly jaw: Sprite;
  private surf = 0;
  private wasTell = false;

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    this.eyes = this.sprite('bog_lurker_eyes', root, 0, -0.1);
    this.jaw = this.sprite('bog_lurker_jaw', lift, 0, 0.55);
    this.jaw.visible = false;
  }

  override reset(): void {
    this.surf = 0;
  }

  update(c: BeastCtx): void {
    const tell = c.phase === 'windup';
    const target = M4_STATE.lurkerSubmerged(c.e) ? (tell ? 0.12 * c.wind : 0) : 1;
    const rate = target > this.surf ? 1 / F.lurkerRise : 1 / F.lurkerSink;
    this.surf += clamp(target - this.surf, -rate * c.dt, rate * c.dt);
    const s = this.surf;
    // Sinks below the waterline: the body slides down and fades, the eyes stay.
    this.lift.position.y += (1 - s) * 1.1;
    this.body.alpha = smoothstep(0.05, 0.6, s);
    this.flash.alpha *= this.body.alpha;
    const bob = Math.sin(c.t * 2.3) * 0.06;
    this.eyes.alpha = 1 - smoothstep(0.3, 0.8, s);
    this.eyes.position.set(c.cx * 0.25, -0.15 + bob - (tell ? 0.25 * c.wind : 0));
    this.jaw.visible = c.phase === 'active' || c.phase === 'recover';
    if (c.shadow) c.shadow.fade(0.15 + 0.85 * s);
    const fx = c.fx;
    // Ripples: lazy rings while lurking, fast tight rings plus bubbles in the 1.2 s telegraph.
    const ry = c.y + 0.3 * c.scale;
    if (tell) {
      if (!this.wasTell) fx.ripple(c.x, ry, 1.2 * c.scale, 5 * c.scale, 0.5, TELEGRAPH.edge, 1);
      if (Math.random() < F.rippleTell * c.dt) {
        const tint = mixRgb(B.bog_lurker.ripple, TELEGRAPH.edge, 0.35 + 0.45 * c.wind);
        fx.ripple(c.x, ry, 0.8 * c.scale, (3 + 2 * c.wind) * c.scale, 0.55, tint, 1);
      }
      if (Math.random() < 10 * c.dt) {
        const b = fx.spawn(
          fx.threat,
          fx.tex.dot,
          c.x + rand(-1.4, 1.4) * c.scale,
          ry + rand(-0.5, 0.5),
          0,
          -rand(1, 2),
          rand(0.25, 0.4),
          B.bog_lurker.bubble,
          0.2,
          0.32,
        );
        if (b) b.aspect = 0.9;
      }
    } else if (s < 0.5 && fx.take(F.rippleIdle, c.dt)) {
      fx.ripple(c.x, ry, 0.9 * c.scale, 3 * c.scale, 1.1, B.bog_lurker.ripple, 0.55);
    }
    if (this.wasTell && !tell && s > 0.5) {
      // Burst out of the water.
      for (let i = 0; i < 8; i++) {
        const a = rand(0, Math.PI * 2);
        const p = fx.spawn(
          fx.body,
          fx.tex.dot,
          c.x,
          ry,
          Math.cos(a) * rand(4, 9),
          Math.sin(a) * rand(2, 5) - 4,
          rand(0.3, 0.5),
          0xd8f4ff,
          0.3,
          0.12,
        );
        if (p) p.grav = 26;
      }
      fx.ripple(c.x, ry, 1.5 * c.scale, 6 * c.scale, 0.4, B.bog_lurker.ripple, 0.9);
    }
    this.wasTell = tell;
  }

  override die(): void {
    this.eyes.alpha = 0;
  }
}

// ---- Frost Wisp -----------------------------------------------------------------------------

export class WispRig extends BeastRig {
  private readonly tail: Sprite;
  private readonly eyes: Sprite;
  private readonly halo: Sprite;

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    this.halo = new Sprite(atlas.get('glow'));
    this.halo.tint = B.frost_wisp.glow;
    this.halo.alpha = 0.35;
    this.halo.scale.set(2.2);
    this.halo.position.set(0, -0.7);
    lift.addChildAt(this.halo, 0);
    this.tail = new Sprite(atlas.get('frost_wisp_tail'));
    this.tail.position.set(0, 0.75);
    lift.addChildAt(this.tail, 1);
    this.eyes = this.sprite('frost_wisp_eyes', lift, 0, -0.25);
  }

  update(c: BeastCtx): void {
    // Floats: hover over the shadow (which stays on the ground) with a slow bob.
    const bob = Math.sin(c.t * Math.PI * 2 * F.wispBobHz) * F.wispBob;
    const hover = F.wispHover + bob - c.wind * 0.3;
    this.lift.position.y = c.foot - hover;
    if (c.shadow) {
      const k = 1 - bob * 0.3;
      c.shadow.scaleX *= k;
      c.shadow.scaleY *= k;
      c.shadow.fade(0.75);
    }
    this.tail.rotation = clamp(-c.velX * 0.03, -0.5, 0.5) + Math.sin(c.t * 3.1) * 0.12;
    this.tail.scale.set(1, 1 + 0.12 * Math.sin(c.t * 4.3));
    this.eyes.position.set(c.cx * 0.3, -0.28 + c.cy * 0.18);
    this.eyes.alpha = smoothstep(-0.95, -0.4, c.cy);
    // Winding up a bolt or the frost line: the halo brightens and the crown flares.
    this.halo.alpha = 0.3 + 0.5 * c.wind + 0.05 * Math.sin(c.t * 5);
    this.halo.scale.set(2.2 + c.wind * 0.9);
    const fx = c.fx;
    if (fx.take(2 + c.wind * 14, c.dt)) {
      const p = fx.spawn(
        fx.body,
        fx.tex.dot,
        c.x + rand(-1, 1) * c.scale,
        c.y - hover - rand(0, 2) * c.scale,
        rand(-1, 1),
        rand(0.5, 2),
        rand(0.4, 0.8),
        0xeaf4ff,
        0.16,
        0.04,
      );
      if (p) p.drag = 1;
    }
  }
}

// ---- Stormcaller ------------------------------------------------------------------------------

export class CallerRig extends BeastRig {
  private readonly face: Sprite;
  private readonly staff = new Container();
  private readonly zaps: Sprite[] = [];
  private flick = 0;

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    this.face = this.sprite('stormcaller_face', lift);
    this.sprite('stormcaller_staff', this.staff);
    for (const n of ['zap_a', 'zap_b']) {
      const z = this.sprite(n, this.staff, 0, -2.95);
      z.alpha = 0;
      this.zaps.push(z);
    }
    lift.addChild(this.staff);
  }

  update(c: BeastCtx): void {
    this.face.position.set(c.cx * 0.36, -1.12 + c.cy * 0.26);
    const vis = smoothstep(-0.95, -0.4, c.cy);
    this.face.alpha = vis;
    this.face.scale.set(0.8 + 0.2 * vis, 0.6 + 0.4 * vis);
    // Staff in the leading hand; raised overhead through the windup.
    const side = c.cx >= 0 ? 1 : -1;
    const raise = c.attack === 'stormStrike' ? c.wind : c.wind * 0.5;
    this.staff.position.set(side * (1.25 - raise * 0.5), -0.3 + c.cy * 0.4 - raise * 1.3);
    this.staff.rotation = side * (0.22 - raise * 0.2) + Math.sin(c.t * 2) * 0.03;
    const back = c.cy < -0.3;
    const idx = this.lift.getChildIndex(this.staff);
    if (back && idx !== 0) this.lift.setChildIndex(this.staff, 0);
    else if (!back && idx === 0) this.lift.setChildIndex(this.staff, this.lift.children.length - 1);
    // Crackle around the orb: idle sparks, a storm of them while winding up.
    this.flick -= c.dt;
    const level = 0.25 + 0.75 * raise;
    if (this.flick <= 0) {
      this.flick = rand(0.04, 0.09);
      for (const z of this.zaps) {
        const on = Math.random() < level;
        z.alpha = on ? 0.6 + 0.4 * level : 0;
        z.rotation = rand(0, Math.PI * 2);
        z.scale.set(rand(0.5, 0.8) * (0.7 + level * 0.6));
        z.tint = Math.random() < 0.5 ? ELEMENT.storm : ELEMENT.stormGlow;
      }
    }
    if (raise > 0.3 && c.fx.take(18 * raise, c.dt)) {
      const sx = c.x + (this.staff.x + Math.sin(this.staff.rotation) * 2.95) * c.scale;
      const sy = c.y + (this.staff.y - 2.95) * c.scale;
      const p = c.fx.spawn(
        c.fx.add,
        c.fx.tex.spark,
        sx + rand(-0.6, 0.6),
        sy + rand(-0.6, 0.6),
        rand(-5, 5),
        rand(-5, 5),
        0.12,
        ELEMENT.storm,
        0.6,
        0.2,
      );
      if (p) {
        p.align = true;
        p.stretch = 0.03;
      }
    }
  }

  override die(): void {
    for (const z of this.zaps) z.alpha = 0;
  }
}

// ---- Kiln Mite ----------------------------------------------------------------------------------

export class MiteRig extends BeastRig {
  private readonly eyes: Sprite;
  private readonly legs: Sprite[] = [];
  private stride = Math.random() * 10;

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    for (const [lx, ly] of [
      [-0.72, -0.3],
      [-0.8, 0.06],
      [-0.65, 0.42],
      [0.72, -0.3],
      [0.8, 0.06],
      [0.65, 0.42],
    ] as const) {
      const l = new Sprite(atlas.get('tinderling_leg'));
      l.position.set(lx, ly);
      l.scale.set(0.75);
      root.addChildAt(l, 0);
      this.legs.push(l);
    }
    this.eyes = this.sprite('kiln_mite_eyes', lift);
  }

  update(c: BeastCtx): void {
    this.stride += c.dt * (6 + 30 * c.run);
    for (let i = 0; i < this.legs.length; i++) {
      const ph = this.stride + (i % 2) * Math.PI;
      this.legs[i]!.pivot.set(Math.cos(ph) * 0.12 * c.run, Math.sin(ph) * 0.15 * c.run);
    }
    this.eyes.position.set(c.cx * 0.4, -0.06 + c.cy * 0.32);
    this.eyes.alpha = smoothstep(-0.95, -0.4, c.cy);
    // Scuttle jitter.
    this.lift.rotation += Math.sin(this.stride * 2.3) * 0.08 * c.run;
  }
}

export type BeastFactory = (
  atlas: Atlas,
  root: Container,
  lift: Container,
  body: Sprite,
  flash: Sprite,
) => BeastRig;

export const SMALL_RIGS: Partial<Record<M4Kind, BeastFactory>> = {
  bog_lurker: (a, r, l, b, f) => new LurkerRig(a, r, l, b, f),
  frost_wisp: (a, r, l, b, f) => new WispRig(a, r, l, b, f),
  stormcaller: (a, r, l, b, f) => new CallerRig(a, r, l, b, f),
  kiln_mite: (a, r, l, b, f) => new MiteRig(a, r, l, b, f),
};
