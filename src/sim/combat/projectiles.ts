import type { ProjectileDef } from '../../../data/combatTypes';
import { PLAYER_ID, type Enemy } from '../actors/enemies';
import { DT } from '../core/constants';
import { emit, type ProjectileEndReason, type Team } from '../events';
import type { GameState } from '../state';
import { isShotSolidCell, type Room } from '../world/room';
import type { DamagePacket } from './damage';
import { applyHit } from './hits';
import { isBlockedByShield } from './shield';

/** One projectile, as plain data. Lives in `state.projectiles` in spawn order. */
export interface Projectile {
  /** Stable id, unique for the run (from state.nextId). */
  id: number;
  /** 'player' projectiles hit enemies; 'enemy' projectiles hit the player. */
  team: Team;
  /** Id of the entity that fired it (PLAYER_ID for the player). */
  ownerId: number;
  /** ProjectileDef.kind, e.g. 'fire_bolt', 'ember_arrow'. */
  kind: string;
  /** Center in cells. */
  x: number;
  y: number;
  /** Position at the start of the current tick, for render interpolation. */
  prevX: number;
  prevY: number;
  /** Velocity, cells/s. */
  vx: number;
  vy: number;
  /** Collision radius in cells, against walls and bodies. */
  radius: number;
  /** Seconds until it expires. */
  lifeLeft: number;
  /** The damage it deals on hit. Shared, never mutated. */
  damage: DamagePacket;
  /** Knockback distance in cells, along its flight direction. */
  knockback: number;
  /** Extra targets it may still pass through (0: the next hit stops it). */
  pierceLeft: number;
  /** Ids already hit (or evaded), so nothing is hit twice. */
  hitIds: number[];
  /** Ended this tick; removed at the end of the step. */
  ended: boolean;
}

/**
 * Longest move between collision checks, in cells. Under one cell, so a projectile can't skip
 * a one-cell wall, and well under the 2-cell minimum diameter sum of a bolt and a body.
 */
const MAX_SUBSTEP = 0.5;
/** Timers within this many seconds of zero count as expired (absorbs 1/60 rounding). */
const TIME_EPSILON = 1e-9;

export interface SpawnProjectileOptions {
  team: Team;
  ownerId: number;
  x: number;
  y: number;
  /** Unit direction. */
  dirX: number;
  dirY: number;
  def: ProjectileDef;
  damage: DamagePacket;
  knockback: number;
}

export function spawnProjectile(state: GameState, o: SpawnProjectileOptions): Projectile {
  const p: Projectile = {
    id: state.nextId++,
    team: o.team,
    ownerId: o.ownerId,
    kind: o.def.kind,
    x: o.x,
    y: o.y,
    prevX: o.x,
    prevY: o.y,
    vx: o.dirX * o.def.speed,
    vy: o.dirY * o.def.speed,
    radius: o.def.radius,
    lifeLeft: o.def.life,
    damage: o.damage,
    knockback: o.knockback,
    pierceLeft: o.def.pierce,
    hitIds: [],
    ended: false,
  };
  state.projectiles.push(p);
  emit(state, {
    type: 'projectileSpawn',
    id: p.id,
    kind: p.kind,
    team: p.team,
    ownerId: p.ownerId,
    x: p.x,
    y: p.y,
    vx: p.vx,
    vy: p.vy,
    radius: p.radius,
  });
  return p;
}

/** True if any cell in the inclusive cell rectangle blocks shots. Cells outside the room do. */
export function anyShotSolid(room: Room, x0: number, y0: number, x1: number, y1: number): boolean {
  if (x0 < 0 || y0 < 0 || x1 >= room.width || y1 >= room.height) return true;
  const mask = room.shotSolid;
  const w = room.width;
  for (let cy = y0; cy <= y1; cy++) {
    const row = cy * w;
    for (let cx = x0; cx <= x1; cx++) if (mask[row + cx] === 1) return true;
  }
  return false;
}

/** True if a circle overlaps (not just touches) a cell that blocks shots. */
export function circleHitsShotWall(room: Room, x: number, y: number, r: number): boolean {
  const x0 = Math.floor(x - r);
  const x1 = Math.floor(x + r);
  const y0 = Math.floor(y - r);
  const y1 = Math.floor(y + r);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (!isShotSolidCell(room, cx, cy)) continue;
      const qx = x < cx ? cx : x > cx + 1 ? cx + 1 : x;
      const qy = y < cy ? cy : y > cy + 1 ? cy + 1 : y;
      const dx = x - qx;
      const dy = y - qy;
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  return false;
}

function endProjectile(state: GameState, p: Projectile, reason: ProjectileEndReason): void {
  p.ended = true;
  p.vx = p.vy = 0;
  emit(state, { type: 'projectileEnd', id: p.id, kind: p.kind, x: p.x, y: p.y, reason });
}

// Scratch for the per-tick enemy candidates and their sort keys; the sim is single-threaded.
const found: number[] = [];
const order: number[] = [];
const dist2: number[] = [];

/**
 * Broad phase for a player projectile: enemies not yet hit that touch the circle (cx, cy, r)
 * around this tick's sweep, into `order`, nearest to the projectile's start first (insertion
 * sort; ties keep array order). Returns how many.
 */
