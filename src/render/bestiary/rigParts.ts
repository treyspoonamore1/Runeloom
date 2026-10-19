import { Container, Sprite } from 'pixi.js';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import { smoothstep } from '../mathx';
import type { BeastCtx } from './beastRig';

/** Shared pieces of the big M4 rigs: fists that ease between poses, slam poses, tar drips. */

/** Eases a pair of fists toward a pose (positions per side, in lift units). */
export class Fists {
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
export function slamPose(
  c: BeastCtx,
  rest: [number, number],
  up: [number, number],
  down: [number, number],
): [number, number] {
  if (c.phase === 'windup') {
    const w = smoothstep(0, 1, c.wind);
    return [rest[0] + (up[0] - rest[0]) * w, rest[1] + (up[1] - rest[1]) * w];
  }
  if (c.phase === 'active' || c.phase === 'recover') return down;
  return rest;
}

export function drip(c: BeastCtx, width: number, bottom: number, rate: number): void {
  if (!c.fx.take(rate, c.dt)) return;
  const p = c.fx.spawn(
    c.fx.body,
    c.fx.tex.drip,
    c.x + rand(-width, width) * c.scale,
    c.y + bottom * c.scale,
    0,
    1.5,
    rand(0.35, 0.55),
    0xffffff,
    0.8 * c.scale,
    0.5 * c.scale,
  );
  if (p) p.grav = 14;
}

// ---- Tar Hulk: drips, slams, and a fuse when Oiled and burning ----------------------------
