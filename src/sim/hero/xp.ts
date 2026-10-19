/**
 * XP and levels (DESIGN §7): kills give XP scaled by area level and monster rarity; the hero
 * levels through xpToNext (data/progression.ts) with a full heal and one passive point per
 * level; socketed runes gain the same XP (hero/runes.ts).
 */
import { enemyDef, type EnemyKind } from '../../../data/enemies';
import { killXp } from '../../../data/loot';
import { xpToNext } from '../../../data/progression';
import type { EnemyRarity } from '../actors/enemies';
import { scaleByLevel } from '../combat/damage';
import { emit } from '../events';
import type { GameState } from '../state';
import { recompileWeaves } from '../weave/runtime/loadout';
import { refreshHero } from './hero';
import { grantRuneXp } from './runes';

/** Base XP of a kind at area level 1, before rarity. */
export function baseKillXp(kind: EnemyKind): number {
  const o = killXp.baseOverride[kind];
  return o ?? enemyDef(kind).life * killXp.perBaseLife;
}

/** XP for killing one enemy: base × growth^(area level − 1) × rarity, rounded, at least 1 unless the base is 0. */
export function killXpFor(kind: EnemyKind, areaLevel: number, rarity: EnemyRarity): number {
  const base = baseKillXp(kind);
  if (base <= 0) return 0;
  const xp = scaleByLevel(base, killXp.growth, areaLevel) * killXp.rarity[rarity];
  return Math.max(1, Math.round(xp));
}

/**
 * Gives the hero `amount` XP (from a kill at x, y): levels up as often as it covers xpToNext,
 * each with a 'levelUp' event; then a full heal if it levelled and the player is alive. Socketed
 * runes gain the same XP.
 */
export function grantXp(state: GameState, amount: number, x: number, y: number): void {
  if (amount <= 0) return;
  const hero = state.hero;
  hero.xp += amount;
  let levelled = false;
  while (hero.xp >= xpToNext(hero.level)) {
    hero.xp -= xpToNext(hero.level);
    hero.level++;
    levelled = true;
    emit(state, { type: 'levelUp', level: hero.level });
  }
  emit(state, { type: 'xpGained', amount, x, y, xp: hero.xp, level: hero.level });
  const runeSlots = grantRuneXp(state, amount);
  if (levelled) {
    refreshHero(state);
    const p = state.player;
    if (!p.dead) {
      p.life = p.maxLife;
      p.mana = p.maxMana;
    }
  } else if (runeSlots.length > 0) recompileWeaves(state, runeSlots);
}
