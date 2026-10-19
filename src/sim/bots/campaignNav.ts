/**
 * The kiter bot (bots/kiter.ts) with tile pathfinding for the region's rooms (M4 balance pass).
 * The kiter steers straight at its engage point and keeps far from walls, which works in arenas
 * but not in mazes and walled rooms (it stalls in front of a bramble hedge). This wrapper keeps
 * the kiter's casts and dodges and replaces its movement when:
 * - travelling (no enemy or enemy shot close) or the straight line to the goal is blocked: walk
 *   the tile path to the goal (Dijkstra, 8-way, no corner cutting, like bots/scriptPath.ts);
 * - the goal can't be walked to (an enemy on a pit island, in water): walk to the nearest tile
 *   that sees it within bolt range and shoot it with LMB;
 * - nothing sees it either (inside a bramble vault): walk a path that may cross burnable tiles
 *   (bramble, crates, barricades) and burn the first one in the way with player-owned fire, the
 *   way a player burns through with Swath or Lob (CONTENT §9's puzzle verbs, tested elsewhere).
 * Plans are rebuilt every `replanTicks` or when the goal moves to another tile. Deterministic.
 */
import { enemyDef } from '../../../data/enemies';
import { MAT, materialByCode, OWNER } from '../../../data/materials';
import { PLAYER_ID, type Enemy } from '../actors/enemies';
import { TILE_CELLS } from '../core/constants';
import { Button, type InputFrame } from '../core/input';
import { applyElement } from '../grid/paint';
import type { GameState } from '../state';
import { hasLineOfSight, hasWalkLine } from '../world/los';
import type { Room } from '../world/room';
import { kiterGoal, kiterInput } from './kiter';
import { tileWalkable } from './scriptPath';

/** Bot heuristics (not game tuning). */
const NAV = {
  /** Replan at least this often. */
  replanTicks: 30,
  /** Look this many waypoints ahead for the farthest one in a straight walk line. */
  lookAhead: 6,
  /** A waypoint within this many cells counts as reached. */
  reach: 1.5,
  /** The last waypoint of a shooting plan counts as reached within this many cells. */
  spotReach: 0.5,
  /** Cells beyond a lit Tar Hulk's blast radius inside which the bot holds its Strike. */
  blastMargin: 3,
  /** Dodge out of a lit Tar Hulk's blast when its fuse has this many seconds left. */
  blastDodge: 0.25,
  /** Cells of clear walking a flee direction needs. */
  fleeProbe: 4,
  /** Fighting (the kiter moves on its own) while an enemy is this close, or an enemy shot. */
  engageEnemy: 16,
  engageShot: 12,
  /** Longest shot at an enemy that can't be walked to, cells. */
  shotRange: 55,
  /** Extra path cost of a tile with fire that would hurt (walk around it if it's cheap to). */
  fireCost: 30,
  /** Half-width of the clear corridor a shot needs, cells (a bolt's radius plus slack). */
  shotWidth: 1.6,
  /** Extra path cost of crossing a burnable tile (they must burn first). */
  burnCost: 12,
  /** Burn the next tile in the way from this close, cells; at most once per this many ticks. */
  burnReach: 8,
  burnEveryTicks: 90,
  /** Radius of the fire the bot lights on a burnable tile, cells. */
  burnRadius: 2.5,
} as const;

const NX = [1, -1, 0, 0, 1, -1, 1, -1];
const NY = [0, 0, 1, -1, 1, 1, -1, -1];

/** Line of sight wide enough for a bolt (radius 1 cell): the center line and both edges. */
function shotClear(room: Room, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-9) return true;
  const ox = (-dy / len) * NAV.shotWidth;
  const oy = (dx / len) * NAV.shotWidth;
  return (
    hasLineOfSight(room, x0, y0, x1, y1) &&
    hasLineOfSight(room, x0 + ox, y0 + oy, x1 + ox, y1 + oy) &&
    hasLineOfSight(room, x0 - ox, y0 - oy, x1 - ox, y1 - oy)
  );
}

/** True while an enemy or an enemy projectile is close: the kiter's own movement fights. */
function engaged(state: GameState): boolean {
  const p = state.player;
  const re = NAV.engageEnemy * NAV.engageEnemy;
  for (const e of state.enemies) if (!e.dead && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= re) return true;
  const rs = NAV.engageShot * NAV.engageShot;
  for (const pr of state.projectiles)
    if (!pr.ended && pr.team === 'enemy' && (pr.x - p.x) ** 2 + (pr.y - p.y) ** 2 <= rs) return true;
  return false;
}

