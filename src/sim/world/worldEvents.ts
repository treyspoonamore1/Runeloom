/**
 * Events of the world and puzzle systems (M4), for render, audio and UI. Part of SimEvent
 * (src/sim/events.ts). Positions are cells (an object's tile center); `key` is WorldObject.key.
 * Persistent looks (a lit brazier, an open door, a pressed plate) read `state.objects`; these
 * are for sounds, one-shot effects and toasts.
 */
import type { ObjectKind } from './objects';
import type { Arrival } from './worldState';

export type WorldEvent =
  /**
   * The player is in a new room (sent by every enterRoom: exits, travel, respawn, rest, a new
   * adventure). The renderer rebuilds its room view on this. firstVisit: never entered before.
   */
  | {
      type: 'roomEnter';
      id: string;
      name: string;
      level: number;
      arrival: Arrival['kind'];
      firstVisit: boolean;
    }
  /** The room's enemies are all dead (or its boss), or it had none. first: rewards were paid now. */
  | { type: 'roomCleared'; id: string; first: boolean }
  /** A Live Wires pylon pulsed (M6): Storm within `radius` cells of (x, y). */
  | { type: 'pylonPulse'; x: number; y: number; radius: number }
  /** A rift's boss died (M6): the rift is complete. newBest: the tier ladder rose to `tier`. */
  | { type: 'riftCompleted'; tier: number; newBest: boolean }
  /** A rift opened (M6) and the player is in its entry; `index` is its room ids' number. */
  | { type: 'riftOpened'; tier: number; mods: readonly string[]; index: number }
  /** The rift ended: its boss died and the player went home, the player left early, or died in it. */
  | { type: 'riftClosed'; tier: number; completed: boolean; reason: 'completed' | 'left' | 'died' }
  /** Best tier ever reached the storm door's tier (M8): sent once per save, also on loading a save past it. */
  | { type: 'stormDoorWoke' }
  /** A boss died; its room stays empty for good (WorldState.bossesDefeated; rift bosses: until the rift closes). */
  | { type: 'bossDefeated'; kind: string; roomId: string; x: number; y: number }
  /** A door tile opened: a `D` whose @link condition was met, a `K` a small key opened, a `G` the big key opened. */
  | { type: 'doorOpened'; key: string; kind: ObjectKind; link: string; x: number; y: number }
  /** The player touched a locked (`K`) or big-key (`G`) door without the key. Sent once per touch. */
  | { type: 'doorLocked'; key: string; kind: ObjectKind; x: number; y: number }
  /** A small key (big: false) or the big key was used on a door. left: small keys left for that dungeon. */
  | { type: 'keyUsed'; dungeon: string; big: boolean; left: number; x: number; y: number }
  /** A chest opened and gave a small key (`k`) or the dungeon's big key (`g`). count: small keys now held. */
  | {
      type: 'chestOpened';
      key: string;
      kind: ObjectKind;
      dungeon: string;
      big: boolean;
      count: number;
      x: number;
      y: number;
    }
  /**
   * The player touched a full rune shrine (`R`) and took its dungeon item: the room's guaranteed
   * runes follow ('rewardGranted', and 'elementUnlocked' for a first element). It is empty now.
   */
  | { type: 'shrineTaken'; key: string; x: number; y: number }
  /** A Heart Seed or Loom Shard was taken. total: how many the hero has now. */
  | { type: 'pickup'; key: string; kind: 'heart_seed' | 'loom_shard'; total: number; x: number; y: number }
  /** A Loom Stone was touched. first: it was activated now (else it only became the respawn point again). */
  | { type: 'loomStoneActivated'; roomId: string; key: string; first: boolean; x: number; y: number }
  /** A brazier caught fire. */
  | { type: 'brazierLit'; key: string; x: number; y: number }
  /** A timed brazier went out before its group was complete. */
  | { type: 'brazierOut'; key: string; x: number; y: number }
  /** A pressure plate was pressed or released. */
  | { type: 'plateChanged'; key: string; pressed: boolean; x: number; y: number }
  /** A conduit switch was powered by Storm (it stays powered). */
  | { type: 'switchPowered'; key: string; x: number; y: number }
  /** M8: a switch of a `timer:N:switch:S` group unlatched before the group completed. */
  | { type: 'switchOff'; key: string; x: number; y: number }
  /** M8: a wind vane spun (latched) after wind covered it for tuning.wind.vaneSeconds. */
  | { type: 'vaneSpun'; key: string; x: number; y: number }
  /** M8: metal pylons start glowing tuning.world.pulseGlowSeconds before a pulse (`@pulse`, Live Wires). */
  | { type: 'pylonGlow'; x: number; y: number; seconds: number }
  /**
   * A push or ice block started moving one tile, from tile (fromTx, fromTy) to (tx, ty).
   * slide: an ice block sliding on ice (not a push). It occupies the new tile at once; draw it
   * moving over `seconds`.
   */
  | {
      type: 'blockMoved';
      key: string;
      kind: ObjectKind;
      fromTx: number;
      fromTy: number;
      tx: number;
      ty: number;
      slide: boolean;
      seconds: number;
    }
  /** A pushed or sliding block reached its tile and came to rest. */
  | { type: 'blockStopped'; key: string; x: number; y: number }
  /** Fire melted an ice block into shallow water. */
  | { type: 'iceBlockMelted'; key: string; x: number; y: number }
  /** An object with an `@note` activated: show `text` (e.g. K10's "The Fen isn't woven yet."). */
  | { type: 'note'; key: string; text: string; x: number; y: number }
  /** The player rested at a Loom Stone: full life and mana, rooms repopulated. */
  | { type: 'rested'; roomId: string; key: string };
