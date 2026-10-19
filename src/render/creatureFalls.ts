import type { Texture } from 'pixi.js';
import { materialByCode } from '../../data/materials';
import type { GameState, SimEvent } from '../sim';
import { burst, spawnHeld } from './ailmentBursts';
import type { Atlas } from './atlas';
import { FX } from './combatPalette';
import { CREATURE as C } from './creaturePalette';
import type { EnemyLayer } from './enemyLayer';
import type { FxLayer, ImmediatePool } from './particles';
import type { PlayerView } from './playerView';

/** Body key for the player (enemy ids are ≥ 1). */
export const PLAYER_KEY = -1;

interface Fall {
  key: number;
  kind: string;
  t: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  water: boolean;
  popped: boolean;
}

/**
 * Falls (rule 25, the 'fell' event): the sim has already moved the body to its safe spot, so the
 * fall is drawn as the body's silhouette shrinking, spinning and fading into the gap (a splash
 * for water, dust and a dark ring for a pit) while the real body stays hidden, then a pop at the
 * safe spot. The player's fall is bigger and never dimmed.
 */
export class CreatureFalls {
  private readonly falls: Fall[] = [];
  private readonly t: Record<'dot' | 'ring' | 'puff', Texture>;

  constructor(
    private readonly atlas: Atlas,
    private readonly eOver: ImmediatePool,
    private readonly pOver: ImmediatePool,
    private readonly norm: FxLayer,
    private readonly tNorm: FxLayer,
  ) {
    this.t = { dot: atlas.get('dot'), ring: atlas.get('ring'), puff: atlas.get('puff') };
  }

  reset(): void {
    this.falls.length = 0;
  }

  start(ev: Extract<SimEvent, { type: 'fell' }>, s: GameState, enemies: EnemyLayer): void {
    const g = s.grid;
    const cx = Math.floor(ev.fromX);
    const cy = Math.floor(ev.fromY);
    const i = cx >= 0 && cy >= 0 && cx < g.width && cy < g.height ? cy * g.width + cx : -1;
    const water = i >= 0 && materialByCode[g.ground[i]!]?.water != null;
    const key = ev.target === 'player' ? PLAYER_KEY : ev.target;
    const kind = ev.target === 'player' ? 'player' : (enemies.view(ev.target)?.kind ?? 'tinderling');
    this.falls.push({ key, kind, t: 0, fromX: ev.fromX, fromY: ev.fromY, toX: ev.toX, toY: ev.toY, water, popped: false });
    this.fallStart(ev.fromX, ev.fromY, water, key === PLAYER_KEY);
  }

  update(dt: number, s: GameState, enemies: EnemyLayer, player: PlayerView): void {
    for (let i = this.falls.length - 1; i >= 0; i--) {
      const f = this.falls[i]!;
      f.t += dt;
      if (!this.updateFall(f, s, enemies, player)) {
        this.falls[i] = this.falls[this.falls.length - 1]!;
        this.falls.pop();
      }
    }
  }

  /** Splash (water) or dust and a dark swirl (pit) where the ground gave way. */
  private fallStart(x: number, y: number, water: boolean, isPlayer: boolean): void {
    const L = isPlayer ? this.tNorm : this.norm;
    const big = isPlayer ? 1.4 : 1;
    if (water) {
      for (const [d, s0, s1] of [
        [0, 0.8, 3.2],
        [0.08, 0.5, 2.4],
      ] as const) {
        const r = spawnHeld(L, this.t.ring, x, y + 0.6, 0, 0, 0.45 + d, C.splash, s0 * big, s1 * big);
        if (r) r.aspect = 0.5;
      }
      burst(L, this.t.dot, x, y, 14, [6, 13], [0.35, 0.6], [C.splash, C.drip, 0xffffff], [0.3 * big, 0.12], 0.6, (p) => {
        p.vy -= 8;
        p.grav = 40;
      });
    } else {
      burst(L, this.t.puff, x, y + 0.5, 6, [3, 7], [0.4, 0.7], [0xb8a890, 0x8a7c6a], [0.7 * big, 1.4 * big], 0.8, (p) => {
        p.a0 = 0.8;
        p.drag = 4;
      });
      const r = spawnHeld(L, this.t.ring, x, y + 0.6, 0, 0, 0.4, C.pitTint, 2.4 * big, 0.4);
      if (r) {
        r.aspect = 0.5;
        r.a0 = 0.8;
      }
    }
  }

  /**
   * One fall: the body's silhouette shrinks, spins and fades into the gap at `from` while the real
   * body (already at the safe spot) stays hidden, then pops up there. Returns false when done.
   */
  private updateFall(f: Fall, s: GameState, enemies: EnemyLayer, player: PlayerView): boolean {
    const isPlayer = f.key === PLAYER_KEY;
    const target = isPlayer ? (s.player.dead ? null : player.root) : (enemies.view(f.key)?.root ?? null);
    if (f.t < C.fallTime) {
      const u = f.t / C.fallTime;
      const pool = isPlayer ? this.pOver : this.eOver;
      const g = pool.next(this.atlas.get(isPlayer ? 'player_fall' : `${f.kind}_body`));
      if (g) {
        const k = u * u;
        g.x = f.fromX;
        g.y = f.fromY + 0.8 * k;
        g.scaleX = g.scaleY = 1 - 0.85 * k;
        g.rotation = (isPlayer ? 1.4 : 0.9) * k;
        g.paint(f.water ? 0xbfd8ff : 0xd0c4c0, 1 - k);
      }
      if (target) target.alpha = 0;
      return true;
    }
    if (!f.popped) {
      f.popped = true;
      const L = isPlayer ? this.tNorm : this.norm;
      const r = spawnHeld(L, this.t.ring, f.toX, f.toY + 0.4, 0, 0, 0.3, isPlayer ? FX.thread : 0xfff4dc, 0.6, 3);
      if (r) r.aspect = 0.55;
      burst(L, this.t.puff, f.toX, f.toY + 0.8, 4, [2, 5], [0.3, 0.5], [0xe8d7b8], [0.5, 1], 0.6, (p) => (p.a0 = 0.7));
    }
    const u = (f.t - C.fallTime) / C.popTime;
    if (target) {
      if (u >= 1) {
        target.alpha = 1;
        target.scale.set(1);
        return false;
      }
      target.alpha = Math.min(1, u * 3);
      target.scale.set(0.4 + 0.6 * u + Math.sin(u * Math.PI) * 0.25);
      return true;
    }
    return u < 1;
  }
}
