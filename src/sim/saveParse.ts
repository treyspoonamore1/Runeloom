/**
 * Validating and migrating save data (src/sim/save.ts). Missing fields take their defaults
 * (createHero, createWorldState), so a save from an older version keeps working; wrong types
 * and broken references throw an Error that names the field.
 */
import { isAffixId } from '../../data/affixes';
import { isCurrencyId } from '../../data/currency';
import { isUniqueId } from '../../data/uniques';
import { isFusePartId } from '../../data/fuseParts';
import { isRuneId, type RuneId } from '../../data/runes';
import { isSpindleId } from '../../data/spindles';
import { maxRuneLevel } from '../../data/progression';
import type { RngState } from './core/rng';
import { craftRngFor } from './rngStreams';
import { createHero } from './hero/hero';
import {
  EQUIP_SLOTS,
  type FusePart,
  type HeroState,
  type Item,
  type ItemRarity,
  type RuneItem,
} from './hero/types';
import { kindOfBase, slotsForKind, socketCount } from './items/items';
import { createWorldState, type RoomFlags, type WorldState } from './world/worldState';
import { parseWeave } from './weave/notation';
import { LOADOUT_SLOTS } from './weave/runtime/loadout';
import { runeOrder } from './hero/runes';
import {
  SAVE_FORMAT,
  SAVE_VERSION,
  SAVED_RNGS,
  type SaveData,
  type SavedRng,
  type SavedWeaves,
} from './save';

type Obj = Record<string, unknown>;

function fail(path: string, what: string): never {
  throw new Error(`Bad save: ${path} ${what}`);
}

function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'should be an object');
  return v as Obj;
}

function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, 'should be a list');
  return v;
}

function num(v: unknown, path: string, min = -Infinity): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min) fail(path, `should be a number ≥ ${min}`);
  return v;
}

function int(v: unknown, path: string, min = 0): number {
  const n = num(v, path, min);
  if (!Number.isInteger(n)) fail(path, 'should be a whole number');
  return n;
}

function str(v: unknown, path: string): string {
  if (typeof v !== 'string') fail(path, 'should be text');
  return v;
}

function bool(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') fail(path, 'should be true or false');
  return v;
}

function strs(v: unknown, path: string): string[] {
  return arr(v, path).map((x, i) => str(x, `${path}[${i}]`));
}

/** `o[key]` through `read`, or `fallback` when the save lacks it (older versions). */
function opt<T>(o: Obj, key: string, read: (v: unknown, path: string) => T, fallback: T, path: string): T {
  return o[key] === undefined ? fallback : read(o[key], `${path}.${key}`);
}

function rune(v: unknown, path: string): RuneId {
  const s = str(v, path);
  if (!isRuneId(s)) fail(path, `is not a rune ("${s}")`);
  return s;
}

function runeItem(v: unknown, path: string): RuneItem {
  const o = obj(v, path);
  return {
    uid: int(o.uid, `${path}.uid`, 1),
    rune: rune(o.rune, `${path}.rune`),
    level: Math.min(maxRuneLevel, int(o.level, `${path}.level`, 1)),
    xp: num(o.xp ?? 0, `${path}.xp`, 0),
    quality: num(o.quality ?? 0, `${path}.quality`, 0),
  };
}

function part(v: unknown, path: string): FusePart {
  const o = obj(v, path);
  const id = str(o.part, `${path}.part`);
  if (!isFusePartId(id)) fail(path, `is not a Fuse part ("${id}")`);
  const tier = int(o.tier, `${path}.tier`, 1);
  if (tier > 3) fail(`${path}.tier`, 'should be 1, 2 or 3');
  return { uid: int(o.uid, `${path}.uid`, 1), part: id, tier: tier as 1 | 2 | 3 };
}

const RARITIES: readonly ItemRarity[] = ['normal', 'magic', 'rare', 'unique'];

function item(v: unknown, path: string): Item {
  const o = obj(v, path);
  const base = str(o.base, `${path}.base`);
  if (kindOfBase(base) === null) fail(`${path}.base`, `is not an item base ("${base}")`);
  const rarity = str(o.rarity, `${path}.rarity`) as ItemRarity;
  if (!RARITIES.includes(rarity)) fail(`${path}.rarity`, `is not a rarity ("${rarity}")`);
  const affixes = arr(o.affixes ?? [], `${path}.affixes`).map((a, i) => {
    const p = `${path}.affixes[${i}]`;
    const ao = obj(a, p);
    const id = str(ao.id, `${p}.id`);
    if (!isAffixId(id)) fail(p, `is not an affix ("${id}")`);
    return { id, tier: int(ao.tier, `${p}.tier`, 1), value: num(ao.value, `${p}.value`) };
  });
  const sockets = socketCount(base);
  const given = arr(o.fused ?? [], `${path}.fused`);
  const fused: (FusePart | null)[] = [];
  for (let i = 0; i < sockets; i++)
    fused.push(given[i] === null || given[i] === undefined ? null : part(given[i], `${path}.fused[${i}]`));
  const out: Item = {
    uid: int(o.uid, `${path}.uid`, 1),
    base,
    rarity,
    itemLevel: int(o.itemLevel, `${path}.itemLevel`, 1),
    affixes,
    fused,
  };
  if (o.name !== undefined) out.name = str(o.name, `${path}.name`);
  if (o.unique !== undefined) {
    const u = str(o.unique, `${path}.unique`);
    if (!isUniqueId(u)) fail(`${path}.unique`, `is not a unique ("${u}")`);
    out.unique = u;
  }
  return out;
}

