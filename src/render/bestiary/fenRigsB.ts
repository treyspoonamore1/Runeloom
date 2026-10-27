import { Container, Sprite } from 'pixi.js';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import { mixRgb } from '../ailmentPalette';
import { smoothstep } from '../mathx';
import { ATMO } from '../terrain/regionLook';
import { BeastRig, type BeastCtx, type BeastFactory } from './beastRig';
import { FEN_BEAST as B, FEN_FEEL as F, type FenKind } from './fenBeastPalette';
import { CopperRig, FlyRig, HeronRig, PikeRig } from './fenRigsA';
import { ease, glowSprite, puff, StunStars } from './fenRigParts';
import { Fists, slamPose } from './rigParts';

/** Rigs of the Fen's bigger enemies (CONTENT §5): Slagshell, Mirebull, Bellows Toad, Bellshell. */

// ---- Slagshell: Hot glow, Cracked when Wet, slag slam ------------------------------------

export class SlagRig extends BeastRig {
  private readonly veins: Sprite;
  private readonly glow: Sprite;
  private readonly fists: Fists;
  private heat = 1;
  private wasHot = true;

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    this.glow = glowSprite(atlas, lift, B.slagshell.vein);
    this.veins = this.sprite('slagshell_veins', lift);
    this.fists = new Fists(atlas, 'slagshell_fist', lift);
    this.fists.snap(-2.35, 0.4, 2.35, 0.4);
  }

  override reset(): void {
    this.heat = 1;
    this.wasHot = true;
    this.fists.snap(-2.35, 0.4, 2.35, 0.4);
  }

  update(c: BeastCtx): void {
    const s = c.e.special;
    const hot = s.hot && s.crackedLeft <= 0;
    this.heat = ease(this.heat, hot ? 1 : 0, c.dt, hot ? 0.8 : 0.15);
    const h = this.heat;
    const pulse = 0.5 + 0.5 * Math.sin(c.t * 3.2);
    // Hot: amber veins that throb and a warm glow. Cracked: a grey crust split by pale cracks.
    this.veins.tint = h > 0.5 ? mixRgb(B.slagshell.vein, B.slagshell.veinHot, pulse * h) : B.slagshell.crack;
    this.veins.alpha = h > 0.5 ? 0.6 + 0.4 * pulse : 0.9;
    this.body.tint = mixRgb(B.slagshell.cooled, 0xffffff, h);
    this.glow.alpha = 0.45 * h * (0.7 + 0.3 * pulse);
    this.glow.scale.set(3.4, 3.0);
    this.glow.position.set(0, -0.9);
    if (this.wasHot && !hot)
      for (let i = 0; i < 6; i++)
        puff(c, c.x + rand(-2, 2) * c.scale, c.y - rand(1, 3) * c.scale, 0xf2f8fb, 1.4, 4);
    if (!hot && c.fx.take(1.5, c.dt))
      puff(c, c.x + rand(-1.5, 1.5) * c.scale, c.y - 2.5 * c.scale, 0xdde6ea, 0.9, 2);
    if (hot && c.fx.take(3, c.dt)) {
      const p = c.fx.spawn(
        c.fx.add,
        c.fx.tex.dot,
        c.x + rand(-2, 2) * c.scale,
        c.y - rand(0.5, 3) * c.scale,
        rand(-0.5, 0.5),
        -rand(1.5, 3),
        rand(0.4, 0.8),
        B.slagshell.veinHot,
        0.15,
        0.05,
      );
      if (p) p.drag = 1;
    }
    this.wasHot = hot;
    const slam = c.attack === 'slagSlam';
    const swing = Math.sin(c.t * 5) * 0.25 * c.run;
    const [px, py] = slam ? slamPose(c, [2.35, 0.4], [1.4, -3.6], [1.9, 1.5]) : [2.35, 0.4];
    this.fists.set(-px, py + swing, px, py - swing, c.phase === 'active' ? 1 : 1 - Math.exp(-c.dt / 0.07));
    this.fists.l.tint = this.fists.r.tint = this.body.tint;
  }
}

// ---- Mirebull: head down and pawing before the charge, bogged in mud, stunned at walls ----

