import { Container, Sprite } from 'pixi.js';
import { M4_STATE } from '../../app/m4Wiring';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import { mixRgb } from '../ailmentPalette';
import { ELEMENT } from '../combatPalette';
import { FLAME_POS } from '../enemyRig';
import { smoothstep } from '../mathx';
import { BeastRig, type BeastCtx } from './beastRig';
import { BEAST_FEEL as F, BESTIARY as B } from './bestiaryPalette';
import { Fists, slamPose } from './rigParts';

const TAU = Math.PI * 2;

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
        const p = c.fx.spawn(
          c.fx.body,
          c.fx.tex.dot,
          c.x - c.cx * 3 * c.scale + rand(-1.5, 1.5),
          c.y + 3 * c.scale + rand(-0.5, 0.5),
          -c.cx * 6,
          -rand(2, 5),
          rand(0.3, 0.5),
          Math.random() < 0.5 ? W.flameOuter : W.flameInner,
          0.45,
          0.1,
        );
        if (p) p.grav = -6;
      }
    } else if (c.attack === 'fireBreath') {
      flameK *= 1 + 0.9 * c.wind;
    } else if (c.attack === 'brazierStorm') {
      const w = c.phase === 'windup' ? smoothstep(0, 1, c.wind) : c.phase === 'none' ? 0 : 1;
      r = [3.9 - 1.2 * w, 0.6 - 7.4 * w];
      if (w > 0.3 && c.fx.take(25, c.dt)) {
        const p = c.fx.spawn(
          c.fx.add,
          c.fx.tex.spark,
          c.x + r[0] * c.scale + rand(-0.8, 0.8),
          c.y + (r[1] - 1) * c.scale + rand(-0.8, 0.8),
          rand(-6, 6),
          rand(-6, 6),
          0.12,
          ELEMENT.storm,
          0.7,
          0.2,
        );
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
      const p = c.fx.spawn(
        c.fx.add,
        c.fx.tex.dot,
        c.x + rand(-3.5, 3.5) * c.scale,
        c.y + rand(-4, 2) * c.scale,
        rand(-1, 1),
        -rand(4, 8),
        rand(0.4, 0.7),
        W.heat,
        0.3,
        0.06,
      );
      if (p) p.drag = 1;
    }
    if (phase >= 2 && c.fx.take(F.steamRate * (heat ? 1 : 0.6), c.dt)) {
      // Steam boils off his shoulders and helm, rising clear of the face.
      const side = Math.random() < 0.5 ? -1 : 1;
      const p = c.fx.spawn(
        c.fx.body,
        c.fx.tex.puff,
        c.x + side * rand(2.2, 4) * c.scale,
        c.y + rand(-5.5, -3) * c.scale,
        side * rand(0.3, 1.5),
        -rand(3, 5),
        rand(0.7, 1.1),
        W.steam,
        0.45,
        1.7,
      );
      if (p) {
        p.a0 = 0.4;
        p.grav = -2;
      }
    }
    if (phase >= 3 && c.fx.take(6, c.dt)) {
      // The storm phase: sparks crawl over his horns.
      const side = Math.random() < 0.5 ? -1 : 1;
      const p = c.fx.spawn(
        c.fx.add,
        Math.random() < 0.5 ? c.fx.tex.zapA : c.fx.tex.zapB,
        c.x + side * rand(1.6, 2.8) * c.scale,
        c.y - rand(5.5, 7) * c.scale,
        0,
        0,
        0.1,
        ELEMENT.storm,
        0.7,
        0.6,
      );
      if (p) p.rotation = rand(0, TAU);
    }
  }
}
