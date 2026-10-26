import { Container, Sprite } from 'pixi.js';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import type { BeastCtx } from './beastRig';

/** Shared pieces of the Fen rigs: stun stars, a glow sprite, state easing, splashes. */

const TAU = Math.PI * 2;

/** Three stars circling over the head while stunned. */
export class StunStars {
  private readonly stars: Sprite[] = [];
  constructor(atlas: Atlas, parent: Container) {
    for (let i = 0; i < 3; i++) {
      const s = new Sprite(atlas.get('star'));
      s.tint = 0xfff2a0;
      s.scale.set(0.32);
      s.visible = false;
      parent.addChild(s);
      this.stars.push(s);
    }
  }
  update(on: boolean, t: number, x: number, y: number, r: number): void {
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i]!;
      s.visible = on;
      if (!on) continue;
      const a = t * 4 + (i * TAU) / 3;
      s.position.set(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.4);
      s.rotation = t * 3;
    }
  }
}

/** An additive glow sprite behind (index 0) or over a parent. */
export function glowSprite(atlas: Atlas, parent: Container, tint: number, back = true): Sprite {
  const g = new Sprite(atlas.get('glow'));
  g.blendMode = 'add';
  g.tint = tint;
  g.alpha = 0;
  if (back) parent.addChildAt(g, 0);
  else parent.addChild(g);
  return g;
}

/** Eases v toward target with time constant tau (s). */
export function ease(v: number, target: number, dt: number, tau: number): number {
  return v + (target - v) * (1 - Math.exp(-dt / Math.max(1e-3, tau)));
}

/** A splash of droplets and a ring on water at (x, y). */
export function splash(c: BeastCtx, x: number, y: number, n: number, tint: number, ring: number): void {
  const fx = c.fx;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    const p = fx.spawn(
      fx.body,
      fx.tex.dot,
      x,
      y,
      Math.cos(a) * rand(3, 8),
      Math.sin(a) * rand(1.5, 4) - 5,
      rand(0.3, 0.5),
      tint,
      0.28,
      0.1,
    );
    if (p) p.grav = 26;
  }
  if (ring > 0) fx.ripple(x, y, ring * 0.3, ring, 0.45, tint, 0.9);
}

/** A puff of dust or steam rising from (x, y). */
export function puff(c: BeastCtx, x: number, y: number, tint: number, size: number, rise: number): void {
  const p = c.fx.spawn(
    c.fx.body,
    c.fx.tex.puff,
    x,
    y,
    rand(-1, 1),
    -rise,
    rand(0.5, 0.9),
    tint,
    size * 0.5,
    size * 1.4,
  );
  if (p) {
    p.a0 = 0.6;
    p.drag = 1.5;
    p.rotation = rand(0, TAU);
  }
}
