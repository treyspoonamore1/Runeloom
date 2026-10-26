/**
 * Region map adapter: the world agent's region map (src/app/hero.ts getRegionMap →
 * src/sim/world/regionMap.ts buildRegionMap) as the map screen's MapLayout, plus progress
 * (visited rooms, activated Loom Stones, the stone the player stands at: world/adventure.ts
 * loomStoneHere). Travel and rest are HeroEdits through heroAdapter.sendEdit.
 *
 * With `?fixture=1` (screenshots) the fixture layout and progress stand in.
 */
import type { Session } from '../../app/session';
import { getLoomStoneHere, getRegionMap } from '../../app/hero';
import { travelDestinations, type RegionMap } from '../../sim/world/regionMap';
import { uiTuning } from '../../../data/ui';
import { fixturesOn } from '../fixtures/mode';
import { fixtureLayout, fixtureProgress } from '../fixtures/regionMap';
import type { MapLayout, MapLink, MapRoom } from './mapModel';

export interface MapProgress {
  current: string;
  visited: ReadonlySet<string>;
  activated: readonly string[];
  /** The activated Loom Stone the player stands at, or null. */
  standing: { roomId: string; key: string } | null;
  /** Room names of every travel destination (the Hearth's hub isn't on the map), id → name. */
  names: ReadonlyMap<string, string>;
}

const REGION_NAMES: Record<string, string> = {
  emberwood: 'Emberwood',
  kiln: 'The Sunken Kiln',
  fen: 'Glasswater Fen',
  foundry: 'The Drowned Foundry',
  test: 'Test grounds',
  rift: 'Rift',
  hearth: 'The Hearth',
};

/**
 * Lays the region map's integer grid out in map units: each room gets a cell of
 * `uiTuning.mapCell` and a box sized by its tile size within it, so links show between rooms.
 */
export function layoutFromRegionMap(map: RegionMap): MapLayout {
  const c = uiTuning.mapCell;
  const rooms: MapRoom[] = map.nodes.map((n) => {
    const w = Math.min(c.w * 0.9, Math.max(c.w * 0.5, (n.tilesW / c.tilesPerW) * c.w));
    const h = Math.min(c.h * 0.9, Math.max(c.h * 0.5, (n.tilesH / c.tilesPerH) * c.h));
    return {
      id: n.id,
      name: n.name,
      region: n.region,
      x: n.x * c.w + (c.w - w) / 2,
      y: n.y * c.h + (c.h - h) / 2,
      w,
      h,
      loomStones: n.loomStones.map((s) => s.key),
    };
  });
  const ids = new Set(map.nodes.map((n) => n.id));
  const seen = new Set<string>();
  const links: MapLink[] = [];
  for (const n of map.nodes)
    for (const e of n.exits) {
      if (!ids.has(e.room)) continue;
      const [a, b] = n.id < e.room ? [n.id, e.room] : [e.room, n.id];
      if (seen.has(`${a}|${b}`)) continue;
      seen.add(`${a}|${b}`);
      links.push({ a, b });
    }
  const regions = [...new Set(map.nodes.map((n) => n.region))].map((id) => ({
    id,
    name: REGION_NAMES[id] ?? id,
  }));
  return { rooms, links, regions };
}

// The layout only changes with the room set; progress is read separately.
let cache: { key: string; layout: MapLayout } | null = null;

export function regionLayout(session: Session): MapLayout {
  if (fixturesOn.peek()) return fixtureLayout;
  const map = getRegionMap(session);
  const key = map.nodes.map((n) => n.id).join('|');
  if (cache?.key !== key) cache = { key, layout: layoutFromRegionMap(map) };
  return cache.layout;
}

export function mapProgress(session: Session): MapProgress {
  if (fixturesOn.peek())
    return {
      current: fixtureProgress.current,
      visited: new Set(fixtureProgress.visited),
      activated: fixtureProgress.activated,
      standing: fixtureProgress.standing,
      names: new Map(),
    };
  const w = session.state.world;
  const visited = new Set(Object.keys(w.flags).filter((id) => w.flags[id]!.visited));
  visited.add(w.roomId);
  // The Hearth (M7) first in the travel list: it is reached only by fast travel.
  const dests = travelDestinations(session.state);
  return {
    current: w.roomId,
    visited,
    activated: dests.map((d) => `${d.roomId}#${d.key}`),
    standing: getLoomStoneHere(session),
    names: new Map(dests.map((d) => [d.roomId, d.name])),
  };
}
