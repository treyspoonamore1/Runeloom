import { Container, Sprite } from 'pixi.js';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import { mixRgb } from '../ailmentPalette';
import { ELEMENT } from '../combatPalette';
import { smoothstep } from '../mathx';
import { BeastRig, type BeastCtx } from './beastRig';
import { FEN_BOSS as P, FEN_BOSS_FEEL as F } from './fenBossPalette';
import { ease, glowSprite, puff, StunStars } from './fenRigParts';

const TAU = Math.PI * 2;
const B = P.bellwether;

/**
 * The Old Bellwether (CONTENT §5, §13.2): a colossal brass-belled turtle. Shelled, its head and
 * legs peek out under the bell; rung open, the bell lifts and tilts off the pale plastron and
 * shivers, ringing out in waves while it is stunned. The Snap thrusts the head out; the Toll
 * ring's windup glows the bell gold and the self-toll's violet (phase 2), then a ring pops; the
 * roll tucks everything in and spins the bell, kicking up dust; a roll into a wall leaves stars.
 */
export class BellwetherRig extends BeastRig {
  private readonly shell = new Container();
  private readonly shellArt: Sprite;
  private readonly lit: Sprite;
  private readonly head: Sprite;
  private readonly halo: Sprite;
  private readonly stars: StunStars;
  private open = 0;
  private reach = 0;
  private tuck = 0;
  private spin = 0;
  private ringClock = 0;
  private lastAttack = '';

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    this.halo = glowSprite(atlas, lift, B.tollGlow);
    this.head = this.sprite('bellwether_head', lift, 0, 0.7);
    this.shellArt = this.sprite('bellwether_shell', this.shell);
    this.lit = this.sprite('bellwether_shell_lit', this.shell);
    this.lit.alpha = 0;
    this.lit.blendMode = 'add';
    lift.addChild(this.shell);
    lift.setChildIndex(this.flash, lift.children.length - 1);
    this.stars = new StunStars(atlas, lift);
  }

  override reset(): void {
    this.open = this.reach = this.tuck = this.spin = this.ringClock = 0;
    this.lastAttack = '';
  }

  update(c: BeastCtx): void {
    const s = c.e.special;
    const opened = s.openLeft > 0;
    const stunned = c.e.terrain.stunLeft > 0;
    const rolling = c.attack === 'shellRoll' && c.phase === 'active' && s.dashSpeed > 0;
    const w = c.phase === 'windup' ? smoothstep(0, 1, c.wind) : 0;
    this.open = ease(this.open, opened ? 1 : 0, c.dt, 0.15);
    // Tucked in for the roll (windup and roll); the head stretches out for the Snap.
    const tuckTarget = c.attack === 'shellRoll' && c.phase !== 'recover' ? (c.phase === 'windup' ? w : 1) : 0;
    this.tuck = ease(this.tuck, tuckTarget, c.dt, 0.1);
    const snap = c.attack === 'bellSnap';
    const reachTarget = opened ? 0.55 : snap ? (c.phase === 'windup' ? -0.3 * w : c.phase === 'active' ? 1 : 0.4) : 0.2;
    this.reach = ease(this.reach, reachTarget * (1 - this.tuck), c.dt, snap && c.phase === 'active' ? 0.03 : 0.1);
    this.pose(c);
    this.shellLook(c, opened, stunned, rolling, w);
    this.ring(c, opened && stunned);
    if (rolling) this.rollDust(c);
    // A new attack's release: the toll and self-toll pop a ring off the bell.
    const key = `${c.attack ?? ''}|${c.phase}`;
    if (key !== this.lastAttack && c.phase === 'active') {
      if (c.attack === 'tollRing' || c.attack === 'tollFoundry') this.pop(c, B.tollGlow);
      else if (c.attack === 'selfToll') this.pop(c, B.selfToll);
    }
    this.lastAttack = key;
    this.stars.update(stunned && !opened, c.t, 0, -4.4, 1.6);
  }

  /** Head toward the facing (behind the bell facing north), legs hidden while tucked. */
  private pose(c: BeastCtx): void {
    const r = this.reach;
    this.head.visible = r > -0.25 && this.tuck < 0.9;
    this.head.position.set(c.cx * (0.9 + 1.5 * r), 0.7 + c.cy * (0.4 + 1.0 * r) - 0.4 * this.tuck);
    this.head.scale.set(0.7 + 0.3 * Math.max(0, r));
    this.head.rotation = Math.atan2(c.cy, c.cx) - Math.PI / 2;
    const back = c.cy < -0.3;
    const above = this.lift.getChildIndex(this.head) > this.lift.getChildIndex(this.shell);
    if (back === above) this.lift.swapChildren(this.head, this.shell);
    this.body.alpha = 1 - smoothstep(0.3, 0.9, this.tuck);
  }

  private shellLook(c: BeastCtx, opened: boolean, stunned: boolean, rolling: boolean, w: number): void {
    const o = this.open;
    const shiver = stunned && opened ? Math.sin(c.t * 47) * F.bellShiver : 0;
    // Toll windups: the bell trembles harder toward the release.
    const tolling = c.phase === 'windup' && (c.attack === 'tollRing' || c.attack === 'selfToll' || c.attack === 'tollFoundry');
    const tremble = tolling ? Math.sin(c.t * 60) * 0.03 * w * w : 0;
    if (rolling) this.spin += Math.hypot(c.velX, c.velY) * c.dt * F.rollSpin;
    else this.spin = ease(this.spin, Math.round(this.spin / TAU) * TAU, c.dt, 0.2);
    this.shell.position.set(shiver * 5 + 0.35 * o + tremble * 4, -F.bellLift * o + 0.5 * this.tuck);
    this.shell.rotation = -0.28 * o + shiver + tremble + (rolling ? Math.sin(this.spin) * 0.25 : 0);
    this.shell.scale.set(1 + 0.04 * w * (tolling ? 1 : 0), 1 - 0.03 * w * (tolling ? 1 : 0));
    const cool = c.e.special.ringCooldown > 0 && !opened;
    // Glows: gold for the toll (and while rung), violet for the self-toll.
    let glow = 0;
    let tint: number = B.tollGlow;
    if (tolling) {
      glow = 0.25 + 0.75 * w;
      if (c.attack === 'selfToll') tint = B.selfToll;
    }
    if (opened) glow = Math.max(glow, 0.25 + 0.2 * Math.sin(c.t * 8));
    const flick = 0.85 + 0.15 * Math.sin(c.t * 23);
    this.lit.tint = tint;
    this.lit.alpha = glow * 0.7 * flick;
    this.shellArt.tint = cool ? 0xcbbd9e : 0xffffff;
    this.halo.tint = tint;
    this.halo.alpha = glow * 0.65;
    this.halo.scale.set(5 + 2 * glow, 4.2 + 1.5 * glow);
    this.halo.position.set(this.shell.x, this.shell.y - 1.4);
    if (c.attack === 'selfToll' && c.phase === 'windup' && c.fx.take(18 * w + 4, c.dt)) {
      const a = rand(0, TAU);
      const p = c.fx.spawn(
        c.fx.add,
        Math.random() < 0.5 ? c.fx.tex.zapA : c.fx.tex.zapB,
        c.x + Math.cos(a) * rand(1, 2.6) * c.scale,
        c.y - rand(0.5, 3.5) * c.scale,
        0,
        0,
        0.1,
        Math.random() < 0.5 ? ELEMENT.stormGlow : B.selfToll,
        rand(0.6, 1.1),
        rand(0.6, 1.1),
      );
      if (p) p.rotation = rand(0, TAU);
    }
  }

  /** Rung and stunned: sound rings roll off the lifted bell. */
  private ring(c: BeastCtx, on: boolean): void {
    if (!on) {
      this.ringClock = 0;
      return;
    }
    this.ringClock -= c.dt;
    if (this.ringClock > 0) return;
    this.ringClock = 1 / F.bellRingHz;
    this.rings(c, B.ring, 1);
  }

  private pop(c: BeastCtx, tint: number): void {
    this.rings(c, tint, 1.6);
    for (let i = 0; i < 10; i++) {
      const a = rand(0, TAU);
      const p = c.fx.spawn(
        c.fx.add,
        c.fx.tex.spark,
        c.x + Math.cos(a) * 2 * c.scale,
        c.y - 1.8 * c.scale + Math.sin(a) * 1.4 * c.scale,
        Math.cos(a) * rand(8, 14),
        Math.sin(a) * rand(5, 9),
        rand(0.2, 0.35),
        tint,
        1.2,
        0.4,
      );
      if (p) {
        p.align = true;
        p.stretch = 0.04;
        p.drag = 3;
      }
    }
  }

  private rings(c: BeastCtx, tint: number, size: number): void {
    for (const [r0, r1, a] of [
      [2.2, 7.5, 0.95],
      [1.8, 6, 0.6],
    ] as const) {
      const p = c.fx.spawn(c.fx.body, c.fx.tex.ring, c.x, c.y - 1.8 * c.scale, 0, 0, 0.6, tint, r0 * c.scale, r1 * c.scale * size);
      if (p) {
        p.aspect = 0.7;
        p.a0 = a;
      }
    }
  }

  private rollDust(c: BeastCtx): void {
    if (!c.fx.take(40, c.dt)) return;
    const sp = Math.hypot(c.velX, c.velY) || 1;
    const bx = -c.velX / sp;
    const by = -c.velY / sp;
    puff(c, c.x + bx * 2.5 * c.scale + rand(-1, 1), c.y + 1.2 * c.scale + by * c.scale, B.dust, 1.6, 0.6);
    if (Math.random() < 0.4)
      c.fx.spawn(c.fx.add, c.fx.tex.spark, c.x + rand(-2, 2) * c.scale, c.y + c.scale, bx * 10, by * 10 - 3, 0.2, mixRgb(B.brassLight, 0xffffff, 0.4), 0.8, 0.2);
  }

  override die(): void {
    this.lit.alpha = 0;
    this.halo.alpha = 0;
  }
}
