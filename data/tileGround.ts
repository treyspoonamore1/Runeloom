/**
 * What each room tile (data/tiles.ts, CONTENT §6.1) becomes on the chemistry grid.
 * 'neighbor': markers and pickups sit on the most common ground among their 4 neighbor tiles,
 * ties going to stone (CONTENT §6.1).
 */
import type { TileId } from './tiles';
import type { MaterialId } from './materials';

export interface TileGround {
  ground: MaterialId;
  /** Material revealed when `ground` burns away or reverts (bridges, floors over pits). Default: ground. */
  under?: MaterialId;
  /** Oil on top (CONTENT §6.1 `o`, `O`). */
  oil?: boolean;
  /** Map-placed ice never thaws on its own; fire still melts it (CONTENT §6.1 `i`). */
  permanent?: boolean;
}

export const tileGround: Readonly<Record<TileId, TileGround | 'neighbor'>> = {
  wall: { ground: 'wall' },
  stone: { ground: 'stone' },
  dirt: { ground: 'dirt' },
  grass: { ground: 'grass' },
  bramble: { ground: 'bramble', under: 'dirt' },
  wood_bridge: { ground: 'wood', under: 'deep_water' },
  wood_floor: { ground: 'wood', under: 'pit' },
  shallow_water: { ground: 'shallow_water' },
  deep_water: { ground: 'deep_water' },
  pit: { ground: 'pit' },
  metal_floor: { ground: 'metal_floor' },
  metal_pylon: { ground: 'metal_pylon' },
  oil: { ground: 'stone', oil: true },
  oil_water: { ground: 'shallow_water', oil: true },
  ice: { ground: 'ice', under: 'shallow_water', permanent: true },
  mud: { ground: 'mud' },
  brazier: { ground: 'brazier' },
  crate: { ground: 'crate', under: 'stone' },
  barricade: { ground: 'barricade', under: 'stone' },
  oil_barrel: { ground: 'oil_barrel', under: 'stone' },
  brood_kiln: { ground: 'object' },
  push_block: { ground: 'object' },
  ice_block: { ground: 'object' },
  conduit_switch: { ground: 'object' },
  sealed_switch: { ground: 'object' },
  wind_vane: { ground: 'object' },
  // Its `under` is itself: a doused vent (borrowed) returns to a lit one (rule 27).
  furnace_vent: { ground: 'vent_lit' },
  pressure_plate: 'neighbor',
  door: { ground: 'object' },
  locked_door: { ground: 'object' },
  key_chest: { ground: 'object' },
  big_key_door: { ground: 'object' },
  big_key_chest: { ground: 'object' },
  rune_shrine: { ground: 'object' },
  // Hearth stations (M7): solid and inert, so the Hearth fire never burns anything.
  spindlewright: { ground: 'object' },
  runekeeper: { ground: 'object' },
  cartographer: { ground: 'object' },
  hearth_fire: { ground: 'object' },
  kindling_pit: { ground: 'object' },
  rune_garden: { ground: 'object' },
  expedition_board: { ground: 'object' },
  salvage_loom: { ground: 'object' },
  heart_seed: 'neighbor',
  loom_shard: 'neighbor',
  loom_stone: 'neighbor',
  exit_w: 'neighbor',
  exit_e: 'neighbor',
  exit_n: 'neighbor',
  exit_s: 'neighbor',
  spawn_1: 'neighbor',
  spawn_2: 'neighbor',
  spawn_3: 'neighbor',
  spawn_4: 'neighbor',
  spawn_5: 'neighbor',
  spawn_6: 'neighbor',
  spawn_7: 'neighbor',
  spawn_8: 'neighbor',
  spawn_9: 'neighbor',
};
