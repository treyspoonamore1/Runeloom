/**
 * Human play time estimated from the bots' fight time (BUILD_PLAN M4 pacing, M6.5 rifts): human
 * fights run slower than the bot's (misses, retreats, rereading telegraphs) and every room adds
 * walking in, reading it, looting, the Loom and menus, plus its puzzle in the region.
 */
import type { CampaignResult, RoomKey } from './campaign';

/** Region rooms: overhead seconds per room, puzzles included. */
export const roomOverhead: Readonly<Record<RoomKey, number>> = {
  e1: 150, // tutorial: move, dodge, the first weave, the bramble wall
  e2: 240, // the bramble maze, the hidden Loom Shard
  e3: 150, // the bridge
  e4: 180, // barrels, the Heart Seed behind crates
  e5: 90,
  e6: 120, // the Heart Seed
  e7: 180, // three braziers in 10 s, the Loom Shard
  e8: 90,
  k1: 120, // two braziers
  k2: 150, // Lob over the walls
  k3: 150, // the bramble path, the small key
  k4: 180, // the oil channels, the barricade, the Heart Seed
  k5: 60,
  k6: 120, // the Frost rune, freezing the pool
  k7: 180, // the ice crossing, the Heart Seed
  k8: 240, // sliding ice blocks onto two plates, the Loom Shard
  k9: 210, // thaw the ice blocks, freeze the meltwater
  k10: 60,
};

/** Human fights run slower than the bot's. */
export const humanFightFactor = 1.5;

/**
 * Rifts: seconds per room (no puzzles: walking in and looting) and per rift (map, gear, crafting).
 * M7: a Hearth visit between rifts (collecting expeditions, upgrades, the garden, the
 * Spindlewright) adds hearthVisit.
 */
export const riftOverhead = { perRoom: 25, perRift: 60, hearthVisit: 30 };

export function pacingMinutes(r: CampaignResult): number {
  let s = 0;
  for (const l of r.logs) s += l.clearSeconds * humanFightFactor + roomOverhead[l.key];
  return s / 60;
}
