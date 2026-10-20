/**
 * The campaign sim (M4 balance pass, BUILD_PLAN M4 task 11): a new game played through the
 * region in room order (data/progression.ts regionRooms, E1…E8, K1…K10) by the kiter bot with
 * pathfinding (bots/campaignNav.ts) and the reference build (bots/campaignPlan.ts). Headless and
 * deterministic: the result is a pure function of the seed and the room texts.
 *
 * Per room: the reference build is applied (gear, Fuse, passives, weaves); the player enters
 * through the exit that leads from the previous room (teleporting between rooms; nothing is
 * walked twice); at a Loom Stone the player rests first; puzzle doors are opened as if solved
 * (the puzzle solution tests cover them) and the room's Heart Seeds and Loom Shards are taken
 * after the fight; the bot fights until the room clears (a boss room: when its boss dies).
 * A death respawns the player at the last Loom Stone as in the game; the bot then comes straight
 * back (the room has repopulated) and tries again, up to `maxDeaths`. A room that stalls (no
 * damage dealt for `stallSeconds`) has its last enemies finished by the script, paying their XP
 * and loot as kills, and is flagged `stuck`.
 */
import { PLAYER_ID } from '../actors/enemies';
import { SIM_HZ } from '../core/constants';
import { killEnemy } from '../combat/hits';
import { resetPlayerVitals } from '../actors/playerVitals';
import { addHeartSeed, addLoomShard } from '../hero/pickups';
import { applyHeroEdit } from '../hero/edits';
import { xpToNext, regionRooms } from '../../../data/progression';
import { collectRoomLoot } from '../items/loot';
import { findItem } from '../items/items';
import { stateContext } from '../weave/runtime/loadout';
import type { GameState } from '../state';
import { step } from '../step';
import { createAdventure } from '../world/adventure';
import { openDoor } from '../world/objectGround';
import { touchLoomStone, touchShrine } from '../world/objectTouch';
import { enterRoom } from '../world/transition';
import { parseRoom } from '../world/room';
import { roomFlags, type Edge, type RoomSource } from '../world/worldState';
import { CampaignNav } from './campaignNav';
import { applyReferenceBuild, itemLabel } from './campaignPlan';
import type { HeroState } from '../hero/types';

export type RoomKey = keyof typeof regionRooms;
export const campaignOrder = Object.keys(regionRooms) as RoomKey[];

/** Rest before a room below this life fraction; before a boss room, below the second. */
const REST_BELOW = 0.5;
const REST_BELOW_BOSS = 0.9;
const BOSS_ROOMS: readonly RoomKey[] = ['k5', 'k10'];
/** Leave a room when its remaining enemies can't be reached or shot for this long. */
const STRANDED_TICKS = 10 * SIM_HZ;

/** Bosses that resist Fire: the reference build puts Frost in LMB for their rooms. */
const FIRE_RESISTANT_BOSS_ROOMS: readonly RoomKey[] = ['k10'];

export interface RoomLog {
  key: RoomKey;
  roomId: string;
  areaLevel: number;
  entryLevel: number;
  /** Rested at the last Loom Stone before the room (life was low). */
  rested: boolean;
  /** XP toward the next level on entry, and what that level needs. */
  entryXp: number;
  entryXpToNext: number;
  exitLevel: number;
  /** Seconds from the first entry to the clear, retries included (deaths add their respawn). */
  clearSeconds: number;
  cleared: boolean;
  /** The script finished enemies the bot couldn't reach or kill. */
  stuck: number;
  /** Where the enemies the script finished were ("kind@x,y", cells). */
  stuckAt: string[];
  /** Enemies left alive because nothing could reach or shoot them ("kind@x,y"). */
  left: string[];
  /** Cleared, or only unreachable enemies are left. */
  done: boolean;
  damageTaken: number;
  deaths: number;
  /** The biggest hits taken in the 3 s before each death ("kind amount"). */
  deathCauses: string[];
  kills: number;
  xpGained: number;
  /** Life fraction when the room cleared (before pickups and level-ups after it). */
  lifeLeft: number;
  /** Weaves the build used here (LMB, RMB, Q, E). */
  weaves: (string | null)[];
  /** "rune:level" of every socketed rune item, slot order. */
  runeLevels: string[];
  /** Equipped items (labels), spindle first. */
  gear: string[];
  /** What changed before this room. */
  equipped: string[];
  fused: string[];
  allocated: string[];
  /** Drops collected here. */
  drops: { runes: string[]; items: number; parts: string[]; scrap: number };
  /** Boss rooms: seconds from the boss's first damage to its death. */
  bossSeconds?: number;
  maxLife: number;
  capacity: number;
}

