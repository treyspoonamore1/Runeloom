/**
 * Rule 32 (M8): Tide hitting an entity makes it Wet for a while, the same Wet as standing in water
 * (rule 15): it puts out Ignite (and so lit fuses: Tar Hulk, Tar Matriarch, whose fuses go out
 * when the Ignite does) and quenches Hot enemies, which read `terrain.wetLeft`. Tide never Wets
 * its caster: player spells hit only enemies.
 */
import { extinguish, isIgnited, type AilmentTarget } from '../combat/ailments';
import type { GameState } from '../state';
import { becomeWet } from './terrain';

/** Makes `t` Wet for at least `seconds` (a longer Wet it already has stays). */
export function applyWet(state: GameState, t: AilmentTarget, seconds: number): void {
  if (seconds <= 0) return;
  const ts = t.terrain;
  if (ts.wetLeft <= 0) becomeWet(state, t);
  if (ts.wetLeft < seconds) ts.wetLeft = seconds;
  if (isIgnited(t)) extinguish(state, t);
}