/** A Tar Hulk with a lit fuse whose blast would reach the player (DESIGN §6.2, CONTENT §5), or null. */
function litHulkNear(state: GameState): Enemy | null {
  const p = state.player;
  for (const e of state.enemies) {
    if (e.dead || e.special.fuseLeft <= 0) continue;
    const blast = enemyDef(e.kind).chemistry?.explodes;
    if (!blast) continue;
    const r = blast.radius + NAV.blastMargin;
    if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= r * r) return e;
  }
  return null;
}

/** Sets the move to run away from (x, y), turning up to 90° around walls. False if boxed in. */
function flee(state: GameState, out: InputFrame, x: number, y: number): boolean {
  const p = state.player;
  let ux = p.x - x;
  let uy = p.y - y;
  const len = Math.sqrt(ux * ux + uy * uy);
  if (len < 1e-9) [ux, uy] = [1, 0];
  else [ux, uy] = [ux / len, uy / len];
  for (const deg of [0, 30, -30, 60, -60, 90, -90]) {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const dx = ux * c - uy * s;
    const dy = ux * s + uy * c;
    if (!hasWalkLine(state.room, p.x, p.y, p.x + dx * NAV.fleeProbe, p.y + dy * NAV.fleeProbe)) continue;
    out.moveX = dx;
    out.moveY = dy;
    return true;
  }
  return false;
}

/** A tile that isn't walkable now but would be once its burnable cells burn (no oil barrels). */
function burnable(state: GameState, tx: number, ty: number): boolean {
  const room = state.room;
  if (tx < 0 || ty < 0 || tx >= room.tilesW || ty >= room.tilesH) return false;
  const g = state.grid;
  let any = false;
  for (let cy = 0; cy < TILE_CELLS; cy++)
    for (let cx = 0; cx < TILE_CELLS; cx++) {
      const i = (ty * TILE_CELLS + cy) * room.width + tx * TILE_CELLS + cx;
      if (room.solid[i] !== 1) continue;
      const code = g.ground[i]!;
      const m = materialByCode[code]!;
      if (!m.flammable || m.flammable.explodeAfter !== undefined || code === MAT.oil_barrel) return false;
      any = true;
    }
  return any;
}

/** True if a cell of tile t burns with fire that would hurt the player (enemy or world owned). */
function hostileFire(state: GameState, t: number): boolean {
  const room = state.room;
  const g = state.grid;
  const tx = t % room.tilesW;
  const ty = (t - tx) / room.tilesW;
  for (let cy = 0; cy < TILE_CELLS; cy++)
    for (let cx = 0; cx < TILE_CELLS; cx++) {
      const i = (ty * TILE_CELLS + cy) * room.width + tx * TILE_CELLS + cx;
      if (g.fire[i]! > 0 && g.owner[i] !== OWNER.player) return true;
    }
  return false;
}

/** The player stands on a cell burning with fire that hurts them. */
function inHostileFire(state: GameState): boolean {
  const p = state.player;
  const g = state.grid;
  const cx = Math.floor(p.x);
  const cy = Math.floor(p.y);
  if (cx < 0 || cy < 0 || cx >= g.width || cy >= g.height) return false;
  const i = cy * g.width + cx;
  return g.fire[i]! > 0 && g.owner[i] !== OWNER.player;
}

interface Plan {
  /** Tile path from the player's tile (excluded) to the target tile. */
  tiles: number[];
  /** What the plan does at its end: walk to the goal, shoot it from there, or burn through. */
  mode: 'walk' | 'shoot' | 'burn' | 'none';
}

/**
 * Dijkstra over tiles from `start`: walk 1 passes, 2 (burnable) and 3 (burning with fire that
 * hurts the player) pass at an extra cost, 0 blocks.
 */
function costMap(room: Room, walk: Uint8Array, start: number): { cost: Int32Array; parent: Int32Array } {
  const w = room.tilesW;
  const n = w * room.tilesH;
  const cost = new Int32Array(n).fill(-1);
  const parent = new Int32Array(n).fill(-1);
  const buckets: number[][] = [[start]];
  cost[start] = 0;
  for (let c = 0; c < buckets.length; c++) {
    const b = buckets[c];
    if (!b) continue;
    for (const t of b) {
      if (cost[t] !== c) continue;
      const tx = t % w;
      const ty = (t - tx) / w;
      for (let k = 0; k < 8; k++) {
        const nx = tx + NX[k]!;
        const ny = ty + NY[k]!;
        if (nx < 0 || ny < 0 || nx >= w || ny >= room.tilesH) continue;
        const nt = ny * w + nx;
        if (!walk[nt]) continue;
        if (k >= 4 && (!walk[ty * w + nx] || !walk[ny * w + tx])) continue;
        const nc = c + (k < 4 ? 2 : 3) + (walk[nt] === 2 ? NAV.burnCost : walk[nt] === 3 ? NAV.fireCost : 0);
        if (cost[nt] !== -1 && cost[nt]! <= nc) continue;
        cost[nt] = nc;
        parent[nt] = t;
        (buckets[nc] ??= []).push(nt);
      }
    }
  }
  return { cost, parent };
}