function currencyStacks(v: unknown, path: string): HeroState['currency'] {
  const o = obj(v, path);
  const out: HeroState['currency'] = {};
  for (const k of Object.keys(o)) {
    if (!isCurrencyId(k)) fail(`${path}.${k}`, 'is not a currency');
    const n = int(o[k], `${path}.${k}`);
    out[k] = n;
  }
  return out;
}

export function parseHero(v: unknown): HeroState {
  const o = obj(v, 'hero');
  const d = createHero();
  const P = 'hero';
  const hero: HeroState = {
    level: opt(o, 'level', (x, p) => int(x, p, 1), d.level, P),
    xp: opt(o, 'xp', (x, p) => num(x, p, 0), d.xp, P),
    unlockedRunes: opt(
      o,
      'unlockedRunes',
      (x, p) => arr(x, p).map((r, i) => rune(r, `${p}[${i}]`)),
      d.unlockedRunes,
      P,
    ),
    runes: opt(o, 'runes', (x, p) => arr(x, p).map((r, i) => runeItem(r, `${p}[${i}]`)), d.runes, P),
    items: opt(o, 'items', (x, p) => arr(x, p).map((r, i) => item(r, `${p}[${i}]`)), d.items, P),
    equipped: { ...d.equipped },
    parts: opt(o, 'parts', (x, p) => arr(x, p).map((r, i) => part(r, `${p}[${i}]`)), d.parts, P),
    passives: opt(o, 'passives', strs, d.passives, P),
    heartSeeds: opt(o, 'heartSeeds', int, d.heartSeeds, P),
    loomShards: opt(o, 'loomShards', int, d.loomShards, P),
    threadScrap: opt(o, 'threadScrap', int, d.threadScrap, P),
    currency: opt(o, 'currency', currencyStacks, d.currency, P),
    patternSeeds: opt(o, 'patternSeeds', int, d.patternSeeds, P),
    nextUid: opt(o, 'nextUid', (x, p) => int(x, p, 1), d.nextUid, P),
  };
  hero.unlockedRunes = [...new Set([...hero.unlockedRunes, ...hero.runes.map((r) => r.rune)])].sort();
  const eq = o.equipped === undefined ? {} : obj(o.equipped, 'hero.equipped');
  for (const slot of EQUIP_SLOTS) {
    const u = eq[slot];
    if (u === null || u === undefined) continue;
    const uid = int(u, `hero.equipped.${slot}`, 1);
    const it = hero.items.find((x) => x.uid === uid);
    if (!it) fail(`hero.equipped.${slot}`, `names item ${uid}, which the hero doesn't have`);
    if (!slotsForKind(kindOfBase(it.base)!).includes(slot))
      fail(`hero.equipped.${slot}`, `can't hold ${it.base}`);
    hero.equipped[slot] = uid;
  }
  const uids: number[] = [
    ...hero.runes.map((r) => r.uid),
    ...hero.items.map((i) => i.uid),
    ...hero.parts.map((p) => p.uid),
  ];
  for (const it of hero.items) for (const f of it.fused) if (f) uids.push(f.uid);
  if (new Set(uids).size !== uids.length) fail('hero', 'has two things with one uid');
  if (
    new Set(EQUIP_SLOTS.map((s) => hero.equipped[s]).filter((u) => u !== null)).size !==
    EQUIP_SLOTS.filter((s) => hero.equipped[s] !== null).length
  )
    fail('hero.equipped', 'holds one item in two slots');
  hero.nextUid = Math.max(hero.nextUid, 1 + Math.max(0, ...uids));
  return hero;
}

function flags(v: unknown, path: string): RoomFlags {
  const o = obj(v, path);
  return {
    visited: opt(o, 'visited', bool, false, path),
    cleared: opt(o, 'cleared', bool, false, path),
    rewardsPaid: opt(o, 'rewardsPaid', bool, false, path),
    opened: opt(o, 'opened', strs, [], path),
    taken: opt(o, 'taken', strs, [], path),
  };
}

