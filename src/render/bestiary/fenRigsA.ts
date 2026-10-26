import { Container, Sprite } from 'pixi.js';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import { mixRgb } from '../ailmentPalette';
import { ELEMENT } from '../combatPalette';
import { clamp, smoothstep } from '../mathx';
import { BeastRig, type BeastCtx } from './beastRig';
import { FEN_BEAST as B, FEN_FEEL as F } from './fenBeastPalette';
import { ease, glowSprite, splash } from './fenRigParts';

/** Rigs of the Fen's smaller enemies (CONTENT §5): Glasspike, Copperback, Spark Heron, Sparkfly. */
const TAU = Math.PI * 2;

/** Mirrors a side-on body to face the way it looks (the lift's squash already set). */
function faceSide(lift: Container, cx: number): number {
  const side = cx >= 0 ? 1 : -1;
  lift.scale.x = Math.abs(lift.scale.x) * side;
  return side;
}

// ---- Glasspike: hidden glint, 0.8 s flash, arcing leap, flopping when stranded --------------

export class PikeRig extends BeastRig {
  private readonly glint: Sprite;
  private surf = 1;
  private wasLeaping = false;
  private wasTell = false;

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    this.glint = this.sprite('star', root, 0, -0.2);
    this.glint.blendMode = 'add';
    this.glint.tint = B.glasspike.glint;
  }

  override reset(): void {
    this.surf = 1;
    this.wasLeaping = this.wasTell = false;
  }

  update(c: BeastCtx): void {
    const s = c.e.special;
    const side = faceSide(this.lift, c.cx);
    const leaping = s.leapLeft > 0;
    const tell = c.phase === 'windup' && c.attack === 'pikeLeap';
    const hidden = s.submerged && !leaping && !tell && !s.stranded;
    this.surf = ease(this.surf, hidden ? 0 : tell ? 0.75 : 1, c.dt, hidden ? 0.25 : 0.08);
    const surf = this.surf;
    this.body.alpha = smoothstep(0.05, 0.7, surf) * 0.92;
    // Hidden: only a faint shape under the glass and the glint (CONTENT §5).
    if (this.flash.alpha < 0.05 && surf < 0.95) {
      this.flash.tint = 0x2a5a66;
      this.flash.alpha = 0.2 * (1 - surf);
    }
    this.lift.position.y += (1 - surf) * 0.5;
    const tw = Math.pow(Math.max(0, Math.sin(c.t * TAU * F.glintHz)), 10);
    let gA = hidden ? 0.15 + 0.85 * tw : 0;
    let gS = 0.32 + 0.2 * tw;
    if (tell) {
      // The 0.8 s flash: the glint flares, the body flashes white.
      const pulse = 0.5 + 0.5 * Math.sin(c.t * TAU * 7);
      gA = 0.7 + 0.3 * pulse;
      gS = 0.5 + 0.9 * c.wind;
      if (this.flash.alpha < 0.05 || this.flash.tint !== 0xffffff) {
        this.flash.tint = 0xffffff;
        this.flash.alpha = (0.3 + 0.4 * c.wind) * pulse;
      }
      if (!this.wasTell) splash(c, c.x, c.y + 0.3, 6, 0xe0f6ff, 2.5);
    }
    this.glint.alpha = gA;
    this.glint.scale.set(gS);
    this.glint.rotation = c.t * 0.8;
    this.glint.position.set(side * 0.9, -0.35 - (1 - surf) * 0.1);
    // The leap: an arc over the ground, nose up then down; the shadow shrinks under it.
    let rot = 0;
    if (leaping) {
      const u = s.leapTime > 0 ? clamp(1 - s.leapLeft / s.leapTime, 0, 1) : 1;
      const h = Math.sin(Math.PI * u) * F.leapHeight;
      this.lift.position.y -= h;
      rot = (u - 0.5) * 1.3 * side;
      if (c.shadow) {
        const k = 1 - 0.45 * (h / F.leapHeight);
        c.shadow.scaleX *= k;
        c.shadow.scaleY *= k;
      }
    } else if (this.wasLeaping) {
      splash(c, c.x, c.y + 0.4, 10, s.stranded ? 0xb8a890 : 0xe0f6ff, s.stranded ? 0 : 3.5);
    }
    if (s.stranded) {
      // Flopping on dry ground, dulled as it dries.
      rot = Math.sin(c.t * 13) * 0.4 * side;
      this.lift.position.y -= Math.abs(Math.sin(c.t * 6.5)) * 0.35;
      this.body.tint = s.drying ? 0xb8b8a8 : 0xe6eeee;
    } else this.body.tint = 0xffffff;
    this.lift.rotation = rot;
    if (c.shadow) c.shadow.fade(0.2 + 0.8 * surf);
    if (hidden && c.fx.take(0.6, c.dt)) c.fx.ripple(c.x, c.y + 0.3, 0.6, 2.2, 1.0, 0xd8f4ff, 0.35);
    this.wasLeaping = leaping;
    this.wasTell = tell;
  }

  override die(): void {
    this.glint.alpha = 0;
  }
}

