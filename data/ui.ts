/**
 * Presentation numbers for the menus and the adventure HUD (M4). They never touch the sim, so they
 * live here rather than in tuning.ts (which is cloned into every GameState and stored in replays).
 */
export const uiTuning = {
  /** Seconds a pickup toast stays on screen. */
  toastSeconds: 3.2,
  /** Seconds a level-up toast stays on screen (it carries the "passive point" hint). */
  levelToastSeconds: 5,
  /** Most pickup toasts shown at once; older ones leave first. */
  maxToasts: 5,
  /** Same-kind pickups within this many seconds merge into one toast ("+3 Thread Scrap"). */
  toastMergeSeconds: 1.2,
  /** Thread Scrap that unfusing with "keep" costs (DESIGN §8.4). */
  unfuseKeepCost: 5,
  /** Passive tree zoom limits and the step per wheel notch or +/- key. */
  treeZoomMin: 0.35,
  treeZoomMax: 2.6,
  treeZoomStep: 1.15,
  /** Pixels the tree pans per arrow-key press (Shift or WASD). */
  treePanStep: 60,
  /** Region map: padding around the layout, in screen pixels. */
  mapPadding: 28,
  /** Player cells within which a Loom Stone counts as "standing at it" when the world agent's flag is absent. */
  loomStoneReach: 6,
} as const;
