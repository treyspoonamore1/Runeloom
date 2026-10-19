/**
 * Scenes, selected with ?scene=<id> or the pause menu's place picker. Screenshots and browser tests
 * load these.
 */
import type { GameMode } from '../sim';
import { startRoom } from '../../data/progression';

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
    label: 'Adventure: a new game in Emberwood',
    short: 'Adventure',
    roomId: startRoom,
    mode: 'adventure',
  },
];

export const DEFAULT_SCENE = 'arena';

export function findScene(id: string): SceneDef | undefined {
  return scenes.find((s) => s.id === id);
}
