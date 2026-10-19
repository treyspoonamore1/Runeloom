/**
 * Player commands from menus (inventory, Fuse, passive tree, map): plain data applied between
 * ticks, recorded by the Session and replayed at the same tick, like LoadoutEdit for weaves
 * (weave/runtime/loadout.ts). The UI never writes `state.hero` or `state.world` directly.
 *
 * CONTRACT (M4): the hero/items agent implements applyHeroEdit for the hero edits, the effects
 * agent for 'allocate' and 'refund', the world agent for 'travel' and 'rest'. The hero agent also
 * provides src/app/hero.ts (Session wrapper and view getters) for the UI.
 */
import type { EquipSlot } from './types';
import type { GameState } from '../state';
import { applyPassiveEdit } from './passives';

export type HeroEdit =
  | { kind: 'equip'; uid: number; slot: EquipSlot }
  | { kind: 'unequip'; slot: EquipSlot }
  /** Destroys an unequipped item or an unfused part for Thread Scrap. */
  | { kind: 'salvage'; uid: number }
  | { kind: 'fuse'; partUid: number; spindleUid: number; socket: number }
  /** Removes a fused part: it is destroyed unless `keep` and the hero pays 5 Thread Scrap (DESIGN §8.4). */
  | { kind: 'unfuse'; spindleUid: number; socket: number; keep: boolean }
  /** Spends a passive point on a node connected to the allocated tree. */
  | { kind: 'allocate'; node: string }
  /** Refunds a node whose removal keeps the tree connected (free until level 10, then 1 Thread Scrap; DESIGN §9). */
  | { kind: 'refund'; node: string }
  /** Fast travel from an active Loom Stone to another activated one (region map). */
  | { kind: 'travel'; roomId: string; key: string }
  /** Rest at the Loom Stone the player stands at: full life and mana, rooms repopulate. */
  | { kind: 'rest' };

/** Applies an edit if it is legal; returns why not, or null when it applied. Stub. */
export function applyHeroEdit(state: GameState, edit: HeroEdit): string | null {
  // ---- Passive tree (effects agent): src/sim/hero/passives.ts ----
  if (edit.kind === 'allocate' || edit.kind === 'refund') return applyPassiveEdit(state, edit);
  // ---- end passive tree ----
  void state;
  return `${edit.kind}: not available yet`;
}
