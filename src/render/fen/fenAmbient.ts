import { Container, type Texture } from 'pixi.js';
import { AIR, MAT } from '../../../data/materials';
import { TILE_CELLS as T, hashString, type GameState } from '../../sim';
import type { Atlas } from '../atlas';
import { FxLayer, ImmediatePool } from '../particles';
import { hash2 } from '../palette';
import { ATMO, FEN, REGION, type RegionLook } from '../terrain/regionLook';
import type { FogLight } from '../terrain/terrainView';

/**
 * The Fen's ambient life (CONTENT §13, DESIGN §14), render-only: fireflies that drift over water and
 * reeds, gather around metal in fog (a gentle hint where pylons are) and around lit braziers;
 * sparks and heat shimmer over lit furnace vents; steam wisps off doused ones. Firefly paths are
 * deterministic from the room id; nothing here writes sim state.
 */

const TAU = Math.PI * 2;
const VENT = 'f'.charCodeAt(0);
/** Most fireflies a room gets. */
const MAX_FLIES = 140;
/** Share of fireflies that keep to metal under fog, when the room has any. */
const METAL_SHARE = 0.4;
/** Cells within which a lit brazier draws a firefly in, and its orbit. */
const BRAZIER_PULL = 14;
const BRAZIER_ORBIT = 3.2;

interface Fly {
  hx: number;
  hy: number;
  /** Wander amplitude (cells), frequencies and phases. */
  ax: number;
  f1: number;
  f2: number;
  p1: number;
  p2: number;
  /** Blink rate and phase. */
  bf: number;
  bp: number;
  /** 0–1 pull toward the nearest lit brazier (eased). */
  pull: number;
  ox: number;
  oy: number;
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

/** Lit braziers of the room as fog lights (up to 8, nearest the player first). */
export function fogLights(s: GameState, radius: number): FogLight[] {
  const out: FogLight[] = [];
  for (const o of s.objects) {
    if (o.kind !== 'brazier' || !o.on) continue;
    out.push({ x: (o.tx + 0.5) * T, y: (o.ty + 0.5) * T, radius, strength: 1 });
  }
  if (out.length > 8) {
    const p = s.player;
    out.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    out.length = 8;
  }
  return out;
}

export class FenAmbient {
  readonly root = new Container();
  private readonly flies: Fly[] = [];
  private readonly glows: ImmediatePool;
  private readonly cores: ImmediatePool;
  private readonly shimmer: ImmediatePool;
  private readonly wisps: FxLayer;
  private readonly sparks: FxLayer;
  private readonly tGlow: Texture;
  private readonly tDot: Texture;
  private readonly tPuff: Texture;
  private readonly tSpark: Texture;
  private vents: [number, number][] = [];
  private region: RegionLook = REGION.base;
  private time = 0;

  constructor(atlas: Atlas) {
    this.tGlow = atlas.get('glow');
    this.tDot = atlas.get('dot');
    this.tPuff = atlas.get('puff');
    this.tSpark = atlas.get('spark');
    this.glows = new ImmediatePool(this.tGlow, MAX_FLIES, 'add');
    this.cores = new ImmediatePool(this.tDot, MAX_FLIES, 'add');
    this.shimmer = new ImmediatePool(this.tGlow, 128, 'add');
    this.wisps = new FxLayer(this.tPuff, 200);
    this.sparks = new FxLayer(this.tSpark, 160, 'add');
    this.root.addChild(
      this.shimmer.container,
      this.wisps.container,
      this.sparks.container,
      this.glows.container,
      this.cores.container,
    );
  }

  get count(): number {
    return this.glows.count + this.cores.count + this.shimmer.count + this.wisps.count + this.sparks.count;
  }

  /** Rebuilds for a room: its vent tiles and, in the Fen and Foundry, its fireflies. */
  build(s: GameState, region: RegionLook, density: number): void {
    this.region = region;
    this.flies.length = 0;
    this.wisps.clear();
    this.sparks.clear();
    const r = s.room;
    this.vents = [];
    for (let ty = 0; ty < r.tilesH; ty++)
      for (let tx = 0; tx < r.tilesW; tx++)
        if (r.tiles[ty * r.tilesW + tx] === VENT) this.vents.push([tx, ty]);
    if (region === REGION.base || density <= 0) return;
    const g = s.grid;
    const marsh: number[] = [];
    const metal: number[] = [];
    for (let ty = 0; ty < r.tilesH; ty++)
      for (let tx = 0; tx < r.tilesW; tx++) {
        const i = (ty * T + 2) * g.width + tx * T + 2;
        const m = g.ground[i]!;
        if (m === MAT.shallow_water || m === MAT.deep_water || m === MAT.grass)
          marsh.push(ty * r.tilesW + tx);
        else if ((m === MAT.metal_floor || m === MAT.metal_pylon) && g.air[i] === AIR.fog)
          metal.push(ty * r.tilesW + tx);
      }
    const n = Math.min(MAX_FLIES, Math.round((density * (marsh.length + metal.length) * T * T) / 100));
    if (n === 0 || marsh.length + metal.length === 0) return;
    const seed = hashString(r.id) | 0;
    for (let k = 0; k < n; k++) {
      const h = (salt: number): number => hash2(k, seed, salt);
      const onMetal = metal.length > 0 && (marsh.length === 0 || h(1) < METAL_SHARE);
      const list = onMetal ? metal : marsh;
      const tile = list[Math.floor(h(2) * list.length)]!;
      const tx = tile % r.tilesW;
      const ty = Math.floor(tile / r.tilesW);
      this.flies.push({
        hx: (tx + h(3)) * T,
        hy: (ty + h(4)) * T - 1.5,
        ax: onMetal ? 1 + h(5) * 1.5 : 2 + h(5) * 4,
        f1: 0.15 + h(6) * 0.35,
        f2: 0.4 + h(7) * 0.6,
        p1: h(8) * TAU,
        p2: h(9) * TAU,
        bf: 0.4 + h(10) * 0.9,
        bp: h(11) * TAU,
        pull: 0,
        ox: 0,
        oy: 0,
      });
    }
  }

