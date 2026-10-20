/**
 * Room legend (CONTENT §6.1). One entry per map character.
 * `walk`: the player and walking enemies can stand on it.
 * `blocksShots`: projectiles and beams stop on it.
 * `marker`: an object or marker that sits on the ground of its neighbors (CONTENT §6.1).
 */
export interface TileDef {
  char: string;
  id: string;
  walk: boolean;
  blocksShots: boolean;
  marker?: boolean;
}

export const tiles = [
  { char: '#', id: 'wall', walk: false, blocksShots: true },
  { char: '.', id: 'stone', walk: true, blocksShots: false },
  { char: ',', id: 'dirt', walk: true, blocksShots: false },
  { char: '"', id: 'grass', walk: true, blocksShots: false },
  { char: '*', id: 'bramble', walk: false, blocksShots: false },
  { char: '=', id: 'wood_bridge', walk: true, blocksShots: false },
  { char: '+', id: 'wood_floor', walk: true, blocksShots: false },
  { char: '~', id: 'shallow_water', walk: true, blocksShots: false },
  { char: 'w', id: 'deep_water', walk: false, blocksShots: false },
  { char: '_', id: 'pit', walk: false, blocksShots: false },
  { char: 'm', id: 'metal_floor', walk: true, blocksShots: false },
  { char: 'M', id: 'metal_pylon', walk: false, blocksShots: true },
  { char: 'o', id: 'oil', walk: true, blocksShots: false },
  { char: 'O', id: 'oil_water', walk: true, blocksShots: false },
  { char: 'i', id: 'ice', walk: true, blocksShots: false },
  { char: ':', id: 'mud', walk: true, blocksShots: false },
  { char: 'B', id: 'brazier', walk: false, blocksShots: true, marker: true },
  { char: 'c', id: 'crate', walk: false, blocksShots: true, marker: true },
  { char: '|', id: 'barricade', walk: false, blocksShots: true, marker: true },
  { char: 'b', id: 'oil_barrel', walk: false, blocksShots: true, marker: true },
  { char: '&', id: 'brood_kiln', walk: false, blocksShots: true, marker: true },
  { char: 'P', id: 'push_block', walk: false, blocksShots: true, marker: true },
  { char: 'I', id: 'ice_block', walk: false, blocksShots: true, marker: true },
  { char: 'S', id: 'conduit_switch', walk: false, blocksShots: true, marker: true },
  { char: 'T', id: 'pressure_plate', walk: true, blocksShots: false, marker: true },
  { char: 'D', id: 'door', walk: false, blocksShots: true },
  { char: 'K', id: 'locked_door', walk: false, blocksShots: true },
  { char: 'k', id: 'key_chest', walk: false, blocksShots: true, marker: true },
  { char: 'G', id: 'big_key_door', walk: false, blocksShots: true },
  { char: 'g', id: 'big_key_chest', walk: false, blocksShots: true, marker: true },
  { char: 'R', id: 'rune_shrine', walk: false, blocksShots: true, marker: true },
  { char: 'H', id: 'heart_seed', walk: true, blocksShots: false, marker: true },
  { char: 'L', id: 'loom_shard', walk: true, blocksShots: false, marker: true },
  { char: 'x', id: 'loom_stone', walk: true, blocksShots: false, marker: true },
  { char: '<', id: 'exit_w', walk: true, blocksShots: false },
  { char: '>', id: 'exit_e', walk: true, blocksShots: false },
  { char: '^', id: 'exit_n', walk: true, blocksShots: false },
  { char: 'v', id: 'exit_s', walk: true, blocksShots: false },
  ...'123456789'
    .split('')
    .map((d) => ({ char: d, id: `spawn_${d}`, walk: true, blocksShots: false, marker: true })),
] as const satisfies readonly TileDef[];

export type TileId = (typeof tiles)[number]['id'];

const byChar = new Map<string, TileDef>(tiles.map((t) => [t.char, t]));

export function tileForChar(char: string): TileDef | undefined {
  return byChar.get(char);
}
