import type { Texture } from 'pixi.js';
import { AIL, type BodyBox } from './ailmentPalette';
import { bodyBoxOf } from './kindInfo';
import type { FxLayer, FxParticle } from './particles';

/**
 * One-shot particle bursts for ailments (freeze, thaw, shatter) and the helpers other effect
 * modules share (spawnHeld, burst). Render-only.
 */
const TAU = Math.PI * 2;

export function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/** Textures the bursts use (all from the shared atlas). */
export type BurstTex = Record<'dot' | 'glow' | 'spark' | 'crystal' | 'shard' | 'ring' | 'star' | 'puff', Texture>;

/** A free particle that holds its alpha for the first 40% of its life. */
export function spawnHeld(layer: FxLayer, tex: Texture, x: number, y: number, vx: number, vy: number, life: number, tint: number, s0: number, s1: number): FxParticle | null {
  const p = layer.spawn(tex, x, y, vx, vy, life, tint, s0, s1);
  if (p) p.hold = 0.4;
  return p;
}


/** Radial burst of n particles. */
export function burst(layer: FxLayer, tex: Texture, x: number, y: number, n: number, sp: [number, number], life: [number, number], tints: readonly number[], s: [number, number], jitter: number, cfg: (p: FxParticle) => void): void {
  for (let i = 0; i < n; i++) {
    const ang = rand(0, TAU);
    const v = rand(sp[0], sp[1]);
    const p = spawnHeld(layer, tex, x + rand(-jitter, jitter), y + rand(-jitter, jitter), Math.cos(ang) * v, Math.sin(ang) * v, rand(life[0], life[1]), tints[i % tints.length]!, s[0], s[1]);
    if (!p) return;
    p.rotation = rand(0, TAU);
    cfg(p);
  }
}

/** Crystallize: a cold ring snaps inward and glints flash on the block. */
export function freezeBurst(layer: FxLayer, t: BurstTex, x: number, y: number, box: BodyBox): void {
  const r = Math.max(box.w, (box.bottom - box.top) / 2);
  const ring = spawnHeld(layer, t.ring, x, y, 0, 0, 0.2, AIL.frost, r * 1.8, r * 0.9);
  if (ring) ring.hold = 0;
  burst(layer, t.star, x, y, 3, [0, 0], [0.18, 0.28], [0xffffff], [0.9, 0.2], r * 0.6, (p) => (p.a0 = 0.9));
  burst(layer, t.crystal, x, y, 5, [4, 8], [0.25, 0.4], [0xffffff], [0.4, 0.15], r * 0.4, (p) => {
    p.drag = 5;
    p.spin = rand(-6, 6);
  });
}

/** Thaw: the block cracks, a few chips fall and water drips. */
export function thawBurst(layer: FxLayer, t: BurstTex, x: number, y: number, box: BodyBox): void {
  const r = Math.max(box.w, (box.bottom - box.top) / 2);
  burst(layer, t.shard, x, y, 5, [3, 8], [0.35, 0.55], [AIL.ice, 0xffffff], [0.7, 0.45], r * 0.6, (p) => {
    p.spin = rand(-8, 8);
    p.grav = 18;
    p.drag = 2;
  });
  burst(layer, t.dot, x, y + r * 0.3, 7, [1, 4], [0.35, 0.6], [AIL.water, 0xd8f4ff], [0.16, 0.1], r * 0.8, (p) => {
    p.grav = 22;
  });
  burst(layer, t.puff, x, y, 3, [1, 3], [0.4, 0.6], [0xe8f8ff], [0.5, 1.1], r * 0.5, (p) => {
    p.a0 = 0.5;
    p.grav = -3;
  });
}

/** A frozen enemy died: ice shards burst out (no corpse), with a bright frost flash. */
export function shatterBurst(norm: FxLayer, add: FxLayer, t: BurstTex, x: number, y: number, kind: string): void {
  const box = bodyBoxOf(kind);
  const cy = y + (box.top + box.bottom) / 2;
  const r = Math.max(box.w, (box.bottom - box.top) / 2);
  const L = norm;
  // Frost flash: a short cold bloom (normal blend: additive bleaches light ground) and a white core.
  const flash = spawnHeld(L, t.glow, x, cy, 0, 0, 0.2, AIL.frost, r * 2.2, r * 2.8);
  if (flash) {
    flash.hold = 0.1;
    flash.a0 = 0.8;
  }
  const core = spawnHeld(add, t.glow, x, cy, 0, 0, 0.1, 0xffffff, r * 1.3, r * 0.8);
  if (core) core.hold = 0.3;
  const ring = spawnHeld(L, t.ring, x, cy, 0, 0, 0.24, AIL.frost, r * 0.8, r * 2.6);
  if (ring) ring.hold = 0.1;
  burst(L, t.shard, x, cy, AIL.shatterShards, [10, 24], [0.5, 0.9], [AIL.ice, 0xffffff, 0x9fdcff, 0xd8f4ff], [1.25, 0.8], r * 0.5, (p) => {
    p.spin = rand(-14, 14);
    p.drag = 3;
    p.grav = 14;
  });
  burst(L, t.shard, x, cy, 8, [3, 9], [0.4, 0.7], [0xffffff, AIL.ice], [0.8, 0.55], r * 0.7, (p) => {
    p.spin = rand(-10, 10);
    p.drag = 2;
    p.grav = 18;
  });
  burst(L, t.star, x, cy, 4, [2, 6], [0.15, 0.3], [0xffffff], [1.2, 0.3], r * 0.8, (p) => (p.drag = 4));
  burst(L, t.puff, x, cy, 5, [1, 4], [0.5, 0.8], [0xeafaff, 0xcfeefc], [0.7, 1.6], r * 0.6, (p) => {
    p.a0 = 0.55;
    p.drag = 2;
    p.grav = -2;
  });
}
