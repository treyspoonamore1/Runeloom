import { enemyDef } from '../../../data/enemies';
import { spellManaCost, spells } from '../../../data/spells';
import type { Enemy } from '../actors/enemies';
import { circleHitsShape, circleIntersectsSector } from '../combat/shapes';
import { Button, type InputFrame } from '../core/input';
import type { GameState } from '../state';
import { hasLineOfSight } from '../world/los';
import { kiterConfig as C } from './kiterConfig';
import { wallDistanceAt, wallDistanceField } from './wallDistance';

/**
 * A scripted player for tests, benches and the 'arena_bot' scenario: a pure function of the state
 * (it remembers nothing between ticks), so a run is reproducible from the seed alone.
 *
 * Each tick it scores 16 run directions and standing still over a short lookahead: telegraphs and
 * enemy arrows that would hit, melee enemies inside their keep distance (much larger while out of
 * mana, or in front of a Shieldbearer), closeness to walls, and progress toward an engage point
 * (the nearest threat, preferring archers; for a Shieldbearer, the spot behind it). Then:
 * - Strike (slot 2) at the aim that hits the most enemies whenever one is in reach. Strike is
 *   ~4× more damage per mana than Fire Bolt here, and mana (1.5/s) is what limits a wave clear.
 * - Fire Bolt (slot 1) at the best target in line of sight only with mana to spare: archers
 *   first, Shieldbearers only from outside the shield arc, with lead.
 * - Dodge when a telegraph or arrow lands within dodgeWithin and the best move can't clear it.
 */

// 16 compass directions (k × 22.5°), as constants so the bot needs no trig.
const C1 = 0.9238795325112867;
const S1 = 0.3826834323650898;
const D45 = 0.7071067811865476;
// prettier-ignore
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [C1, S1], [D45, D45], [S1, C1], [0, 1], [-S1, C1], [-D45, D45], [-C1, S1],
  [-1, 0], [-C1, -S1], [-D45, -D45], [-S1, -C1], [0, -1], [S1, -C1], [D45, -D45], [C1, -S1],
];

const STRIKE_SLOT = Button.Cast2;
const BOLT_SLOT = Button.Cast1;

// Scratch.
const live: Enemy[] = [];
const goal = { x: 0, y: 0, on: false };
let bestHitSoon = false;

export function kiterInput(state: GameState): InputFrame {
  const p = state.player;
  const out: InputFrame = { moveX: 0, moveY: 0, aimX: p.x + p.aimDirX, aimY: p.y + p.aimDirY, buttons: 0 };
  if (p.dead) return out;
  live.length = 0;
  for (const e of state.enemies) if (!e.dead && enemyDef(e.kind).behavior.kind !== 'none') live.push(e);

  const canStrike = p.mana >= spellManaCost(spells.strike);
  pickGoal(state, canStrike);

  // Movement: best of 16 directions and standing still.
  let bestScore = scoreMove(state, 0, 0, canStrike);
  let bestX = 0;
  let bestY = 0;
  let hitSoon = bestHitSoon;
  for (const [dx, dy] of DIRS) {
    const s = scoreMove(state, dx, dy, canStrike);
    if (s > bestScore) {
      bestScore = s;
      bestX = dx;
      bestY = dy;
      hitSoon = bestHitSoon;
    }
  }
  out.moveX = bestX;
  out.moveY = bestY;

  if (!aimStrike(state, out)) {
    const spare = p.mana >= p.maxMana * C.boltManaFraction && meleeFarther(state, C.boltSafeDistance);
    if (spare || p.mana >= spellManaCost(spells.fire_bolt)) aimBolt(state, out, !spare);
  }

  const dodgeHeld = (state.prevButtons & Button.Dodge) !== 0;
  if (hitSoon && !dodgeHeld && p.dodgeCharges > 0 && (bestX !== 0 || bestY !== 0))
    out.buttons |= Button.Dodge;
  return out;
}

