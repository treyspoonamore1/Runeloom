/** Debug scenes, selected with ?scene=<id>. Screenshots and browser tests load these. */
import type { GameMode } from '../sim';

export interface SceneDef {
  id: string;
  label: string;
  roomId: string;
  /** Default 'sandbox'. */
  mode?: GameMode;
}

export const scenes: SceneDef[] = [
  { id: 'arena', label: 'The Wilds: endless waves on terrain', roomId: 'test/wilds', mode: 'arena' },
  { id: 'arena_flat', label: 'M1 arena: endless waves, flat floor', roomId: 'test/arena', mode: 'arena' },
  { id: 'room', label: 'M0 test yard', roomId: 'test/m0_room' },
  { id: 'lab', label: 'Chemistry Lab: one station per rule', roomId: 'test/lab' },
];

export const DEFAULT_SCENE = 'arena';

export function findScene(id: string): SceneDef | undefined {
  return scenes.find((s) => s.id === id);
}
