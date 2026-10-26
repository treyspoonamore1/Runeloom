import { Container, Graphics } from 'pixi.js';
import { materialByCode } from '../../../data/materials';
import { TILE_CELLS, type GameState, type SimEvent } from '../../sim';
import { ELEMENT, TELEGRAPH as T } from '../combatPalette';
import { FEN_BOSS as P, FEN_BOSS_FEEL as F } from './fenBossPalette';

const TAU = Math.PI * 2;
const PYLON_CHAR = 'M'.charCodeAt(0);
/** Seconds between recomputing a warning's cells (it follows the Coil and the water). */
const REFRESH = 0.1;
/** The landed pulse's flash, and a fizzled or cancelled warning's fade, seconds. */
const FLASH = 0.35;
const FADE = 0.25;

/** Eye / Body pulse and pylon storm (the Coil); the Bellwether's self-toll. */
type Kind = 'eye' | 'body' | 'pylon' | 'toll';

interface Warning {
  kind: Kind;
  id: number;
  x: number;
  y: number;
  reach: number;
  /** Pylon tile centers (pylon warnings). */
  pylons: { x: number; y: number }[];
  seconds: number;
  t: number;
  refresh: number;
  /** 'glow' until it lands ('flash') or is cancelled / fizzles ('fade'). */
  stage: 'glow' | 'flash' | 'fade';
  stageT: number;
  fill: Graphics;
  edge: Graphics;
  /** The cells it covers (grid indices), for crackle. */
  cells: number[];
}

/** A glowing warning as the telegraph layer reads it: its cells and how far along it is (0–1). */
export interface GlowView {
  cells: readonly number[];
  u: number;
}

/**
 * The Fen bosses' charge warnings on the ground (DESIGN §10.5, §14), drawn cell by cell from
 * the grid so the player sees exactly what will be electrified:
 * - Eye pulse glow: all of its water (along the water from its cell, the pulse's reach) brightens;
 * - Body pulse glow: its water within 20 steps along the water;
 * - Pylon glow: each pylon's metal network and the water it hands charge to;
 * - the Old Bellwether's self-toll windup: the metal and water under it and what they conduct to.
 * The fill sits under the bodies; the red-magenta edge cells (a hazard's pulsing edge) go on top,
 * above fog, smoke and the player's own effects, so a warning is never lost. When the pulse lands
 * the area flashes; an Overload cancels it with a violet fade. Reads the grid, never writes it.
 */
export class FenBossGlow {
  readonly ground = new Container();
  readonly top = new Container();
  private readonly list: Warning[] = [];
  private readonly pool: Graphics[] = [];
  private time = 0;
  // BFS scratch.
  private seen = new Int32Array(0);
  private stamp = 0;
  private readonly queue: number[] = [];
  private readonly dist: number[] = [];

  /** The warnings still glowing (not yet landed or cancelled). */
  *glowing(): Generator<GlowView> {
    for (const w of this.list)
      if (w.stage === 'glow') yield { cells: w.cells, u: Math.min(1, w.t / Math.max(0.1, w.seconds)) };
  }

  reset(): void {
    for (const w of this.list) this.free(w);
    this.list.length = 0;
  }

  handle(events: readonly SimEvent[], s: GameState): void {
    for (const ev of events) {
      if (ev.type === 'coilPulseGlow') this.add(s, ev.pulse, ev.id, ev.x, ev.y, ev.reach, ev.seconds, []);
      else if (ev.type === 'coilPylonGlow') this.add(s, 'pylon', ev.id, 0, 0, 0, ev.seconds, ev.pylons);
      else if (ev.type === 'coilPulse') this.end(ev.id, ev.pulse, 'flash');
      else if (ev.type === 'coilPylonStorm') this.end(ev.id, 'pylon', 'flash');
      else if (ev.type === 'coilOverloaded') this.end(ev.id, 'body', 'fade');
      else if (ev.type === 'bellSelfToll') this.end(ev.id, 'toll', 'flash');
    }
  }

