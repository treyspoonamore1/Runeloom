import type { Container, Texture } from 'pixi.js';
import { AIR } from '../../data/materials';
import { enemyDef } from '../../data/enemies';
import type { Ailments, GameState, SimEvent } from '../sim';
import type { TerrainState } from '../sim/actors/terrainState';
import { burst, rand, spawnHeld } from './ailmentBursts';
import { AIL, BODY, type BodyBox } from './ailmentPalette';
import { bodyBoxOf } from './kindInfo';
import type { AilmentParts } from './ailmentParts';
import type { Atlas } from './atlas';
import { CREATURE as C, hueRgb } from './creaturePalette';
import type { EnemyLayer } from './enemyLayer';
import type { EnemyView } from './enemyView';
import { FxLayer, ImmediatePool } from './particles';
import type { PlayerView } from './playerView';
import { CreatureFalls, PLAYER_KEY } from './creatureFalls';

export { PLAYER_KEY };

const TAU = Math.PI * 2;

/** One body this frame, as AilmentFx sees it (reused object). */
export interface CreatureBody {
  key: number;
  kind: string;
  a: Ailments;
  terrain: TerrainState;
  parts: AilmentParts;
  box: BodyBox;
  /** Body origin (the view's root), cells; vx, vy: velocity, cells/s. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  player: boolean;
}

interface Arc {
  t: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  threat: boolean;
}

/**
 * Entities on the chemistry grid (M3 phase B), read from `terrain` on every body each frame and
 * from the grid events: Wet drips and gloss, the Oiled sheen (and the much hotter look of an
 * Oiled body on fire), slide streaks on ice, charge-hit crackle, Shock arcs, falls into pits and
 * water with a respawn pop, doused and relit Tinderlings, scorching and breaking shields, and the
 * player's smoke/steam haze. Owned by AilmentFx, which walks the bodies; render-only.
 *
 * Enemy effects draw into `fx` (dimmed with the player's effects when busy); the player's into
 * `threat` (never dimmed).
 */
export class CreatureFx {
  private readonly eOver: ImmediatePool;
  private readonly pOver: ImmediatePool;
  private readonly t: Record<'dot' | 'glow' | 'star' | 'ring' | 'puff' | 'sheen' | 'zapC' | 'zapA' | 'zapB' | 'streak' | 'splinter' | 'chip', Texture>;
  private readonly crackle = new Map<number, number>();
  private readonly falls: CreatureFalls;
  private readonly arcs: Arc[] = [];
  private time = 0;
  private budget = 0;

  constructor(
    atlas: Atlas,
    fx: Container,
    threat: Container,
    private readonly norm: FxLayer,
    private readonly add: FxLayer,
    private readonly tNorm: FxLayer,
    /** AilmentFx's additive glow pool under the bodies (drawn between its begin and end). */
    private readonly glows: ImmediatePool,
  ) {
    const dot = atlas.get('dot');
    this.eOver = new ImmediatePool(dot, 2048);
    this.pOver = new ImmediatePool(dot, 64);
    fx.addChild(this.eOver.container);
    threat.addChild(this.pOver.container);
    this.t = {
      dot,
      glow: atlas.get('glow'),
      star: atlas.get('star'),
      ring: atlas.get('ring'),
      puff: atlas.get('puff'),
      sheen: atlas.get('oil_sheen'),
      zapC: atlas.get('zap_charge'),
      zapA: atlas.get('zap_a'),
      zapB: atlas.get('zap_b'),
      streak: atlas.get('streak'),
      splinter: atlas.get('splinter'),
      chip: atlas.get('chip'),
    };
    this.falls = new CreatureFalls(atlas, this.eOver, this.pOver, norm, tNorm);
  }

  reset(): void {
    this.crackle.clear();
    this.falls.reset();
    this.arcs.length = 0;
  }

  /** True if this body needs a visit even without ailments (grid chemistry, crackle). */
  static active(t: TerrainState): boolean {
    return t.wetLeft > 0 || t.oiledLeft > 0 || t.onIce || t.blind;
  }

