import { Container } from 'pixi.js';
import { AIR, MAT } from '../../../data/materials';
import type { GameState, SimEvent } from '../../sim';
import type { Atlas } from '../atlas';
import { FxLayer } from '../particles';
import type { Shake } from '../shake';
import { TERRAIN as C, TERRAIN_ONESHOT as O } from './terrainColors';

const TAU = Math.PI * 2;
const rand = (a: number, b: number): number => a + Math.random() * (b - a);

type Bounds = { count: number; minX: number; minY: number; maxX: number; maxY: number };

/** A recent electrify event, for the pulse the ground shader races across the network. */
export interface ChargePulse {
  x: number;
  y: number;
  /** Render clock (s) when it started. */
  t0: number;
  /** Bigger networks pulse brighter, 0–1. */
  strength: number;
}

/**
 * One-shot effects driven by the batched grid events (DESIGN §6, events.ts): ignition flares,
 * burn-out ash puffs, steam puffs, frost blooms, ice cracking chips and shatter, electrify zaps
 * (plus the pulse the ground shader draws over the charged network) and oil barrel explosions.
 * `ground` sits over the terrain fire layer, `top` above the entities with the smoke. Particle
 * positions are sampled from the grid so a flare lands on a burning cell, not just the bounds.
 * Render-only: reads the state, never writes it.
 */
export class TerrainFx {
  readonly ground = new Container();
  readonly top = new Container();
  /** Up to four recent electrify pulses, newest last. */
  readonly pulses: ChargePulse[] = [];
  private readonly gNorm: FxLayer;
  private readonly gAdd: FxLayer;
  private readonly tNorm: FxLayer;
  private readonly tAdd: FxLayer;
  /**
   * Ordered layers for stacked discs (fireball rings, flares): a pool swap-removes particles, so
   * order inside one layer is arbitrary and a big outer disc could cover the core.
   */
  private readonly stack: FxLayer[];
  private time = 0;

  constructor(
    private readonly atlas: Atlas,
    private readonly shake: Shake,
  ) {
    const t = atlas.get('dot');
    this.gNorm = new FxLayer(t, O.capacity);
    this.gAdd = new FxLayer(t, O.capacity, 'add');
    this.tNorm = new FxLayer(t, O.capacity);
    this.tAdd = new FxLayer(t, O.capacity, 'add');
    this.stack = [0, 1, 2, 3].map(() => new FxLayer(t, O.stackCapacity));
    this.ground.addChild(this.gNorm.container, this.gAdd.container);
    this.top.addChild(this.tNorm.container, ...this.stack.map((l) => l.container), this.tAdd.container);
  }

  get particleCount(): number {
    return (
      this.gNorm.count +
      this.gAdd.count +
      this.tNorm.count +
      this.tAdd.count +
      this.stack.reduce((n, l) => n + l.count, 0)
    );
  }

  reset(): void {
    for (const l of [this.gNorm, this.gAdd, this.tNorm, this.tAdd, ...this.stack]) l.clear();
    this.pulses.length = 0;
  }

  update(dt: number): void {
    this.time += dt;
    for (const l of [this.gNorm, this.gAdd, this.tNorm, this.tAdd, ...this.stack]) l.update(dt);
    while (this.pulses.length > 0 && this.time - this.pulses[0]!.t0 > O.pulseLife) this.pulses.shift();
  }

  /** Render clock the pulses are timed on. */
  get clock(): number {
    return this.time;
  }

  handle(events: readonly SimEvent[], s: GameState): void {
    for (const e of events) {
      switch (e.type) {
        case 'cellIgnited':
          this.ignite(s, e);
          break;
        case 'burntOut':
          this.burntOut(s, e);
          break;
        case 'steam':
          this.steam(s, e);
          break;
        case 'iceFormed':
          this.iceFormed(s, e);
          break;
        case 'iceBreaking':
          this.iceBreaking(s, e);
          break;
        case 'iceBroke':
          this.iceBroke(s, e);
          break;
        case 'waterElectrified':
        case 'metalElectrified':
          this.electrify(e.x, e.y, e.cells, e.type === 'metalElectrified');
          break;
        case 'explosion':
          this.explosion(e.x, e.y, e.radius);
          break;
        case 'pylonPulse':
          this.pylonPulse(e.x, e.y, e.radius);
          break;
        default:
          break;
      }
    }
  }

  // ---- helpers ------------------------------------------------------------------------------