export class BullRig extends BeastRig {
  private readonly head: Sprite;
  private readonly stars: StunStars;
  private sink = 0;

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    this.head = this.sprite('mire_bull_head', lift, 0, 0);
    this.stars = new StunStars(atlas, lift);
  }

  override reset(): void {
    this.sink = 0;
  }

  update(c: BeastCtx): void {
    const s = c.e.special;
    const charge = c.attack === 'bullCharge';
    const gore = c.attack === 'bullGore';
    const w = c.phase === 'windup' ? smoothstep(0, 1, c.wind) : 0;
    const running = charge && (c.phase === 'active' || c.phase === 'recover');
    const down = charge ? (c.phase === 'windup' ? w : running ? 1 : 0) : 0;
    const thrust = gore ? (c.phase === 'windup' ? -0.5 * w : c.phase === 'active' ? 0.8 : 0) : 0;
    // The head sits toward the facing; lowered (horns forward) for the charge.
    this.head.position.set(c.cx * (1.25 + thrust), -0.35 + c.cy * (0.8 + thrust * 0.6) + down * 0.55);
    this.head.rotation = c.cx * 0.15 * down;
    const back = c.cy < -0.3;
    const idx = this.lift.getChildIndex(this.head);
    if (back && idx !== 0) this.lift.setChildIndex(this.head, 0);
    else if (!back && idx === 0) this.lift.setChildIndex(this.head, this.lift.children.length - 1);
    // Pawing the ground through the 0.9 s windup; a dust wake while it runs.
    if (charge && c.phase === 'windup') {
      this.lift.rotation += Math.sin(c.t * 18) * 0.05 * w;
      if (c.fx.take(10 * w, c.dt))
        puff(c, c.x - c.cx * 1.5 * c.scale + rand(-1, 1), c.y + 1.4 * c.scale, 0xb8a080, 0.9, 1);
    }
    if (running) {
      this.lift.rotation += c.cx * 0.12;
      if (c.fx.take(30, c.dt))
        puff(c, c.x - c.cx * 2 * c.scale + rand(-1, 1), c.y + 1.3 * c.scale, 0xb8a080, 1.1, 0.5);
    }
    // Bogged: sunk to the knees in mud, struggling.
    const bogged = s.boggedLeft > 0;
    this.sink = ease(this.sink, bogged ? 1 : 0, c.dt, 0.15);
    this.lift.position.y += this.sink * F.bogSink;
    if (bogged) {
      this.lift.rotation += Math.sin(c.t * 9) * 0.08;
      if (c.fx.take(5, c.dt)) {
        const p = c.fx.spawn(
          c.fx.body,
          c.fx.tex.dot,
          c.x + rand(-2, 2) * c.scale,
          c.y + 1.2 * c.scale,
          rand(-3, 3),
          -rand(3, 6),
          rand(0.3, 0.5),
          B.mire_bull.mud,
          0.35,
          0.2,
        );
        if (p) p.grav = 24;
      }
    }
    if (c.shadow) c.shadow.fade(1 - 0.6 * this.sink);
    this.stars.update(c.e.terrain.stunLeft > 0, c.t, this.head.x, this.head.y - 1.6, 1.1);
  }
}

// ---- Bellows Toad: swells through the 1.0 s inflate, croaks ------------------------------

export class ToadRig extends BeastRig {
  private readonly eyes: Sprite;
  private readonly sac: Sprite;
  private readonly stars: StunStars;
  private puffed = 0;

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    this.sac = this.sprite('bellows_toad_sac', lift, 0, 0.05);
    this.eyes = this.sprite('bellows_toad_eyes', lift, 0, -1.6);
    this.stars = new StunStars(atlas, lift);
  }

  override reset(): void {
    this.puffed = 0;
  }

  update(c: BeastCtx): void {
    const croak = c.attack === 'toadCroak';
    const w = croak && c.phase === 'windup' ? c.wind : 0;
    // Visibly swelling (CONTENT §5): body and sac grow, trembling near the end.
    this.puffed = c.phase === 'windup' && croak ? w : ease(this.puffed, 0, c.dt, 0.08);
    const k = this.puffed;
    const tremble = k > 0.6 ? Math.sin(c.t * 60) * 0.03 * k : 0;
    const swell = 1 + F.toadSwell * k * k + tremble;
    this.lift.scale.x *= swell;
    this.lift.scale.y *= swell;
    const breathe = 0.5 + 0.5 * Math.sin(c.t * 2.4);
    const sac = 0.8 + 0.12 * breathe + 0.75 * k;
    this.sac.scale.set(sac, sac * (0.9 + 0.25 * k));
    this.sac.tint = mixRgb(B.bellows_toad.throat, B.bellows_toad.throatHot, k);
    this.sac.position.set(c.cx * 0.3, 0.05 + c.cy * 0.2);
    this.eyes.position.set(c.cx * 0.45, -1.6 + c.cy * 0.25 - k * 0.3);
    this.eyes.alpha = smoothstep(-0.95, -0.4, c.cy);
    if (croak && c.phase === 'active' && c.fx.take(60, c.dt)) {
      // The croak's gust leaves its mouth in pale streaks (the gust cells draw the rest).
      const a = Math.atan2(c.cy, c.cx) + rand(-0.5, 0.5);
      const v = rand(14, 22);
      const p = c.fx.spawn(
        c.fx.add,
        c.fx.tex.spark,
        c.x + c.cx * 1.5 * c.scale,
        c.y,
        Math.cos(a) * v,
        Math.sin(a) * v,
        0.3,
        ATMO.gale,
        1.2,
        0.6,
      );
      if (p) {
        p.align = true;
        p.stretch = 0.05;
        p.drag = 2;
      }
    }
    this.stars.update(c.e.terrain.stunLeft > 0, c.t, 0, -2.6, 1.0);
  }
}

