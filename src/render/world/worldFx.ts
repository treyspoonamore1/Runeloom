import { Container, type Texture } from 'pixi.js';
import type { Atlas } from '../atlas';
import { burst, rand, spawnHeld } from '../ailmentBursts';
import { FxLayer, type FxParticle } from '../particles';

const TAU = Math.PI * 2;

export type WorldTex = Record<
  | 'dot'
  | 'glow'
  | 'ring'
  | 'star'
  | 'puff'
  | 'spark'
  | 'chip'
  | 'thread'
  | 'zapA'
  | 'zapB'
  | 'crystal'
  | 'shard'
  | 'lockSmall'
  | 'lockBig'
  | 'heart'
  | 'line',
  Texture
>;

/**
 * Particles for world moments (objects, loot, level ups, boss deaths). Rare events, so they are
 * never dimmed: `ground` sits under the bodies, `top` and `add` above everything but the HUD.
 */
export class WorldFx {
  readonly ground: FxLayer;
  readonly top: FxLayer;
  readonly add: FxLayer;
  readonly under = new Container();
  readonly over = new Container();
  readonly t: WorldTex;

  constructor(atlas: Atlas) {
    const dot = atlas.get('dot');
    this.ground = new FxLayer(dot, 400);
    this.top = new FxLayer(dot, 1200);
    this.add = new FxLayer(dot, 400, 'add');
    this.under.addChild(this.ground.container);
    this.over.addChild(this.top.container, this.add.container);
    this.t = {
      dot,
      glow: atlas.get('glow'),
      ring: atlas.get('ring'),
      star: atlas.get('star'),
      puff: atlas.get('puff'),
      spark: atlas.get('spark'),
      chip: atlas.get('chip'),
      thread: atlas.get('thread'),
      zapA: atlas.get('zap_a'),
      zapB: atlas.get('zap_b'),
      crystal: atlas.get('frost_crystal'),
      shard: atlas.get('shard'),
      lockSmall: atlas.get('lock_small'),
      lockBig: atlas.get('lock_big'),
      heart: atlas.get('heart_seed'),
      line: atlas.get('line'),
    };
  }

  get count(): number {
    return this.ground.count + this.top.count + this.add.count;
  }

  reset(): void {
    this.ground.clear();
    this.top.clear();
    this.add.clear();
  }

  update(dt: number): void {
    this.ground.update(dt);
    this.top.update(dt);
    this.add.update(dt);
  }

  one(
    layer: FxLayer,
    tex: Texture,
    x: number,
    y: number,
    life: number,
    tint: number,
    s0: number,
    s1: number,
    a0 = 1,
  ): FxParticle | null {
    const p = spawnHeld(layer, tex, x, y, 0, 0, life, tint, s0, s1);
    if (p) p.a0 = a0;
    return p;
  }

  /** A flat ring growing on the ground (ellipse), e.g. a plate's dust ring. */
  groundRing(x: number, y: number, r0: number, r1: number, life: number, tint: number, a0 = 0.8): void {
    const p = this.one(this.ground, this.t.ring, x, y, life, tint, r0, r1, a0);
    if (p) {
      p.aspect = 0.55;
      p.hold = 0.1;
    }
  }

  /** Radial burst; cfg tunes each particle (gravity, drag, spin). */
  burst(
    layer: FxLayer,
    tex: Texture,
    x: number,
    y: number,
    n: number,
    sp: [number, number],
    life: [number, number],
    tints: readonly number[],
    s: [number, number],
    jitter: number,
    cfg: (p: FxParticle) => void = () => {},
  ): void {
    burst(layer, tex, x, y, n, sp, life, tints, s, jitter, cfg);
  }

  /** Dust puffs along a horizontal edge (doors, blocks). */
  dust(x: number, y: number, width: number, n: number, tint = 0xd8c3a0): void {
    for (let i = 0; i < n; i++) {
      const p = spawnHeld(
        this.top,
        this.t.puff,
        x + rand(-width / 2, width / 2),
        y + rand(-0.3, 0.3),
        rand(-2, 2),
        rand(-2.5, -0.5),
        rand(0.4, 0.7),
        tint,
        0.5,
        1.2,
      );
      if (p) {
        p.a0 = 0.75;
        p.drag = 3;
      }
    }
  }

  /** Motes spiraling up around (x, y): Loom threads, level ups. */
  spiral(
    x: number,
    y: number,
    n: number,
    r: number,
    tints: readonly number[],
    rise: number,
    life: number,
  ): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const p = spawnHeld(
        this.top,
        this.t.dot,
        x + Math.cos(a) * r,
        y + Math.sin(a) * r * 0.5,
        -Math.sin(a) * r * 2.5,
        Math.cos(a) * r * 1.2 - rise,
        life * rand(0.8, 1.2),
        tints[i % tints.length]!,
        0.35,
        0.08,
      );
      if (p) p.drag = 1.5;
    }
  }
}