  /** A random cell center in the bounds where `ok(i)` holds (a few tries), or null. */
  private pick(s: GameState, b: Bounds, ok: (i: number) => boolean): { x: number; y: number } | null {
    const g = s.grid;
    for (let k = 0; k < 6; k++) {
      const cx = Math.floor(rand(b.minX, b.maxX + 1));
      const cy = Math.floor(rand(b.minY, b.maxY + 1));
      if (cx < 0 || cy < 0 || cx >= g.width || cy >= g.height) continue;
      if (ok(cy * g.width + cx)) return { x: cx + 0.5, y: cy + 0.5 };
    }
    return null;
  }

  private spawn(
    layer: FxLayer,
    tex: string,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    tint: number,
    s0: number,
    s1: number,
    o: { drag?: number; grav?: number; a0?: number; spin?: number; hold?: number; align?: number } = {},
  ): void {
    const p = layer.spawn(this.atlas.get(tex), x, y, vx, vy, life, tint, s0, s1);
    if (!p) return;
    p.drag = o.drag ?? 3;
    p.grav = o.grav ?? 0;
    p.a0 = o.a0 ?? 1;
    p.hold = o.hold ?? 0.3;
    if (o.align !== undefined) {
      p.align = true;
      p.stretch = o.align;
    } else {
      p.rotation = rand(0, TAU);
      p.spin = rand(-1, 1) * (o.spin ?? 0);
    }
  }