/** Sets `goal` to where the bot wants to fight: near its preferred target, behind shields. */
function pickGoal(state: GameState, canStrike: boolean): void {
  const p = state.player;
  goal.on = false;
  if (live.length === 0) {
    goal.on = true;
    goal.x = state.room.spawnX;
    goal.y = state.room.spawnY;
    return;
  }
  let best: Enemy | null = null;
  let bestCost = Infinity;
  for (const e of live) {
    const b = enemyDef(e.kind).behavior.kind;
    // Out of mana, only archers are worth closing on (harmless up close, and they run).
    if (!canStrike && b !== 'kite') continue;
    const pref = b === 'kite' ? C.archerPreference : b === 'shield' ? C.shieldPreference : 1;
    const hurt = C.hurtPreference + (1 - C.hurtPreference) * (e.life / e.maxLife);
    const cost = Math.sqrt((e.x - p.x) ** 2 + (e.y - p.y) ** 2) * pref * hurt;
    if (cost < bestCost) {
      bestCost = cost;
      best = e;
    }
  }
  if (!best || (!canStrike && !meleeFarther(state, C.keepFleeing))) return;
  goal.on = true;
  if (enemyDef(best.kind).behavior.kind === 'shield') {
    goal.x = best.x - best.facingX * C.behindShield;
    goal.y = best.y - best.facingY * C.behindShield;
  } else {
    goal.x = best.x;
    goal.y = best.y;
  }
}

/**
 * Score of running along unit (dx, dy) (or standing for 0, 0) for the lookahead. Sets
 * bestHitSoon when this move still gets hit within dodgeWithin.
 */
function scoreMove(state: GameState, dx: number, dy: number, canStrike: boolean): number {
  const p = state.player;
  const t = state.tuning.player;
  const R = t.radius;
  const sp = t.moveSpeed;
  const T = C.lookahead;
  let score = 0;
  bestHitSoon = false;

  // Arrows in flight.
  for (const pr of state.projectiles) {
    if (pr.ended || pr.team !== 'enemy') continue;
    const rr = pr.radius + R + C.dangerMargin;
    for (let i = 1; i <= C.samples; i++) {
      const ts = (T * i) / C.samples;
      if (ts > pr.lifeLeft) break;
      const ex = p.x + dx * sp * ts - (pr.x + pr.vx * ts);
      const ey = p.y + dy * sp * ts - (pr.y + pr.vy * ts);
      if (ex * ex + ey * ey <= rr * rr) {
        score -= C.dangerPenalty;
        if (ts <= C.dodgeWithin) bestHitSoon = true;
        break;
      }
    }
  }

  const qx = p.x + dx * sp * T;
  const qy = p.y + dy * sp * T;
  for (const e of live) {
    const a = e.attack;
    if (a.phase === 'windup') {
      const tl = a.timeLeft < T ? a.timeLeft : T;
      const hx = p.x + dx * sp * tl;
      const hy = p.y + dy * sp * tl;
      if (circleHitsShape(a.shape, a.originX, a.originY, hx, hy, R + C.dangerMargin)) {
        score -= a.timeLeft <= T ? C.dangerPenalty : C.dangerPenalty / 2;
        if (a.timeLeft <= C.dodgeWithin) bestHitSoon = true;
      }
    }
    const kind = enemyDef(e.kind).behavior.kind;
    if (kind === 'kite') continue;
    const ex = e.x + e.vx * T;
    const ey = e.y + e.vy * T;
    const ox = qx - ex;
    const oy = qy - ey;
    const d = Math.sqrt(ox * ox + oy * oy);
    let keep: number = canStrike
      ? kind === 'shield'
        ? C.keepShieldbearer
        : C.keepTinderling
      : C.keepFleeing;
    if (kind === 'shield' && d > 0 && (ox * e.facingX + oy * e.facingY) / d > C.shieldFrontDot)
      keep = keep > C.keepShieldFront ? keep : C.keepShieldFront;
    if (d < keep) score -= C.keepWeight * (keep - d) * (keep - d);
  }

  const wd = wallDistanceAt(state.room, wallDistanceField(state.room), qx, qy);
  if (wd < C.wallMargin) score -= C.wallWeight * (C.wallMargin - wd) * (C.wallMargin - wd);
  if (wd < R) score -= C.dangerPenalty;

  if (goal.on) {
    const d0 = Math.sqrt((goal.x - p.x) ** 2 + (goal.y - p.y) ** 2);
    const d1 = Math.sqrt((goal.x - qx) ** 2 + (goal.y - qy) ** 2);
    score += C.goalWeight * (d0 - d1);
  }
  return score;
}

