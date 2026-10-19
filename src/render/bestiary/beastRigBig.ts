import { Container, Sprite } from 'pixi.js';
import { M4_STATE } from '../../app/m4Wiring';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import { mixRgb } from '../ailmentPalette';
import { ELEMENT } from '../combatPalette';
import { FLAME_POS } from '../enemyRig';
import { clamp, smoothstep } from '../mathx';
import { BeastRig, type BeastCtx, type BeastFactory } from './beastRig';
import { BEAST_FEEL as F, BESTIARY as B, type M4Kind } from './bestiaryPalette';

const TAU = Math.PI * 2;

/** Eases a pair of fists toward a pose (positions per side, in lift units). */
class Fists {
  readonly l: Sprite;
  readonly r: Sprite;
  private lx = 0;
  private ly = 0;
  private rx = 0;
  private ry = 0;

  constructor(atlas: Atlas, name: string, parent: Container) {
    this.l = new Sprite(atlas.get(name));
    this.r = new Sprite(atlas.get(name));
    this.r.scale.x = -1;
    parent.addChild(this.l, this.r);
  }

  set(lx: number, ly: number, rx: number, ry: number, k: number): void {
    this.lx += (lx - this.lx) * k;
    this.ly += (ly - this.ly) * k;
    this.rx += (rx - this.rx) * k;
    this.ry += (ry - this.ry) * k;
    this.l.position.set(this.lx, this.ly);
    this.r.position.set(this.rx, this.ry);
  }

  snap(lx: number, ly: number, rx: number, ry: number): void {
    this.lx = lx;
    this.ly = ly;
    this.rx = rx;
    this.ry = ry;
    this.set(lx, ly, rx, ry, 1);
  }
}

/** Fist pose for slams: raised through the windup, slammed down on release, then back. */
function slamPose(c: BeastCtx, rest: [number, number], up: [number, number], down: [number, number]): [number, number] {
  if (c.phase === 'windup') {
    const w = smoothstep(0, 1, c.wind);
    return [rest[0] + (up[0] - rest[0]) * w, rest[1] + (up[1] - rest[1]) * w];
  }
  if (c.phase === 'active' || c.phase === 'recover') return down;
  return rest;
}

function drip(c: BeastCtx, width: number, bottom: number, rate: number): void {
  if (!c.fx.take(rate, c.dt)) return;
  const p = c.fx.spawn(c.fx.body, c.fx.tex.drip, c.x + rand(-width, width) * c.scale, c.y + bottom * c.scale, 0, 1.5, rand(0.35, 0.55), 0xffffff, 0.8 * c.scale, 0.5 * c.scale);
  if (p) p.grav = 14;
}

// ---- Tar Hulk: drips, slams, and a fuse when Oiled and burning ----------------------------

