/**
 * The rift bot (M6 acceptance: "a bot clear-rate report per tier for each reference build"): a
 * reference character opens a rift at E1's Loom Stone and the campaign bot (bots/campaignNav.ts
 * with the kiter and its boss tactics) clears it room by room in the generator's order, then
 * kills the boss. Headless and deterministic: a pure function of the options and the room texts.
 *
 * The character (riftCharacter): the K10 reference hero (bots/campaignEncounter.ts: every rune
 * the region guarantees, at one rune level, no random drops, no gear affixes, no Fuse parts) at
 * the rift's area level, rune level 9 + 2/3 per tier (at most 20), with the best spindle base
 * that drops at the area level (Ashwood, Heartwood from 18, Loomsteel at 30), and a Rare in every
 * slot at the area's item level (referenceAffixes: life, resistances, damage). Its build is the
 * campaign's reference build (bots/campaignPlan.ts) without crafting; 'frost' puts a Frost Bolt
 * on LMB where the campaign uses Fire.
 *
 * Rooms are entered through the exit from the room they hang off (no walking between rooms:
 * cleared rooms stay cleared). One death ends the rift, as in the game. A room where nothing is
 * damaged for `stallSeconds` has its last enemies finished by the script (counted as `stuck`).
 */
import { riftAreaLevel, type RiftModId } from '../../../data/rift';
import { guaranteedRunes, regionRooms, startRoom } from '../../../data/progression';
import type { SpindleId } from '../../../data/spindles';
import { PLAYER_ID } from '../actors/enemies';
import { killEnemy } from '../combat/hits';
import { SIM_HZ } from '../core/constants';
import { applyHeroEdit } from '../hero/edits';
import { syncWeaveSpindle } from '../hero/equip';
import { refreshHero } from '../hero/hero';
import type { HeroState } from '../hero/types';
import { makeItem, makeRune } from '../items/items';
import { affixes, type AffixDef } from '../../../data/affixes';
import { gearBases, type ItemKind } from '../../../data/items';
import type { AffixRoll } from '../hero/types';
import { makeSigil } from '../items/sigils';
import { step } from '../step';
import type { GameState } from '../state';
import { WORLD_SOURCE_ID } from '../grid/cells';
import { createAdventure } from '../world/adventure';
import { touchLoomStone } from '../world/objectTouch';
import { generateRift, type RiftRoomPlan } from '../world/rift/generate';
import { enterRoom } from '../world/transition';
import { roomFlags, type Edge, type RoomSource } from '../world/worldState';
import { referenceHero } from './campaignEncounter';
import { CampaignNav } from './campaignNav';
import { applyReferenceBuild } from './campaignPlan';

/** Finish a room's enemies when none could be reached or shot for this long (as the campaign does). */
const STRANDED_TICKS = 10 * SIM_HZ;

export const riftBuilds = ['fire', 'frost'] as const;
export type RiftBuild = (typeof riftBuilds)[number];

export interface RiftBotOptions {
  rooms: RoomSource;
  seed: number;
  tier: number;
  mods: RiftModId[];
  build: RiftBuild;
  /** Default riftCharacter(tier). */
  hero?: HeroState;
  /** Give up on a room after this many seconds (default 240). */
  maxRoomSeconds?: number;
  /** Finish a room's last enemies after this many seconds without damage dealt (default 40). */
  stallSeconds?: number;
}

export interface RiftRunLog {
  tier: number;
  mods: RiftModId[];
  build: RiftBuild;
  seed: number;
  level: number;
  /** The boss died (the rift is complete). */
  completed: boolean;
  died: boolean;
  /** A room took longer than maxRoomSeconds (a bot limit, not a death). */
  timedOut: boolean;
  /** Rooms, boss arena included, and how many were cleared. */
  rooms: number;
  cleared: number;
  /** Fight seconds over every room. */
  seconds: number;
  /** Boss arena: seconds from entering to the boss's death. */
  bossSeconds: number | null;
  /** Enemies the script finished after a stall. */
  stuck: number;
  /** Where the run ended when it didn't complete ("rift/3/r4"), and the hits before a death. */
  endedIn: string | null;
  deathCause: string | null;
}

/**
 * What hurt the player: an enemy ("kind" or "kind(mods)", alive or already dead: `seen` remembers
 * every enemy of the room), "~burn" for its burn, "world" hazards, or "self".
 */
function sourceName(seen: ReadonlyMap<number, string>, id: number, type: string): string {
  const dot = type === 'dot' ? '~burn' : '';
  const e = seen.get(id);
  if (e) return `${e}${dot}`;
  return id === WORLD_SOURCE_ID ? `world${dot}` : id === PLAYER_ID ? `self${dot}` : `#${id}${dot}`;
}

