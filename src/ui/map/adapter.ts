/**
 * Region map adapter: what the map needs from the world/puzzles agent.
 *
 * EXPECTED from src/sim/world/regionMap.ts (world agent): a layout of every region room with
 * { id, region, x, y, w, h } in layout units (any scale), links between rooms { a, b, door? }
 * (door: 'locked' | 'big' | 'sealed'), region names, and each room's Loom Stone object keys
 * (`loom_stone@tx,ty`, as WorldObject.key). Names come from the room files' @name.
 * EXPECTED from GameState.world (already in the contract): roomId, flags[id].visited,
 * loomStones (`${roomId}#${key}`), keys. From state.objects: the 'loom_stone' the player stands
 * at (or a world helper `standingLoomStone(state)`; this file falls back to distance).
 * Edits: { kind: 'travel', roomId, key } and { kind: 'rest' } through heroAdapter.sendEdit.
 */
import type { Session } from '../../app/session';
import { uiTuning } from '../../../data/ui';
import { TILE_CELLS } from '../../sim/core/constants';
import { fixturesOn } from '../fixtures/mode';
import { fixtureLayout, fixtureProgress } from '../fixtures/regionMap';
import type { MapLayout } from './mapModel';

export interface MapProgress {
  current: string;
  visited: ReadonlySet<string>;
  activated: readonly string[];
  /** The activated Loom Stone the player stands at, or null. */
  standing: { roomId: string; key: string } | null;
}

/** MERGE: return the world agent's regionMap (mapped to MapLayout) when fixtures are off. */
export function regionLayout(): MapLayout {
  return fixtureLayout;
}

export function mapProgress(session: Session): MapProgress {
  if (fixturesOn.peek())
    return {
      current: fixtureProgress.current,
      visited: new Set(fixtureProgress.visited),
      activated: fixtureProgress.activated,
      standing: fixtureProgress.standing,
    };
  const s = session.state;
  const w = s.world;
  const visited = new Set(Object.keys(w.flags).filter((id) => w.flags[id]!.visited));
  visited.add(w.roomId);
  return { current: w.roomId, visited, activated: w.loomStones, standing: standingStone(session) };
}

/** The active Loom Stone within reach of the player in the current room, or null. */
export function standingStone(session: Session): { roomId: string; key: string } | null {
  const s = session.state;
  const p = s.player;
  const reach = uiTuning.loomStoneReach;
  for (const o of s.objects) {
    if (o.kind !== 'loom_stone' || !o.on) continue;
    const cx = (o.tx + 0.5) * TILE_CELLS;
    const cy = (o.ty + 0.5) * TILE_CELLS;
    if ((p.x - cx) ** 2 + (p.y - cy) ** 2 <= reach * reach) return { roomId: s.world.roomId, key: o.key };
  }
  return null;
}
