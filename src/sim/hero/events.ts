/**
 * Character and loot events (M4), part of SimEvent (src/sim/events.ts). For HUD toasts, the XP
 * bar, level-up effects and drop visuals. Never read back by the sim.
 */
import type { RuneId } from '../../../data/runes';
import type { LootContent } from '../items/loot';

export type HeroEvent =
  /** The hero earned XP from a kill at (x, y). `xp` and `level` are the totals after it. */
  | { type: 'xpGained'; amount: number; x: number; y: number; xp: number; level: number }
  /** The hero reached `level` (one event per level): +1 passive point, full life and mana. */
  | { type: 'levelUp'; level: number }
  /** A socketed rune item reached `level`. */
  | { type: 'runeLevelUp'; uid: number; rune: RuneId; level: number; slot: number }
  /** A rune was unlocked: random drops can now roll it (CONTENT §9.1). */
  | { type: 'runeUnlocked'; rune: RuneId }
  /**
   * A first-clear reward went straight into the hero's pouch (guaranteed runes). `roomId` is the
   * room that paid it.
   */
  | { type: 'rewardGranted'; roomId: string; content: LootContent }
  /** A drop landed on the floor at (x, y), thrown from (fromX, fromY) (the body). */
  | {
      type: 'lootDropped';
      id: number;
      x: number;
      y: number;
      fromX: number;
      fromY: number;
      content: LootContent;
    }
  /** The player picked up a drop (or it was collected on leaving the room: `onExit`). */
  | { type: 'lootPicked'; id: number; x: number; y: number; content: LootContent; onExit: boolean };
