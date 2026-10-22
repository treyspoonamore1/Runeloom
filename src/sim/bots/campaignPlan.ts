/**
 * The campaign bot's reference build (M4 balance pass): what a reasonable player does with what
 * they own between rooms. Pure functions of the state, applied only through the same calls the
 * Loom and the menus use (setSlotWeave, applyHeroEdit), so the build is legal and deterministic.
 *
 * - Weaves: each slot takes the first candidate that compiles with the rune items still free
 *   and the spindle's Capacity (CONTENT §2 reference weaves and their smaller cousins). RMB is
 *   the kiter bot's Strike, LMB its Bolt, Q a Frost Bolt once Frost is owned (the Warden tactic in
 *   bots/kiterBoss.ts), E an automatic weave when spare element runes allow one. In a room whose
 *   boss resists Fire, LMB prefers Frost.
 * - Passives: along `passivePath` (Ember fire, then the Warden life spur), skipping nodes that
 *   aren't connected yet.
 * - Gear: equip an item when its score beats the slot's current one (life, resistances,
 *   damage; spindles: Capacity first).
 * - Fuse: the best part by `partPriority` (then tier) in each socket of the equipped spindle.
 */
import { affixes, type StatId } from '../../../data/affixes';
import { gearBases } from '../../../data/items';
import { isUniqueId, uniques } from '../../../data/uniques';
import { spindles, isSpindleId } from '../../../data/spindles';
import type { RuneId } from '../../../data/runes';
import { applyHeroEdit } from '../hero/edits';
import { implicitStats } from '../hero/stats';
import type { EquipSlot, FusePart, Item } from '../hero/types';
import { equippedSpindle, findItem, kindOfBase } from '../items/items';
import type { GameState } from '../state';
import { setSlotWeave } from '../weave/runtime/loadout';
import { craftEquipped, craftNewItems, polishMainRune } from './campaignCraft';

/** Strike weaves for RMB, best first. Physical: most early enemies resist Fire. */
export const strikeWeaves: readonly string[] = [
  'Cast > Strike[Echo, Heavy, Wide, Keen]',
  'Cast > Strike[Echo, Heavy, Wide]',
  'Cast > Strike[Heavy, Wide, Keen]',
  'Cast > Strike[Heavy, Wide]',
  'Cast > Strike[Wide]',
  'Cast > Strike[Heavy]',
  'Cast > Strike[]',
];

/** Bolt weaves for LMB, best first: Scatter Spark (reference weave 4) and its parts. */
export const fireBoltWeaves: readonly string[] = [
  'Cast > Bolt[Fire, Split, Pierce, Heavy]',
  'Cast > Bolt[Fire, Split, Pierce]',
  'Cast > Bolt[Fire, Split]',
  'Cast > Bolt[Fire, Pierce]',
  'Cast > Bolt[Fire]',
];

/** LMB against a boss that resists Fire (the Warden: 75% Fire, −25% Frost). */
export const frostBoltWeaves: readonly string[] = [
  'Cast > Bolt[Frost, Split, Pierce]',
  'Cast > Bolt[Frost, Split]',
  'Cast > Bolt[Frost, Pierce]',
  'Cast > Bolt[Frost]',
];

/** Q once Frost is owned: the Frost Bolt the Warden tactic needs (bots/kiterBoss.ts). */
export const qWeaves: readonly string[] = ['Cast > Bolt[Frost, Pierce]', 'Cast > Bolt[Frost]'];

/** E: an automatic weave, if spare runes allow (Stormfront-like Pulse Lob, Ember Orbit's cousin). */
export const eWeaves: readonly string[] = [
  'Pulse > Lob[Fire, Wide]',
  'Pulse > Lob[Fire]',
  'Pulse > Bolt[Fire]',
  'Pulse > Lob[Frost, Wide]',
  'Pulse > Lob[Frost]',
];

/** Passive nodes in allocation order: Ember fire, then the Warden life spur from the south. */
export const passivePath: readonly string[] = [
  'weaver_n',
  'ember_s1',
  'ember_s2',
  'weaver_se',
  'weaver_s',
  'weaver_s1',
  'weaver_s2',
  'weaver_s3',
  'warden_b3',
  'warden_b2',
  'warden_b1',
  'warden_r90',
  'warden_r120',
  'warden_r150',
  'ember_r1',
  'ember_m1',
  'ember_m2',
];

