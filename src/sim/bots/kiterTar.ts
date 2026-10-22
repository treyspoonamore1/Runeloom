/**
 * Tar Matriarch tactics for the kiter bot (bots/kiter.ts), as a sensible player fights her
 * (CONTENT §5): her tar burns world-owned, and lit while Oiled she flares in a 6-cell burst.
 * - Lit fuses (a Tar Hulk's blast, her flare) are telegraphs: fuseBlastRadius.
 * - In her fight (tarFight): oil is a hazard to stand in while anything burns near it (it may
 *   catch any moment); hazards weigh as much as telegraphs (Oiled, burning oil costs more than her
 *   slam) and are checked all along each move (kiter.ts); her summon's telegraph, which deals no
 *   damage, is ignored; the pathfinding wrapper never walks tile paths through her pit
 *   (campaignNav.ts, tarFightIn).
 * - When she is Oiled with her flare ready, back off past the flare's reach and light her with
 *   the Fire Bolt in slot 1 (LMB) from dry ground, then come back to Strike once she has flared.
 * A pure function of the state, like the rest of the bot.
 */
import { bossFightOf } from '../../../data/enemies';
import { enemyDef } from '../../../data/enemies';
import { SURFACE } from '../../../data/materials';
import type { Enemy } from '../actors/enemies';
import { isOiled } from '../actors/terrainState';
import { isFrozen } from '../combat/ailments';
import { Button, type InputFrame } from '../core/input';
import type { GameState } from '../state';
import { hasLineOfSight } from '../world/los';
import { kiterConfig as C } from './kiterConfig';

/** Blast radius of an enemy's lit fuse (a Tar Hulk's explosion, the Tar Matriarch's flare); 0 if unlit. */
export function fuseBlastRadius(e: Enemy): number {
  if (e.special.fuseLeft <= 0) return 0;
  const c = enemyDef(e.kind).chemistry;
  return c?.explodes?.radius ?? c?.flare?.radius ?? 0;
}

/** The Tar Matriarch, Oiled, with her flare ready and unlit: worth lighting from a distance. */
export function flareReady(boss: Enemy | null): boolean {
  if (boss === null || bossFightOf(boss.kind) !== 'tar_matriarch' || boss.boss === null) return false;
  return boss.special.fuseLeft <= 0 && boss.boss.flareCooldown <= 0 && isOiled(boss) && !isFrozen(boss);
}

/** Cells from her center the bot lights her from: past her flare's reach (radius + body + margin). */
function standoff(state: GameState, boss: Enemy): number {
  const f = enemyDef(boss.kind).chemistry?.flare;
  return (f?.radius ?? 0) + state.tuning.player.radius + C.flareStandoffMargin;
}

/** The Fire Bolt in slot 1 (LMB) and its mana, if it holds one. */
function fireBolt(state: GameState): number | null {
  const prog = state.weaves.slots[0]?.program;
  if (!prog || prog.trigger.event !== 'press' || prog.root.form !== 'bolt') return null;
  if (!prog.root.elements.some((x) => x.element === 'fire')) return null;
  return prog.mana;
}

/**
 * While she is ready to flare and the bot can afford a Fire Bolt: the engage point is on the
 * line from her through the bot at the standoff distance. Returns false (goal untouched) otherwise.
 */
export function flareStandoff(
  state: GameState,
  boss: Enemy | null,
  goal: { x: number; y: number; on: boolean },
): boolean {
  if (!flareReady(boss)) return false;
  const mana = fireBolt(state);
  const p = state.player;
  if (mana === null || p.mana < mana) return false;
  const b = boss!;
  let ux = p.x - b.x;
  let uy = p.y - b.y;
  const d = Math.sqrt(ux * ux + uy * uy);
  if (d < 1e-9) [ux, uy] = [1, 0];
  else [ux, uy] = [ux / d, uy / d];
  const r = standoff(state, b);
  goal.on = true;
  goal.x = b.x + ux * r;
  goal.y = b.y + uy * r;
  return true;
}

/**
 * Holds the Fire Bolt at her once the bot stands past the flare's reach on ground without oil,
 * with her in sight, replacing the other cast buttons. Returns true if it did.
 */
export function flareShot(state: GameState, out: InputFrame, boss: Enemy | null): boolean {
  if (!flareReady(boss)) return false;
  const mana = fireBolt(state);
  const p = state.player;
  if (mana === null || p.mana < mana) return false;
  const b = boss!;
  const r = standoff(state, b) - C.flareShotSlack;
  if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 < r * r) return false;
  if (onOil(state, p.x, p.y) || !hasLineOfSight(state.room, p.x, p.y, b.x, b.y)) return false;
  out.aimX = b.x;
  out.aimY = b.y;
  out.buttons = (out.buttons & Button.Dodge) | Button.Cast1;
  return true;
}

/** True if (x, y) is on oil or tar. */
function onOil(state: GameState, x: number, y: number): boolean {
  const g = state.grid;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= g.width || cy >= g.height) return false;
  return g.surface[cy * g.width + cx] === SURFACE.oil;
}

/** The Tar Matriarch is the boss being fought: hazards weigh as much as her telegraphs. */
export function tarFight(boss: Enemy | null): boolean {
  return boss !== null && bossFightOf(boss.kind) === 'tar_matriarch';
}

/** A live Tar Matriarch is in the room. */
export function tarFightIn(state: GameState): boolean {
  for (const e of state.enemies) if (!e.dead && bossFightOf(e.kind) === 'tar_matriarch') return true;
  return false;
}

/**
 * In her fight, true if cell i holds oil (her tar, the room's oil, a Hulk's trail) with fire close
 * by (any burning cell within tarFireReach cells) or a lit fuse (hers or a Hulk's) in the room:
 * fire reaching her tar burns world-owned and spreads through the oil it touches, so the bot keeps
 * off it (Oiled, on burning oil, it would burn for four times terrain-fire DPS).
 */
export function oilAtRisk(state: GameState, i: number, boss: Enemy | null): boolean {
  if (!tarFight(boss)) return false;
  const g = state.grid;
  if (g.surface[i] !== SURFACE.oil) return false;
  for (const e of state.enemies) if (!e.dead && e.special.fuseLeft > 0) return true;
  const w = g.width;
  const x = i % w;
  const y = (i - x) / w;
  const r = C.tarFireReach;
  for (let cy = Math.max(0, y - r); cy <= Math.min(g.height - 1, y + r); cy++)
    for (let cx = Math.max(0, x - r); cx <= Math.min(w - 1, x + r); cx++)
      if (g.fire[cy * w + cx]! > 0) return true;
  return false;
}