export interface CampaignOptions {
  seed: number;
  rooms: RoomSource;
  /** Give up on a room after this many seconds of fighting (default 600). */
  maxSeconds?: number;
  /** Give up on a room after this many deaths (default 3). */
  maxDeaths?: number;
  /** Finish a room's last enemies after this many seconds without damage dealt (default 45). */
  stallSeconds?: number;
  /** What a stall does: 'finish' the enemies (default, paying their XP) or 'leave' the room. */
  onStall?: 'finish' | 'leave';
  /** Stop after this room (default the last). */
  until?: RoomKey;
  /** Called with the state just before each room's fight (snapshots for encounter sims). */
  onRoomStart?: (key: RoomKey, state: GameState) => void;
  /** Called after every fight tick (debugging). */
  onTick?: (key: RoomKey, state: GameState, nav: CampaignNav) => void;
}

export interface CampaignResult {
  seed: number;
  logs: RoomLog[];
  /** Total fight seconds over every room. */
  totalSeconds: number;
  deaths: number;
  finalLevel: number;
  hero: HeroState;
}

/** The edge of `fromId` whose exit leads to `toId`, or null. */
function exitEdge(rooms: RoomSource, fromId: string, toId: string): Edge | null {
  const text = rooms[fromId];
  if (text === undefined) return null;
  const ex = parseRoom(text).header.exits.find((e) => e.room === toId);
  return ex ? (ex.dir as Edge) : null;
}

/** Opens every door in the current room, as if its puzzle (or key) were solved. */
function solveDoors(state: GameState): void {
  for (const o of state.objects)
    if ((o.kind === 'door' || o.kind === 'locked_door' || o.kind === 'big_key_door') && !o.on)
      openDoor(state, o);
}

/** Takes the room's Heart Seeds and Loom Shards and its rune shrine's runes (puzzles are tested elsewhere). */
function takePickups(state: GameState): void {
  const flags = roomFlags(state.world, state.room.id);
  for (const o of state.objects) {
    if (o.kind === 'rune_shrine') touchShrine(state, o);
    if ((o.kind !== 'heart_seed' && o.kind !== 'loom_shard') || o.on) continue;
    o.on = true;
    if (!flags.taken.includes(o.key)) flags.taken.push(o.key);
    if (o.kind === 'heart_seed') addHeartSeed(state);
    else addLoomShard(state);
  }
}

/** Enters `roomId` from `fromId` (through the exit between them; default arrival without one). */
function enter(state: GameState, roomId: string, fromId: string | null): void {
  const edge = fromId === null ? null : exitEdge(state.rooms, fromId, roomId);
  enterRoom(state, roomId, edge ? { kind: 'edge', from: edge } : { kind: 'default' });
  solveDoors(state);
  // A Loom Stone in the room: touch it and rest (full life; the room's enemies come back).
  const stone = state.objects.find((o) => o.kind === 'loom_stone');
  if (stone) {
    touchLoomStone(state, stone);
    const p = state.player;
    p.x = p.prevX = (stone.tx + 0.5) * 4;
    p.y = p.prevY = (stone.ty + 0.5) * 4;
    if (applyHeroEdit(state, { kind: 'rest' }) === null) solveDoors(state);
  }
}

