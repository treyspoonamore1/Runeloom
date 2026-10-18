import { Container } from 'pixi.js';
import type { GameState, Projectile } from '../sim';
import type { Atlas } from './atlas';
import { PROJ } from './combatPalette';
import type { FxLayer, FxParticle } from './particles';
import { ParticlePool } from './particles';

interface ProjView {
  id: number;
  seen: number;
  isArrow: boolean;
  glow: FxParticle | null;
  trail: FxParticle | null;
  core: FxParticle | null;
  phase: number;
  emberTimer: number;
}

/** Above this many live projectiles, bolts stop shedding embers in flight. */
const EMBER_LIMIT = 300;

/** Glow, trail and core pools for one team, drawn in that order. */
interface Pools {
  glow: ParticlePool;
  trail: ParticlePool;
  core: ParticlePool;
}

/**
 * Projectiles, interpolated between ticks. Player bolts go in `player` (dimmed by effect
 * density), enemy shots in `enemy` (never dimmed, drawn above the player). Each projectile is
 * three pooled particles in separate layers (glow under trail under core), so swap-removal
 * never reorders them. Glows use normal blending: additive washes out on light ground.
 */
export class ProjectileView {
  readonly player = new Container();
  readonly enemy = new Container();
  private readonly mine: Pools;
  private readonly theirs: Pools;
  private readonly byId = new Map<number, ProjView>();
  private readonly live: ProjView[] = [];
  private readonly spare: ProjView[] = [];
  private frame = 0;

  constructor(
    private readonly atlas: Atlas,
    private readonly embers: FxLayer,
  ) {
    const tex = atlas.get('glow');
    const pools = (trailBlend: 'add' | 'normal'): Pools => ({
      glow: new ParticlePool(tex, 4096),
      trail: new ParticlePool(tex, 4096, trailBlend),
      core: new ParticlePool(tex, 4096),
    });
    this.mine = pools('add');
    this.theirs = pools('normal');
    for (const [c, p] of [
      [this.player, this.mine],
      [this.enemy, this.theirs],
    ] as const)
      c.addChild(p.glow.container, p.trail.container, p.core.container);
  }

  get count(): number {
    return this.live.length;
  }

  reset(): void {
    for (const v of this.live) this.release(v);
    this.live.length = 0;
    this.byId.clear();
  }

  update(state: GameState, alpha: number, dt: number): void {
    const frame = ++this.frame;
    const shed = state.projectiles.length < EMBER_LIMIT;
    for (const p of state.projectiles) {
      if (p.ended) continue;
      let v = this.byId.get(p.id);
      if (!v) v = this.create(p);
      v.seen = frame;
      const x = p.prevX + (p.x - p.prevX) * alpha;
      const y = p.prevY + (p.y - p.prevY) * alpha;
      const ang = Math.atan2(p.vy, p.vx);
      v.phase += dt;
      const flick = 0.5 + 0.5 * Math.sin(v.phase * 31 + v.id);
      if (v.glow) {
        v.glow.x = x;
        v.glow.y = y;
        v.glow.rotation = ang;
        if (!v.isArrow) v.glow.scaleX = v.glow.scaleY = PROJ.boltGlowR * p.radius * (0.92 + 0.12 * flick);
      }
      if (v.trail) {
        v.trail.x = x;
        v.trail.y = y;
        v.trail.rotation = ang;
        // Grow the trail over the first moments so it never pokes out behind the caster.
        const len = Math.min(1, v.phase * 12) * (v.isArrow ? PROJ.arrowTrailLen : PROJ.boltTrailLen);
        v.trail.scaleX = len;
      }
      if (v.core) {
        v.core.x = x;
        v.core.y = y;
        v.core.rotation = ang;
      }
      if (!v.isArrow && shed) {
        v.emberTimer -= dt;
        if (v.emberTimer <= 0) {
          v.emberTimer = 0.03 + Math.random() * 0.04;
          const e = this.embers.spawn(
            this.atlas.get('dot'),
            x - Math.cos(ang) * p.radius + (Math.random() - 0.5) * p.radius,
            y - Math.sin(ang) * p.radius + (Math.random() - 0.5) * p.radius,
            p.vx * 0.08 + (Math.random() - 0.5) * 4,
            p.vy * 0.08 + (Math.random() - 0.5) * 4 - 2,
            0.2 + Math.random() * 0.15,
            Math.random() < 0.5 ? PROJ.boltCore : PROJ.boltRim,
            0.22,
            0.05,
          );
          if (e) e.drag = 4;
        }
      }
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const v = this.live[i]!;
      if (v.seen === frame) continue;
      this.live[i] = this.live[this.live.length - 1]!;
      this.live.pop();
      this.byId.delete(v.id);
      this.release(v);
    }
  }

  private create(p: Projectile): ProjView {
    const v = this.spare.pop() ?? {
      id: 0,
      seen: 0,
      isArrow: false,
      glow: null,
      trail: null,
      core: null,
      phase: 0,
      emberTimer: 0,
    };
    v.id = p.id;
    v.phase = 0;
    v.emberTimer = 0;
    const enemy = p.team === 'enemy';
    v.isArrow = enemy;
    const P = enemy ? this.theirs : this.mine;
    const a = this.atlas;
    if (enemy) {
      // Fire arrow: thin dark shaft and hot tip, wrapped in the danger color.
      v.glow = P.glow.alloc(a.get('elong_glow'));
      if (v.glow) {
        v.glow.paint(PROJ.arrowDanger, 0.75);
        v.glow.scaleX = PROJ.arrowLen * 0.85;
        v.glow.scaleY = 2.4;
      }
      v.trail = P.trail.alloc(a.get('streak'));
      if (v.trail) {
        v.trail.paint(0xff6a3a, 0.7);
        v.trail.scaleY = 0.45;
        v.trail.anchorX = 1 - (PROJ.arrowLen * 0.35) / PROJ.arrowTrailLen;
      }
      v.core = P.core.alloc(a.get('arrow'));
    } else {
      v.glow = P.glow.alloc(a.get('glow'));
      if (v.glow) {
        v.glow.paint(PROJ.boltGlow, 0.45);
      }
      v.trail = P.trail.alloc(a.get('streak'));
      if (v.trail) {
        v.trail.paint(PROJ.boltTrail, 0.9);
        v.trail.scaleY = p.radius * 1.7;
      }
      v.core = P.core.alloc(a.get('bolt_core'));
      if (v.core) v.core.scaleX = v.core.scaleY = p.radius * 0.85;
    }
    this.byId.set(p.id, v);
    this.live.push(v);
    return v;
  }

  private release(v: ProjView): void {
    const P = v.isArrow ? this.theirs : this.mine;
    if (v.glow) P.glow.release(v.glow);
    if (v.trail) P.trail.release(v.trail);
    if (v.core) P.core.release(v.core);
    v.glow = v.trail = v.core = null;
    this.spare.push(v);
  }
}
