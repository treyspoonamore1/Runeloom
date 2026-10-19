/**
 * HeroMods: every number and rule flag the character's gear, passives, Fuse parts, Heart Seeds,
 * Loom Shards and level add up to. Systems read `state.heroMods` and nothing else about the
 * character's build, so the sources (items, tree, parts) and the systems that apply them can be
 * built separately.
 *
 * Derived data: rebuilt by `refreshHero(state)` (src/sim/hero/hero.ts) whenever the hero changes
 * (equip, level up, allocate, fuse, a new game or a load). Not hashed: it is a pure function of
 * the hashed `state.hero`.
 *
 * CONTRACT (M4). Conventions: `...Inc` fields are summed "increased" fractions (0.1 = 10%
 * increased), applied as × (1 + sum). `...More` fields are products of (1 + more), applied as a
 * separate multiplier. `...Add` fields are flat additions in the field's own unit. A neutral
 * HeroMods (emptyHeroMods) must leave every system exactly as it was before M4, so sandbox,
 * arena, the lab and every existing test and bench keep their hashes.
 *
 * Owners: the hero/items agent aggregates items, implicits, levels, Heart Seeds and Loom Shards
 * and applies the "Core" and "Defense" groups. The effects agent aggregates passives and Fuse
 * parts and applies the "Ailments", "Terrain" and "Rules" groups. Either may add a field: put it
 * in the right group with a doc comment, and give emptyHeroMods a neutral value.
 */
import { damageTypes, type DamageType } from '../../../data/combatTypes';

export type ByType = Record<DamageType, number>;

export interface HeroMods {
  // ---- Core: vitals, offense, weaving ----
  /** Flat max life on top of the level formula (DESIGN §7: 80 + 12 per level above 1): Heart Seeds, gear. */
  maxLifeAdd: number;
  maxLifeInc: number;
  /** Flat max mana on top of the level formula (DESIGN §7: 50 + 4 per level above 1): gear. */
  maxManaAdd: number;
  maxManaInc: number;
  /** Added mana regen, mana per second, on top of the base % of max (tuning.player). */
  manaRegenAdd: number;
  /** Increased damage by type. "Elemental" increases add to fire, frost and storm. */
  damageInc: ByType;
  /** Increased damage for spells at branch depth ≥ 1. */
  branchDamageInc: number;
  /** Flat Strike base damage (Ironbark implicit, affixes), added after rune-level scaling. */
  strikeFlatAdd: number;
  /** Increased cast speed (cast time ÷ (spindle cast speed × (1 + this))). */
  castSpeedInc: number;
  /** Added crit chance, as a fraction (0.02 = +2 percentage points). */
  critChanceAdd: number;
  /** Reduced mana cost, as a fraction (0.1 = 10% reduced). */
  manaCostReduced: number;
  /** Added Capacity for every weave (Loom Shards, affixes, Spellwright, Single Thread's −3). */
  capacityAdd: number;
  /** Added levels for runes of an element (Pyre Hood), and `all` for every rune (Loomsteel). */
  runeLevelAdd: { all: number; fire: number; frost: number; storm: number };

  // ---- Defense and movement ----
  /** Resistances added by gear, before the player cap (combat.resistCap). */
  resistAdd: ByType;
  /** Increased move speed. */
  moveSpeedInc: number;
  /** Faster dodge recharge, as a fraction (0.15 = recharges 15% faster). */
  dodgeRechargeInc: number;
  /** Extra dodge charges (Second Wind). */
  dodgeChargesAdd: number;
  /** Less damage taken from enemy projectiles, as a fraction (Shield Plate: 0.2). */
  projectileDamageTakenLess: number;

  // ---- Ailments ----
  /** Increased duration of every ailment you inflict. */
  ailmentDurationInc: number;
  /** Increased Ignite duration (Slow Burn). */
  igniteDurationInc: number;
  /** Increased effect of Chill, Shock and Ignite you inflict. */
  chillEffectInc: number;
  shockEffectInc: number;
  igniteEffectInc: number;
  /** Increased chill build-up (Rimeglass implicit, Deep Freeze). */
  chillGainInc: number;
  /** Increased Freeze duration (Rime Mote), then seconds added (Deep Freeze). */
  freezeDurationInc: number;
  freezeDurationAdd: number;

  // ---- Terrain you create ----
  /** Increased duration of terrain effects you create (ice, charge, placed fire, steam). */
  terrainDurationInc: number;
  /** Increased spread chance for fire you create (Kindler, charm affix). */
  fireSpreadInc: number;
  /** Increased duration of ice and ice bridges you create (Long Winter). */
  iceDurationInc: number;
  /** Seconds added to charge you create on water and metal (Overcharge, Storm Antler). */
  chargeDurationAdd: number;
  /** Increased conduction range, and cells added to the water/metal caps (Conduit). */
  conductionRangeInc: number;
  conductionRangeAdd: number;
  conductionCellsAdd: number;

  // ---- Rules: keystones, notables and Fuse parts that change how things work ----
  /** Allocated keystone ids (CONTENT §7), sorted. */
  keystones: string[];
  /** Fused part ids with their tiers (CONTENT §4), in socket order. */
  parts: { part: string; tier: 1 | 2 | 3 }[];
  /**
   * Named effects not covered by a number above, e.g. 'oilcraft', 'brittle', 'rainshadow',
   * 'echoing_thread', with their magnitude. Keys are documented where they are applied.
   */
  effects: Record<string, number>;
  /** Extra weaves that use no slot and no Capacity (Cinder Heart grants `Harvest > Nova[Fire]`). */
  extraWeaves: string[];
}

function byType(v: number): ByType {
  const out = {} as ByType;
  for (const t of damageTypes) out[t] = v;
  return out;
}

/** Neutral mods: a level 1 character with no gear changes nothing. */
export function emptyHeroMods(): HeroMods {
  return {
    maxLifeAdd: 0,
    maxLifeInc: 0,
    maxManaAdd: 0,
    maxManaInc: 0,
    manaRegenAdd: 0,
    damageInc: byType(0),
    branchDamageInc: 0,
    strikeFlatAdd: 0,
    castSpeedInc: 0,
    critChanceAdd: 0,
    manaCostReduced: 0,
    capacityAdd: 0,
    runeLevelAdd: { all: 0, fire: 0, frost: 0, storm: 0 },
    resistAdd: byType(0),
    moveSpeedInc: 0,
    dodgeRechargeInc: 0,
    dodgeChargesAdd: 0,
    projectileDamageTakenLess: 0,
    ailmentDurationInc: 0,
    igniteDurationInc: 0,
    chillEffectInc: 0,
    shockEffectInc: 0,
    igniteEffectInc: 0,
    chillGainInc: 0,
    freezeDurationInc: 0,
    freezeDurationAdd: 0,
    terrainDurationInc: 0,
    fireSpreadInc: 0,
    iceDurationInc: 0,
    chargeDurationAdd: 0,
    conductionRangeInc: 0,
    conductionRangeAdd: 0,
    conductionCellsAdd: 0,
    keystones: [],
    parts: [],
    effects: {},
    extraWeaves: [],
  };
}
