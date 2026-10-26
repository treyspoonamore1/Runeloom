/**
 * Coil Dynamo (M8 Fuse part, CONTENT §4): when charge the player created on water or metal ends,
 * it pulses once more for dynamo_echo of its damage, over the same cells, as a new charge event
 * (so each entity can be hit again) that lasts coilDynamoSeconds and never echoes itself.
 *
 * Each grid tick, before the events count down, every player event in its last tick gets its
 * echo event; then, as each of its cells' charge ends in the cell visit (grid/tick.ts), the cell
 * takes the echo's charge instead (rearmEcho). The pairing is scratch for one grid tick only.
 */
import { OWNER } from '../../../data/materials';
import { coilDynamoSeconds } from '../../../data/fuseEffects';
import type { GameState } from '../state';
import { gridTicks, u8 } from './cells';
import type { Grid } from './grid';

/** This grid tick's ending player events → their echoes. */
const pending = new Map<number, number>();
let echoTicks = 0;

/** Before tickChargeEvents: echo events for the player's events about to end. */
export function dynamoBeforeTick(state: GameState): void {
  pending.clear();
  const k = state.heroMods.effects.dynamo_echo ?? 0;
  if (k <= 0) return;
  const g = state.grid;
  echoTicks = u8(gridTicks(coilDynamoSeconds));
  const n = g.chargeEvents.length;
  for (let j = 0; j < n; j++) {
    const ev = g.chargeEvents[j]!;
    if (ev.ticksLeft !== 1 || ev.owner !== OWNER.player || ev.echo) continue;
    const id = g.nextChargeId++;
    // One more tick: tickChargeEvents counts it down right after, with the ending events.
    g.chargeEvents.push({ ...ev, id, damage: ev.damage * k, ticksLeft: echoTicks + 1, echo: true });
    pending.set(ev.id, id);
  }
}

/** A cell's charge just ended: if its event has an echo, the cell carries the echo now. */
export function rearmEcho(g: Grid, i: number): boolean {
  if (pending.size === 0) return false;
  const echo = pending.get(g.chargeId[i]!);
  if (echo === undefined) return false;
  g.charge[i] = echoTicks;
  g.chargeId[i] = echo;
  return true;
}
