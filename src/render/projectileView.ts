import { Container } from 'pixi.js';
import type { DamageType } from '../../data/combatTypes';
import type { GameState, Projectile } from '../sim';
import type { Atlas } from './atlas';
import { PROJ } from './combatPalette';
import { boltLook, dominantType, type ElementLook } from './elementLook';
import type { FxLayer, FxParticle } from './particles';
import { ParticlePool } from './particles';

interface ProjView {
  id: number;
  seen: number;
  isArrow: boolean;
  element: DamageType;
  look: ElementLook;
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

  /** Element of a projectile seen last frame (for its impact burst), or null. */
  elementOf(id: number): DamageType | null {
    return this.byId.get(id)?.element ?? null;
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
      const crackle = !v.isArrow && v.look.crackle;
      if (v.glow) {
        v.glow.x = x;
        v.glow.y = y;
        v.glow.rotation = ang;
        if (!v.isArrow) {
          const f = crackle ? 0.8 + 0.4 * Math.random() : 0.92 + 0.12 * flick;
          v.glow.scaleX = v.glow.scaleY = PROJ.boltGlowR * p.radius * f;
        }
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
        // Storm sparks spin and flicker; other cores face their flight.
        v.core.rotation = crackle ? v.phase * 25 + Math.random() * 0.8 : ang;
      }
      if (!v.isArrow && shed) {
        v.emberTimer -= dt;
        if (v.emberTimer <= 0) {
          v.emberTimer = 0.03 + Math.random() * 0.04;
          this.shed(v.look, p, x, y, ang);
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

  /** One in-flight particle behind a player projectile, by its element's style. */
  private shed(L: ElementLook, p: Projectile, x: number, y: number, ang: number): void {
    const r = p.radius;
    const sx = x - Math.cos(ang) * r + (Math.random() - 0.5) * r;
    const sy = y - Math.sin(ang) * r + (Math.random() - 0.5) * r;
    const c = L.sparks[Math.floor(Math.random() * L.sparks.length)]!;
    if (L.shed === 'spark') {
      const a = Math.random() * Math.PI * 2;
      const e = this.embers.spawn(this.atlas.get('spark'), sx, sy, Math.cos(a) * 14 + p.vx * 0.1, Math.sin(a) * 14 + p.vy * 0.1, 0.07 + Math.random() * 0.07, c, 0.7, 0.3);
      if (e) {
        e.align = true;
        e.stretch = 0.03;
        e.drag = 6;
      }
    } else if (L.shed === 'flake') {
      const e = this.embers.spawn(this.atlas.get('frost_crystal'), sx, sy, p.vx * 0.05 + (Math.random() - 0.5) * 3, p.vy * 0.05 + (Math.random() - 0.5) * 3, 0.3 + Math.random() * 0.2, c, 0.32, 0.1);
      if (e) {
        e.drag = 3;
        e.spin = (Math.random() - 0.5) * 8;
      }
    } else {
      const e = this.embers.spawn(this.atlas.get('dot'), sx, sy, p.vx * 0.08 + (Math.random() - 0.5) * 4, p.vy * 0.08 + (Math.random() - 0.5) * 4 - 2, 0.2 + Math.random() * 0.15, c, 0.22, 0.05);
      if (e) e.drag = 4;
    }
  }

  private create(p: Projectile): ProjView {
    const v = this.spare.pop() ?? {
      id: 0,
      seen: 0,
      isArrow: false,
      element: 'fire' as DamageType,
      look: boltLook('fire'),
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
    v.element = dominantType(p.damage.base);
    v.look = boltLook(v.element);
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
      // Player bolt, in its element's look (elementLook.ts).
      const L = v.look;
      v.glow = P.glow.alloc(a.get('glow'));
      if (v.glow) v.glow.paint(L.glow, L.glowAlpha);
      v.trail = P.trail.alloc(a.get('streak'));
      if (v.trail) {
        v.trail.paint(L.trail, L.trailAlpha);
        v.trail.scaleY = p.radius * 1.7;
      }
      v.core = P.core.alloc(a.get(L.boltCore));
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