export class HulkRig extends BeastRig {
  private readonly fists: Fists;
  private readonly cracks: Sprite;
  private fusePhase = 0;

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    this.cracks = this.sprite('tar_hulk_cracks', lift);
    this.cracks.alpha = 0;
    this.fists = new Fists(atlas, 'tar_hulk_fist', lift);
    this.fists.snap(-2.55, 0.1, 2.55, 0.1);
  }

  override reset(): void {
    this.cracks.alpha = 0;
    this.fusePhase = 0;
    this.fists.snap(-2.55, 0.1, 2.55, 0.1);
  }

  update(c: BeastCtx): void {
    const swing = Math.sin(c.t * 5) * 0.3 * c.run;
    const slam = c.attack === 'hulkSlam' || c.attack === undefined;
    const [px, py] = slam ? slamPose(c, [2.55, 0.1], [1.5, -3.9], [2.1, 1.4]) : [2.55, 0.1];
    this.fists.set(-px, py + swing, px, py - swing, c.phase === 'active' ? 1 : 1 - Math.exp(-c.dt / 0.07));
    drip(c, 2.0, 1.9, F.dripRate);
    // The fuse: fissures glow, pulsing faster toward the blast; sparks spit from the top.
    const fuse = c.sig?.fuse ?? -1;
    if (fuse >= 0) {
      const u = clamp(fuse / 1.5, 0, 1);
      this.fusePhase += c.dt * TAU * (F.fuseHz0 + (F.fuseHz1 - F.fuseHz0) * u * u);
      const pulse = 0.5 + 0.5 * Math.sin(this.fusePhase);
      this.cracks.alpha = smoothstep(0, 0.12, u) * (0.55 + 0.45 * pulse);
      this.cracks.tint = mixRgb(B.tar.crack, 0xffffff, pulse * u * 0.6);
      if (this.flash.alpha < 0.05) {
        this.flash.tint = 0xffa060;
        this.flash.alpha = 0.4 * pulse * u;
      }
      const swell = 1 + 0.08 * u * pulse;
      this.lift.scale.x *= swell;
      this.lift.scale.y *= swell;
      if (c.fx.take(25, c.dt)) {
        const p = c.fx.spawn(c.fx.add, c.fx.tex.spark, c.x + rand(-1, 1) * c.scale, c.y - 3.8 * c.scale, rand(-6, 6), -rand(6, 12), rand(0.15, 0.3), Math.random() < 0.5 ? ELEMENT.fire : 0xffe08a, 0.8, 0.2);
        if (p) {
          p.align = true;
          p.stretch = 0.03;
          p.grav = 20;
        }
      }
    } else if (this.cracks.alpha > 0) this.cracks.alpha = Math.max(0, this.cracks.alpha - c.dt * 4);
  }
}

// ---- Tar Matriarch ------------------------------------------------------------------------

export class MatriarchRig extends BeastRig {
  private readonly fists: Fists;
  private readonly sac: Sprite;

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    this.sac = this.sprite('tar_matriarch_sac', lift, 0, -0.4);
    this.fists = new Fists(atlas, 'tar_matriarch_fist', lift);
    this.fists.snap(-4.0, 0.3, 4.0, 0.3);
  }

  update(c: BeastCtx): void {
    const swing = Math.sin(c.t * 4) * 0.4 * c.run;
    const k = c.phase === 'active' ? 1 : 1 - Math.exp(-c.dt / 0.08);
    let l: [number, number] = [-4.0, 0.3 + swing];
    let r: [number, number] = [4.0, 0.3 - swing];
    const summoning = c.attack === 'summon' && c.phase !== 'none';
    if (c.attack === 'matriarchSlam') {
      const [px, py] = slamPose(c, [4.0, 0.3], [2.4, -6.4], [3.2, 2.2]);
      l = [-px, py];
      r = [px, py];
    } else if (c.attack === 'tarGlob' && c.phase === 'windup') {
      // Wind back the throwing arm.
      const w = smoothstep(0, 1, c.wind);
      r = [4.0 - 1.0 * w, 0.3 - 5.8 * w];
    } else if (summoning) {
      const w = c.phase === 'windup' ? smoothstep(0, 1, c.wind) : 1;
      l = [-4.0 + 0.8 * w, 0.3 - 6.5 * w];
      r = [4.0 - 0.8 * w, 0.3 - 6.5 * w];
    }
    this.fists.set(l[0], l[1], r[0], r[1], k);
    // The brood sac throbs, hard while she summons.
    const beat = summoning ? 0.5 + 0.5 * Math.sin(c.t * 14) : 0.5 + 0.5 * Math.sin(c.t * 2.2);
    const s = 1 + (summoning ? 0.18 : 0.05) * beat;
    this.sac.scale.set(s);
    this.sac.tint = summoning ? mixRgb(0xffffff, 0xffe0a0, beat) : mixRgb(0x9a8a80, 0xffffff, beat * 0.4);
    drip(c, 3.4, 2.9, F.dripRate * 2);
    if (summoning && c.fx.take(30, c.dt)) {
      // Tar bubbles in a ring where the new hulks will rise.
      const a = rand(0, TAU);
      const rr = rand(5, 7) * c.scale;
      const p = c.fx.spawn(c.fx.threat, c.fx.tex.dot, c.x + Math.cos(a) * rr, c.y + 2 + Math.sin(a) * rr * 0.5, 0, -0.5, rand(0.4, 0.7), B.tar.light, 0.35, 0.7);
      if (p) p.aspect = 0.7;
    }
  }
}