  update(s: GameState, dt: number): void {
    this.time += dt;
    this.fromState(s);
    const pulse = 0.5 + 0.5 * Math.sin(this.time * TAU * T.pulseHz);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const w = this.list[i]!;
      w.t += dt;
      w.stageT += dt;
      if (w.stage === 'glow') {
        if (w.t > w.seconds + 0.3 || (w.kind === 'toll' && !this.tolling(s, w.id))) this.setStage(w, 'fade');
        else if ((w.kind === 'eye' || w.kind === 'body') && (w.refresh -= dt) <= 0) {
          w.refresh = REFRESH;
          const boss = s.enemies.find((e) => e.id === w.id && !e.dead);
          if (boss) this.draw(s, w, boss.x, boss.y);
        }
      }
      const u = Math.min(1, w.t / Math.max(0.1, w.seconds));
      if (w.stage === 'glow') {
        w.fill.alpha = (0.16 + 0.24 * u) * (0.7 + 0.3 * pulse);
        w.edge.alpha = u > 0.8 ? 1 : 0.55 + 0.45 * pulse;
      } else {
        const len = w.stage === 'flash' ? FLASH : FADE;
        const k = Math.max(0, 1 - w.stageT / len);
        w.fill.alpha = (w.stage === 'flash' ? 0.75 : 0.3) * k;
        w.edge.alpha = k;
        if (k <= 0) {
          this.free(w);
          this.list.splice(i, 1);
        }
      }
    }
  }

  /**
   * Warnings the sim's state says are on but no event started (a fight adopted mid-glow: a loaded
   * save, a screenshot): started from the boss's glow flags with the time it has left.
   */
  private fromState(s: GameState): void {
    for (const e of s.enemies) {
      const f = e.boss?.fen;
      if (!f || e.dead) continue;
      const B = s.tuning.bosses;
      if (f.pulseGlowing) {
        const kind: Kind = e.boss!.phase >= 3 ? 'body' : 'eye';
        const reach = kind === 'eye' ? B.coilPulse.reach : B.coilBodyPulse.reach;
        if (!this.isGlowing(e.id, kind)) this.add(s, kind, e.id, e.x, e.y, reach, Math.max(0.1, f.pulseLeft), []);
      }
      // The Bellwether's self-toll windup (no event of its own until it lands, 'bellSelfToll').
      const a = e.attack;
      if (a.name === 'self_toll' && a.phase === 'windup' && !this.isGlowing(e.id, 'toll')) {
        const r = a.shape.kind === 'circle' ? a.shape.r : e.radius;
        this.add(s, 'toll', e.id, a.originX, a.originY, r, Math.max(0.1, a.timeLeft), []);
      }
      if (f.pylonGlowing && !this.isGlowing(e.id, 'pylon'))
        this.add(s, 'pylon', e.id, 0, 0, 0, Math.max(0.1, f.pylonLeft), this.pylonsOf(s));
    }
  }

  /** The Bellwether is still in its self-toll (a stun or a ring cancels the warning). */
  private tolling(s: GameState, id: number): boolean {
    const e = s.enemies.find((x) => x.id === id);
    return !!e && !e.dead && e.attack.name === 'self_toll' && e.attack.phase !== 'none';
  }

  private isGlowing(id: number, kind: Kind): boolean {
    return this.list.some((w) => w.id === id && w.kind === kind && w.stage === 'glow');
  }

  private pylonRoom = '';
  private pylons: { x: number; y: number }[] = [];

  /** The room's pylon tile centers (as the sim's pylonCenters). */
  private pylonsOf(s: GameState): { x: number; y: number }[] {
    if (this.pylonRoom === s.room.id) return this.pylons;
    this.pylonRoom = s.room.id;
    const r = s.room;
    this.pylons = [];
    for (let ty = 0; ty < r.tilesH; ty++)
      for (let tx = 0; tx < r.tilesW; tx++)
        if (r.tiles[ty * r.tilesW + tx] === PYLON_CHAR)
          this.pylons.push({ x: (tx + 0.5) * TILE_CELLS, y: (ty + 0.5) * TILE_CELLS });
    return this.pylons;
  }

  private add(s: GameState, kind: Kind, id: number, x: number, y: number, reach: number, seconds: number, pylons: { x: number; y: number }[]): void {
    for (const w of this.list) {
      if (w.id !== id || w.kind !== kind || w.stage !== 'glow') continue;
      // The same glow, already started from the boss's state this frame: keep it.
      if (w.t < 0.2) {
        w.seconds = seconds;
        return;
      }
      this.setStage(w, 'fade');
    }
    const w: Warning = {
      kind,
      id,
      x,
      y,
      reach,
      pylons,
      seconds,
      t: 0,
      refresh: REFRESH,
      stage: 'glow',
      stageT: 0,
      fill: this.graphics(this.ground),
      edge: this.graphics(this.top),
      cells: [],
    };
    this.list.push(w);
    this.draw(s, w, x, y);
  }

  private end(id: number, kind: Kind, stage: 'flash' | 'fade'): void {
    for (const w of this.list) if (w.id === id && w.kind === kind && w.stage === 'glow') this.setStage(w, stage);
  }

  private setStage(w: Warning, stage: 'flash' | 'fade'): void {
    w.stage = stage;
    w.stageT = 0;
    if (stage === 'flash') w.fill.tint = 0xffffff;
    else w.fill.tint = w.edge.tint = P.glasswater_coil.glowViolet;
  }

  private graphics(parent: Container): Graphics {
    const g = this.pool.pop() ?? new Graphics();
    g.clear();
    g.tint = 0xffffff;
    g.alpha = 0;
    // The fill brightens what it covers (water, metal) instead of painting over it.
    g.blendMode = parent === this.ground ? 'add' : 'normal';
    g.visible = true;
    parent.addChild(g);
    return g;
  }

  private free(w: Warning): void {
    for (const g of [w.fill, w.edge]) {
      g.clear();
      g.parent?.removeChild(g);
      this.pool.push(g);
    }
  }

  /** Cells the warning covers, then the fill (every cell) and the edge (cells at its border). */
  private draw(s: GameState, w: Warning, x: number, y: number): void {
    const cells =
      w.kind === 'pylon'
        ? this.pylonCells(s, w.pylons)
        : w.kind === 'toll'
          ? this.tollCells(s, x, y, w.reach)
          : this.waterCells(s, x, y, w.reach);
    w.cells = cells;
    const g = s.grid;
    const W = g.width;
    w.fill.clear();
    w.edge.clear();
    const fillColor = w.kind === 'pylon' ? ELEMENT.storm : w.kind === 'toll' ? P.bellwether.selfToll : P.glasswater_coil.glow;
    for (const i of cells) w.fill.rect(i % W, Math.floor(i / W), 1, 1);
    if (cells.length) w.fill.fill(fillColor);
    let edges = 0;
    for (const i of cells) {
      const cx = i % W;
      const cy = Math.floor(i / W);
      const out = (j: number, ok: boolean) => !ok || this.seen[j] !== this.stamp;
      if (out(i - 1, cx > 0) || out(i + 1, cx < W - 1) || out(i - W, cy > 0) || out(i + W, cy < g.height - 1)) {
        w.edge.rect(cx + 0.15, cy + 0.15, 0.7, 0.7);
        edges++;
      }
    }
    if (edges) w.edge.fill(T.edge);
    // Pylons: a ring around each pad. (The Body pulse's reach is the edge of its lit water: the
    // charge walks the water 20 steps, so a circle would promise more than it covers.)
    if (w.kind === 'pylon')
      for (const p of w.pylons) {
        w.edge.circle(p.x, p.y, F.pylonRing).stroke({ width: 1, color: T.edgeDark, alpha: 0.6 });
        w.edge.circle(p.x, p.y, F.pylonRing).stroke({ width: 0.5, color: T.edge });
      }
  }

  private begin(n: number): void {
    if (this.seen.length < n) this.seen = new Int32Array(n);
    if (++this.stamp > 2e9) {
      this.seen.fill(0);
      this.stamp = 1;
    }
    this.queue.length = 0;
    this.dist.length = 0;
  }

  /** Water cells reachable from (x, y) along the water within `reach` steps (the sim's rule 11 search). */
  private waterCells(s: GameState, x: number, y: number, reach: number): number[] {
    const g = s.grid;
    this.begin(g.ground.length);
    const start = Math.floor(y) * g.width + Math.floor(x);
    if (x < 0 || y < 0 || x >= g.width || y >= g.height || !isWater(g.ground[start]!)) return [];
    return this.flood(s, [start], (code) => (isWater(code) ? 1 : -1), reach);
  }

  /** Each pylon tile's metal network, then the water it touches out to the storm's water reach. */
  private pylonCells(s: GameState, pylons: readonly { x: number; y: number }[]): number[] {
    const h = TILE_CELLS / 2;
    return this.networkCells(s, pylons, (dx, dy) => Math.abs(dx) < h && Math.abs(dy) < h);
  }

  /** The self-toll: the metal and water under the bell (its circle), and what they conduct to. */
  private tollCells(s: GameState, x: number, y: number, r: number): number[] {
    return this.networkCells(s, [{ x, y }], (dx, dy) => dx * dx + dy * dy <= r * r);
  }

  /**
   * Conducting cells in the footprints `inside` around `at` (rules 12–13: enemy charge seeded
   * there), then their metal network and the water it touches out to the enemy water reach.
   */
  private networkCells(s: GameState, at: readonly { x: number; y: number }[], inside: (dx: number, dy: number) => boolean): number[] {
    const g = s.grid;
    this.begin(g.ground.length);
    const starts: number[] = [];
    const R = TILE_CELLS * 2;
    for (const p of at)
      for (let yy = Math.floor(p.y - R); yy < p.y + R; yy++)
        for (let xx = Math.floor(p.x - R); xx < p.x + R; xx++)
          if (xx >= 0 && yy >= 0 && xx < g.width && yy < g.height && inside(xx + 0.5 - p.x, yy + 0.5 - p.y)) {
            const i = yy * g.width + xx;
            if (materialByCode[g.ground[i]!]!.conducts !== 'none') starts.push(i);
          }
    const reach = s.tuning.grid.water.maxDistance;
    return this.flood(s, starts, (code) => {
      const m = materialByCode[code]!;
      if (m.conducts === 'full') return 0;
      return m.conducts === 'falloff' ? 1 : -1;
    }, reach);
  }

  /** Breadth-first over cells whose step cost is ≥ 0 (cost added to the distance), up to `reach`. */
  private flood(s: GameState, starts: number[], cost: (code: number) => number, reach: number): number[] {
    const g = s.grid;
    const W = g.width;
    const out: number[] = [];
    const q = this.queue;
    const d = this.dist;
    for (const i of starts) {
      if (this.seen[i] === this.stamp) continue;
      this.seen[i] = this.stamp;
      q.push(i);
      d.push(0);
    }
    for (let k = 0; k < q.length && out.length < F.glowMaxCells; k++) {
      const i = q[k]!;
      out.push(i);
      const cx = i % W;
      const cy = (i - cx) / W;
      for (const [j, ok] of [
        [i - 1, cx > 0],
        [i + 1, cx < W - 1],
        [i - W, cy > 0],
        [i + W, cy < g.height - 1],
      ] as const) {
        if (!ok || this.seen[j] === this.stamp) continue;
        const c = cost(g.ground[j]!);
        if (c < 0 || d[k]! + c > reach) continue;
        this.seen[j] = this.stamp;
        q.push(j);
        d.push(d[k]! + c);
      }
    }
    return out;
  }
}

function isWater(code: number): boolean {
  return materialByCode[code]!.water !== null;
}
