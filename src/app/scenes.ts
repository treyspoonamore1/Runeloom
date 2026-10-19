/**
 * Scenes, selected with ?scene=<id> or the pause menu's place picker. Screenshots and browser tests
 * load these.
 */
import type { GameMode } from '../sim';
import { startRoom } from '../../data/progression';

/** The adventure scene's start room while emberwood/e1_glade is missing: the test world. */
const ADVENTURE_FALLBACK_ROOM = 'test/world_a';

export interface SceneDef {
  id: string;
  label: string;
  /** Name in the pause menu's place picker. */
  short: string;
  roomId: string;
  /** Default 'sandbox'. */
  mode?: GameMode;
}

export const scenes: SceneDef[] = [
  {
    id: 'arena',
    label: 'The Wilds: endless waves on terrain',
    short: 'The Wilds',
    roomId: 'test/wilds',
    mode: 'arena',
  },
  { id: 'lab', label: 'Chemistry Lab: one station per rule', short: 'Chemistry Lab', roomId: 'test/lab' },
  {
    id: 'arena_flat',
    label: 'M1 arena: endless waves, flat floor',
    short: 'Flat arena',
    roomId: 'test/arena',
    mode: 'arena',
  },
  { id: 'room', label: 'M0 test yard', short: 'Test yard', roomId: 'test/m0_room' },
  {
    id: 'adventure',
    label: 'Adventure: a new game in Emberwood (test rooms until the region exists)',
    short: 'Adventure',
    roomId: ADVENTURE_FALLBACK_ROOM,
    mode: 'adventure',
  },
];

export const DEFAULT_SCENE = 'arena';

/**
 * Where an adventure starts. The adventure scene names the test world (ADVENTURE_FALLBACK_ROOM);
 * it becomes the region's start room (data/progression.ts startRoom) once that file exists. Any
 * other requested room (the console's `room <id>`) is used as is.
 */
export function adventureStartRoom(rooms: Readonly<Record<string, string>>, requested: string): string {
  return requested === ADVENTURE_FALLBACK_ROOM && rooms[startRoom] !== undefined ? startRoom : requested;
}

export function findScene(id: string): SceneDef | undefined {
  return scenes.find((s) => s.id === id);
}