// ---- Brood Kiln -------------------------------------------------------------------------------

export class KilnRig extends BeastRig {
  private readonly fire: Sprite;
  private readonly frost: Sprite;
  private lastSince = -1;
  private pop = 0;

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    this.fire = this.sprite('brood_kiln_fire', lift);
    this.frost = this.sprite('brood_kiln_frost', lift);
    this.frost.alpha = 0;
  }

  override reset(): void {
    this.lastSince = -1;
    this.pop = 0;
    this.frost.alpha = 0;
  }

  update(c: BeastCtx): void {
    const frozen = M4_STATE.frozen(c.e);
    const since = c.sig?.sinceSpawn ?? -1;
    const cyc = since >= 0 ? clamp(since / F.kilnCycle, 0, 1) : (c.t % F.kilnCycle) / F.kilnCycle;
    if (since >= 0 && (this.lastSince < 0 || since < this.lastSince)) this.spawned(c);
    this.lastSince = since;
    this.pop = Math.max(0, this.pop - c.dt);
    const flashK = this.pop / F.kilnFlash;
    let level = 0.3 + 0.7 * smoothstep(1 - F.kilnRamp, 1, cyc);
    level = Math.max(level, flashK);
    if (frozen) level = 0.04;
    const flick = 0.92 + 0.08 * Math.sin(c.t * 19) * Math.sin(c.t * 7.3);
    this.fire.alpha = level * flick;
    this.fire.scale.set(0.9 + 0.15 * level, 0.85 + 0.25 * level * flick);
    this.frost.alpha += ((frozen ? 1 : 0) - this.frost.alpha) * (1 - Math.exp(-c.dt / 0.12));
    // Swells as it hatches.
    const sw = 1 + 0.06 * smoothstep(0.75, 1, cyc) * (frozen ? 0 : 1) + 0.1 * flashK;
    this.lift.scale.x *= sw;
    this.lift.scale.y *= 2 - sw;
    if (c.glow) {
      c.glow.x = c.x;
      c.glow.y = c.y - 0.1 * c.scale;
      c.glow.scaleX = c.glow.scaleY = (3 + 1.5 * level) * c.scale;
      c.glow.fade(0.55 * level);
    }
    if (!frozen && c.fx.take(1.4, c.dt)) {
      const p = c.fx.spawn(c.fx.body, c.fx.tex.puff, c.x + rand(-0.2, 0.2), c.y - 4.3 * c.scale, rand(-0.5, 0.5), -rand(2, 3.5), rand(0.9, 1.4), 0x5a4a52, 0.5, 1.4);
      if (p) {
        p.a0 = 0.5;
        p.grav = -1;
      }
    }
  }

  private spawned(c: BeastCtx): void {
    this.pop = F.kilnFlash;
    const fx = c.fx;
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * 0.5 + rand(-0.9, 0.9);
      const v = rand(5, 12);
      const p = fx.spawn(fx.body, fx.tex.dot, c.x, c.y + 0.2 * c.scale, Math.cos(a) * v, Math.sin(a) * v * 0.6, rand(0.3, 0.6), Math.random() < 0.5 ? B.brood_kiln.fire : B.brood_kiln.fireHot, 0.3, 0.06);
      if (p) {
        p.drag = 3;
        p.grav = -4;
      }
    }
    for (let i = 0; i < 3; i++) {
      const p = fx.spawn(fx.body, fx.tex.puff, c.x + rand(-1, 1), c.y + 0.5 * c.scale, rand(-2, 2), rand(0.5, 2), rand(0.5, 0.8), 0x7a6a70, 0.6, 1.4);
      if (p) p.a0 = 0.6;
    }
  }
}

