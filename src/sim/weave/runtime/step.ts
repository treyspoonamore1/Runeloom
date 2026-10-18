/** The spell phase of a tick: due Echo repeats spawn, then every live instance steps in spawn order. */
import { DT } from '../../core/constants';
import type { GameState } from '../../state';
import { stepForm } from './forms';
import { TIME_EPSILON } from './procs';
import { spawnSpell } from './spawn';
import type { PendingSpawn } from './types';

/**
 * Instances spawned during this phase (branches, Echo repeats) step from their spawn tick too,
 * like M1 projectiles: the loop runs over the growing array.
 */
export function stepSpells(state: GameState): void {
  const pend = state.pendingSpells;
  if (pend.length > 0) {
    const due: PendingSpawn[] = [];
    let n = 0;
    for (const ps of pend) {
      ps.delayLeft -= DT;
      if (ps.delayLeft > TIME_EPSILON) pend[n++] = ps;
      else due.push(ps);
    }
    pend.length = n;
    for (const ps of due) {
      ps.cast.refs--;
      spawnSpell(state, ps.cast, ps.spec, ps.at);
    }
  }
  const list = state.spells;
  for (let i = 0; i < list.length; i++) {
    const s = list[i]!;
    if (s.ended) continue;
    s.prevX = s.x;
    s.prevY = s.y;
    s.age += DT;
    stepForm(state, s);
  }
}

/** Removes ended instances (keeping order) and cast records nothing refers to any more. */
export function compactSpells(state: GameState): void {
  const list = state.spells;
  let n = 0;
  for (const s of list) if (!s.ended) list[n++] = s;
  list.length = n;
  const casts = state.casts;
  let m = 0;
  for (const c of casts) if (c.refs > 0) casts[m++] = c;
  casts.length = m;
}

/** Hitstop tick: instances hold still for render interpolation. */
export function holdSpells(state: GameState): void {
  for (const s of state.spells) {
    s.prevX = s.x;
    s.prevY = s.y;
  }
}
