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
import { equip, fuse, salvage, unequip, unfuse } from './equip';
import { refreshHero } from './hero';
import { restAtLoomStone, travelToLoomStone } from '../world/adventure';

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
/**
 * A HeroEdit recorded by the Session, applied between ticks when `state.tick === tick` (like
 * LoadoutEdit). `after`: how many Loom edits the session had recorded before it, so replays keep
 * the order of hero and Loom edits made between the same two ticks.
 */
export interface TimedHeroEdit {
  tick: number;
  after: number;
  edit: HeroEdit;
}

/**
 * Applies an edit if it is legal; returns why not, or null when it applied. Equipment edits work
 * in adventure mode only (other modes have no inventory). A successful edit refreshes the hero.
 */
export function applyHeroEdit(state: GameState, edit: HeroEdit): string | null {
  // ---- Passive tree (effects agent): src/sim/hero/passives.ts refreshes the hero itself ----
  if (edit.kind === 'allocate' || edit.kind === 'refund') return applyPassiveEdit(state, edit);
  // ---- World edits (world agent): Loom Stone rest and fast travel (world/adventure.ts) ----
  if (edit.kind === 'travel') return travelToLoomStone(state, edit.roomId, edit.key);
  if (edit.kind === 'rest') return restAtLoomStone(state);
  // ---- Equipment (hero agent) ----
  const err = applyEquipmentEdit(state, edit);
  if (err === null) refreshHero(state);
  return err;
}

type EquipmentEdit = Exclude<HeroEdit, { kind: 'allocate' | 'refund' | 'travel' | 'rest' }>;

function applyEquipmentEdit(state: GameState, edit: EquipmentEdit): string | null {
  if (state.mode !== 'adventure') return 'Only in adventure mode';
  switch (edit.kind) {
    case 'equip':
      return equip(state, edit.uid, edit.slot);
    case 'unequip':
      return unequip(state, edit.slot);
    case 'salvage':
      return salvage(state, edit.uid);
    case 'fuse':
      return fuse(state, edit.partUid, edit.spindleUid, edit.socket);
    case 'unfuse':
      return unfuse(state, edit.spindleUid, edit.socket, edit.keep);
  }
}
