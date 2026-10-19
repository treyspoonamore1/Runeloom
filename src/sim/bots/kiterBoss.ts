/**
 * Boss and terrain tactics for the kiter bot (bots/kiter.ts), M4:
 * - Burning: run to the nearest uncharged shallow water (Wet puts Ignite out, rule 15).
 * - The Superheated Cinder Warden builds chill only in water (DESIGN §10.3): stand in water so
 *   he wades in after the bot, and while he stands in it, shoot him with the Frost Bolt in slot 3
 *   (Q) if it holds one, until he freezes (breaking Superheat) or is immune to freezing.
 * - While the braziers glow (phase 3), water and metal count as hazards: the storm is coming.
 * A pure function of the state, like the rest of the bot.
 */
import { MAT, materialByCode } from '../../../data/materials';
import type { Enemy } from '../actors/enemies';
import { isFrozen } from '../combat/ailments';
import { Button, type InputFrame } from '../core/input';
import type { GameState } from '../state';
import { hasLineOfSight } from '../world/los';

/** The first live boss in `live`, or null. */
export function bossIn(live: readonly Enemy[]): Enemy | null {
  for (const e of live) if (e.boss !== null) return e;
  return null;
}

/** A boss's braziers are glowing: the brazier storm lands within brazierGlowSeconds. */
export function stormSoon(boss: Enemy | null): boolean {
  return boss !== null && boss.boss!.glowing;
}

/** The boss only builds chill in water and is Superheated: the bot should fight from water. */
export function wantsWater(boss: Enemy | null): boolean {
  if (boss === null) return false;
  const b = boss.boss!;
  return b.chillNeedsWater && b.superheated;
}

/** True if cell i conducts Storm (water, metal, braziers). */
export function conducts(state: GameState, i: number): boolean {
  return materialByCode[state.grid.ground[i]!]!.conducts !== 'none';
}

/**
 * Sets `goal` to the shallow water cell nearest the player within `r` cells that isn't charged;
 * returns false (goal untouched) if there is none.
 */
export function nearestWater(
  state: GameState,
  r: number,
  goal: { x: number; y: number; on: boolean },
): boolean {
  const g = state.grid;
  const p = state.player;
  const cx = Math.floor(p.x);
  const cy = Math.floor(p.y);
  let best = r * r;
  let found = false;
  let gx = 0;
  let gy = 0;
  for (let y = Math.max(0, cy - r); y <= Math.min(g.height - 1, cy + r); y++)
    for (let x = Math.max(0, cx - r); x <= Math.min(g.width - 1, cx + r); x++) {
      const i = y * g.width + x;
      if (g.ground[i] !== MAT.shallow_water || g.charge[i]! > 0) continue;
      const d = (x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2;
      if (d >= best) continue;
      best = d;
      found = true;
      gx = x + 0.5;
      gy = y + 0.5;
    }
  if (!found) return false;
  goal.on = true;
  goal.x = gx;
  goal.y = gy;
  return true;
}

/**
 * Holds the Frost Bolt in slot 3 at a Superheated boss standing in water that can be frozen,
 * replacing the other cast buttons. Returns true if it did.
 */
export function frostShot(state: GameState, out: InputFrame, boss: Enemy | null): boolean {
  if (boss === null || !wantsWater(boss)) return false;
  const b = boss.boss!;
  if (!b.inWater || isFrozen(boss) || boss.ailments.freeze.immuneLeft > 0) return false;
  const prog = state.weaves.slots[2]?.program;
  if (!prog || prog.trigger.event !== 'press' || prog.root.form !== 'bolt') return false;
  if (!prog.root.elements.some((x) => x.element === 'frost') || state.player.mana < prog.mana) return false;
  const p = state.player;
  if (!hasLineOfSight(state.room, p.x, p.y, boss.x, boss.y)) return false;
  out.aimX = boss.x;
  out.aimY = boss.y;
  out.buttons = (out.buttons & Button.Dodge) | Button.Cast3;
  return true;
}
