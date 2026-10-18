/** Debug scenes, selected with ?scene=<id>. Screenshots and browser tests load these. */
export interface SceneDef {
  id: string;
  label: string;
  roomId: string;
}

export const scenes: SceneDef[] = [{ id: 'room', label: 'M0 test yard', roomId: 'test/m0_room' }];

export const DEFAULT_SCENE = 'room';

export function findScene(id: string): SceneDef | undefined {
  return scenes.find((s) => s.id === id);
}
