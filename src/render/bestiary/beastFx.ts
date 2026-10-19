import { Container, type Texture } from 'pixi.js';
import type { Atlas } from '../atlas';
import { spawnHeld } from '../ailmentBursts';
import { FxLayer, type FxParticle } from '../particles';

/**
 * Free particles of the M4 enemies: ripples and bubbles on the water (`threat`: a Bog Lurker's
 * ripples are its telegraph, never dimmed), drips, steam, sparks and embers on bodies (`body` and
 * `add`, dimmed with the player's effects on busy screens like the M3 creature effects).
 * Spawns share a budget so 300 dripping hulks can't flood the pools.
 */
export class BeastFx {
  /** On the ground under the bodies: ripples and tar bubbles. Never dimmed. */
  readonly threat: FxLayer;
  /** Above the bodies: drips, steam, crackle sparks. */
  readonly body: FxLayer;
  readonly add: FxLayer;
  readonly under = new Container();
  readonly over = new Container();
  readonly tex: Record<
    'dot' | 'ring' | 'puff' | 'spark' | 'glow' | 'drip' | 'star' | 'zapA' | 'zapB',
    Texture
  >;
  private budget = 0;

  constructor(atlas: Atlas) {
    const dot = atlas.get('dot');
    this.threat = new FxLayer(dot, 900);
    this.body = new FxLayer(dot, 1400);
    this.add = new FxLayer(dot, 500, 'add');
    this.under.addChild(this.threat.container);
    this.over.addChild(this.body.container, this.add.container);
    this.tex = {
      dot,
      ring: atlas.get('ring'),
      puff: atlas.get('puff'),
      spark: atlas.get('spark'),
      glow: atlas.get('glow'),
      drip: atlas.get('tar_drip'),
      star: atlas.get('star'),
      zapA: atlas.get('zap_a'),
      zapB: atlas.get('zap_b'),
    };
  }

  get count(): number {
    return this.threat.count + this.body.count + this.add.count;
  }

  reset(): void {
    this.threat.clear();
    this.body.clear();
    this.add.clear();
  }

  update(dt: number): void {
    this.budget = Math.min(this.budget, 2) + 400 * dt;
    this.threat.update(dt);
    this.body.update(dt);
    this.add.update(dt);
  }

  /**
   * Stochastic allowance for ambient spawns: true with probability rate·dt (≤ 1) while the frame
   * budget lasts. Threats bypass this (call `spawn` directly).
   */
  take(rate: number, dt: number): boolean {
    if (this.budget < 1 || Math.random() >= rate * dt) return false;
    this.budget -= 1;
    return true;
  }

  spawn(
    layer: FxLayer,
    tex: Texture,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    tint: number,
    s0: number,
    s1: number,
  ): FxParticle | null {
    return spawnHeld(layer, tex, x, y, vx, vy, life, tint, s0, s1);
  }

  /** A flat water ring (ellipse) growing from r0 to r1 cells. */
  ripple(x: number, y: number, r0: number, r1: number, life: number, tint: number, alpha = 0.9): void {
    const p = spawnHeld(this.threat, this.tex.ring, x, y, 0, 0, life, tint, r0, r1);
    if (!p) return;
    p.aspect = 0.5;
    p.hold = 0.15;
    p.a0 = alpha;
  }
}
