/**
 * Region progress (M4): which room the player is in, what each room remembers, keys and Loom
 * Stones. Lives in `GameState.world`, hashed, and goes into saves with the hero.
 *
 * CONTRACT (M4), owned by the world/puzzles agent:
 * - The sim loads rooms only through `state.rooms` (a RoomSource), never from disk.
 * - Entering a room rebuilds the room-scoped state (room, grid, flow, enemies, projectiles,
 *   spells, objects, loot) and keeps hero, world, weaves and RNG streams.
 * - Terrain resets on re-entry (burnt grass regrows, bridges are back). What a room remembers
 *   lives in RoomFlags: doors that opened stay open, chests stay looted, pickups stay taken,
 *   first-clear rewards are paid once.
 * - A cleared room stays empty until the player rests at a Loom Stone or dies, which
 *   repopulates every room except boss rooms whose boss is dead.
 */
import type { Hasher } from '../core/hash';
import type { RiftSpec } from './rift/types';

/** Room file texts by id ("emberwood/e1_glade"). The app builds it with Vite ?raw, tools from disk. */
export type RoomSource = Readonly<Record<string, string>>;

/** Edge of a room, as in `@exit <w|e|n|s>`. */
export type Edge = 'w' | 'e' | 'n' | 's';

/** How the player arrives in a room. */
export type Arrival =
  /**
   * Walked through an exit: `from` is the edge of the room the player LEFT by, so they are placed
   * just inside the target room's opposite edge exit (left by 'e' → arrive at the 'w' edge).
   */
  | { kind: 'edge'; from: Edge }
  /** Respawn or fast travel: at the Loom Stone with this object key. */
  | { kind: 'loomStone'; key: string }
  /** The room's default spawn (first Loom Stone, else the room's spawn point). */
  | { kind: 'default' };

/** What one room remembers. Object keys are WorldObject.key (stable per room file). */
export interface RoomFlags {
  visited: boolean;
  /** All its enemies died since it was last populated. */
  cleared: boolean;
  /** First-clear rewards (guaranteed runes, CONTENT §9.1) were paid. */
  rewardsPaid: boolean;
  /** Doors whose condition was met (or that a key opened). They stay open. */
  opened: string[];
  /** Chests looted and pickups (Heart Seed, Loom Shard) taken. */
  taken: string[];
}

export interface WorldState {
  /** The current room id. */
  roomId: string;
  flags: Record<string, RoomFlags>;
  /** Small keys held, per dungeon id (the room id's region prefix, e.g. "kiln"). */
  keys: Record<string, number>;
  /** Dungeons whose big key the player holds. */
  bigKeys: string[];
  /** Activated Loom Stones: `${roomId}#${objectKey}`, in activation order. */
  loomStones: string[];
  /** Where the player respawns: the last Loom Stone touched. */
  respawn: { roomId: string; key: string } | null;
  /** Boss enemy ids defeated, e.g. "tar_matriarch". */
  bossesDefeated: string[];
  /** A transition requested this step, applied at the end of the step. Null otherwise. */
  pending: PendingTransition | null;
  /** The open rift (M6), or null. Its rooms are rebuilt from the spec (world/rift/run.ts). */
  rift: ActiveRift | null;
  /** Rifts opened in this save; the next rift's index (its room ids' prefix). */
  riftCount: number;
  /** The storm door's one-time hint (best tier ever reached riftGate.stormDoorTier) was sent (M8). */
  stormDoorHinted: boolean;
}

/** An open rift: what it is built from, and whether its boss has died. */
export interface ActiveRift {
  spec: RiftSpec;
  bossDead: boolean;
}

/**
 * Why the room changes. 'respawn' (death) and 'rest' repopulate every room before entering;
 * 'exit' and 'travel' don't. Absent means 'exit'.
 */
export type TransitionReason = 'exit' | 'respawn' | 'rest' | 'travel';

export interface PendingTransition {
  roomId: string;
  arrival: Arrival;
  reason?: TransitionReason;
}

export function createWorldState(roomId: string): WorldState {
  return {
    roomId,
    flags: {},
    keys: {},
    bigKeys: [],
    loomStones: [],
    respawn: null,
    bossesDefeated: [],
    pending: null,
    rift: null,
    riftCount: 0,
    stormDoorHinted: false,
  };
}

/** The dungeon (key ring) a room belongs to: its id's region prefix ("kiln/k3_x" → "kiln"). */
export function dungeonOf(roomId: string): string {
  const slash = roomId.indexOf('/');
  return slash < 0 ? roomId : roomId.slice(0, slash);
}

/** The Loom Stone id stored in `loomStones`: `${roomId}#${objectKey}`. */
export function loomStoneId(roomId: string, key: string): string {
  return `${roomId}#${key}`;
}

/** A deep copy (saves, replays, tests). */
export function cloneWorld(w: WorldState): WorldState {
  return JSON.parse(JSON.stringify(w)) as WorldState;
}

/** Flags for a room, created on first use. */
export function roomFlags(world: WorldState, roomId: string): RoomFlags {
  let f = world.flags[roomId];
  if (!f) {
    f = { visited: false, cleared: false, rewardsPaid: false, opened: [], taken: [] };
    world.flags[roomId] = f;
  }
  return f;
}

function hashArrival(h: Hasher, a: Arrival): void {
  h.string(a.kind).byte(0);
  if (a.kind === 'edge') h.string(a.from).byte(0);
  else if (a.kind === 'loomStone') h.string(a.key).byte(0);
}

export function hashWorld(h: Hasher, w: WorldState): void {
  h.string(w.roomId).byte(0);
  const ids = Object.keys(w.flags).sort();
  h.u32(ids.length);
  for (const id of ids) {
    const f = w.flags[id]!;
    h.string(id).byte(0).bool(f.visited).bool(f.cleared).bool(f.rewardsPaid);
    h.u32(f.opened.length);
    for (const k of f.opened) h.string(k).byte(0);
    h.u32(f.taken.length);
    for (const k of f.taken) h.string(k).byte(0);
  }
  const dungeons = Object.keys(w.keys).sort();
  h.u32(dungeons.length);
  for (const d of dungeons) h.string(d).byte(0).u32(w.keys[d]!);
  h.u32(w.bigKeys.length);
  for (const k of w.bigKeys) h.string(k).byte(0);
  h.u32(w.loomStones.length);
  for (const k of w.loomStones) h.string(k).byte(0);
  h.bool(w.respawn !== null);
  if (w.respawn) h.string(w.respawn.roomId).byte(0).string(w.respawn.key).byte(0);
  h.u32(w.bossesDefeated.length);
  for (const b of w.bossesDefeated) h.string(b).byte(0);
  h.bool(w.pending !== null);
  if (w.pending) {
    h.string(w.pending.roomId).byte(0);
    hashArrival(h, w.pending.arrival);
    h.string(w.pending.reason ?? 'exit').byte(0);
  }
  h.u32(w.riftCount).bool(w.stormDoorHinted).bool(w.rift !== null);
  if (w.rift) {
    const s = w.rift.spec;
    h.u32(s.index).u32(s.seed).u32(s.tier).bool(w.rift.bossDead).u32(s.mods.length);
    for (const m of s.mods) h.string(m).byte(0);
    h.string(s.home.roomId).byte(0).string(s.home.key).byte(0);
  }
}
