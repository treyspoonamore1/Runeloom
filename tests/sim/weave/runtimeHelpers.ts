import { applyLoadoutSpec, DT, type GameState, type SimEvent, type SpellInstance } from '../../../src/sim';
import { addEnemy, arena, ofType, tick, ticks } from '../combat/helpers';

export { addEnemy, arena, ofType, tick, ticks };

/**
 * The open test arena (player at (80, 60) aiming +x, AI frozen) with `notations` in slots 0–3 on
 * the dev test_spindle (Capacity 99 unless given).
 */
export function weaveArena(notations: (string | null)[], capacity = 99): GameState {
  const state = arena();
  setWeaves(state, notations, capacity);
  return state;
}

export function setWeaves(state: GameState, notations: (string | null)[], capacity = 99): void {
  applyLoadoutSpec(state, { spindleId: 'test_spindle', capacity, notations });
  for (let i = 0; i < 4; i++)
    if (notations[i] && !state.weaves.slots[i]!.program)
      throw new Error(`weave ${i} doesn't compile: ${state.weaves.slots[i]!.error}`);
}

/** 1-based tick (counting the press tick) on which a cast of `castTime` seconds releases. */
export const releaseTick = (castTime: number, frac = 0.25): number =>
  Math.ceil((castTime * frac - 1e-9) / DT);

/** Holds `buttons` (aimed at `aim`) for `n` ticks, then releases for `after` ticks; returns every event. */
export function castFor(
  state: GameState,
  buttons: number,
  n: number,
  aim?: [number, number],
  after = 0,
): SimEvent[] {
  return [...ticks(state, n, buttons, aim), ...ticks(state, after, 0, aim)];
}

/** Hits per target id, from 'hit' events on enemies. */
export function hitsByTarget(events: SimEvent[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const h of ofType(events, 'hit'))
    if (h.target !== 'player') m.set(h.target, (m.get(h.target) ?? 0) + 1);
  return m;
}

/** 'spellSpawn' events of one form. */
export function spawnsOf(events: SimEvent[], form: SpellInstance['form']) {
  return ofType(events, 'spellSpawn').filter((e) => e.form === form);
}

/** Damage of a hit with crit and Shock taken out (both are visible in the event and target state). */
export function baseAmount(amount: number, crit: boolean, critMultiplier: number): number {
  return crit ? amount / critMultiplier : amount;
}