// ---- Copperback: claw raise, Charged antenna sparks and shell glow --------------------------

export class CopperRig extends BeastRig {
  private readonly clawL: Sprite;
  private readonly clawR: Sprite;
  private readonly antenna: Sprite;
  private readonly glow: Sprite;
  private stride = Math.random() * 10;

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    this.glow = glowSprite(atlas, lift, ELEMENT.stormGlow);
    this.antenna = this.sprite('copperback_antenna', lift, 0, -1.2);
    this.clawL = this.sprite('copperback_claw', lift, -1.45, 0.1);
    this.clawR = this.sprite('copperback_claw', lift, 1.45, 0.1);
    this.clawR.scale.x = -1;
  }

  update(c: BeastCtx): void {
    this.stride += c.dt * (4 + 22 * c.run);
    const pinch = c.attack === 'copperPinch';
    const raise = pinch && c.phase === 'windup' ? smoothstep(0, 1, c.wind) : 0;
    const snap = pinch && (c.phase === 'active' || c.phase === 'recover') ? 1 : 0;
    const bob = Math.sin(this.stride) * 0.12 * c.run;
    // Claws rise and open through the 0.5 s windup, then snap shut forward.
    const y = 0.1 - raise * 1.0 + snap * 0.35;
    this.clawL.position.set(-1.45 + snap * 0.35, y + bob);
    this.clawR.position.set(1.45 - snap * 0.35, y - bob);
    this.clawL.rotation = raise * 0.55 - snap * 0.3;
    this.clawR.rotation = -raise * 0.55 + snap * 0.3;
    // Sidling: a sideways rock.
    this.lift.rotation += Math.sin(this.stride * 0.5) * 0.06 * c.run;
    const charged = c.e.special.chargedLeft > 0;
    const k = 0.5 + 0.5 * Math.sin(c.t * 23);
    this.antenna.tint = charged ? mixRgb(ELEMENT.storm, 0xffffff, k) : 0xc8b8a0;
    this.glow.alpha = charged ? 0.35 + 0.25 * k : 0;
    this.glow.scale.set(2.6, 2.0);
    this.glow.position.set(0, -0.4);
    if (charged && this.flash.alpha < 0.05) {
      this.flash.tint = ELEMENT.stormGlow;
      this.flash.alpha = 0.18 + 0.12 * k;
    }
    if (charged && c.fx.take(F.copperSparks, c.dt)) {
      const sx = rand(-1, 1) < 0 ? -0.75 : 0.75;
      const z = c.fx.spawn(
        c.fx.add,
        Math.random() < 0.5 ? c.fx.tex.zapA : c.fx.tex.zapB,
        c.x + sx * c.scale,
        c.y - 2.5 * c.scale,
        0,
        0,
        0.1,
        Math.random() < 0.5 ? ELEMENT.storm : ELEMENT.stormGlow,
        0.7,
        0.5,
      );
      if (z) z.rotation = rand(0, TAU);
    }
  }
}

// ---- Spark Heron: beak glow before the strike, head back before the spit ------------------

