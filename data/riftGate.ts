/**
 * The deep-rift gate and the Fen's storm door (DESIGN §10.4 "The deep rifts (M8)", CONTENT §9.1).
 * Tiers above `openTier` open only once `boss` is in WorldState.bossesDefeated; the K10 storm door
 * wakes once the best tier ever reaches `stormDoorTier`.
 */
export const riftGate = {
  /** The highest tier that opens before the Coil is dead. */
  openTier: 8,
  /** The boss whose defeat opens tiers above `openTier`. Rekindle never resets it. */
  boss: 'glasswater_coil',
  /** The sigil the Coil drops on its first (region) kill, the way into the deep rifts (DESIGN §10.5). */
  firstKillSigilTier: 9,
  /** The best tier ever (hero.hearth.bestEverTier) that wakes K10's storm door. */
  stormDoorTier: 6,
  lockedText:
    'The deep rifts are flooded. Calm the Glasswater Coil in the Drowned Foundry to open tier 9 and above.',
  stormDoorToast: "The storm door in Warden's Hearth hums. Something stirs in the Fen.",
  openedToast: 'The deep rifts drain. Tiers 9 and up are open.',
} as const;
