import { lookKind } from '../../data/enemies';
import { Container } from 'pixi.js';
import type { Enemy, GameState } from '../sim';
import type { M4Signals } from '../app/m4Signals';
import type { Atlas } from './atlas';
import { ENEMY } from './combatPalette';
import { EnemyView } from './enemyView';
import { ParticlePool } from './particles';
import { BeastFx } from './bestiary/beastFx';
import { BESTIARY } from './bestiary/bestiaryPalette';

/** Additive glows per kind (Tinderling embers, the kiln's mouth, the Warden's heat): color, alpha. */
const GLOWS: Record<string, [number, number]> = {
  tinderling: [ENEMY.tinderling.glow, 0.5],
  brood_kiln: [BESTIARY.brood_kiln.fire, 0.5],
  cinder_warden: [BESTIARY.cinder_warden.heat, 0.3],
};

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
  private readonly pools = new Map<string, EnemyView[]>();
  private frame = 0;
  /** Particles of the M4 kinds (ripples, drips, steam, sparks). */
  readonly beastFx: BeastFx;
  /** Derived M4 enemy looks (fuse, Superheat, phase, kiln timer); set by the renderer. */
  signals: M4Signals | null = null;

  constructor(private readonly atlas: Atlas) {
    this.beastFx = new BeastFx(atlas);
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
    this.beastFx.reset();
  }

  update(state: GameState, alpha: number, dt: number): void {
    const frame = ++this.frame;
    const fx = this.beastFx;
    fx.update(dt);
    for (const e of state.enemies) {
      if (e.dead) continue;
      let v = this.byId.get(e.id);
      if (!v) v = this.create(e);
      v.seen = frame;
      const x = e.prevX + (e.x - e.prevX) * alpha;
      const y = e.prevY + (e.y - e.prevY) * alpha;
      v.update(state, x, y, dt, this.signals?.enemy(e.id), fx);
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
    const look = lookKind(e.kind);
    const pool = this.pools.get(look);
    const v = pool?.pop() ?? new EnemyView(look, this.atlas);
    v.bind(e);
    v.shadow = this.shadows.alloc(this.atlas.get('shadow'));
    const glow = GLOWS[look];
    if (glow) {
      v.glow = this.glows.alloc(this.atlas.get('glow'));
      if (v.glow) v.glow.paint(glow[0], glow[1]);
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
