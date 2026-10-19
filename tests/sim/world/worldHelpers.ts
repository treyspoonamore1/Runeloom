/** Helpers for the M4 world and puzzle tests. */
import { createAdventure, NEUTRAL_INPUT, step, type GameState, type InputFrame } from '../../../src/sim';
import { loadAllRooms } from '../../../tools/lib/rooms';

/** Every room file under data/rooms. */
export const ROOMS = loadAllRooms();

/** Cell coordinate of tile t's center. */
export const T = (t: number): number => (t + 0.5) * 4;

/** An adventure game starting in `roomId`, with extra inline rooms (`id` → text) added. */
export function adventure(roomId: string, extra: Record<string, string> = {}, seed = 1): GameState {
  return createAdventure({ seed, rooms: { ...ROOMS, ...extra }, startRoomId: roomId });
}

/** An adventure in a single inline room (its @id is read from the text). */
export function inlineRoom(text: string, more: Record<string, string> = {}): GameState {
  const id = /@id (\S+)/.exec(text)![1]!;
  return createAdventure({ seed: 1, rooms: { [id]: text, ...more }, startRoomId: id });
}

/** Steps `n` ticks with `input` (default no input). */
export function run(s: GameState, n: number, input: InputFrame = NEUTRAL_INPUT): void {
  for (let i = 0; i < n; i++) step(s, input);
}

/** Puts the player at (x, y) at rest. */
export function teleport(s: GameState, x: number, y: number): void {
  const p = s.player;
  p.x = p.prevX = x;
  p.y = p.prevY = y;
  p.vx = p.vy = 0;
}

export function obj(s: GameState, kind: string, n = 0) {
  const list = s.objects.filter((o) => o.kind === kind);
  const o = list[n];
  if (!o) throw new Error(`no ${kind} #${n} in ${s.room.id}`);
  return o;
}

/** Event types of the last step. */
export const types = (s: GameState): string[] => s.events.map((e) => e.type);

/** Runs until `cond` or `max` ticks; returns every event seen. */
export function runUntil(
  s: GameState,
  cond: (s: GameState) => boolean,
  max = 600,
  input: InputFrame = NEUTRAL_INPUT,
) {
  const seen: GameState['events'] = [];
  for (let i = 0; i < max && !cond(s); i++) {
    step(s, input);
    seen.push(...s.events);
  }
  return seen;
}
