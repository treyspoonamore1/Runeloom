/**
 * Monster rarity and mods (CONTENT §5; data/monsterMods.ts). Magic: 1–2 mods, ×1.7 life. Rare:
 * 2–4 mods (as many as ship), ×4 life, 2 minions (actors/roomSpawns.ts adds them). Mods are
 * rolled from state.aiRng, distinct, from the shipped ones in table order.
 *
 * Mod effects: Hasted scales walking (ai/common.ts moveAlong) and attack speed (recover, active
 * and cooldowns; windups only down to minTelegraph: combat/enemyAttacks.ts, ai/index.ts);
 * Incendiary leaves fire on death (actors/chemistry.ts); Thick-skinned multiplies life at spawn.
 */
import { minTelegraph, monsterMods, rarities, type MonsterModDef } from '../../../data/monsterMods';
import type { GameState } from '../state';

type Rarity = 'normal' | 'magic' | 'rare';

const table = monsterMods as Record<string, MonsterModDef>;

/** Mods that can roll now (shipped in M4). */
export const shippedMods: readonly string[] = Object.keys(table).filter((id) => table[id]!.ships === 'M4');

/** Life multiplier of a rarity with its mods: the rarity's × each mod's (Thick-skinned 1.4). */
export function rarityLifeMult(rarity: Rarity, mods: readonly string[]): number {
  let m = rarity === 'normal' ? 1 : rarities[rarity].lifeMult;
  for (const id of mods) m *= table[id]?.life ?? 1;
  return m;
}

/** Rolls a rarity's mods from state.aiRng: count in [modsMin, modsMax] (capped at the shipped mods), distinct. */
export function rollMods(state: GameState, rarity: Rarity): string[] {
  if (rarity === 'normal') return [];
  const r = rarities[rarity];
  const pool = [...shippedMods];
  let n = r.modsMin + state.aiRng.int(r.modsMax - r.modsMin + 1);
  if (n > pool.length) n = pool.length;
  const out: string[] = [];
  for (let k = 0; k < n; k++) out.push(pool.splice(state.aiRng.int(pool.length), 1)[0]!);
  return out;
}

/** Minions a monster of this rarity brings (Rare: 2). */
export function rarityMinions(rarity: Rarity): number {
  return rarity === 'normal' ? 0 : rarities[rarity].minions;
}

interface Modded {
  mods: readonly string[];
}

/** Product of the mods' move speed multipliers (Hasted 1.3); 1 without mods. */
export function moveSpeedMult(e: Modded): number {
  let m = 1;
  for (const id of e.mods) m *= table[id]?.moveSpeed ?? 1;
  return m;
}

/** Product of the mods' attack speed multipliers (Hasted 1.3); 1 without mods. */
export function attackSpeedMult(e: Modded): number {
  let m = 1;
  for (const id of e.mods) m *= table[id]?.attackSpeed ?? 1;
  return m;
}

/**
 * The windup an attack actually telegraphs for: windup ÷ attack speed, but never below
 * minTelegraph (or the attack's own windup, if that is shorter) — DESIGN §14.
 */
export function hastedWindup(windup: number, speed: number): number {
  if (speed === 1) return windup;
  const floor = windup < minTelegraph ? windup : minTelegraph;
  const w = windup / speed;
  return w > floor ? w : floor;
}

/** Side of the square of fire an Incendiary monster leaves on death, 0 if none. */
export function deathFireSquare(e: Modded): number {
  let n = 0;
  for (const id of e.mods) {
    const s = table[id]?.deathFireSquare ?? 0;
    if (s > n) n = s;
  }
  return n;
}
