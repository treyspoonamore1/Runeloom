/**
 * Running a rift (DESIGN §10.4, M6): opening one with a Rift Sigil at a Loom Stone, its rooms in
 * `state.rooms`, and closing it.
 *
 * - Open (HeroEdit 'openRift'): at an activated Loom Stone, with no rift open, a sigil whose tier
 *   is at most one above the highest tier completed (the tier ladder). The sigil is used up; the
 *   rift's seed comes from the loot RNG. The Loom Stone becomes the respawn point and the rift's
 *   way home; the player arrives at the center of the entry room.
 * - The rift's rooms are generated from WorldState.rift's spec and added to `state.rooms`
 *   (installRiftRooms, also on load), so a save keeps only the spec.
 * - Close: the rift ends whenever the player arrives in a room outside it: walking out of the
 *   entry's south exit or the boss arena's north exit (the way home leads to the Loom Stone), or
 *   dying (respawn at the Loom Stone). It counts as completed if its boss died. Its rooms and room
 *   flags are dropped.
 */
import { emit } from '../../events';
import type { GameState } from '../../state';
import { loomStoneHere } from '../adventure';
import { enterRoom } from '../transition';
import { findSigil, makeSigil } from '../../items/sigils';
import { riftDrops } from '../../../../data/rift';
import { installRiftRooms } from './rooms';
import { riftRoomPrefix, type RiftSpec } from './types';
import { maxRiftTier } from '../../meta/view';

/**
 * The highest sigil tier the hero may open: one above the best completed (the tier ladder), and
 * never above the Rekindle cap (M7, meta/view.ts maxRiftTier: 10, +2 per Rekindle, up to 16).
 */
export function maxOpenTier(state: GameState): number {
  return Math.min(state.hero.riftTier + 1, maxRiftTier(state.hero));
}

/** Why the sigil `uid` can't be opened here now, or null. */
export function openRiftError(state: GameState, uid: number): string | null {
  if (state.mode !== 'adventure') return 'Only in adventure mode';
  if (state.world.rift) return 'A rift is already open';
  const sigil = findSigil(state.hero, uid);
  if (!sigil) return `No Rift Sigil ${uid}`;
  const cap = maxRiftTier(state.hero);
  if (sigil.tier > cap) return `Rekindle to open tiers above ${cap}`;
  if (sigil.tier > maxOpenTier(state)) return `Complete a tier ${sigil.tier - 1} rift first`;
  if (!loomStoneHere(state)) return 'Stand at an activated Loom Stone';
  return null;
}

/** HeroEdit 'openRift'. Returns why it can't, or null when the player is in the rift. */
export function openRift(state: GameState, uid: number): string | null {
  const err = openRiftError(state, uid);
  if (err) return err;
  const hero = state.hero;
  const sigil = findSigil(hero, uid)!;
  const stone = loomStoneHere(state)!;
  hero.sigils.splice(hero.sigils.indexOf(sigil), 1);
  const w = state.world;
  const spec: RiftSpec = {
    index: w.riftCount++,
    seed: state.lootRng.nextU32(),
    tier: sigil.tier,
    mods: [...sigil.mods],
    home: { roomId: state.room.id, key: stone.key },
  };
  w.rift = { spec, bossDead: false };
  w.respawn = { roomId: spec.home.roomId, key: spec.home.key };
  installRiftRooms(state);
  emit(state, { type: 'riftOpened', tier: spec.tier, mods: spec.mods, index: spec.index });
  enterRoom(state, `${riftRoomPrefix(spec.index)}entry`, { kind: 'default' });
  return null;
}

/**
 * Why the hero can't take a free sigil now, or null (M6.5): after the Cinder Warden, a hero with
 * no sigils and no rift open may take a plain tier-1 sigil (riftDrops.freeSigilTier), so failed
 * rifts never lock anyone out of the endgame.
 */
export function freeSigilError(state: GameState): string | null {
  if (state.mode !== 'adventure') return 'Only in adventure mode';
  if (!state.world.bossesDefeated.includes('cinder_warden')) return 'Defeat the Cinder Warden first';
  if (state.hero.sigils.length > 0) return 'You still hold a Rift Sigil';
  if (state.world.rift) return 'A rift is already open';
  return null;
}

/** HeroEdit 'freeSigil'. Returns why it can't, or null when the sigil is in the hero's bag. */
export function takeFreeSigil(state: GameState): string | null {
  const err = freeSigilError(state);
  if (err) return err;
  state.hero.sigils.push(makeSigil(state.hero, riftDrops.freeSigilTier, []));
  return null;
}