// ---- Bellshell: shelled, head out to bite, shell open and ringing when rung --------------

export class BellRig extends BeastRig {
  private readonly shell: Sprite;
  private readonly head: Sprite;
  private readonly stars: StunStars;
  private open = 0;
  private reach = 0;
  private ringClock = 0;

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    this.head = this.sprite('bellshell_head', lift, 0, 0.6);
    this.shell = this.sprite('bellshell_shell', lift);
    this.lift.setChildIndex(this.flash, this.lift.children.length - 1);
    this.stars = new StunStars(atlas, lift);
  }

  override reset(): void {
    this.open = this.reach = this.ringClock = 0;
  }

  update(c: BeastCtx): void {
    const s = c.e.special;
    const opened = s.openLeft > 0;
    const stunned = c.e.terrain.stunLeft > 0;
    this.open = ease(this.open, opened ? 1 : 0, c.dt, 0.12);
    const bite = c.attack === 'bellBite';
    const target = opened ? 0.6 : bite ? (c.phase === 'windup' ? c.wind : c.phase === 'none' ? 0 : 1) : 0;
    this.reach = ease(this.reach, target, c.dt, 0.08);
    const r = this.reach;
    // Shelled, the head is tucked under the brass; out, it stretches toward the facing.
    this.head.visible = r > 0.05;
    this.head.position.set(c.cx * (0.6 + 1.1 * r), 0.55 + c.cy * (0.3 + 0.7 * r));
    this.head.scale.set(0.5 + 0.5 * r);
    this.head.rotation = Math.atan2(c.cy, c.cx) - Math.PI / 2;
    // Facing north the head is behind the shell; facing south, in front of it.
    const back = c.cy < -0.3;
    const above = this.lift.getChildIndex(this.head) > this.lift.getChildIndex(this.shell);
    if (back === above) this.lift.swapChildren(this.head, this.shell);
    // Open: the shell lifts and tilts; rung and stunned, it shivers and rings out in waves.
    const o = this.open;
    const shiver = stunned ? Math.sin(c.t * 45) * F.bellShiver : 0;
    this.shell.position.set(shiver * 4 + 0.3 * o, -F.bellLift * o);
    this.shell.rotation = -0.35 * o + shiver;
    const cool = s.ringCooldown > 0 && !opened;
    this.shell.tint = cool
      ? 0xc8b896
      : mixRgb(0xffffff, B.bellshell.ringGold, o * F.bellGlow * (0.75 + 0.25 * Math.sin(c.t * 8)));
    if (stunned && opened) {
      this.ringClock -= c.dt;
      if (this.ringClock <= 0) {
        this.ringClock = 1 / F.bellRingHz;
        for (const [r0, r1, a, tint] of [
          [2.2, 7.5, 1, B.bellshell.ringGold],
          [1.8, 6, 0.75, B.bellshell.ring],
        ] as const) {
          const p = c.fx.spawn(
            c.fx.body,
            c.fx.tex.ring,
            c.x,
            c.y - 1.2 * c.scale,
            0,
            0,
            0.55,
            tint,
            r0 * c.scale,
            r1 * c.scale,
          );
          if (p) {
            p.aspect = 0.7;
            p.a0 = a;
          }
        }
      }
    } else this.ringClock = 0;
    this.stars.update(stunned, c.t, 0, -3.4, 1.3);
  }
}

export const FEN_RIGS: Readonly<Record<FenKind, BeastFactory>> = {
  glasspike: (a, r, l, b, f) => new PikeRig(a, r, l, b, f),
  copperback: (a, r, l, b, f) => new CopperRig(a, r, l, b, f),
  spark_heron: (a, r, l, b, f) => new HeronRig(a, r, l, b, f),
  sparkfly: (a, r, l, b, f) => new FlyRig(a, r, l, b, f),
  slagshell: (a, r, l, b, f) => new SlagRig(a, r, l, b, f),
  mire_bull: (a, r, l, b, f) => new BullRig(a, r, l, b, f),
  bellows_toad: (a, r, l, b, f) => new ToadRig(a, r, l, b, f),
  bellshell: (a, r, l, b, f) => new BellRig(a, r, l, b, f),
};