export function parseWorld(v: unknown): WorldState {
  const o = obj(v, 'world');
  const w = createWorldState(str(o.roomId, 'world.roomId'));
  const P = 'world';
  const f = o.flags === undefined ? {} : obj(o.flags, 'world.flags');
  for (const id of Object.keys(f)) w.flags[id] = flags(f[id], `world.flags.${id}`);
  const k = o.keys === undefined ? {} : obj(o.keys, 'world.keys');
  for (const id of Object.keys(k)) w.keys[id] = int(k[id], `world.keys.${id}`);
  w.bigKeys = opt(o, 'bigKeys', strs, w.bigKeys, P);
  w.loomStones = opt(o, 'loomStones', strs, w.loomStones, P);
  w.bossesDefeated = opt(o, 'bossesDefeated', strs, w.bossesDefeated, P);
  if (o.respawn !== null && o.respawn !== undefined) {
    const r = obj(o.respawn, 'world.respawn');
    w.respawn = { roomId: str(r.roomId, 'world.respawn.roomId'), key: str(r.key, 'world.respawn.key') };
  }
  return w;
}

/** Weaves, emptying any slot whose socketed runes don't match its notation or are used twice. */
function parseWeaves(v: unknown, hero: HeroState): SavedWeaves {
  const o = obj(v, 'weaves');
  const spindleId = str(o.spindleId, 'weaves.spindleId');
  if (!isSpindleId(spindleId)) fail('weaves.spindleId', `is not a spindle ("${spindleId}")`);
  const notations = arr(o.notations ?? [], 'weaves.notations');
  const runes = arr(o.runes ?? [], 'weaves.runes');
  const byUid = new Map(hero.runes.map((r) => [r.uid, r]));
  const used = new Set<number>();
  const out: SavedWeaves = { spindleId, notations: [], runes: [] };
  for (let i = 0; i < LOADOUT_SLOTS; i++) {
    const n =
      notations[i] === null || notations[i] === undefined
        ? null
        : str(notations[i], `weaves.notations[${i}]`);
    const r =
      runes[i] === null || runes[i] === undefined
        ? null
        : arr(runes[i], `weaves.runes[${i}]`).map((u, j) => int(u, `weaves.runes[${i}][${j}]`, 1));
    const parsed = n === null ? null : parseWeave(n);
    const order = parsed?.ok ? runeOrder(parsed.tree) : null;
    const ok =
      order !== null &&
      r !== null &&
      r.length === order.length &&
      r.every((u, j) => byUid.get(u)?.rune === order[j]!.rune && !used.has(u));
    if (ok) for (const u of r) used.add(u);
    out.notations.push(ok ? n : null);
    out.runes.push(ok ? r : null);
  }
  return out;
}

function rngState(v: unknown, path: string): RngState {
  const a = arr(v, path);
  if (a.length !== 4) fail(path, 'should hold 4 numbers');
  return a.map((x, i) => {
    const v = int(x, `${path}[${i}]`, -0x80000000);
    if (v > 0xffffffff) fail(`${path}[${i}]`, 'should be a 32-bit number');
    return v;
  }) as RngState;
}

/** RNG streams newer than the first saves, with the state a new game gives them. */
const LATE_RNGS = { craftRng: (seed: number) => craftRngFor(seed).getState() };

/** Migrations from version n to n + 1, by n. None yet: version 1 is the first. */
const migrations: Record<number, (o: Obj) => Obj> = {};

export function parseSaveData(data: unknown): SaveData {
  let o = obj(data, 'save');
  if (o.format !== SAVE_FORMAT) throw new Error(`Not a Runeloom save (expected format "${SAVE_FORMAT}")`);
  let version = int(o.version, 'version', 1);
  if (version > SAVE_VERSION)
    throw new Error(
      `This save is from a newer version of Runeloom (save version ${version}, this build reads ${SAVE_VERSION})`,
    );
  while (version < SAVE_VERSION) {
    const m = migrations[version];
    if (!m) throw new Error(`Can't migrate save version ${version}`);
    o = m(o);
    version++;
  }
  const hero = parseHero(o.hero);
  const r = obj(o.rngs, 'rngs');
  const rngs = {} as Record<SavedRng, RngState>;
  for (const k of SAVED_RNGS) {
    // Streams added after version 1 saves were made (craftRng, M5) start from the seed.
    if (r[k] === undefined && k in LATE_RNGS)
      rngs[k] = LATE_RNGS[k as keyof typeof LATE_RNGS](int(o.seed, 'seed') >>> 0);
    else rngs[k] = rngState(r[k], `rngs.${k}`);
  }
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    seed: int(o.seed, 'seed') >>> 0,
    tick: opt(o, 'tick', int, 0, 'save'),
    hero,
    world: parseWorld(o.world),
    weaves: parseWeaves(o.weaves, hero),
    rngs,
  };
}
