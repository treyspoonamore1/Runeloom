/**
 * The new-game character (CONTENT §9.1): the Twig Spindle equipped, the runes Cast, Bolt, Strike
 * and Fire unlocked, `Cast > Bolt[Fire]` on LMB and `Cast > Strike[]` on RMB.
 *
 * Both weaves need a Cast rune and each rune item sits in one place, so the hero starts with
 * enough items for the starting weaves: two Cast, one Bolt, one Strike and one Fire.
 *
 * The world agent's createAdventure builds the game with `hero: newGameHero()` and mode
 * 'adventure', then calls `setupNewGameWeaves(state)`.
 */
import { newGame } from '../../../data/progression';
import type { RuneId } from '../../../data/runes';
import type { GameState } from '../state';
import { applyLoadoutSpec, setSlotWeave } from '../weave/runtime/loadout';
import { parseWeave } from '../weave/notation';
import { makeItem, makeRune } from '../items/items';
import { createHero, refreshHero } from './hero';
import { syncWeaveSpindle } from './equip';
import { runeOrder } from './runes';
import type { HeroState } from './types';

/** Rune items the new game starts with: the listed runes, plus copies so every starting weave fits. */
export function newGameRunes(): RuneId[] {
  const need = new Map<RuneId, number>();
  for (const n of newGame.weaves) {
    if (n === null) continue;
    const parsed = parseWeave(n);
    if (!parsed.ok) throw new Error(`newGame weave "${n}": ${parsed.error.message}`);
    const count = new Map<RuneId, number>();
    for (const r of runeOrder(parsed.tree)) count.set(r.rune, (count.get(r.rune) ?? 0) + 1);
    for (const [r, c] of count) need.set(r, (need.get(r) ?? 0) + c);
  }
  const out: RuneId[] = [];
  for (const r of newGame.runes) {
    const n = Math.max(1, need.get(r) ?? 0);
    for (let i = 0; i < n; i++) out.push(r);
    need.delete(r);
  }
  for (const [r, n] of need) for (let i = 0; i < n; i++) out.push(r);
  return out;
}

/** A level 1 hero with the new-game spindle (equipped), rune items and unlocks. */
export function newGameHero(): HeroState {
  const hero = createHero();
  const spindle = makeItem(hero, newGame.spindle, 'normal', 1);
  hero.items.push(spindle);
  hero.equipped.spindle = spindle.uid;
  for (const r of newGameRunes()) hero.runes.push(makeRune(hero, r));
  hero.unlockedRunes = [...new Set(hero.runes.map((r) => r.rune))].sort();
  return hero;
}

/**
 * Puts the new-game weaves in their slots on an adventure game whose hero came from
 * newGameHero (the equipped spindle and socketed rune items), and refreshes the hero.
 * Throws if a starting weave can't be set (a data error).
 */
export function setupNewGameWeaves(state: GameState): void {
  applyLoadoutSpec(state, { spindleId: newGame.spindle, notations: [] });
  syncWeaveSpindle(state);
  refreshHero(state);
  newGame.weaves.forEach((n, slot) => {
    if (n === null) return;
    const out = setSlotWeave(state, slot, n);
    if (!out.applied) {
      const msg =
        out.preview.parseError?.message ??
        (out.preview.compiled?.ok === false ? out.preview.compiled.error.message : '');
      throw new Error(`New-game weave "${n}" can't be set: ${msg}`);
    }
  });
}
