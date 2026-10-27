import { Container } from 'pixi.js';
import type { DamageType } from '../../data/combatTypes';
import type { GameState, Projectile } from '../sim';
import type { SpellInstance } from '../sim/weave/runtime/types';
import { mixRgb } from './ailmentPalette';
import type { Atlas } from './atlas';
import { PROJ } from './combatPalette';
import {
  boltLook,
  dominantType,
  ECHO_ALPHA,
  ECHO_TINT,
  elementType,
  secondLook,
  spellLook,
  type ElementLook,
} from './elementLook';
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

/** What a flying body needs to be drawn: an enemy Projectile or a player Bolt instance. */
type Flyer = Pick<Projectile, 'id' | 'x' | 'y' | 'prevX' | 'prevY' | 'vx' | 'vy' | 'radius'>;

/** Above this many live projectiles and bolts, bolts stop shedding embers in flight. */
const EMBER_LIMIT = 300;

/** Glow, trail and core pools for one team, drawn in that order. */
interface Pools {
  glow: ParticlePool;
  trail: ParticlePool;
  core: ParticlePool;
}

/**
 * Projectiles, interpolated between ticks: enemy shots (`state.projectiles`) and the player's
 * Bolt spell instances (`state.spells`, form 'bolt'). Player bolts go in `player` (dimmed by
 * effect density), enemy shots in `enemy` (never dimmed, drawn above the player). Each one is
 * three pooled particles in separate layers (glow under trail under core), so swap-removal never
 * reorders them. A bolt takes its first element's look (elementLook.ts); a second element colors
 * its trail. Echo repeats are paler and fainter.
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

  /** Element of a projectile or bolt seen last frame (for its impact burst), or null. */
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
    const shed = this.live.length < EMBER_LIMIT;
    for (const p of state.projectiles) {
      if (p.ended) continue;
      let v = this.byId.get(p.id);
      if (!v) v = this.createArrowOrShot(p);
      v.seen = frame;
      this.place(v, p, alpha, dt, shed);
    }
    for (const s of state.spells) {
      if (s.form !== 'bolt' || s.ended) continue;
      let v = this.byId.get(s.id);
      if (!v) v = this.createBolt(s);
      v.seen = frame;
      this.place(v, s, alpha, dt, shed);
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

  private place(v: ProjView, p: Flyer, alpha: number, dt: number, shed: boolean): void {
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
      v.trail.scaleX = Math.min(1, v.phase * 12) * (v.isArrow ? PROJ.arrowTrailLen : PROJ.boltTrailLen);
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

  /** One in-flight particle behind a player bolt, by its element's style. */
  private shed(L: ElementLook, p: Flyer, x: number, y: number, ang: number): void {
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
    } else if (L.shed === 'wisp') {
      // Gale: a pale streak left behind along the flight, no rise.
      const e = this.embers.spawn(this.atlas.get('spark'), sx, sy, -p.vx * 0.15, -p.vy * 0.15, 0.16 + Math.random() * 0.1, c, 0.6, 0.2);
      if (e) {
        e.align = true;
        e.stretch = 0.04;
        e.drag = 4;
      }
    } else {
      const e = this.embers.spawn(this.atlas.get('dot'), sx, sy, p.vx * 0.08 + (Math.random() - 0.5) * 4, p.vy * 0.08 + (Math.random() - 0.5) * 4 - 2, 0.2 + Math.random() * 0.15, c, 0.22, 0.05);
      if (e) e.drag = 4;
    }
  }

  private take(id: number): ProjView {
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
    v.id = id;
    v.phase = 0;
    v.emberTimer = 0;
    this.byId.set(id, v);
    this.live.push(v);
    return v;
  }

  /** Enemy arrows (and any other projectile in state.projectiles). */
  private createArrowOrShot(p: Projectile): ProjView {
    const v = this.take(p.id);
    const enemy = p.team === 'enemy';
    v.isArrow = enemy;
    v.element = dominantType(p.damage.base);
    v.look = boltLook(v.element);
    if (!enemy) {
      this.dressBolt(v, p.radius, null, false);
      return v;
    }
    // Fire arrow: thin dark shaft and hot tip, wrapped in the danger color.
    const P = this.theirs;
    const a = this.atlas;
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
    return v;
  }

  /** A player Bolt spell instance. */
  private createBolt(s: SpellInstance): ProjView {
    const v = this.take(s.id);
    v.isArrow = false;
    v.element = elementType(s.spec.elements[0]?.element);
    v.look = spellLook(s.spec.elements);
    this.dressBolt(v, s.radius, secondLook(s.spec.elements), s.echo);
    return v;
  }

  private dressBolt(v: ProjView, radius: number, second: ElementLook | null, echo: boolean): void {
    const L = v.look;
    const P = this.mine;
    const a = this.atlas;
    const pale = (c: number): number => (echo ? mixRgb(c, ECHO_TINT, 0.55) : c);
    const fade = echo ? ECHO_ALPHA : 1;
    v.glow = P.glow.alloc(a.get('glow'));
    if (v.glow) v.glow.paint(pale(L.glow), L.glowAlpha * fade);
    v.trail = P.trail.alloc(a.get('streak'));
    if (v.trail) {
      // A second element shows in the trail (Fire + Storm: a violet wake behind the fireball).
      const t = second ?? L;
      v.trail.paint(pale(t.trail), t.trailAlpha * fade);
      v.trail.scaleY = radius * 1.7;
    }
    v.core = P.core.alloc(a.get(L.boltCore));
    if (v.core) {
      v.core.scaleX = v.core.scaleY = radius * 0.85;
      if (echo) v.core.paint(ECHO_TINT, ECHO_ALPHA + 0.2);
    }
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