export class HeronRig extends BeastRig {
  private readonly beak: Sprite;
  private readonly tip: Sprite;

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    this.beak = this.sprite('spark_heron_beak', lift, 0.75, -4.12);
    this.tip = glowSprite(atlas, lift, ELEMENT.storm, false);
  }

  update(c: BeastCtx): void {
    faceSide(this.lift, c.cx);
    const strike = c.attack === 'heronBeak';
    const spit = c.attack === 'puddleSpit';
    const w = c.phase === 'windup' ? smoothstep(0, 1, c.wind) : 0;
    const fire = c.phase === 'active' || c.phase === 'recover' ? 1 : 0;
    // Strike: the beak draws back and glows, then stabs; spit: the head tips back.
    const bx = 0.75 - (strike ? 0.25 * w - 0.35 * fire : 0);
    this.beak.position.set(bx, -4.12 + (spit ? -0.25 * w : 0));
    this.beak.rotation = spit ? -0.6 * w + 0.4 * fire : strike ? 0.08 * w : 0;
    const glow = strike ? w : 0;
    this.beak.tint = mixRgb(0xffffff, ELEMENT.storm, glow);
    this.tip.position.set(bx + 1.6, -4.1);
    this.tip.alpha = glow * (0.6 + 0.3 * Math.sin(c.t * 40));
    this.tip.scale.set(0.6 + 1.2 * glow);
    if (glow > 0.2 && c.fx.take(16 * glow, c.dt)) {
      const sx = this.lift.scale.x < 0 ? -1 : 1;
      const p = c.fx.spawn(
        c.fx.add,
        c.fx.tex.spark,
        c.x + sx * (bx + 1.6) * c.scale,
        c.y + (-4.1 + c.foot - 1.5) * c.scale,
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
    if (spit && w > 0.3 && c.fx.take(8, c.dt)) {
      const sx = this.lift.scale.x < 0 ? -1 : 1;
      const p = c.fx.spawn(
        c.fx.body,
        c.fx.tex.dot,
        c.x + sx * 1.9 * c.scale,
        c.y - 3.6 * c.scale,
        0,
        1.5,
        0.35,
        0xcfeef2,
        0.18,
        0.1,
      );
      if (p) p.grav = 18;
    }
    // A slow stilted gait, and lazy rings where it wades.
    this.lift.rotation += Math.sin(c.t * 5) * 0.04 * c.run;
    if (c.fx.take(0.8 + c.run * 2, c.dt) && c.e.terrain.wetLeft > 0)
      c.fx.ripple(c.x, c.y + 1.4 * c.scale, 0.5, 2.2, 0.9, 0xd8f4ff, 0.45);
  }
}

// ---- Sparkfly: hovering lamp, wings a blur, a 0.25 s flicker before the zap -----------------

export class FlyRig extends BeastRig {
  private readonly lamp: Sprite;
  private readonly halo: Sprite;
  private readonly wings: Sprite[] = [];

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    this.halo = glowSprite(atlas, lift, B.sparkfly.lamp);
    for (const s of [-1, 1]) {
      const wg = this.sprite('sparkfly_wing', lift, s * 0.15, -0.3);
      wg.scale.x = s;
      this.wings.push(wg);
    }
    this.lamp = this.sprite('sparkfly_lamp', lift, 0, 0.32);
  }

  update(c: BeastCtx): void {
    const bob = Math.sin(c.t * 5.3) * 0.25;
    this.lift.position.y = c.foot - 1.3 - bob;
    for (let i = 0; i < this.wings.length; i++) {
      const s = i === 0 ? -1 : 1;
      this.wings[i]!.scale.set(s, 0.35 + 0.65 * Math.abs(Math.sin(c.t * 38 + i)));
    }
    const zap = c.attack === 'sparkZap' && c.phase === 'windup';
    const lured = c.e.special.lureLeft > 0;
    const flick = zap ? (Math.sin(c.t * 70) > 0 ? 1 : 0.3) : 0.75 + 0.25 * Math.sin(c.t * 3.1);
    this.lamp.tint = zap ? mixRgb(B.sparkfly.lampHot, ELEMENT.storm, flick) : B.sparkfly.lamp;
    this.lamp.alpha = 0.6 + 0.4 * flick;
    this.halo.alpha = (lured ? 0.7 : 0.5) * flick;
    this.halo.scale.set(zap ? 1.9 : 1.4);
    this.halo.position.set(0, 0.3);
    if (c.shadow) c.shadow.fade(0.45);
  }
}
