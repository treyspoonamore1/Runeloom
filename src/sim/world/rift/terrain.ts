/**
 * The chemistry suffixes' terrain rewrites (CONTENT §10), applied to a rift room's grid when the
 * rift is built. Runtime effects (fire spread, ice and smoke durations, Oiled monsters, pylon
 * pulses) are in rules.ts. Exits, markers and walls are never touched, so a rewrite can only add
 * walkable ground (Floodplain, Permafrost, Tinderbox, Drought) or place pylons where they can't
 * cut a path (Live Wires: only on tiles whose 8 neighbors are all open floor).
 */
import { riftMods, type RiftModId } from '../../../../data/rift';
import type { Rng } from '../../core/rng';

/** Ground a suffix may rewrite: open floor (stone, dirt, grass, mud, metal floor). */
const FLOOR = '.,":m';

const at = (rows: string[][], x: number, y: number): string => rows[y]?.[x] ?? '#';

/**
 * Applies every terrain suffix in `mods` to `rows` (mutated), in mod order. `keepClear` is a tile
 * no pylon may sit on or next to (the entry's arrival point: the room center).
 */
export function applyRiftTerrain(
  rows: string[][],
  mods: readonly RiftModId[],
  rng: Rng,
  keepClear: { x: number; y: number } | null = null,
): void {
  for (const id of mods) {
    const m = riftMods[id];
    if (!('terrain' in m)) continue;
    switch (m.terrain) {
      case 'drought':
        forEach(rows, (ch) => (ch === '~' || ch === 'w' ? ',' : ch === 'O' ? 'o' : ch));
        break;
      case 'floodplain': {
        const share = m.floodShare;
        forEach(rows, (ch) => (FLOOR.includes(ch) && rng.chance(share) ? '~' : ch));
        break;
      }
      case 'permafrost':
        forEach(rows, (ch) => (ch === '~' || ch === 'w' ? 'i' : ch));
        break;
      case 'tinderbox':
        forEach(rows, (ch) => (ch === '.' || ch === ',' || ch === ':' ? '"' : ch));
        break;
      case 'live_wires':
        placePylons(rows, m.extraPylons, rng, keepClear);
        break;
    }
  }
}

function forEach(rows: string[][], f: (ch: string) => string): void {
  for (const row of rows) for (let x = 0; x < row.length; x++) row[x] = f(row[x]!);
}

/** `n` pylons on floor tiles surrounded by open floor, picked evenly from those, in row order. */
function placePylons(
  rows: string[][],
  n: number,
  rng: Rng,
  keepClear: { x: number; y: number } | null,
): void {
  const spots: [number, number][] = [];
  for (let y = 2; y < rows.length - 2; y++)
    for (let x = 2; x < rows[y]!.length - 2; x++) {
      let open = true;
      for (let dy = -1; dy <= 1 && open; dy++)
        for (let dx = -1; dx <= 1 && open; dx++) if (!FLOOR.includes(at(rows, x + dx, y + dy))) open = false;
      if (keepClear && Math.abs(x - keepClear.x) <= 2 && Math.abs(y - keepClear.y) <= 2) open = false;
      if (open) spots.push([x, y]);
    }
  for (let k = 0; k < n && spots.length > 0; k++) {
    const [x, y] = spots.splice(rng.int(spots.length), 1)[0]!;
    rows[y]![x] = 'M';
    // Keep the next pylon off this one's neighbors.
    for (let i = spots.length - 1; i >= 0; i--)
      if (Math.abs(spots[i]![0] - x) <= 2 && Math.abs(spots[i]![1] - y) <= 2) spots.splice(i, 1);
  }
}