  update(s: GameState, dt: number): void {
    this.time += dt;
    this.wisps.update(dt);
    this.sparks.update(dt);
    this.updateVents(s, dt);
    this.updateFlies(s, dt);
  }

  private updateFlies(s: GameState, dt: number): void {
    const t = this.time;
    this.glows.begin();
    this.cores.begin();
    if (this.flies.length > 0) {
      const lit: [number, number][] = [];
      for (const o of s.objects)
        if (o.kind === 'brazier' && o.on) lit.push([(o.tx + 0.5) * T, (o.ty + 0.5) * T]);
      const ease = 1 - Math.exp(-dt / 1.2);
      for (let k = 0; k < this.flies.length; k++) {
        const f = this.flies[k]!;
        let x = f.hx + Math.sin(t * f.f1 + f.p1) * f.ax + Math.sin(t * f.f2 + f.p2) * f.ax * 0.35;
        let y = f.hy + Math.cos(t * f.f1 * 0.8 + f.p2) * f.ax * 0.6 + Math.sin(t * f.f2 * 1.3 + f.p1) * 0.4;
        // Lit braziers draw nearby fireflies into a slow orbit.
        let best = BRAZIER_PULL * BRAZIER_PULL;
        let bx = 0;
        let by = 0;
        for (const [lx, ly] of lit) {
          const d = (lx - f.hx) ** 2 + (ly - f.hy) ** 2;
          if (d < best) {
            best = d;
            bx = lx;
            by = ly;
          }
        }
        const want = best < BRAZIER_PULL * BRAZIER_PULL ? 1 : 0;
        if (want) {
          f.ox = bx + Math.cos(t * f.f2 * 1.5 + f.p1) * BRAZIER_ORBIT;
          f.oy = by - 1.5 + Math.sin(t * f.f2 * 1.5 + f.p1) * BRAZIER_ORBIT * 0.6;
        }
        f.pull += (want - f.pull) * ease;
        if (f.pull > 0.001) {
          x += (f.ox - x) * f.pull;
          y += (f.oy - y) * f.pull;
        }
        const b = Math.max(0, Math.sin(t * f.bf * TAU * 0.5 + f.bp));
        const a = 0.15 + 0.85 * b * b * b;
        const gl = this.glows.next(this.tGlow);
        if (gl) {
          gl.x = x;
          gl.y = y;
          gl.scaleX = gl.scaleY = 1.3;
          gl.paint(ATMO.firefly, 0.35 * a);
        }
        const c = this.cores.next(this.tDot);
        if (c) {
          c.x = x;
          c.y = y;
          c.scaleX = c.scaleY = 0.2;
          c.paint(ATMO.fireflyCore, a);
        }
      }
    }
    this.glows.end();
    this.cores.end();
  }

  /** Lit vents: rising sparks and a wavering heat glow. Doused vents: steam wisps. */
  private updateVents(s: GameState, dt: number): void {
    this.shimmer.begin();
    const g = s.grid;
    const t = this.time;
    for (const [tx, ty] of this.vents) {
      const cx = (tx + 0.5) * T;
      const cy = (ty + 0.5) * T;
      const m = g.ground[(ty * T + 2) * g.width + tx * T + 2];
      if (m === MAT.vent_lit) {
        const sh = this.shimmer.next(this.tGlow);
        if (sh) {
          const w = Math.sin(t * 7.3 + tx * 1.7) * 0.12 + Math.sin(t * 13.1 + ty) * 0.06;
          sh.x = cx + w * 2;
          sh.y = cy - 3.2;
          sh.scaleX = 2.0 * (1 + w);
          sh.scaleY = 3.6 * (1 - w * 0.5);
          sh.paint(FEN.ventHot, 0.16 + 0.05 * Math.sin(t * 9 + tx));
        }
        if (Math.random() < 2.5 * dt) {
          const p = this.sparks.spawn(
            this.tSpark,
            cx + rand(-1.6, 1.6),
            cy - rand(0.5, 2),
            rand(-1, 1),
            rand(-9, -5),
            rand(0.4, 0.8),
            Math.random() < 0.5 ? FEN.ventHot : FEN.ventGlow,
            0.5,
            0.2,
          );
          if (p) {
            p.align = true;
            p.stretch = 0.03;
            p.drag = 1;
          }
        }
      } else if (m === MAT.vent_doused && Math.random() < 1.6 * dt) {
        const p = this.wisps.spawn(
          this.tPuff,
          cx + rand(-1.4, 1.4),
          cy + rand(-1, 0.5),
          rand(-0.4, 0.4),
          rand(-3.2, -2),
          rand(1.1, 1.7),
          Math.random() < 0.5 ? 0xf2f8fb : 0xc9dce6,
          0.5,
          1.4,
        );
        if (p) {
          p.a0 = 0.55;
          p.hold = 0.15;
          p.drag = 0.6;
          p.spin = rand(-0.6, 0.6);
          p.rotation = rand(0, TAU);
        }
      }
    }
    this.shimmer.end();
  }

  reset(): void {
    this.wisps.clear();
    this.sparks.clear();
  }

  get fireflyCount(): number {
    return this.region === REGION.base ? 0 : this.flies.length;
  }
}