function runeLevels(state: GameState): string[] {
  const out: string[] = [];
  const byUid = new Map(state.hero.runes.map((r) => [r.uid, r]));
  for (const s of state.weaves.slots)
    for (const u of s.runes ?? []) {
      const r = byUid.get(u);
      if (r) out.push(`${r.rune}:${r.level}`);
    }
  return out;
}

function gearLabels(state: GameState): string[] {
  const out: string[] = [];
  for (const uid of Object.values(state.hero.equipped)) {
    if (uid === null) continue;
    const it = findItem(state.hero, uid);
    if (it) out.push(itemLabel(it));
  }
  return out;
}

/** Plays one room; returns its log. The state is left in the room, cleared (or given up on). */
export function playRoom(
  state: GameState,
  key: RoomKey,
  fromId: string | null,
  opts: Omit<CampaignOptions, 'seed' | 'rooms'> = {},
): RoomLog {
  const roomId = regionRooms[key];
  const maxTicks = (opts.maxSeconds ?? 600) * SIM_HZ;
  const maxDeaths = opts.maxDeaths ?? 3;
  const stallTicks = (opts.stallSeconds ?? 45) * SIM_HZ;
  const hero = state.hero;
  // Low on life (no regeneration in the game): back to the last Loom Stone to rest first. The
  // bot never walks back through the rooms that repopulate, so this is a heal and a log entry.
  const p = state.player;
  const boss = BOSS_ROOMS.includes(key);
  const rested = p.life < p.maxLife * (boss ? REST_BELOW_BOSS : REST_BELOW);
  if (rested) resetPlayerVitals(p, state.tuning, state.heroMods);
  const build = applyReferenceBuild(state, { frostLmb: FIRE_RESISTANT_BOSS_ROOMS.includes(key) });
  const log: RoomLog = {
    key,
    roomId,
    areaLevel: 0,
    entryLevel: hero.level,
    rested,
    entryXp: hero.xp,
    entryXpToNext: xpToNext(hero.level),
    exitLevel: hero.level,
    clearSeconds: 0,
    cleared: false,
    stuck: 0,
    stuckAt: [],
    left: [],
    done: false,
    damageTaken: 0,
    deaths: 0,
    deathCauses: [],
    kills: 0,
    xpGained: 0,
    lifeLeft: 1,
    weaves: build.weaves,
    runeLevels: runeLevels(state),
    gear: gearLabels(state),
    equipped: build.equipped,
    fused: build.fused,
    allocated: build.allocated,
    drops: { runes: [], items: 0, parts: [], scrap: 0 },
    maxLife: state.player.maxLife,
    capacity: 0,
  };
  enter(state, roomId, fromId);
  log.areaLevel = state.room.level;
  log.capacity = compiledCapacity(state);
  opts.onRoomStart?.(key, state);

  const nav = new CampaignNav();
  const recent: Hurt[] = [];
  const start = state.tick;
  let lastDamage = state.tick;
  let bossHitAt = -1;
  const flags = () => roomFlags(state.world, roomId);
  while (!flags().cleared && state.tick - start < maxTicks) {
    step(state, nav.input(state));
    opts.onTick?.(key, state, nav);
    for (const e of state.events) {
      if ((e.type === 'hit' || e.type === 'dot') && e.target === 'player') {
        log.damageTaken += e.amount;
        recent.push({ tick: state.tick, src: sourceName(state, e.sourceId, e.type), amount: e.amount });
      } else if ((e.type === 'hit' || e.type === 'dot') && e.target !== 'player') {
        lastDamage = state.tick;
        if (bossHitAt < 0 && state.enemies.some((x) => x.id === e.target && x.boss !== null))
          bossHitAt = state.tick;
      } else if (e.type === 'death') log.kills++;
      else if (e.type === 'xpGained') log.xpGained += e.amount;
      else if (e.type === 'playerDeath') {
        log.deaths++;
        log.deathCauses.push(describeDeath(recent, state.tick));
      } else if (e.type === 'lootPicked') countDrop(log, e.content);
    }
    // Respawned at a Loom Stone in another room, or walked out through an exit: come straight
    // back in through the same exit as before.
    if (state.room.id !== roomId) {
      if (log.deaths >= maxDeaths) break;
      enter(state, roomId, fromId);
      lastDamage = state.tick;
      bossHitAt = -1;
    } else if (log.deaths >= maxDeaths && state.player.dead) break;
    // Nothing left that can be walked to or shot (a Bog Lurker asleep mid-lake): leave it.
    if (nav.strandedTicks > STRANDED_TICKS) {
      for (const e of state.enemies)
        if (!e.dead) log.left.push(`${e.kind}@${Math.round(e.x)},${Math.round(e.y)}`);
      break;
    }
    if (state.tick - lastDamage > stallTicks && !state.player.dead) {
      if (opts.onStall === 'leave') {
        for (const e of state.enemies)
          if (!e.dead) log.left.push(`${e.kind}@${Math.round(e.x)},${Math.round(e.y)}`);
        break;
      }
      for (const e of state.enemies)
        if (!e.dead) {
          log.stuck++;
          log.stuckAt.push(`${e.kind}@${Math.round(e.x)},${Math.round(e.y)}`);
          killEnemy(state, e, PLAYER_ID, 'hit');
        }
      lastDamage = state.tick;
    }
  }
  log.clearSeconds = (state.tick - start) / SIM_HZ;
  log.cleared = flags().cleared;
  log.done = log.cleared || log.left.length > 0;
  if (bossHitAt >= 0 && log.cleared) log.bossSeconds = (state.tick - bossHitAt) / SIM_HZ;
  log.lifeLeft = state.player.maxLife > 0 ? state.player.life / state.player.maxLife : 0;
  if (log.done) takePickups(state);
  // Loot left on the floor is collected (the game does it on leaving the room).
  for (const d of state.loot) countDrop(log, d.content);
  collectRoomLoot(state);
  log.exitLevel = hero.level;
  return log;
}

