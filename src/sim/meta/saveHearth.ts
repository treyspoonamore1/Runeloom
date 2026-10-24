/**
 * The Hearth in saves (save version 3, M7). parseHero calls parseHearth for `hero.hearth`;
 * parseSaveData calls migrateHearth once the hero, world and weaves are parsed.
 *
 * CONTRACT (M7), owned by the meta agent: every field is validated (building levels within their
 * max, garden uids are pouch runes, expedition uids unique, mutation counts within their max),
 * throwing an Error that names the field, like src/sim/saveParse.ts.
 */
import { BUILDING_IDS, buildings, mutations, type MutationId } from '../../../data/hearth';
import { RIFT_TIERS } from '../../../data/rift';
import type { HeroState } from '../hero/types';
import type { WorldState } from '../world/worldState';
import { createHearth, lightHearthState } from './hearth';
import { SALVAGE_ORDER } from './salvage';
import type { Expedition, HearthState, SalvageSetting } from './types';

type Obj = Record<string, unknown>;
const P = 'hero.hearth';

function fail(path: string, what: string): never {
  throw new Error(`Bad save: ${path} ${what}`);
}

function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'should be an object');
  return v as Obj;
}

function num(v: unknown, path: string, min = 0, max = Infinity): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    fail(path, max === Infinity ? `should be a number ≥ ${min}` : `should be a number from ${min} to ${max}`);
  return v;
}

function int(v: unknown, path: string, min = 0, max = Infinity): number {
  const n = num(v, path, min, max);
  if (!Number.isInteger(n)) fail(path, 'should be a whole number');
  return n;
}

function list(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, 'should be a list');
  return v;
}

/** A field, or its default when missing. */
function opt<T>(o: Obj, key: string, read: (v: unknown, path: string) => T, d: T): T {
  return o[key] === undefined ? d : read(o[key], `${P}.${key}`);
}

function expedition(v: unknown, path: string): Expedition {
  const o = obj(v, path);
  const duration = num(o.duration, `${path}.duration`);
  return {
    uid: int(o.uid, `${path}.uid`, 1),
    tier: int(o.tier, `${path}.tier`, 1, RIFT_TIERS),
    left: num(o.left, `${path}.left`, 0, duration),
    duration,
  };
}

/** `hero.hearth` from a save; a missing one (versions 1 and 2) is a fresh, unlit Hearth. */
export function parseHearth(v: unknown): HearthState {
  const d = createHearth();
  if (v === undefined) return d;
  const o = obj(v, P);
  const lit = opt(
    o,
    'lit',
    (x, p) => (typeof x === 'boolean' ? x : fail(p, 'should be true or false')),
    d.lit,
  );
  const b = opt(o, 'buildings', obj, {} as Obj);
  const levels = { ...d.buildings };
  for (const id of BUILDING_IDS)
    if (b[id] !== undefined) levels[id] = int(b[id], `${P}.buildings.${id}`, 0, buildings[id].maxLevel);
  for (const k of Object.keys(b))
    if (!(BUILDING_IDS as readonly string[]).includes(k)) fail(`${P}.buildings.${k}`, 'is not a building');
  const garden = opt(o, 'garden', (x, p) => list(x, p).map((u, i) => int(u, `${p}[${i}]`, 1)), d.garden);
  if (new Set(garden).size !== garden.length) fail(`${P}.garden`, 'lists a rune twice');
  const expeditions = opt(
    o,
    'expeditions',
    (x, p) => list(x, p).map((e, i) => expedition(e, `${p}[${i}]`)),
    d.expeditions,
  );
  if (new Set(expeditions.map((e) => e.uid)).size !== expeditions.length)
    fail(`${P}.expeditions`, 'repeats a uid');
  const salvage = opt(
    o,
    'salvage',
    (x, p) => {
      if (!SALVAGE_ORDER.includes(x as SalvageSetting))
        fail(p, `should be one of ${SALVAGE_ORDER.join(', ')}`);
      return x as SalvageSetting;
    },
    d.salvage,
  );
  const m = opt(o, 'mutations', obj, {} as Obj);
  const muts: HearthState['mutations'] = {};
  for (const [id, n] of Object.entries(m)) {
    if (!(id in mutations)) fail(`${P}.mutations.${id}`, 'is not a mutation');
    const count = int(n, `${P}.mutations.${id}`, 0, mutations[id as MutationId].max);
    if (count > 0) muts[id as MutationId] = count;
  }
  return {
    lit,
    embers: opt(o, 'embers', int, d.embers),
    embersSpent: opt(o, 'embersSpent', num, d.embersSpent),
    buildings: levels,
    scrapCarry: opt(o, 'scrapCarry', (x, p) => num(x, p, 0, 1), d.scrapCarry),
    garden,
    expeditions,
    salvage,
    rekindles: opt(o, 'rekindles', int, d.rekindles),
    ash: opt(o, 'ash', int, d.ash),
    mutations: muts,
    playSeconds: opt(o, 'playSeconds', num, d.playSeconds),
    clock: opt(o, 'clock', int, d.clock),
  };
}

/**
 * After parsing: a save from before M7 (`hadHearth` false) whose world shows the Cinder Warden
 * dead gets a lit Hearth, as lightHearth gives (onLit Embers, the Hearth's Loom Stone in
 * world.loomStones). Garden uids must be the hero's runes (else it throws); garden runes that a
 * weave socketed (`socketed`) go back to the pouch.
 */
export function migrateHearth(
  hero: HeroState,
  world: WorldState,
  hadHearth: boolean,
  socketed: ReadonlySet<number> = new Set(),
): void {
  const h = hero.hearth;
  if (!hadHearth && !h.lit && world.bossesDefeated.includes('cinder_warden'))
    lightHearthState(hero, world.loomStones);
  const runes = new Set(hero.runes.map((r) => r.uid));
  h.garden.forEach((u, i) => {
    if (!runes.has(u)) fail(`${P}.garden[${i}]`, `is not one of the hero's runes (${u})`);
  });
  h.garden = h.garden.filter((u) => !socketed.has(u));
}