/** Fuse parts best first; tier breaks ties. Cinder Heart drops after the last fight. */
export const partPriority: readonly string[] = [
  'tinder_tooth',
  'shield_plate',
  'kiln_chitin',
  'matriarchs_sac',
  'ember_feather',
  'tar_gland',
  'rime_mote',
  'storm_antler',
  'bog_gill',
  'cinder_heart',
];

/** Score per display unit of each stat (12 for 12%) for the gear rule; unlisted stats count 0.1. */
export const statWeights: Partial<Record<StatId, number>> = {
  life_flat: 1,
  life_inc: 1.2,
  fire_resist: 0.6,
  frost_resist: 0.6,
  storm_resist: 0.6,
  strike_flat: 2,
  fire_damage: 0.4,
  frost_damage: 0.2,
  elemental_damage: 0.5,
  cast_speed: 0.8,
  crit_chance: 0.4,
  mana_flat: 0.3,
  mana_regen: 3,
  mana_cost: 0.6,
  move_speed: 0.8,
  dodge_recharge: 0.3,
  capacity: 10,
  rune_levels: 15,
};

/** Score of one Capacity point on a spindle (Capacity decides which weaves fit). */
const CAPACITY_SCORE = 10;
/** Cast speed above 1.00 on a spindle base, per 0.01. */
const CAST_SPEED_SCORE = 0.8;

function statScore(stat: StatId, value: number): number {
  return (statWeights[stat] ?? 0.1) * value;
}

/** The gear rule's score of an item: its affixes, plus base Capacity, cast speed and implicit for spindles. */
export function itemScore(item: Item): number {
  let s = 0;
  for (const a of item.affixes) {
    const def = (affixes as Record<string, { stat: StatId }>)[a.id];
    if (def) s += statScore(def.stat, a.value);
  }
  const u = item.unique !== undefined && isUniqueId(item.unique) ? uniques[item.unique] : null;
  if (u) for (const st of u.stats) s += statScore(st.stat, st.value);
  if (isSpindleId(item.base)) {
    const b = spindles[item.base];
    s += b.capacity * CAPACITY_SCORE + (b.castSpeed - 1) * 100 * CAST_SPEED_SCORE;
    if (b.implicit) for (const { stat, value } of implicitStats(b.implicit)) s += statScore(stat, value);
  } else {
    const g = (gearBases as Record<string, { implicit: { stat: StatId; value: number }[] }>)[item.base];
    if (g) for (const { stat, value } of g.implicit) s += statScore(stat, value);
  }
  return s;
}

/** A short label for logs: "ashwood(m)" or "cloak(m):life_flat 12, fire_resist 8". */
export function itemLabel(item: Item): string {
  const r = item.rarity === 'normal' ? '' : `(${item.rarity[0]})`;
  const aff = item.affixes.map(
    (a) => `${(affixes as Record<string, { stat: string }>)[a.id]?.stat ?? a.id} ${a.value}`,
  );
  return `${item.base}${r}${aff.length ? ':' + aff.join(', ') : ''}`;
}

/** Equips better gear and spindles. Returns the labels of what it equipped. */
export function equipBest(state: GameState): string[] {
  const hero = state.hero;
  const out: string[] = [];
  const slotsOf: Record<string, EquipSlot[]> = {
    spindle: ['spindle'],
    cloak: ['cloak'],
    hood: ['hood'],
    boots: ['boots'],
    charm: ['charm1', 'charm2'],
  };
  for (const [kind, slots] of Object.entries(slotsOf)) {
    for (const slot of slots) {
      const cur = hero.equipped[slot];
      const curItem = cur === null ? undefined : findItem(hero, cur);
      let best = curItem;
      let bestScore = curItem ? itemScore(curItem) : -Infinity;
      for (const it of hero.items) {
        if (kindOfBase(it.base) !== kind) continue;
        if (Object.values(hero.equipped).includes(it.uid)) continue;
        const sc = itemScore(it);
        if (sc > bestScore) {
          best = it;
          bestScore = sc;
        }
      }
      if (!best || best === curItem) continue;
      if (slot === 'spindle' && curItem) moveParts(state, curItem);
      if (applyHeroEdit(state, { kind: 'equip', uid: best.uid, slot }) === null) out.push(itemLabel(best));
    }
  }
  return out;
}