interface Hurt {
  tick: number;
  src: string;
  amount: number;
}

/** What dealt damage: an enemy kind, "fire" (terrain), "player" or "world". */
function sourceName(state: GameState, id: number, type: string): string {
  const e = state.enemies.find((x) => x.id === id);
  if (e) return type === 'dot' ? `${e.kind}~ignite` : e.kind;
  return id === PLAYER_ID ? 'self' : type === 'dot' ? 'ignite' : 'terrain';
}

/** The damage taken in the 3 s before a death, summed by source, biggest first. */
function describeDeath(recent: Hurt[], tick: number): string {
  const by = new Map<string, number>();
  for (const h of recent) if (tick - h.tick <= 3 * SIM_HZ) by.set(h.src, (by.get(h.src) ?? 0) + h.amount);
  recent.length = 0;
  return [...by.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${Math.round(v)}`)
    .join(', ');
}

function countDrop(log: RoomLog, c: import('../items/loot').LootContent): void {
  if (c.kind === 'rune') log.drops.runes.push(c.rune.rune);
  else if (c.kind === 'item') log.drops.items++;
  else if (c.kind === 'part') log.drops.parts.push(c.part.part);
  else log.drops.scrap += c.amount;
}

/** The Capacity weaves compile against now (spindle base, Loom Shards, affixes, passives). */
function compiledCapacity(state: GameState): number {
  return stateContext(state).capacity;
}

/** Plays the region from a new game. */
export function runCampaign(opts: CampaignOptions): CampaignResult {
  const state = createAdventure({ seed: opts.seed, rooms: opts.rooms });
  const logs: RoomLog[] = [];
  let from: string | null = null;
  for (const key of campaignOrder) {
    const log = playRoom(state, key, from, opts);
    logs.push(log);
    from = regionRooms[key];
    if (key === opts.until) break;
  }
  return {
    seed: opts.seed,
    logs,
    totalSeconds: logs.reduce((s, l) => s + l.clearSeconds, 0),
    deaths: logs.reduce((s, l) => s + l.deaths, 0),
    finalLevel: state.hero.level,
    hero: state.hero,
  };
}
