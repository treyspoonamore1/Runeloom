/**
 * Pack tables (CONTENT §5). A room places a pack with `@spawn <digit> pack:<id> [magic|rare]`:
 * every marker with that digit gets one pack, its members spread around the marker
 * (src/sim/actors/packs.ts). Counts are rolled from state.aiRng.
 *
 * Rarity (M4): a Magic pack makes every member Magic with the same 1–2 mods. A Rare pack makes
 * its `leader` Rare (2–4 mods) and adds `rareMinions` normal `minion`s (CONTENT §5 "2 minions").
 */
import type { EnemyKind } from './enemies';

export interface PackMember {
  kind: EnemyKind;
  min: number;
  max: number;
}

export interface PackDef {
  members: readonly PackMember[];
  /** The member kind that becomes Rare in a Rare pack (the first one of that kind spawned). */
  leader: EnemyKind;
  /** The kind of a Rare pack's extra minions. */
  minion: EnemyKind;
  /** Spawns only on markers in water, its members on water cells (bog_nest, pike_shoal). */
  waterOnly?: boolean;
}

export const packs = {
  tinderling_swarm: {
    members: [{ kind: 'tinderling', min: 6, max: 10 }],
    leader: 'tinderling',
    minion: 'tinderling',
  },
  archer_line: {
    members: [
      { kind: 'ember_archer', min: 3, max: 3 },
      { kind: 'shieldbearer', min: 1, max: 1 },
    ],
    leader: 'shieldbearer',
    minion: 'ember_archer',
  },
  tar_crew: {
    members: [
      { kind: 'tar_hulk', min: 1, max: 1 },
      { kind: 'tinderling', min: 4, max: 4 },
    ],
    leader: 'tar_hulk',
    minion: 'tinderling',
  },
  bog_nest: {
    members: [{ kind: 'bog_lurker', min: 2, max: 3 }],
    leader: 'bog_lurker',
    minion: 'bog_lurker',
    waterOnly: true,
  },
  wisp_flight: {
    members: [
      { kind: 'frost_wisp', min: 2, max: 2 },
      { kind: 'kiln_mite', min: 3, max: 3 },
    ],
    leader: 'frost_wisp',
    minion: 'kiln_mite',
  },
  caller_guard: {
    members: [
      { kind: 'stormcaller', min: 1, max: 1 },
      { kind: 'shieldbearer', min: 2, max: 2 },
    ],
    leader: 'stormcaller',
    minion: 'shieldbearer',
  },
  // M8: the Glasswater Fen (CONTENT §5).
  pike_shoal: {
    members: [{ kind: 'glasspike', min: 2, max: 3 }],
    leader: 'glasspike',
    minion: 'glasspike',
    waterOnly: true,
  },
  crab_cast: {
    members: [
      { kind: 'copperback', min: 3, max: 3 },
      { kind: 'spark_heron', min: 1, max: 1 },
    ],
    leader: 'spark_heron',
    minion: 'copperback',
  },
  heron_wade: {
    members: [
      { kind: 'spark_heron', min: 2, max: 2 },
      { kind: 'bellshell', min: 1, max: 1 },
    ],
    leader: 'bellshell',
    minion: 'spark_heron',
  },
  sparkfly_cloud: {
    members: [{ kind: 'sparkfly', min: 8, max: 12 }],
    leader: 'sparkfly',
    minion: 'sparkfly',
  },
  mire_herd: {
    members: [
      { kind: 'mire_bull', min: 2, max: 2 },
      { kind: 'bellows_toad', min: 2, max: 2 },
    ],
    leader: 'mire_bull',
    minion: 'bellows_toad',
  },
  foundry_crew: {
    members: [
      { kind: 'slagshell', min: 1, max: 1 },
      { kind: 'copperback', min: 2, max: 2 },
      { kind: 'sparkfly', min: 4, max: 4 },
    ],
    leader: 'slagshell',
    minion: 'copperback',
  },
  toad_chorus: {
    members: [
      { kind: 'bellows_toad', min: 3, max: 3 },
      { kind: 'sparkfly', min: 6, max: 6 },
    ],
    leader: 'bellows_toad',
    minion: 'sparkfly',
  },
} satisfies Record<string, PackDef>;

export type PackId = keyof typeof packs;

export function isPackId(id: string): id is PackId {
  return Object.prototype.hasOwnProperty.call(packs, id);
}