function pathTo(parent: Int32Array, start: number, goal: number): number[] {
  const out: number[] = [];
  for (let t = goal; t !== start && t >= 0; t = parent[t]!) out.push(t);
  return out.reverse();
}

function center(room: Room, t: number): { x: number; y: number } {
  const tx = t % room.tilesW;
  return { x: (tx + 0.5) * TILE_CELLS, y: ((t - tx) / room.tilesW + 0.5) * TILE_CELLS };
}

export class CampaignNav {
  private plan: Plan = { tiles: [], mode: 'walk' };
  private goalTile = -1;
  private planTick = -Infinity;
  private burnTick = -Infinity;
  /** Consecutive ticks the goal could be neither walked to, shot nor burned toward. */
  strandedTicks = 0;

  /** The current plan's mode and length (debugging). */
  get planInfo(): string {
    return `${this.plan.mode}:${this.plan.tiles.length}`;
  }

  /** The kiter's input, with path-following movement when its goal is behind something. */
  input(state: GameState): InputFrame {
    const out = kiterInput(state);
    const p = state.player;
    // A lit Tar Hulk: leave its blast (the kiter dithers at its edge), dodging at the last moment,
    // and never Strike it (dying lit, it explodes at once).
    const hulk = litHulkNear(state);
    if (hulk !== null && !p.dead) {
      if (p.castSlot !== 1) out.buttons &= ~Button.Cast2;
      if (flee(state, out, hulk.x, hulk.y) && hulk.special.fuseLeft <= NAV.blastDodge && p.dodgeCharges > 0)
        out.buttons |= Button.Dodge;
      return out;
    }
    const goal = kiterGoal();
    const room = state.room;
    // Standing in fire that hurts (Oiled, on burning oil, it kills in seconds): get out first.
    if (!p.dead && p.terrain.wetLeft <= 0 && inHostileFire(state) && this.escape(state, out)) return out;
    if (p.dead || !goal.on || (hasWalkLine(room, p.x, p.y, goal.x, goal.y) && engaged(state))) {
      this.plan.tiles = [];
      this.goalTile = -1;
      this.strandedTicks = 0;
      return out;
    }
    const tile = Math.floor(goal.y / TILE_CELLS) * room.tilesW + Math.floor(goal.x / TILE_CELLS);
    if (tile !== this.goalTile || state.tick - this.planTick >= NAV.replanTicks) {
      this.plan = this.makePlan(state, goal.x, goal.y);
      this.goalTile = tile;
      this.planTick = state.tick;
    }
    this.strandedTicks = this.plan.mode === 'none' ? this.strandedTicks + 1 : 0;
    const tiles = this.plan.tiles;
    while (tiles.length > 0) {
      const w = center(room, tiles[0]!);
      // A shooting spot is walked to its center: the line of sight was checked from there.
      const r = this.plan.mode === 'shoot' && tiles.length === 1 ? NAV.spotReach : NAV.reach;
      if ((w.x - p.x) ** 2 + (w.y - p.y) ** 2 > r * r) break;
      tiles.shift();
    }
    if (this.plan.mode === 'shoot' && tiles.length === 0) this.shoot(state, out, goal.x, goal.y);
    if (this.plan.mode === 'burn') {
      // Stop before the first tile that must burn; burn it once close.
      const k = tiles.findIndex((t) => !tileWalkable(room, t % room.tilesW, Math.floor(t / room.tilesW)));
      if (k >= 0) {
        const c = center(room, tiles[k]!);
        tiles.length = k;
        if ((c.x - p.x) ** 2 + (c.y - p.y) ** 2 <= NAV.burnReach * NAV.burnReach) this.burn(state, c.x, c.y);
        if (tiles.length === 0) {
          out.moveX = out.moveY = 0;
          return out;
        }
      }
    }
    if (tiles.length === 0) return out;
    // The farthest of the next few waypoints the player can walk straight to.
    let to = center(room, tiles[0]!);
    for (let i = Math.min(NAV.lookAhead, tiles.length) - 1; i > 0; i--) {
      const w = center(room, tiles[i]!);
      if (hasWalkLine(room, p.x, p.y, w.x, w.y)) {
        to = w;
        break;
      }
    }
    const dx = to.x - p.x;
    const dy = to.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1e-9) {
      out.moveX = dx / len;
      out.moveY = dy / len;
    }
    return out;
  }

  /** Moves toward the nearest tile free of hostile fire; false if there is none reachable. */
  private escape(state: GameState, out: InputFrame): boolean {
    const room = state.room;
    const p = state.player;
    const w = room.tilesW;
    const n = w * room.tilesH;
    const walk = new Uint8Array(n);
    for (let t = 0; t < n; t++)
      walk[t] = tileWalkable(room, t % w, Math.floor(t / w)) ? (hostileFire(state, t) ? 3 : 1) : 0;
    const start = Math.floor(p.y / TILE_CELLS) * w + Math.floor(p.x / TILE_CELLS);
    if (start < 0 || start >= n) return false;
    const was = walk[start]!;
    walk[start] = 1;
    const { cost, parent } = costMap(room, walk, start);
    let best = -1;
    for (let t = 0; t < n; t++)
      if (t !== start && walk[t] === 1 && cost[t]! >= 0 && (best < 0 || cost[t]! < cost[best]!)) best = t;
    if (best < 0 || was === 1) return false;
    const path = pathTo(parent, start, best);
    const to = center(room, path[0] ?? best);
    const dx = to.x - p.x;
    const dy = to.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-9) return false;
    out.moveX = dx / len;
    out.moveY = dy / len;
    this.plan.tiles = [];
    this.goalTile = -1;
    return true;
  }

  private makePlan(state: GameState, gx: number, gy: number): Plan {
    const room = state.room;
    const p = state.player;
    const w = room.tilesW;
    const n = w * room.tilesH;
    const walk = new Uint8Array(n);
    for (let t = 0; t < n; t++)
      walk[t] = tileWalkable(room, t % w, Math.floor(t / w)) ? (hostileFire(state, t) ? 3 : 1) : 0;
    const start = Math.floor(p.y / TILE_CELLS) * w + Math.floor(p.x / TILE_CELLS);
    if (start < 0 || start >= n) return { tiles: [], mode: 'walk' };
    walk[start] = 1;
    const goal = Math.floor(gy / TILE_CELLS) * w + Math.floor(gx / TILE_CELLS);
    const { cost, parent } = costMap(room, walk, start);
    if (goal >= 0 && goal < n && cost[goal]! >= 0)
      return { tiles: pathTo(parent, start, goal), mode: 'walk' };
    // Unreachable: the cheapest reachable tile that sees the goal within range.
    let best = -1;
    for (let t = 0; t < n; t++) {
      if (cost[t]! < 0 || (best >= 0 && cost[t]! >= cost[best]!)) continue;
      const c = center(room, t);
      if ((c.x - gx) ** 2 + (c.y - gy) ** 2 > NAV.shotRange * NAV.shotRange) continue;
      if (shotClear(room, c.x, c.y, gx, gy)) best = t;
    }
    if (best >= 0) return { tiles: pathTo(parent, start, best), mode: 'shoot' };
    // Nothing sees it: burn a way through.
    for (let t = 0; t < n; t++) if (!walk[t] && burnable(state, t % w, Math.floor(t / w))) walk[t] = 2;
    const burnMap = costMap(room, walk, start);
    if (goal >= 0 && goal < n && burnMap.cost[goal]! >= 0)
      return { tiles: pathTo(burnMap.parent, start, goal), mode: 'burn' };
    return { tiles: [], mode: 'none' };
  }

  /** Holds LMB at (x, y) if it holds a working Cast weave, there is mana and a line of sight. */
  private shoot(state: GameState, out: InputFrame, x: number, y: number): void {
    const p = state.player;
    const prog = state.weaves.slots[0]?.program;
    if (!prog || prog.trigger.event !== 'press' || (out.buttons & Button.Cast2) !== 0) return;
    if (p.mana < prog.mana && p.castSlot !== 0) return;
    if (!shotClear(state.room, p.x, p.y, x, y)) return;
    out.aimX = x;
    out.aimY = y;
    out.buttons = (out.buttons & Button.Dodge) | Button.Cast1;
  }

  /** Lights player-owned fire on a burnable tile (a scripted Swath or Lob), rate-limited. */
  private burn(state: GameState, x: number, y: number): void {
    if (state.tick - this.burnTick < NAV.burnEveryTicks) return;
    this.burnTick = state.tick;
    applyElement(state, {
      element: 'fire',
      shape: { kind: 'circle', x, y, r: NAV.burnRadius },
      owner: OWNER.player,
      sourceId: PLAYER_ID,
      hitDamage: 0,
      durationMult: 1,
    });
  }
}