  hasCrackle(key: number): boolean {
    return this.crackle.has(key);
  }

  begin(dt: number): void {
    this.time += dt;
    this.budget = Math.min(this.budget, 1) + 300 * dt;
    this.eOver.begin();
    this.pOver.begin();
  }

  /** Per-frame look of a Tinderling (out while Wet) and a Shieldbearer's shield. Cheap; every enemy. */
  enemyState(v: EnemyView, dt: number): void {
    const e = v.enemy!;
    if (e.kind === 'tinderling') v.setDoused(e.terrain.wetLeft > 0);
    else if (e.kind === 'shieldbearer') {
      const total = enemyDef(e.kind).shield?.burnTime ?? 1;
      const scorch = e.shield ? 1 - e.shield.burnLeft / total : 0;
      v.setShield(scorch, e.shield !== null);
      // A shield on fire sheds embers.
      if (e.shield && scorch > 0.02 && e.ailments.ignite.timeLeft > 0 && this.take(C.shieldEmberRate * scorch * dt)) {
        const sx = e.x + e.facingX * 2.7;
        const sy = e.y - 0.2 + e.facingY * 2.7 * 0.6;
        const p = spawnHeld(this.norm, this.t.dot, sx + rand(-0.6, 0.6), sy + rand(-0.6, 0.6), rand(-1, 1), -rand(3, 6), rand(0.3, 0.6), Math.random() < 0.5 ? AIL.fire : AIL.fireInner, 0.2, 0.05);
        if (p) p.grav = -4;
      }
    }
  }

  /** Stochastic spawn allowance: true with probability `want` (≤ 1), within the frame budget. */
  private take(want: number): boolean {
    if (this.budget < 1 || Math.random() >= want) return false;
    this.budget--;
    return true;
  }

  /** Draws one body's grid-chemistry look (AilmentFx calls it for visited, on-screen bodies). */
  body(b: CreatureBody, dt: number): void {
    const T = b.terrain;
    const box = b.box;
    const h = box.bottom - box.top;
    const pool = b.player ? this.pOver : this.eOver;
    const layer = b.player ? this.tNorm : this.norm;
    const x = b.x;
    const y = b.y;
    if (T.wetLeft > 0) {
      // Gloss highlight and drips.
      const g = pool.next(this.t.dot);
      if (g) {
        g.x = x - box.w * 0.45;
        g.y = y + box.top + h * 0.3;
        g.scaleX = 0.34;
        g.scaleY = 0.2;
        g.rotation = -0.5;
        g.paint(0xffffff, C.glossAlpha * (0.6 + 0.4 * Math.sin(this.time * TAU * C.glossHz + b.key)));
      }
      if (this.take(C.dripRate * dt)) {
        const p = spawnHeld(layer, this.t.dot, x + rand(-0.7, 0.7) * box.w, y + box.bottom * 0.4, b.vx * 0.2, rand(1, 3), rand(0.25, 0.4), C.drip, 0.17, 0.09);
        if (p) p.grav = 30;
      }
    }
    if (T.oiledLeft > 0) {
      const sh = pool.next(this.t.sheen);
      if (sh) {
        sh.x = x;
        sh.y = y + box.top + h * 0.42;
        sh.scaleX = box.w * 0.85;
        sh.scaleY = box.w * 0.6;
        sh.paint(hueRgb(this.time * C.sheenSpeed + b.key * 0.13), C.sheenAlpha);
      }
      if (b.parts.oilFire) this.oilFire(b, layer);
    }
    if (T.onIce) {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > C.iceMinSpeed && this.take(C.iceStreakRate * dt)) {
        const p = layer.spawn(this.t.streak, x + rand(-0.4, 0.4) * box.w, y + box.bottom * 0.85, b.vx * 0.02, b.vy * 0.02, 0.25, C.ice, 1.3, 0.5);
        if (p) {
          p.align = true;
          p.aspect = 0.22;
          p.a0 = 0.7;
        }
      } else if (this.take(1.2 * dt)) {
        const p = spawnHeld(layer, this.t.star, x + rand(-0.6, 0.6) * box.w, y + box.bottom * 0.8, 0, 0, 0.25, C.ice, 0.5, 0.1);
        if (p) p.a0 = 0.8;
      }
    }
    const left = this.crackle.get(b.key);
    if (left !== undefined) {
      for (let i = 0; i < 2; i++) {
        const z = pool.next(this.t.zapC);
        if (!z) break;
        z.x = x + rand(-0.6, 0.6) * box.w;
        z.y = y + box.top + rand(0.2, 0.8) * h;
        z.rotation = rand(0, TAU);
        z.scaleX = box.w * rand(0.5, 0.9);
        z.scaleY = Math.random() < 0.5 ? -0.9 : 0.9;
        z.paint(0xffffff, Math.min(1, left / C.chargeCrackle + 0.3));
      }
    }
  }

