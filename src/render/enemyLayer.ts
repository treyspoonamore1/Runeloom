import { Container } from 'pixi.js';
import type { Enemy, GameState } from '../sim';
import type { EnemyKind } from '../../data/enemies';
import type { Atlas } from './atlas';
import { ENEMY } from './combatPalette';
import { EnemyView } from './enemyView';
import { ParticlePool } from './particles';

/**
 * All enemy views. A view is created (or taken from its kind's pool) the first frame an enemy
 * is seen, updated from interpolated sim positions, and when the enemy leaves the state it
 * plays its death topple in the corpse layer and returns to the pool.
 */
export class EnemyLayer {
  /** Fading corpses, under everything alive. */
  readonly corpses = new Container();
  /** Ground shadows of every enemy, drawn under all bodies. */
  readonly shadows: ParticlePool;
  /** Additive glows (Tinderling embers), under the bodies. */
  readonly glows: ParticlePool;
  /** Living bodies, sorted by y. */
  readonly bodies = new Container();

  private readonly byId = new Map<number, EnemyView>();
  private readonly live: EnemyView[] = [];
  private readonly dying: EnemyView[] = [];
  private readonly pools = new Map<EnemyKind, EnemyView[]>();
  private frame = 0;

  constructor(private readonly atlas: Atlas) {
    this.shadows = new ParticlePool(atlas.get('shadow'), 1024);
    this.glows = new ParticlePool(atlas.get('glow'), 1024, 'add');
    this.bodies.sortableChildren = true;
  }

  get count(): number {
    return this.live.length;
  }

  view(id: number): EnemyView | undefined {
    return this.byId.get(id);
  }

  reset(): void {
    for (const v of this.live) this.release(v);
    for (const v of this.dying) this.release(v);
    this.live.length = 0;
    this.dying.length = 0;
    this.byId.clear();
  }

  update(state: GameState, alpha: number, dt: number): void {
    const frame = ++this.frame;
    for (const e of state.enemies) {
      if (e.dead) continue;
      let v = this.byId.get(e.id);
      if (!v) v = this.create(e);
      v.seen = frame;
      const x = e.prevX + (e.x - e.prevX) * alpha;
      const y = e.prevY + (e.y - e.prevY) * alpha;
      v.update(state, x, y, dt);
      const z = Math.round(y * 8);
      if (v.root.zIndex !== z) v.root.zIndex = z;
    }
    // Enemies gone from the state died (or were removed): topple into corpses.
    for (let i = this.live.length - 1; i >= 0; i--) {
      const v = this.live[i]!;
      if (v.seen === frame) continue;
      this.live[i] = this.live[this.live.length - 1]!;
      this.live.pop();
      this.byId.delete(v.enemy!.id);
      v.die();
      this.bodies.removeChild(v.root);
      this.corpses.addChild(v.root);
      this.dying.push(v);
    }
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const v = this.dying[i]!;
      if (v.updateDeath(dt)) continue;
      this.dying[i] = this.dying[this.dying.length - 1]!;
      this.dying.pop();
      this.release(v);
    }
  }

  private create(e: Enemy): EnemyView {
    const pool = this.pools.get(e.kind);
    const v = pool?.pop() ?? new EnemyView(e.kind, this.atlas);
    v.bind(e);
    v.shadow = this.shadows.alloc(this.atlas.get('shadow'));
    if (e.kind === 'tinderling') {
      v.glow = this.glows.alloc(this.atlas.get('glow'));
      if (v.glow) v.glow.tint = ENEMY.tinderling.glow;
    }
    this.bodies.addChild(v.root);
    this.byId.set(e.id, v);
    this.live.push(v);
    return v;
  }

  private release(v: EnemyView): void {
    v.root.parent?.removeChild(v.root);
    if (v.shadow) this.shadows.release(v.shadow);
    if (v.glow) this.glows.release(v.glow);
    v.shadow = v.glow = null;
    v.enemy = null;
    let pool = this.pools.get(v.kind);
    if (!pool) this.pools.set(v.kind, (pool = []));
    pool.push(v);
  }
}