/** The spindle base a character at `areaLevel` carries. */
function spindleAt(areaLevel: number): SpindleId {
  return areaLevel >= 30 ? 'loomsteel' : areaLevel >= 18 ? 'heartwood' : 'ashwood';
}

/** Affixes the reference gear prefers, by item kind, best first (then the rest of the pool). */
const GEAR_PRIORITY: Readonly<Record<ItemKind, readonly string[]>> = {
  spindle: ['fire_damage', 'frost_damage', 'cast_speed', 'mana_cost', 'crit_chance', 'capacity'],
  cloak: ['life_flat', 'life_inc', 'fire_resist', 'frost_resist', 'storm_resist'],
  hood: ['mana_flat', 'fire_resist', 'frost_resist', 'storm_resist'],
  boots: ['move_speed', 'dodge_recharge', 'fire_resist', 'frost_resist', 'storm_resist'],
  charm: ['life_flat', 'elemental_damage', 'fire_resist', 'storm_resist', 'frost_resist'],
};

/**
 * A Rare's affixes for `kind` at `itemLevel`, deterministic: up to 3 prefixes and 3 suffixes from
 * GEAR_PRIORITY, each at the best tier the item level allows, at the middle of its range.
 */
export function referenceAffixes(kind: ItemKind, itemLevel: number): AffixRoll[] {
  const pool = (Object.values(affixes) as AffixDef[]).filter((a) => a.kinds.includes(kind));
  const order = [...GEAR_PRIORITY[kind], ...pool.map((a) => a.id)];
  const out: AffixRoll[] = [];
  const groups = new Set<string>();
  const count = { prefix: 0, suffix: 0 };
  for (const id of order) {
    const a = pool.find((x) => x.id === id);
    if (!a || groups.has(a.group) || count[a.kind] >= 3) continue;
    const t = a.tiers.find((x) => x.itemLevel <= itemLevel);
    if (!t) continue;
    groups.add(a.group);
    count[a.kind]++;
    out.push({ id: a.id, tier: t.tier, value: Math.round((t.min + t.max) / 2) });
  }
  return out;
}

/** The reference character for a tier (see the file comment). */
export function riftCharacter(tier: number): HeroState {
  const level = riftAreaLevel(tier);
  const hero = referenceHero('k10', {
    level,
    runeLevel: Math.min(20, 9 + Math.floor((tier * 2) / 3)),
    spindle: spindleAt(level),
    heartSeeds: 4,
    loomShards: 3,
  });
  for (const rune of guaranteedRunes[regionRooms.k10] ?? []) {
    hero.runes.push(makeRune(hero, rune, hero.runes[0]?.level ?? 1));
    if (!hero.unlockedRunes.includes(rune)) hero.unlockedRunes.push(rune);
  }
  hero.unlockedRunes.sort();
  hero.riftTier = 16;
  // Gear: a Rare of every slot at the area's item level (applyReferenceBuild equips it).
  const spindle = hero.items.find((it) => it.uid === hero.equipped.spindle)!;
  spindle.rarity = 'rare';
  spindle.itemLevel = level;
  spindle.affixes = referenceAffixes('spindle', level);
  for (const kind of ['cloak', 'hood', 'boots', 'charm', 'charm'] as const) {
    const base = Object.values(gearBases)
      .filter((b) => b.kind === kind && b.itemLevel <= level)
      .sort((a, b) => b.itemLevel - a.itemLevel)[0]!;
    hero.items.push(makeItem(hero, base.id, 'rare', level, referenceAffixes(kind, level)));
  }
  return hero;
}

/** The edge of `from` that leads to `to` in the plan. */
function edgeTo(from: RiftRoomPlan, to: string): Edge {
  return (Object.keys(from.exits) as Edge[]).find((e) => from.exits[e] === to)!;
}

export function runRiftBot(opts: RiftBotOptions): RiftRunLog {
  const state = createAdventure({
    seed: opts.seed,
    rooms: opts.rooms,
    hero: structuredClone(opts.hero ?? riftCharacter(opts.tier)),
    startRoomId: startRoom,
  });
  syncWeaveSpindle(state);
  refreshHero(state);
  applyReferenceBuild(state, { frostLmb: opts.build === 'frost', craft: false });
  const p = state.player;
  p.life = p.maxLife;
  p.mana = p.maxMana;
  const stone = state.objects.find((o) => o.kind === 'loom_stone');
  if (!stone) throw new Error(`runRiftBot: no Loom Stone in ${startRoom}`);
  touchLoomStone(state, stone);
  const sigil = makeSigil(state.hero, opts.tier, opts.mods);
  state.hero.sigils.push(sigil);
  const err = applyHeroEdit(state, { kind: 'openRift', uid: sigil.uid });
  if (err) throw new Error(`runRiftBot: ${err}`);
  return clearOpenRift(state, opts.rooms, { ...opts, seed: opts.seed });
}

