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

/**
 * M8: the Glasswater Fen and the Drowned Foundry (bots/fenRun.ts), per route visit. Unlike the
 * region's, the Fen bot walks its puzzles (the scripted solutions) and every room to room walk,
 * so those seconds count × humanFightFactor with the fights; an overhead is the rest: walking in
 * and reading the room, working the puzzle out (and a retry where a timer is tight), looting,
 * the Loom and menus. A new element (F6's Tide) adds its item-get panel and a Loom visit.
 */
export const fenRoomOverhead: Readonly<Record<string, number>> = {
  k10: 30, // the progression sim's player opens the storm door (the save has it open)
  g1: 120, // arrival, the Loom Stone, first fog, find the switch on its post
  g2: 60,
  g3: 150, // three networks joined by water, the ice plug, the vault's Loom Shard
  g4: 150, // read the pulses, plan the frozen path, the Heart Seed islet
  g5: 120, // fog; find the alcove and burn its bramble
  g7: 150, // four braziers in 15 s, two across black water
  'g5 (back)': 120, // three switches in 12 s in the fog (a retry likely)
  g6: 60,
  g8: 90, // the Loom Stone, the broken bridge
  f1: 90,
  f2: 150, // a 3 s window: pick or weave something that reaches three networks
  f3: 180, // freezing lanes and sliding two ice blocks onto plates
  f4: 120, // the oil channel, the Heart Seed vault, the locked door
  f5: 60,
  f6: 120, // Tide's item get, the Loom, the vent tutorial
  f7: 90,
  f8: 210, // the Floodline puzzle, the vents' vault
  f9: 180, // the ice bridge over the chasm, glazing the lane and washing the block
  'f8 (back)': 30,
  f10: 60,
};

/** Human minutes for a Fen run: (fights + puzzles and walking) × humanFightFactor + overheads. */
export function fenPacingMinutes(r: {
  visits: readonly { label: string; fightSeconds: number; puzzleSeconds: number }[];
}): number {
  let s = 0;
  for (const v of r.visits)
    s += (v.fightSeconds + v.puzzleSeconds) * humanFightFactor + (fenRoomOverhead[v.label] ?? 0);
  return s / 60;
}
