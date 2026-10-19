/**
 * Room spawns (CONTENT §5, §6): the room's `@spawn` headers, in file order, then a Brood Kiln on
 * every `&` tile.
 *
 * - `@spawn <d> enemy:<id> [count] [magic|rare]`: `count` enemies on every `<d>` marker, on a
 *   square grid tuning.enemies.spawnSpacing apart, centered on the marker (swimmers: on the
 *   nearest water cells instead).
 * - `@spawn <d> pack:<id> [magic|rare]`: one pack (data/packs.ts) per marker, member counts
 *   rolled from aiRng, members spread around the marker on cells their bodies fit (packs.ts
 *   `waterOnly`: only on markers in water, members on water).
 * - Rarity: `magic` makes every member Magic with the same 1–2 mods (an `enemy:` line counts as
 *   one pack); `rare` makes the pack's leader (an `enemy:` line: each of its enemies) Rare with
 *   2–4 mods plus 2 normal minions (the pack's `minion` kind; an `enemy:` line: its own kind).
 */
import { enemyDef, isEnemyKind, type EnemyKind } from '../../../data/enemies';
import { isPackId, packs, type PackDef } from '../../../data/packs';
import { TILE_CELLS } from '../core/constants';
import type { GameState } from '../state';
import { circleOverlapsSolid } from './collision';
import { spawnEnemy, type EnemyRarity } from './enemies';
import { isWaterAt } from './locomotion';
import { rarityMinions, rollMods } from './rarity';
import { isShotSolidCell } from '../world/room';

const KILN_CHAR = '&'.charCodeAt(0);

export function spawnRoomEnemies(state: GameState): void {
  const spacing = state.tuning.enemies.spawnSpacing;
  for (const s of state.room.spawns) {
    for (const m of state.room.spawnMarkers) {
      if (m.marker !== s.marker) continue;
      if (s.kind === 'pack') spawnPack(state, s.id, m.x, m.y, s.rarity ?? 'normal');
      else spawnEnemyLine(state, s.id, s.count, m.x, m.y, spacing, s.rarity ?? 'normal');
    }
  }
  const room = state.room;
  for (let ty = 0; ty < room.tilesH; ty++)
    for (let tx = 0; tx < room.tilesW; tx++)
      if (room.tiles[ty * room.tilesW + tx] === KILN_CHAR)
        spawnEnemy(state, 'brood_kiln', (tx + 0.5) * TILE_CELLS, (ty + 0.5) * TILE_CELLS);
}

/** An `enemy:` line on one marker (the M1 grid layout, unchanged for walkers without rarity). */
function spawnEnemyLine(
  state: GameState,
  id: string,
  count: number,
  x: number,
  y: number,
  spacing: number,
  rarity: EnemyRarity,
): void {
  if (!isEnemyKind(id)) throw new Error(`Unknown enemy kind "${id}"`);
  const kinds: EnemyKind[] = new Array<EnemyKind>(count).fill(id);
  const swims = enemyDef(id).locomotion === 'swim';
  if (rarity === 'normal' && !swims) {
    let side = 1;
    while (side * side < count) side++;
    const half = (side - 1) / 2;
    for (let i = 0; i < count; i++) {
      const gx = (i % side) - half;
      const gy = Math.floor(i / side) - half;
      spawnEnemy(state, id, x + gx * spacing, y + gy * spacing);
    }
    return;
  }
  const rarities: EnemyRarity[] = kinds.map(() => rarity);
  const mods: string[][] = kinds.map(() => []);
  if (rarity === 'magic') {
    const shared = rollMods(state, 'magic');
    for (let i = 0; i < count; i++) mods[i] = shared;
  } else if (rarity === 'rare') {
    for (let i = 0; i < count; i++) {
      mods[i] = rollMods(state, 'rare');
      for (let k = 0; k < rarityMinions('rare'); k++) {
        kinds.push(id);
        rarities.push('normal');
        mods.push([]);
      }
    }
  }
  spawnGroup(state, kinds, rarities, mods, x, y, spacing, swims);
}