  private burst(
    layer: FxLayer,
    tex: string,
    x: number,
    y: number,
    n: number,
    speed: [number, number],
    life: [number, number],
    colors: readonly number[],
    size: [number, number],
    o: { drag?: number; grav?: number; a0?: number; spin?: number; align?: number; up?: number } = {},
  ): void {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(speed[0], speed[1]);
      const vy = Math.sin(a) * sp - (o.up ?? 0);
      this.spawn(
        layer,
        tex,
        x,
        y,
        Math.cos(a) * sp,
        vy,
        rand(life[0], life[1]),
        colors[i % colors.length]!,
        size[0],
        size[1],
        o,
      );
    }
  }

  // ---- effects ------------------------------------------------------------------------------

  private ignite(s: GameState, b: Bounds): void {
    const g = s.grid;
    const n = Math.min(O.igniteMax, Math.ceil(b.count / O.ignitePerFlare));
    for (let k = 0; k < n; k++) {
      const at = this.pick(s, b, (i) => g.fire[i]! > 0);
      if (!at) continue;
      // A quick hot flare and a couple of sparks jumping up.
      this.spawn(this.stack[1]!, 'dot', at.x, at.y - 0.3, 0, 0, O.flareLife, C.fireOuter, 0.5, 1.1, {
        a0: 0.9,
        hold: 0.3,
      });
      this.spawn(this.stack[3]!, 'dot', at.x, at.y - 0.3, 0, 0, O.flareLife * 0.8, C.fireCore, 0.3, 0.6, {
        a0: 1,
        hold: 0.3,
      });
      this.spawn(this.gAdd, 'glow', at.x, at.y - 0.3, 0, 0, O.flareLife, C.fireGlow, 1.4, 2.4, {
        a0: 0.6,
        hold: 0,
      });
      this.burst(
        this.gAdd,
        'spark',
        at.x,
        at.y,
        3,
        [3, 7],
        [0.25, 0.45],
        [C.fireInner, C.fireOuter],
        [0.7, 0.2],
        {
          up: 5,
          grav: -3,
          align: 0.03,
        },
      );
    }
  }

  private burntOut(s: GameState, b: Bounds): void {
    const g = s.grid;
    const n = Math.min(O.burntMax, Math.ceil(b.count / 6));
    for (let k = 0; k < n; k++) {
      const at = this.pick(s, b, (i) => g.fire[i] === 0);
      if (!at) continue;
      this.burst(this.gNorm, 'puff', at.x, at.y, 1, [0.5, 1.5], [0.6, 1.0], [C.ashDark], [0.5, 1.0], {
        a0: 0.45,
        grav: -3,
      });
      this.burst(this.gAdd, 'dot', at.x, at.y, 2, [1, 3], [0.4, 0.8], [C.ember], [0.14, 0.04], {
        up: 2,
        grav: -2,
      });
    }
  }

  private steam(s: GameState, b: Bounds): void {
    const g = s.grid;
    const n = Math.min(O.steamMax, Math.ceil(b.count / 3));
    for (let k = 0; k < n; k++) {
      const at = this.pick(s, b, (i) => g.air[i] === AIR.steam) ?? {
        x: (b.minX + b.maxX + 1) / 2,
        y: (b.minY + b.maxY + 1) / 2,
      };
      this.spawn(
        this.tNorm,
        'puff',
        at.x + rand(-0.5, 0.5),
        at.y,
        rand(-1, 1),
        -rand(2, 4),
        rand(0.6, 1.0),
        C.steam,
        0.8,
        2.0,
        {
          a0: 0.7,
          drag: 2,
          grav: -1,
          spin: 1,
        },
      );
    }
  }

  private iceFormed(s: GameState, b: Bounds): void {
    const g = s.grid;
    const cx = (b.minX + b.maxX + 1) / 2;
    const cy = (b.minY + b.maxY + 1) / 2;
    const r = Math.max(1.5, Math.hypot(b.maxX - b.minX + 1, b.maxY - b.minY + 1) / 2);
    // A frost ring blooming out over the new ice, and glints on it.
    this.spawn(this.gNorm, 'ring', cx, cy, 0, 0, O.bloomLife, C.iceEdge, r * 0.3, r * 1.05, {
      a0: 0.9,
      hold: 0,
    });
    this.spawn(this.gNorm, 'ring', cx, cy, 0, 0, O.bloomLife, 0xffffff, r * 0.25, r * 0.95, {
      a0: 0.9,
      hold: 0,
    });
    this.spawn(this.gNorm, 'glow', cx, cy, 0, 0, O.bloomLife, C.ice, r * 0.6, r * 1.1, { a0: 0.45, hold: 0 });
    const n = Math.min(O.glintMax, Math.ceil(b.count / 6));
    for (let k = 0; k < n; k++) {
      const at = this.pick(s, b, (i) => g.ground[i] === MAT.ice || g.ground[i] === MAT.ice_bridge);
      if (!at) continue;
      this.spawn(this.gNorm, 'star', at.x, at.y, 0, 0, rand(0.35, 0.6), C.iceEdge, 0.9, 0.15, {
        a0: 1,
        hold: 0.2,
        spin: 2,
      });
      this.spawn(this.gAdd, 'star', at.x, at.y, 0, 0, rand(0.35, 0.6), 0xffffff, 0.7, 0.1, {
        a0: 1,
        hold: 0.2,
        spin: 2,
      });
    }
  }

  private iceBreaking(s: GameState, b: Bounds): void {
    const g = s.grid;
    const n = Math.min(O.chipMax, Math.ceil(b.count / 8));
    for (let k = 0; k < n; k++) {
      const at = this.pick(s, b, (i) => g.ground[i] === MAT.ice_bridge);
      if (!at) continue;
      this.burst(
        this.gNorm,
        'shard',
        at.x,
        at.y,
        2,
        [2, 4],
        [0.3, 0.5],
        [C.iceSheen, C.iceEdge],
        [0.35, 0.25],
        {
          up: 3,
          grav: 14,
          spin: 10,
        },
      );
    }
  }

  private iceBroke(s: GameState, b: Bounds): void {
    const g = s.grid;
    const n = Math.min(O.shatterMax, Math.ceil(b.count / 3));
    for (let k = 0; k < n; k++) {
      const at = this.pick(s, b, (i) => g.ground[i] === MAT.deep_water || g.ground[i] === MAT.shallow_water);
      if (!at) continue;
      // Shards pop up and drop back into the water, leaving a splash ring.
      this.burst(
        this.gNorm,
        'shard',
        at.x,
        at.y,
        2,
        [1, 3],
        [0.45, 0.7],
        [C.iceBridge, 0xffffff, C.iceEdge],
        [0.6, 0.3],
        {
          up: 6,
          grav: 22,
          spin: 12,
          drag: 1,
        },
      );
      this.spawn(this.gNorm, 'ring', at.x, at.y + 0.3, 0, 0, 0.5, C.foam, 0.2, 1.1, { a0: 0.8, hold: 0 });
    }
    this.shake.kick(O.shatterShake);
  }

  private electrify(x: number, y: number, cells: number, metal: boolean): void {
    const strength = Math.min(1, 0.35 + cells / O.bigNetwork);
    this.pulses.push({ x, y, t0: this.time, strength });
    if (this.pulses.length > 4) this.pulses.shift();
    const big = 1 + strength;
    this.spawn(this.tNorm, 'dot', x, y, 0, 0, 0.18, C.stormGlow, 0.5 * big, 1.1 * big, {
      a0: 0.8,
      hold: 0.3,
    });
    this.spawn(this.tAdd, 'glow', x, y, 0, 0, 0.3, C.stormGlow, 1.5 * big, 3 * big, { a0: 0.8, hold: 0 });
    this.spawn(this.tNorm, 'star', x, y, 0, 0, 0.22, C.ink, 1.9 * big, 0.5, { a0: 0.8, hold: 0.2 });
    this.spawn(this.tNorm, 'star', x, y, 0, 0, 0.22, C.stormCore, 1.4 * big, 0.4, { a0: 1, hold: 0.2 });
    this.spawn(this.tNorm, 'ring', x, y, 0, 0, 0.3, metal ? 0xffffff : C.stormCore, 0.4, 2.2 * big, {
      a0: 0.9,
      hold: 0,
    });
    this.spawn(this.tNorm, 'ring', x, y, 0, 0, 0.3, C.stormGlow, 0.5, 2.4 * big, { a0: 0.7, hold: 0 });
    this.burst(
      this.tAdd,
      'spark',
      x,
      y,
      6,
      [10, 22],
      [0.12, 0.25],
      [C.stormCore, 0xffffff, C.stormGlow],
      [0.9, 0.3],
      {
        drag: 6,
        align: 0.025,
      },
    );
  }

  /** Live Wires (M6): a Storm ring out to the pulse's reach, so its size reads. */
  private pylonPulse(x: number, y: number, radius: number): void {
    this.spawn(this.tAdd, 'glow', x, y, 0, 0, 0.35, C.stormGlow, 2, radius * 1.2, { a0: 0.6, hold: 0 });
    this.spawn(this.tNorm, 'ring', x, y, 0, 0, 0.4, C.ink, 1, radius + 0.4, { a0: 0.5, hold: 0 });
    this.spawn(this.tNorm, 'ring', x, y, 0, 0, 0.4, C.stormCore, 1, radius, { a0: 0.95, hold: 0 });
    this.burst(
      this.tAdd,
      'spark',
      x,
      y,
      12,
      [radius * 2.5, radius * 4],
      [0.15, 0.3],
      [C.stormCore, 0xffffff, C.stormGlow],
      [0.9, 0.3],
      {
        drag: 5,
        align: 0.025,
      },
    );
  }

  private explosion(x: number, y: number, radius: number): void {
    const r = Math.max(2, radius);
    // Flash, fireball, shockwave (dark-backed so it reads on light floors), debris and soot.
    // Toon fireball: stacked discs (outer red-orange, yellow, white core) that swell and fade.
    this.spawn(this.stack[0]!, 'dot', x, y, 0, 0, O.fireballLife, C.fireDeep, r * 0.55, r * 1.05, {
      a0: 0.95,
      hold: 0.45,
    });
    this.spawn(this.stack[1]!, 'dot', x, y, 0, 0, O.fireballLife * 0.85, C.fireOuter, r * 0.45, r * 0.9, {
      a0: 1,
      hold: 0.45,
    });
    this.spawn(this.stack[2]!, 'dot', x, y, 0, 0, O.fireballLife * 0.7, C.fireInner, r * 0.3, r * 0.6, {
      a0: 1,
      hold: 0.45,
    });
    this.spawn(this.stack[3]!, 'dot', x, y, 0, 0, O.flashLife, C.fireCore, r * 0.2, r * 0.4, {
      a0: 1,
      hold: 0.4,
    });
    this.spawn(this.tAdd, 'glow', x, y, 0, 0, O.flashLife, C.fireCore, r * 1.2, r * 2.6, {
      a0: 0.8,
      hold: 0,
    });
    this.spawn(this.tNorm, 'ring', x, y, 0, 0, O.ringLife, C.ink, r * 0.35, r * 1.9, { a0: 0.55, hold: 0 });
    this.spawn(this.tNorm, 'ring', x, y, 0, 0, O.ringLife, C.fireInner, r * 0.3, r * 1.8, {
      a0: 0.95,
      hold: 0,
    });
    this.burst(
      this.tNorm,
      'chip',
      x,
      y,
      10,
      [10, 22],
      [0.5, 0.9],
      [C.woodDark, C.oil, C.ashDark],
      [0.55, 0.35],
      {
        up: 6,
        grav: 24,
        spin: 14,
        drag: 1.5,
      },
    );
    this.burst(
      this.tAdd,
      'spark',
      x,
      y,
      14,
      [14, 30],
      [0.2, 0.45],
      [C.fireInner, C.fireCore, C.fireOuter],
      [1.1, 0.3],
      {
        drag: 4,
        align: 0.03,
      },
    );
    this.burst(this.tNorm, 'puff', x, y, 6, [2, 5], [0.9, 1.5], [C.oilSmoke, C.smoke], [0.9, 2.2], {
      a0: 0.6,
      grav: -3,
      drag: 2,
      spin: 1,
    });
    this.shake.kick(O.explosionShake);
  }
}