// ---- Cinder Warden ----------------------------------------------------------------------------

export class WardenRig extends BeastRig {
  private readonly fists: Fists;
  private readonly seams: Sprite;
  private readonly flames: Sprite[] = [];
  private readonly boots: Sprite[] = [];
  private stride = 0;

  constructor(atlas: Atlas, root: Container, lift: Container, body: Sprite, flash: Sprite) {
    super(atlas, root, lift, body, flash);
    for (const bx of [-1.8, 1.8]) {
      const b = new Sprite(atlas.get('cinder_warden_boot'));
      b.position.set(bx, 3.3);
      root.addChildAt(b, 0);
      this.boots.push(b);
    }
    this.seams = this.sprite('cinder_warden_seams', lift);
    for (let i = 0; i < FLAME_POS.length; i++) {
      const f = this.sprite('tinderling_flame', lift, (FLAME_POS[i]![0] ?? 0) * 1.9, -5.35);
      this.flames.push(f);
    }
    this.fists = new Fists(atlas, 'cinder_warden_fist', lift);
    this.fists.snap(-3.9, 0.6, 3.9, 0.6);
  }

  update(c: BeastCtx): void {
    const e = c.e;
    const phase = c.sig?.phase ?? M4_STATE.bossPhase(e);
    const heat = c.sig?.superheat ?? false;
    const broken = phase >= 2 && !heat;
    const pulse = 0.5 + 0.5 * Math.sin(c.t * TAU * F.heatHz);
    const W = B.cinder_warden;
    this.seams.tint = heat ? mixRgb(W.seam, W.seamHot, 0.45 + 0.55 * pulse) : broken ? W.seamCold : W.seam;
    this.seams.alpha = heat ? 1 : broken ? 0.75 : 0.95;
    // Boots stomp.
    this.stride += c.dt * (2 + 9 * c.run);
    for (let i = 0; i < 2; i++) {
      const ph = this.stride + i * Math.PI;
      this.boots[i]!.pivot.set(Math.cos(ph) * 0.25 * c.run, Math.sin(ph) * 0.35 * c.run);
    }
    // Poses.
    const k = c.phase === 'active' ? 1 : 1 - Math.exp(-c.dt / 0.07);
    let l: [number, number] = [-3.9, 0.6 + Math.sin(this.stride) * 0.3 * c.run];
    let r: [number, number] = [3.9, 0.6 - Math.sin(this.stride) * 0.3 * c.run];
    let flameK = heat ? 1.3 : broken ? 0.65 : 1;
    if (c.attack === 'fireSlam') {
      const [px, py] = slamPose(c, [3.9, 0.6], [1.9, -6.6], [2.8, 2.2]);
      l = [-px, py];
      r = [px, py];
    } else if (c.attack === 'wardenCharge') {
      // Head down, fists forward; leans into the run while charging.
      const w = c.phase === 'windup' ? smoothstep(0, 1, c.wind) : c.phase === 'active' ? 1 : 0;
      l = [-2.6 + c.cx * 2.2 * w, 0.6 + c.cy * 1.6 * w];
      r = [2.6 + c.cx * 2.2 * w, 0.6 + c.cy * 1.6 * w];
      this.lift.rotation += c.cx * 0.22 * w;
      if (c.phase === 'active' && c.fx.take(40, c.dt)) {
        const p = c.fx.spawn(c.fx.body, c.fx.tex.dot, c.x - c.cx * 3 * c.scale + rand(-1.5, 1.5), c.y + 3 * c.scale + rand(-0.5, 0.5), -c.cx * 6, -rand(2, 5), rand(0.3, 0.5), Math.random() < 0.5 ? W.flameOuter : W.flameInner, 0.45, 0.1);
        if (p) p.grav = -6;
      }
    } else if (c.attack === 'fireBreath') {
      flameK *= 1 + 0.9 * c.wind;
    } else if (c.attack === 'brazierStorm') {
      const w = c.phase === 'windup' ? smoothstep(0, 1, c.wind) : c.phase === 'none' ? 0 : 1;
      r = [3.9 - 1.2 * w, 0.6 - 7.4 * w];
      if (w > 0.3 && c.fx.take(25, c.dt)) {
        const p = c.fx.spawn(c.fx.add, c.fx.tex.spark, c.x + r[0] * c.scale + rand(-0.8, 0.8), c.y + (r[1] - 1) * c.scale + rand(-0.8, 0.8), rand(-6, 6), rand(-6, 6), 0.12, ELEMENT.storm, 0.7, 0.2);
        if (p) p.align = true;
      }
    }
    this.fists.set(l[0], l[1], r[0], r[1], k);
    for (let i = 0; i < this.flames.length; i++) {
      const f = this.flames[i]!;
      const n = 0.6 * Math.sin(c.t * (9 + i * 2.7)) + 0.4 * Math.sin(c.t * (23 + i * 4.1) + i);
      const s = (FLAME_POS[i]![2] ?? 1) * 1.7 * flameK;
      f.scale.set(s * (1 - 0.08 * n), s * (1 + 0.2 * n));
      f.tint = broken ? 0xc8a090 : 0xffffff;
    }
    // Superheat: a pulsing heat aura and rising sparks. Phase 2 floods: steam boils off him.
    if (c.glow) {
      c.glow.x = c.x;
      c.glow.y = c.y - 1.8 * c.scale;
      const g = heat ? 0.6 + 0.25 * pulse : broken ? 0.12 : 0.28;
      c.glow.scaleX = c.glow.scaleY = (6.5 + (heat ? 1.2 * pulse : 0)) * c.scale;
      c.glow.fade(g);
    }
    if (heat && c.fx.take(16, c.dt)) {
      const p = c.fx.spawn(c.fx.add, c.fx.tex.dot, c.x + rand(-3.5, 3.5) * c.scale, c.y + rand(-4, 2) * c.scale, rand(-1, 1), -rand(4, 8), rand(0.4, 0.7), W.heat, 0.3, 0.06);
      if (p) p.drag = 1;
    }
    if (phase >= 2 && c.fx.take(F.steamRate * (heat ? 1 : 0.6), c.dt)) {
      // Steam boils off his shoulders and helm, rising clear of the face.
      const side = Math.random() < 0.5 ? -1 : 1;
      const p = c.fx.spawn(c.fx.body, c.fx.tex.puff, c.x + side * rand(2.2, 4) * c.scale, c.y + rand(-5.5, -3) * c.scale, side * rand(0.3, 1.5), -rand(3, 5), rand(0.7, 1.1), W.steam, 0.45, 1.7);
      if (p) {
        p.a0 = 0.4;
        p.grav = -2;
      }
    }
    if (phase >= 3 && c.fx.take(6, c.dt)) {
      // The storm phase: sparks crawl over his horns.
      const side = Math.random() < 0.5 ? -1 : 1;
      const p = c.fx.spawn(c.fx.add, Math.random() < 0.5 ? c.fx.tex.zapA : c.fx.tex.zapB, c.x + side * rand(1.6, 2.8) * c.scale, c.y - rand(5.5, 7) * c.scale, 0, 0, 0.1, ELEMENT.storm, 0.7, 0.6);
      if (p) p.rotation = rand(0, TAU);
    }
  }
}

export const BIG_RIGS: Partial<Record<M4Kind, BeastFactory>> = {
  tar_hulk: (a, r, l, b, f) => new HulkRig(a, r, l, b, f),
  tar_matriarch: (a, r, l, b, f) => new MatriarchRig(a, r, l, b, f),
  brood_kiln: (a, r, l, b, f) => new KilnRig(a, r, l, b, f),
  cinder_warden: (a, r, l, b, f) => new WardenRig(a, r, l, b, f),
};