/** One pack on one marker. */
function spawnPack(state: GameState, id: string, x: number, y: number, rarity: EnemyRarity): void {
  if (!isPackId(id)) throw new Error(`Unknown pack "${id}"`);
  const pack: PackDef = packs[id];
  if (pack.waterOnly && !isWaterAt(state, x, y)) return;
  const kinds: EnemyKind[] = [];
  for (const m of pack.members) {
    const n = m.min + state.aiRng.int(m.max - m.min + 1);
    for (let k = 0; k < n; k++) kinds.push(m.kind);
  }
  const rarities: EnemyRarity[] = kinds.map(() => 'normal');
  const mods: string[][] = kinds.map(() => []);
  if (rarity === 'magic') {
    const shared = rollMods(state, 'magic');
    for (let i = 0; i < kinds.length; i++) {
      rarities[i] = 'magic';
      mods[i] = shared;
    }
  } else if (rarity === 'rare') {
    const lead = kinds.indexOf(pack.leader);
    const i = lead >= 0 ? lead : 0;
    rarities[i] = 'rare';
    mods[i] = rollMods(state, 'rare');
    for (let k = 0; k < rarityMinions('rare'); k++) {
      kinds.push(pack.minion);
      rarities.push('normal');
      mods.push([]);
    }
  }
  spawnGroup(state, kinds, rarities, mods, x, y, state.tuning.enemies.spawnSpacing, pack.waterOnly === true);
}

function spawnGroup(
  state: GameState,
  kinds: readonly EnemyKind[],
  rarities: readonly EnemyRarity[],
  mods: readonly string[][],
  x: number,
  y: number,
  spacing: number,
  water: boolean,
): void {
  const used: number[] = [];
  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i]!;
    const swims = water || enemyDef(kind).locomotion === 'swim';
    const [px, py] = placeNear(state, kind, x, y, spacing, swims, used);
    used.push(px, py);
    spawnEnemy(state, kind, px, py, { rarity: rarities[i]!, mods: mods[i]! });
  }
}

/** Rings of candidate points tried around a marker, at most this many spacings out. */
const MAX_RINGS = 6;

/**
 * The first point around (x, y) — the marker, then square rings `spacing` apart, each ring in
 * a fixed order — where the kind fits (its body clear of what blocks it; swimmers: on water)
 * and no earlier member stands. Falls back to the marker.
 */
function placeNear(
  state: GameState,
  kind: EnemyKind,
  x: number,
  y: number,
  spacing: number,
  swims: boolean,
  used: readonly number[],
): [number, number] {
  for (let r = 0; r <= MAX_RINGS; r++) {
    for (let k = 0; k < (r === 0 ? 1 : 8 * r); k++) {
      const [ox, oy] = ringPoint(r, k);
      const px = x + ox * spacing;
      const py = y + oy * spacing;
      if (taken(used, px, py, spacing * 0.5)) continue;
      if (fits(state, kind, px, py, swims)) return [px, py];
    }
  }
  return [x, y];
}

/** The k-th of the 8r points on the square ring r (integer offsets), clockwise from the top-left corner. */
function ringPoint(r: number, k: number): [number, number] {
  if (r === 0) return [0, 0];
  const side = 2 * r;
  const s = Math.floor(k / side);
  const t = k % side;
  if (s === 0) return [-r + t, -r];
  if (s === 1) return [r, -r + t];
  if (s === 2) return [r - t, r];
  return [-r, r - t];
}

function taken(used: readonly number[], x: number, y: number, d: number): boolean {
  for (let i = 0; i < used.length; i += 2) {
    const dx = used[i]! - x;
    const dy = used[i + 1]! - y;
    if (dx * dx + dy * dy < d * d) return true;
  }
  return false;
}

function fits(state: GameState, kind: EnemyKind, x: number, y: number, swims: boolean): boolean {
  const def = enemyDef(kind);
  if (swims) return isWaterAt(state, x, y);
  if (def.locomotion === 'float') return !isShotSolidCell(state.room, Math.floor(x), Math.floor(y));
  return !circleOverlapsSolid(state.room, x, y, def.radius);
}