/** Before a spindle swap: keeps its fused parts when Thread Scrap allows, else they are lost with it. */
function moveParts(state: GameState, from: Item): void {
  from.fused.forEach((p, socket) => {
    if (!p) return;
    const keep = state.hero.threadScrap >= 5;
    applyHeroEdit(state, { kind: 'unfuse', spindleUid: from.uid, socket, keep });
  });
}

function partRank(p: FusePart): number {
  const i = partPriority.indexOf(p.part);
  return (i < 0 ? partPriority.length : i) * 10 - p.tier;
}

/** Fuses the best loose parts into the equipped spindle, replacing worse ones. Returns what it fused. */
export function fuseBest(state: GameState): string[] {
  const out: string[] = [];
  const spindle = equippedSpindle(state.hero);
  if (!spindle) return out;
  for (let socket = 0; socket < spindle.fused.length; socket++) {
    const loose = [...state.hero.parts].sort((a, b) => partRank(a) - partRank(b) || a.uid - b.uid);
    const fusedHere = new Set(spindle.fused.filter((p): p is FusePart => p !== null).map((p) => p.part));
    const best = loose.find((p) => !fusedHere.has(p.part) || spindle.fused[socket]?.part === p.part);
    if (!best) continue;
    const cur = spindle.fused[socket];
    if (cur && partRank(cur) <= partRank(best)) continue;
    if (cur) applyHeroEdit(state, { kind: 'unfuse', spindleUid: spindle.uid, socket, keep: false });
    if (applyHeroEdit(state, { kind: 'fuse', partUid: best.uid, spindleUid: spindle.uid, socket }) === null)
      out.push(`${best.part} ${'I'.repeat(best.tier)}`);
  }
  // Leftover parts are salvaged for Thread Scrap, as a player clears the inventory.
  for (const p of [...state.hero.parts]) applyHeroEdit(state, { kind: 'salvage', uid: p.uid });
  return out;
}

/** Spends every passive point along passivePath. Returns the nodes allocated. */
export function allocatePassives(state: GameState): string[] {
  const out: string[] = [];
  for (const node of passivePath) {
    if (state.hero.passives.includes(node)) continue;
    if (applyHeroEdit(state, { kind: 'allocate', node }) === null) out.push(node);
  }
  return out;
}

/** Sets slot `slot` to the first candidate that compiles with the free runes; returns it or null. */
function setFirst(state: GameState, slot: number, candidates: readonly string[]): string | null {
  for (const n of candidates) if (setSlotWeave(state, slot, n).applied) return n;
  return null;
}

export interface WeavePlanOptions {
  /** The room's boss resists Fire: LMB prefers a Frost Bolt. */
  frostLmb?: boolean;
  /** Spend crafting currency (bots/campaignCraft.ts). Default true. */
  craft?: boolean;
}

/** Rebuilds all four weaves from the runes owned (empties them first, then RMB, LMB, Q, E). */
export function planWeaves(state: GameState, opts: WeavePlanOptions = {}): (string | null)[] {
  for (let s = 0; s < 4; s++) setSlotWeave(state, s, null);
  const owned = new Set<RuneId>(state.hero.runes.map((r) => r.rune));
  const out: (string | null)[] = [null, null, null, null];
  out[1] = setFirst(state, 1, strikeWeaves);
  // Against a Fire-resistant boss LMB turns Frost (its Split bolts also build his chill faster);
  // the Warden tactic shoots it when Q holds no Frost Bolt (bots/kiterBoss.ts).
  const lmb = opts.frostLmb && owned.has('frost') ? [...frostBoltWeaves, ...fireBoltWeaves] : fireBoltWeaves;
  out[0] = setFirst(state, 0, lmb);
  out[2] = setFirst(state, 2, qWeaves);
  out[3] = setFirst(state, 3, eWeaves);
  return out;
}

/** Every build step between rooms, in the order a player does them. */
export function applyReferenceBuild(
  state: GameState,
  opts: WeavePlanOptions = {},
): {
  equipped: string[];
  fused: string[];
  allocated: string[];
  weaves: (string | null)[];
  crafted: string[];
} {
  const craft = opts.craft ?? true;
  const crafted = craft ? craftNewItems(state) : [];
  const equipped = equipBest(state);
  if (craft) {
    crafted.push(...craftEquipped(state));
    equipped.push(...equipBest(state));
  }
  const fused = fuseBest(state);
  const allocated = allocatePassives(state);
  const weaves = planWeaves(state, opts);
  if (craft) crafted.push(...polishMainRune(state));
  return { equipped, fused, allocated, weaves, crafted };
}