/**
 * Holds Strike at the aim that deals the most useful damage (each target's share capped at its
 * remaining life, so overkill counts for nothing), if any enemy is in reach. With a pack close
 * by and nothing about to hit, it waits until the swing is worth packMinDamage. Returns true if
 * it holds Strike.
 */
function aimStrike(state: GameState, out: InputFrame): boolean {
  const p = state.player;
  if (p.mana < spellManaCost(spells.strike) && p.castSpell !== 'strike') return false;
  const arc = spells.strike.arc;
  const base = spells.strike.baseDamage;
  let bestV = 0;
  let bestD = Infinity;
  let ax = 0;
  let ay = 0;
  for (const e of live) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d === 0 || d > arc.reach + e.radius + C.strikeSlack) continue;
    const ux = dx / d;
    const uy = dy / d;
    let v = 0;
    for (const o of live) {
      if (!circleIntersectsSector(o.x, o.y, o.radius, p.x, p.y, ux, uy, arc.halfAngleCos, arc.reach))
        continue;
      const dmg = base * (1 - o.resist.physical);
      v += dmg < o.life ? dmg : o.life;
    }
    if (v > bestV || (v === bestV && d < bestD)) {
      bestV = v;
      bestD = d;
      ax = ux;
      ay = uy;
    }
  }
  if (bestV === 0) return false;
  if (bestV < C.packMinDamage && !threatened(state) && nearby(state, C.packRadius) >= C.packCount)
    return false;
  out.aimX = p.x + ax * arc.reach;
  out.aimY = p.y + ay * arc.reach;
  out.buttons |= STRIKE_SLOT;
  return true;
}

/**
 * Holds Fire Bolt at the best target in line of sight, leading it. With `finishOnly`, only at an
 * archer out of Strike reach that one bolt kills (saves chasing a kiter for its last few life).
 * Returns true if it did.
 */
function aimBolt(state: GameState, out: InputFrame, finishOnly: boolean): boolean {
  const p = state.player;
  const bolt = spells.fire_bolt;
  const speed = bolt.projectile.speed;
  const reach = spells.strike.arc.reach;
  let best: Enemy | null = null;
  let bestCost = Infinity;
  for (const e of live) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d === 0 || d > C.boltRange) continue;
    const kind = enemyDef(e.kind).behavior.kind;
    // Shield arc: the bolt arrives from the player's side of the Shieldbearer.
    if (e.shield && (-dx * e.facingX - dy * e.facingY) / d >= e.shield.halfAngleCos) continue;
    const resist = 1 - e.resist.fire;
    if (finishOnly && (kind !== 'kite' || d <= reach + e.radius || bolt.baseDamage * resist < e.life))
      continue;
    const cost = (d * (kind === 'kite' ? C.archerPreference : 1)) / resist;
    if (cost >= bestCost || !hasLineOfSight(state.room, p.x, p.y, e.x, e.y)) continue;
    bestCost = cost;
    best = e;
  }
  if (!best) return false;
  const t = Math.sqrt((best.x - p.x) ** 2 + (best.y - p.y) ** 2) / speed;
  out.aimX = best.x + best.vx * t;
  out.aimY = best.y + best.vy * t;
  out.buttons |= BOLT_SLOT;
  return true;
}

/** True if every melee enemy is farther than `d` cells. */
function meleeFarther(state: GameState, d: number): boolean {
  const p = state.player;
  for (const e of live) {
    if (enemyDef(e.kind).behavior.kind === 'kite') continue;
    if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < d * d) return false;
  }
  return true;
}

/** Enemies within `r` cells of the player. */
function nearby(state: GameState, r: number): number {
  const p = state.player;
  let n = 0;
  for (const e of live) if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= r * r) n++;
  return n;
}

/** True if some melee telegraph covers the player now. */
function threatened(state: GameState): boolean {
  const p = state.player;
  const r = state.tuning.player.radius;
  for (const e of live) {
    const a = e.attack;
    if (
      a.phase === 'windup' &&
      !enemyDef(e.kind).attack?.projectile &&
      circleHitsShape(a.shape, a.originX, a.originY, p.x, p.y, r)
    )
      return true;
  }
  return false;
}