export interface ClearOptions {
  build: RiftBuild;
  seed: number;
  maxRoomSeconds?: number;
  stallSeconds?: number;
}

/**
 * Clears the rift open in `state` with the campaign bot, room by room in the generator's order
 * (see the file comment); stops at a death, a timeout or the boss's death. The player is left
 * where it ended: dead (respawning home) or in the last room.
 */
export function clearOpenRift(state: GameState, rooms: RoomSource, opts: ClearOptions): RiftRunLog {
  const spec = state.world.rift!.spec;
  const rift = generateRift(spec, rooms);
  const byId = new Map(rift.plan.map((r) => [r.id, r]));
  const log: RiftRunLog = {
    tier: spec.tier,
    mods: [...spec.mods],
    build: opts.build,
    seed: opts.seed,
    level: state.hero.level,
    completed: false,
    died: false,
    timedOut: false,
    rooms: rift.plan.length,
    cleared: roomFlags(state.world, rift.entryId).cleared ? 1 : 0,
    seconds: 0,
    bossSeconds: null,
    stuck: 0,
    endedIn: null,
    deathCause: null,
  };
  const maxTicks = (opts.maxRoomSeconds ?? 240) * SIM_HZ;
  const stallTicks = (opts.stallSeconds ?? 40) * SIM_HZ;
  for (let k = 1; k < rift.plan.length; k++) {
    const room = rift.plan[k]!;
    // The room it hangs off: the first room before it in plan order that it joins.
    const parent = rift.plan.slice(0, k).find((r) => Object.values(r.exits).includes(room.id))!;
    enterRoom(state, room.id, { kind: 'edge', from: edgeTo(byId.get(parent.id)!, room.id) });
    const nav = new CampaignNav();
    const start = state.tick;
    let lastDamage = state.tick;
    const hits: { tick: number; src: string; amount: number }[] = [];
    const seen = new Map<number, string>();
    while (!roomFlags(state.world, room.id).cleared && state.tick - start < maxTicks) {
      for (const e of state.enemies)
        if (!seen.has(e.id)) seen.set(e.id, e.mods.length ? `${e.kind}(${e.mods.join(' ')})` : e.kind);
      step(state, nav.input(state));
      for (const e of state.events) {
        if ((e.type === 'hit' || e.type === 'dot') && e.target === 'player') {
          const src = sourceName(seen, e.sourceId, e.type);
          hits.push({ tick: state.tick, src, amount: e.amount });
        } else if ((e.type === 'hit' || e.type === 'dot') && e.target !== 'player') lastDamage = state.tick;
      }
      if (state.player.dead || !state.world.rift) break;
      // Nothing damaged for stallSeconds, or nothing left the bot can walk to or shoot.
      if (state.tick - lastDamage > stallTicks || nav.strandedTicks > STRANDED_TICKS) {
        for (const e of state.enemies)
          if (!e.dead) {
            log.stuck++;
            killEnemy(state, e, PLAYER_ID, 'hit');
          }
        lastDamage = state.tick;
        nav.strandedTicks = 0;
      }
    }
    log.seconds += (state.tick - start) / SIM_HZ;
    if (state.player.dead || !state.world.rift) {
      log.died = true;
      log.endedIn = room.id;
      const by = new Map<string, number>();
      for (const h of hits)
        if (state.tick - h.tick <= 3 * SIM_HZ) by.set(h.src, (by.get(h.src) ?? 0) + h.amount);
      log.deathCause = [...by.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([s, v]) => `${s} ${Math.round(v)}`)
        .join(', ');
      return log;
    }
    if (!roomFlags(state.world, room.id).cleared) {
      log.timedOut = true;
      log.endedIn = room.id;
      return log;
    }
    log.cleared++;
    if (room.id === rift.bossId) {
      log.bossSeconds = (state.tick - start) / SIM_HZ;
      log.completed = state.world.rift?.bossDead === true;
    }
  }
  return log;
}

/** Clear rate and times over a set of runs. */
export function summarizeRiftRuns(logs: readonly RiftRunLog[]): {
  runs: number;
  completed: number;
  deaths: number;
  timeouts: number;
  avgSeconds: number;
  avgBossSeconds: number | null;
  stuck: number;
} {
  const done = logs.filter((l) => l.completed);
  const boss = done.map((l) => l.bossSeconds ?? 0);
  return {
    runs: logs.length,
    completed: done.length,
    deaths: logs.filter((l) => l.died).length,
    timeouts: logs.filter((l) => l.timedOut).length,
    avgSeconds: done.length ? done.reduce((n, l) => n + l.seconds, 0) / done.length : 0,
    avgBossSeconds: boss.length ? boss.reduce((a, b) => a + b, 0) / boss.length : null,
    stuck: logs.reduce((n, l) => n + l.stuck, 0),
  };
}