  /** Rule 18: an Oiled body on fire: a deep red danger glow and black smoke on top of the bigger flames. */
  private oilFire(b: CreatureBody, layer: FxLayer): void {
    const box = b.box;
    const cy = b.y + (box.top + box.bottom) / 2;
    const g = this.glows.next(this.t.glow);
    if (g) {
      g.x = b.x;
      g.y = cy;
      g.scaleX = g.scaleY = box.w * 2.6 * (0.9 + 0.12 * Math.sin(this.time * 17 + b.key));
      g.paint(C.oilFireGlow, C.oilFireGlowAlpha);
    }
    if (this.take(C.oilSmokeRate / 60)) {
      const p = layer.spawn(this.t.puff, b.x + rand(-0.5, 0.5) * box.w, b.y + box.top, rand(-1, 1), -rand(4, 7), rand(0.6, 0.9), C.oilSmoke, 0.5, 1.5);
      if (p) {
        p.a0 = 0.55;
        p.hold = 0.2;
        p.drag = 1;
      }
    }
  }

  /** Advances falls and arcs; overrides the bodies of falling entities. Call after the views update. */
  end(dt: number, s: GameState, enemies: EnemyLayer, player: PlayerView): void {
    for (const [k, v] of this.crackle) {
      const left = v - dt;
      if (left <= 0) this.crackle.delete(k);
      else this.crackle.set(k, left);
    }
    this.falls.update(dt, s, enemies, player);
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i]!;
      a.t += dt;
      if (a.t >= C.arcLife) {
        this.arcs[i] = this.arcs[this.arcs.length - 1]!;
        this.arcs.pop();
        continue;
      }
      this.drawArc(a);
    }
    this.eOver.end();
    this.pOver.end();
  }

  handle(ev: SimEvent, s: GameState, enemies: EnemyLayer): void {
    switch (ev.type) {
      case 'fell':
        this.falls.start(ev, s, enemies);
        break;
      case 'chargeHit': {
        const key = ev.target === 'player' ? PLAYER_KEY : ev.target;
        this.crackle.set(key, C.chargeCrackle);
        const box = bodyBox(ev.target === 'player' ? 'player' : (enemies.view(ev.target)?.kind ?? ''));
        const cy = ev.y + (box.top + box.bottom) / 2;
        const g = spawnHeld(this.add, this.t.glow, ev.x, cy, 0, 0, 0.14, C.charge, box.w * 2.4, box.w * 1.2);
        if (g) g.a0 = 0.9;
        const L = ev.target === 'player' ? this.tNorm : this.norm;
        const r = spawnHeld(L, this.t.ring, ev.x, cy, 0, 0, 0.18, C.chargeGlow, box.w * 0.6, box.w * 1.8);
        if (r) r.hold = 0;
        break;
      }
      case 'arc':
        this.arcs.push({ t: 0, x0: ev.x0, y0: ev.y0 - 1, x1: ev.x1, y1: ev.y1 - 1, threat: ev.from === 'player' || ev.to === 'player' });
        break;
      case 'tinderlingDoused': {
        // Hiss: a puff of steam and a few drops; the flame goes out (EnemyView.setDoused).
        burst(this.norm, this.t.puff, ev.x, ev.y - 1, 7, [1, 4], [0.5, 0.9], [C.steam, 0xffffff], [0.5, 1.4], 0.6, (p) => {
          p.a0 = 0.75;
          p.grav = -7;
          p.drag = 2;
        });
        burst(this.norm, this.t.dot, ev.x, ev.y - 1.2, 5, [3, 7], [0.25, 0.4], [C.drip], [0.16, 0.08], 0.4, (p) => (p.grav = 25));
        break;
      }
      case 'tinderlingRelit': {
        const g = spawnHeld(this.add, this.t.glow, ev.x, ev.y - 0.6, 0, 0, 0.25, AIL.fire, 2.5, 4.5);
        if (g) g.a0 = 0.9;
        burst(this.norm, this.t.dot, ev.x, ev.y - 0.8, 12, [4, 10], [0.35, 0.6], [AIL.fire, AIL.fireInner, AIL.fireCore], [0.28, 0.06], 0.6, (p) => {
          p.grav = -10;
          p.drag = 2;
        });
        break;
      }
      case 'shieldBurned': {
        const v = enemies.view(ev.id);
        const fx = v?.enemy?.facingX ?? 1;
        const fy = v?.enemy?.facingY ?? 0;
        const sx = ev.x + fx * 2.7;
        const sy = ev.y - 0.2 + fy * 2.7 * 0.6;
        const dir = Math.atan2(fy, fx);
        burst(this.norm, this.t.splinter, sx, sy, 10, [6, 14], [0.5, 0.9], [C.charred, 0x5a3a28, 0x2a1a14], [1.2, 0.9], 1, (p) => {
          p.spin = rand(-12, 12);
          p.grav = 16;
          p.drag = 2;
          p.vx += Math.cos(dir) * 5;
          p.vy += Math.sin(dir) * 5;
        });
        burst(this.norm, this.t.dot, sx, sy, 10, [3, 9], [0.4, 0.8], [AIL.fire, AIL.fireInner], [0.22, 0.05], 1, (p) => (p.grav = -6));
        burst(this.norm, this.t.puff, sx, sy, 4, [1, 3], [0.6, 0.9], [0x4a3a3a], [0.8, 1.6], 0.8, (p) => {
          p.a0 = 0.6;
          p.grav = -4;
        });
        break;
      }
      default:
    }
  }

  /** A Shock arc between two Wet entities: jagged storm segments, re-rolled each frame. */
  private drawArc(a: Arc): void {
    const pool = a.threat ? this.pOver : this.eOver;
    const dx = a.x1 - a.x0;
    const dy = a.y1 - a.y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return;
    const n = Math.max(1, Math.round(len / C.arcSegment));
    const ang = Math.atan2(dy, dx);
    const alpha = 1 - (a.t / C.arcLife) ** 2;
    for (let k = 0; k < n; k++) {
      const z = pool.next(k % 2 ? this.t.zapB : this.t.zapA);
      if (!z) return;
      const m = (k + 0.5) / n;
      z.x = a.x0 + dx * m + rand(-0.2, 0.2);
      z.y = a.y0 + dy * m + rand(-0.2, 0.2);
      z.rotation = ang + rand(-0.35, 0.35);
      z.scaleX = (len / n / 2) * 1.15;
      z.scaleY = Math.random() < 0.5 ? -1.1 : 1.1;
      z.paint(0xffffff, alpha);
    }
  }

  /** Haze over the screen edge while the player stands in smoke or steam (Blind, DESIGN §6.4). */
  haze(s: GameState): { alpha: number; tint: number } | null {
    const p = s.player;
    if (p.dead) return null;
    const g = s.grid;
    const cx = Math.floor(p.x);
    const cy = Math.floor(p.y);
    if (cx < 0 || cy < 0 || cx >= g.width || cy >= g.height) return null;
    const air = g.air[cy * g.width + cx]!;
    if (air === AIR.none) return null;
    return { alpha: C.hazeAlpha, tint: air === AIR.smoke ? C.hazeSmoke : C.hazeSteam };
  }
}

function bodyBox(kind: string): BodyBox {
  return kind === 'player' ? BODY.player : bodyBoxOf(kind);
}

