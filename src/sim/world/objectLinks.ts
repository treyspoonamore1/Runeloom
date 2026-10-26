/**
 * `@link <door char> <condition>` (CONTENT §6.2): when a door opens. Several @link lines for the
 * same door all have to hold. Conditions:
 * - `braziers:all`: every brazier in the room is lit.
 * - `timer:<seconds>:braziers:all`: every brazier lit within the time (each one goes out that
 *   many seconds after it was lit unless the group completes first).
 * - `switch:S`: every conduit switch in the room (`S` and sealed `Q`) is powered.
 * - `timer:<seconds>:switch:S` (M8): every switch powered within the time (each one unlatches
 *   that many seconds after it was powered unless the group completes first).
 * - `vanes:all` (M8): every wind vane spun.
 * - `plates:all`: every pressure plate is pressed at the same time.
 * - `cleared`: the room is cleared (all its enemies dead).
 * - `rifttier:N`: the best rift tier ever is at least N, and every `@exit` of the room leads to a
 *   room that exists (a door to a region not woven yet stays shut). The Fen's storm door (M8).
 * - `sealed`: never holds. A door that stays shut on purpose (the K10 storm door, CONTENT §9.1).
 * A door that opened stays open (RoomFlags.opened), and so do the braziers and switches that
 * opened it: they start lit or powered when the room is entered again.
 *
 * M8: a room may link two door characters (`D` and `d`). A puzzle object counts for the door its
 * `link` names: the only door watching its kind, or with several, the nearest one (objectBuild.ts).
 */
import type { GameState } from '../state';
import type { RoomHeader } from './room';
import { roomFlags } from './worldState';
import type { ObjectKind, WorldObject } from './objects';
import { openDoor } from './objectGround';
import { riftTierLinkMet } from './riftTierLink';

export type LinkCondition =
  | { kind: 'braziers'; seconds: number }
  /** `seconds` > 0: `timer:<seconds>:switch:S` (M8); 0: `switch:S`. */
  | { kind: 'switch'; seconds: number }
  | { kind: 'plates' }
  | { kind: 'vanes' }
  | { kind: 'cleared' }
  | { kind: 'sealed' }
  | { kind: 'rifttier'; tier: number };

/** Parses a link condition, or returns null if it is not one of CONTENT §6.2's. */
export function parseLinkCondition(text: string): LinkCondition | null {
  if (text === 'braziers:all') return { kind: 'braziers', seconds: 0 };
  if (text === 'switch:S') return { kind: 'switch', seconds: 0 };
  if (text === 'plates:all') return { kind: 'plates' };
  if (text === 'vanes:all') return { kind: 'vanes' };
  if (text === 'cleared') return { kind: 'cleared' };
  if (text === 'sealed') return { kind: 'sealed' };
  const rt = /^rifttier:(\d+)$/.exec(text);
  if (rt) return { kind: 'rifttier', tier: Number(rt[1]) };
  const m = /^timer:(\d+(?:\.\d+)?):(braziers:all|switch:S)$/.exec(text);
  if (m) {
    const s = Number(m[1]);
    if (s > 0) return m[2] === 'switch:S' ? { kind: 'switch', seconds: s } : { kind: 'braziers', seconds: s };
  }
  return null;
}

const WATCHES: Readonly<Partial<Record<LinkCondition['kind'], readonly ObjectKind[]>>> = {
  braziers: ['brazier'],
  switch: ['conduit_switch', 'sealed_switch'],
  plates: ['pressure_plate'],
  vanes: ['wind_vane'],
};

/** The object kinds a condition watches ([] for cleared and sealed). */
export function conditionKinds(c: LinkCondition): readonly ObjectKind[] {
  return WATCHES[c.kind] ?? [];
}

/** The first object kind a condition watches, if any (see conditionKinds). */
export function conditionKind(c: LinkCondition): ObjectKind | null {
  return conditionKinds(c)[0] ?? null;
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

/** Seconds a powered switch stays powered in this room (M8): the timed link's time, or 0 (latched). */
export function switchSeconds(header: RoomHeader): number {
  for (const l of header.links) {
    const c = parseLinkCondition(l.condition);
    if (c?.kind === 'switch' && c.seconds > 0) return c.seconds;
  }
  return 0;
}

/** Every object of these kinds that belongs to `door` (its `link`, objectBuild.ts) is on. */
function allOn(objects: readonly WorldObject[], kinds: readonly ObjectKind[], door: string): boolean {
  let any = false;
  for (const o of objects) {
    if (!kinds.includes(o.kind) || o.link !== door) continue;
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
    } else if (!allOn(state.objects, conditionKinds(c), door)) return false;
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
      // The group that opened it stays as it is now (timed braziers and switches stop counting).
      if (o.link === door && (o.kind === 'brazier' || isSwitch(o.kind))) o.timer = 0;
    }
  }
}

/** A conduit switch, sealed or not. */
export function isSwitch(kind: ObjectKind): boolean {
  return kind === 'conduit_switch' || kind === 'sealed_switch';
}