function gatherCandidates(state: GameState, p: Projectile, cx: number, cy: number, r: number): number {
  const n = state.enemyHash.queryCircle(cx, cy, r, found);
  let m = 0;
  for (let k = 0; k < n; k++) {
    const idx = found[k]!;
    const e = state.enemies[idx]!;
    if (e.dead || p.hitIds.includes(e.id)) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d2 = dx * dx + dy * dy;
    let j = m++;
    while (j > 0 && (dist2[j - 1]! > d2 || (dist2[j - 1] === d2 && order[j - 1]! > idx))) {
      dist2[j] = dist2[j - 1]!;
      order[j] = order[j - 1]!;
      j--;
    }
    dist2[j] = d2;
    order[j] = idx;
  }
  return m;
}

/**
 * Hits at the end (x, y) of one substep: candidate enemies (team 'player', from
 * gatherCandidates) or the player (team 'enemy'). Returns true if the projectile ended.
 */
function hitBodies(state: GameState, p: Projectile, x: number, y: number, candidates: number): boolean {
  if (p.team === 'enemy') {
    const pl = state.player;
    if (pl.dead || p.hitIds.includes(PLAYER_ID)) return false;
    const rr = p.radius + state.tuning.player.radius;
    const dx = pl.x - x;
    const dy = pl.y - y;
    if (dx * dx + dy * dy > rr * rr) return false;
    p.hitIds.push(PLAYER_ID);
    const res = applyHit(state, pl, p.damage, hitInfo(p));
    // Evaded (i-frames): the projectile flies on.
    if (res === null) return false;
    return useHit(p);
  }

  for (let k = 0; k < candidates; k++) {
    const idx = order[k]!;
    if (idx < 0) continue;
    const e: Enemy = state.enemies[idx]!;
    if (e.dead) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const rr = e.radius + p.radius;
    if (dx * dx + dy * dy > rr * rr) continue;
    order[k] = -1;
    p.hitIds.push(e.id);
    if (isBlockedByShield(e, x, y)) {
      p.x = x;
      p.y = y;
      emit(state, { type: 'shieldBlock', id: e.id, projectileId: p.id, x, y });
      endProjectile(state, p, 'blocked');
      return true;
    }
    applyHit(state, e, p.damage, hitInfo(p));
    if (useHit(p)) return true;
  }
  return false;
}

/** Spends one hit: pierce if it can, else ends the projectile. Returns true if it ended. */
function useHit(p: Projectile): boolean {
  if (p.pierceLeft > 0) {
    p.pierceLeft--;
    return false;
  }
  return true;
}

function hitInfo(p: Projectile) {
  const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  return {
    sourceId: p.ownerId,
    dirX: speed > 0 ? p.vx / speed : 0,
    dirY: speed > 0 ? p.vy / speed : 0,
    knockback: p.knockback,
  };
}

/**
 * Moves one projectile for a tick in substeps. Each substep checks bodies first (so a target
 * pressed against a wall is still hit), then walls; a wall stops it at its last clear position.
 * Broad phase once per tick: enemies near the whole sweep, and whether any shot-blocking cell is
 * near it, so open-ground flight skips the per-substep work.
 */
function stepProjectile(state: GameState, p: Projectile): void {
  p.prevX = p.x;
  p.prevY = p.y;
  const dx = p.vx * DT;
  const dy = p.vy * DT;
  const r = p.radius;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(dist / MAX_SUBSTEP));
  const sx = dx / steps;
  const sy = dy / steps;
  const ex = p.x + dx;
  const ey = p.y + dy;
  const wallsNear = anyShotSolid(
    state.room,
    Math.floor((p.x < ex ? p.x : ex) - r),
    Math.floor((p.y < ey ? p.y : ey) - r),
    Math.floor((p.x > ex ? p.x : ex) + r),
    Math.floor((p.y > ey ? p.y : ey) + r),
  );
  const candidates =
    p.team === 'player' ? gatherCandidates(state, p, p.x + dx / 2, p.y + dy / 2, dist / 2 + r) : 0;
  for (let i = 0; i < steps; i++) {
    const nx = p.x + sx;
    const ny = p.y + sy;
    if ((p.team === 'enemy' || candidates > 0) && hitBodies(state, p, nx, ny, candidates)) {
      if (!p.ended) {
        p.x = nx;
        p.y = ny;
        endProjectile(state, p, 'hit');
      }
      return;
    }
    if (wallsNear && circleHitsShotWall(state.room, nx, ny, r)) {
      endProjectile(state, p, 'wall');
      return;
    }
    p.x = nx;
    p.y = ny;
  }
  p.lifeLeft -= DT;
  if (p.lifeLeft <= TIME_EPSILON) endProjectile(state, p, 'expired');
}

/** Steps every live projectile in array order. Call after enemies move and the hash is rebuilt. */
export function stepProjectiles(state: GameState): void {
  const list = state.projectiles;
  // Projectiles spawned during this loop (none in M1) are stepped from their spawn tick too.
  for (let i = 0; i < list.length; i++) {
    const p = list[i]!;
    if (!p.ended) stepProjectile(state, p);
  }
}

/** Removes ended projectiles, keeping the order of the rest. */
export function compactProjectiles(state: GameState): void {
  const list = state.projectiles;
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const p = list[i]!;
    if (!p.ended) list[n++] = p;
  }
  list.length = n;
}
