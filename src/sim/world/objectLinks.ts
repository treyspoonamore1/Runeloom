/**
 * `@link <door char> <condition>` (CONTENT §6.2): when a door opens. Several @link lines for the
 * same door all have to hold. Conditions:
 * - `braziers:all`: every brazier in the room is lit.
 * - `timer:<seconds>:braziers:all`: every brazier lit within the time (each one goes out that
 *   many seconds after it was lit unless the group completes first).
 * - `switch:S`: every conduit switch in the room is powered.
 * - `plates:all`: every pressure plate is pressed at the same time.
 * - `cleared`: the room is cleared (all its enemies dead).
 * - `rifttier:N`: the best rift tier ever is at least N, and every `@exit` of the room leads to a
 *   room that exists (a door to a region not woven yet stays shut). The Fen's storm door (M8).
 * - `sealed`: never holds. A door that stays shut on purpose (the K10 storm door, CONTENT §9.1).
 * A door that opened stays open (RoomFlags.opened), and so do the braziers and switches that
 * opened it: they start lit or powered when the room is entered again.
 */
import type { GameState } from '../state';
import type { RoomHeader } from './room';
import { roomFlags } from './worldState';
import type { ObjectKind, WorldObject } from './objects';
import { openDoor } from './objectGround';
import { riftTierLinkMet } from './riftTierLink';

export type LinkCondition =
  | { kind: 'braziers'; seconds: number }
  | { kind: 'switch' }
  | { kind: 'plates' }
  | { kind: 'cleared' }
  | { kind: 'sealed' }
  | { kind: 'rifttier'; tier: number };

/** Parses a link condition, or returns null if it is not one of CONTENT §6.2's. */
export function parseLinkCondition(text: string): LinkCondition | null {
  if (text === 'braziers:all') return { kind: 'braziers', seconds: 0 };
  if (text === 'switch:S') return { kind: 'switch' };
  if (text === 'plates:all') return { kind: 'plates' };
  if (text === 'cleared') return { kind: 'cleared' };
  if (text === 'sealed') return { kind: 'sealed' };
  const rt = /^rifttier:(\d+)$/.exec(text);
  if (rt) return { kind: 'rifttier', tier: Number(rt[1]) };
  const m = /^timer:(\d+(?:\.\d+)?):braziers:all$/.exec(text);
  if (m) {
    const s = Number(m[1]);
    if (s > 0) return { kind: 'braziers', seconds: s };
  }
  return null;
}

/** The object kind a condition watches, if any. */
export function conditionKind(c: LinkCondition): ObjectKind | null {
  if (c.kind === 'braziers') return 'brazier';
  if (c.kind === 'switch') return 'conduit_switch';
  if (c.kind === 'plates') return 'pressure_plate';
  return null;
}

/** Door characters with at least one @link, in file order (no repeats). */
export function linkedDoors(header: RoomHeader): string[] {
  const out: string[] = [];
  for (const l of header.links) if (!out.includes(l.door)) out.push(l.door);
  return out;
}

/** Seconds a lit brazier stays lit in this room: the timed link's time, or 0 (forever). */
export function brazierSeconds(header: RoomHeader): number {
  for (const l of header.links) {
    const c = parseLinkCondition(l.condition);
    if (c?.kind === 'braziers' && c.seconds > 0) return c.seconds;
  }
  return 0;
}

function allOn(objects: readonly WorldObject[], kind: ObjectKind): boolean {
  let any = false;
  for (const o of objects) {
    if (o.kind !== kind) continue;
    any = true;
    if (!o.on) return false;
  }
  return any;
}

/** True when every @link condition of `door` holds now. Unknown conditions never hold. */
export function linkMet(state: GameState, door: string): boolean {
  let any = false;
  for (const l of state.room.header.links) {
    if (l.door !== door) continue;
    any = true;
    const c = parseLinkCondition(l.condition);
    if (c === null || c.kind === 'sealed') return false;
    if (c.kind === 'rifttier') {
      if (!riftTierLinkMet(state, c.tier)) return false;
    } else if (c.kind === 'cleared') {
      if (!roomFlags(state.world, state.room.id).cleared) return false;
    } else if (!allOn(state.objects, conditionKind(c)!)) return false;
  }
  return any;
}

/** Opens every closed door whose links all hold; a timed brazier group then stays lit. */
export function stepLinks(state: GameState): void {
  for (const door of linkedDoors(state.room.header)) {
    let closed = false;
    for (const o of state.objects) if (o.kind === 'door' && o.link === door && !o.on) closed = true;
    if (!closed || !linkMet(state, door)) continue;
    for (const o of state.objects) {
      if (o.kind === 'door' && o.link === door && !o.on) openDoor(state, o);
      // The group that opened it stays as it is now.
      if (o.link === door && o.kind === 'brazier') o.timer = 0;
    }
  }
}
