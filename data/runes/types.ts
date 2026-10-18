/**
 * Rune data shapes (CONTENT §1, DESIGN §5). Units: cells, seconds, cells per second, degrees for
 * angles, fractions for chances (0.06 = 6%). Multipliers are plain factors (1.3 = 30% more,
 * 0.75 = 25% less).
 *
 * Ids are snake_case string literals listed here, so every table can be checked for completeness
 * with `satisfies Record<…Id, …Def>` without circular types.
 */
import type { DamageType } from '../combatTypes';

/** Milestone that first ships a rune (CONTENT "Ships" column). */
export const runeShips = ['M2', 'M5', 'M7', 'M8'] as const;
export type RuneShip = (typeof runeShips)[number];

export const triggerIds = [
  'cast',
  'pulse',
  'on_dodge',
  'harvest',
  'on_crit',
  'on_hurt',
  'channel',
  'shatter',
] as const;
export const formIds = ['bolt', 'nova', 'beam', 'lob', 'orb', 'strike', 'swath', 'sigil'] as const;
export const elementIds = ['fire', 'frost', 'storm', 'tide', 'gale'] as const;
export const modifierIds = [
  'split',
  'chain',
  'pierce',
  'wide',
  'echo',
  'seeker',
  'heavy',
  'keen',
  'lingering',
  'saturate',
  'fork',
  'return',
  'infuse',
  'focus',
  'swift',
] as const;
export const branchIds = ['on_hit', 'on_expire', 'on_kill', 'emit'] as const;

export type TriggerId = (typeof triggerIds)[number];
export type FormId = (typeof formIds)[number];
export type ElementId = (typeof elementIds)[number];
export type ModifierId = (typeof modifierIds)[number];
export type BranchId = (typeof branchIds)[number];
export type RuneId = TriggerId | FormId | ElementId | ModifierId | BranchId;

export type RuneKind = 'trigger' | 'form' | 'element' | 'modifier' | 'branch';

/** Fields every rune has. */
export interface RuneBase<K extends RuneKind, Id extends RuneId> {
  /** Same as the table key. */
  id: Id;
  kind: K;
  /** Display name (CONTENT Name column), e.g. 'On Hit'. */
  name: string;
  /** Notation name: `name` without spaces, e.g. 'OnHit'. Matched case-insensitively. */
  notation: string;
  /** Complexity cost. For branches this is the base cost at depth 1 (DESIGN §5.4). */
  cx: number;
  /** Player-facing one-liner for tooltips. */
  description: string;
  ships: RuneShip;
}

// ---------------------------------------------------------------------------------------------
// Triggers (CONTENT §1.1)

/** What makes a trigger fire. */
export type TriggerEvent =
  | 'press' // the slot's button is pressed (held repeats, as M1 casting)
  | 'interval' // every `period` seconds, if a target is found
  | 'dodge_start'
  | 'kill' // the player kills an enemy
  | 'crit' // a player hit crits
  | 'hurt' // one hit deals at least `hurtThreshold` of max life
  | 'held' // every `period` seconds while the button is held
  | 'shatter'; // the player shatters a Frozen enemy (rule 20)

/** Where the root spell starts. */
export type TriggerOrigin = 'caster' | 'killed_enemy' | 'crit_target' | 'shattered_enemy';

/** Where the root spell aims. */
export type TriggerAim =
  | 'cursor' // the player's aim point
  | 'nearest_enemy' // nearest visible enemy within `aimRange`; skips firing if none
  | 'dodge_direction'
  | 'away_from_caster'
  | 'hit_direction';

export interface TriggerDef extends RuneBase<'trigger', TriggerId> {
  /** Weave mana multiplier (DESIGN §5.4). Channel's is per fire. */
  manaMult: number;
  /** Internal cooldown in seconds, 0 for none. */
  icd: number;
  event: TriggerEvent;
  origin: TriggerOrigin;
  aim: TriggerAim;
  /** True for triggers that fire on their own; their slot button does nothing (DESIGN §5.1). */
  automatic: boolean;
  /** Only Cast waits for the form's cast time. Others fire instantly and don't interrupt movement. */
  usesCastTime: boolean;
  /** Seconds between fires for 'interval' and 'held'. */
  period?: { base: number; perLevel: number; min: number };
  /** Aim search radius for 'nearest_enemy'. */
  aimRange?: number;
  /** 'hurt': minimum single-hit damage as a fraction of max life. */
  hurtThreshold?: number;
  /** Movement speed reduction while active (0.4 = 40% slower). */
  moveSlow?: number;
}

// ---------------------------------------------------------------------------------------------
// Forms (CONTENT §1.2)

/** Where a form applies its elements' terrain effects (CONTENT §1.2 "Terrain footprint", M3). */
export type FootprintDef =
  /** A disc at impact or expiry. */
  | { kind: 'impact'; radius: number }
  /** The form's own hit shape (Nova disc, Lob burst, Strike arc, Swath strip). */
  | { kind: 'hit_shape' }
  /** The beam's line, `width` cells wide. */
  | { kind: 'line'; width: number }
  /** A disc under a moving instance every `interval` seconds. */
  | { kind: 'trail'; radius: number; interval: number }
  | { kind: 'none' };

/** Behavior numbers per form. Areas and lengths are at area multiplier 1. */
export type FormBehavior =
  | { form: 'bolt'; speed: number; life: number; radius: number }
  | { form: 'nova'; radius: number; expandTime: number }
  | { form: 'beam'; length: number; width: number }
  | { form: 'lob'; range: number; flightTime: number; burstRadius: number; branchLandRadius: number }
  | {
      form: 'orb';
      orbitRadius: number;
      revolutionsPerSecond: number;
      duration: number;
      radius: number;
      hitInterval: number;
    }
  | { form: 'strike'; arcDeg: number; reach: number }
  | { form: 'swath'; length: number; width: number }
  | { form: 'sigil'; range: number; duration: number };

export interface FormDef extends RuneBase<'form', FormId> {
  baseMana: number;
  /** Seconds, before cast speed. */
  castTime: number;
  /** Base hit damage at rune level 1 (Strike adds the spindle's Strike bonus). */
  baseDamage: number;
  /** Base crit chance. */
  crit: number;
  /** Knockback distance in cells (0: none). */
  knockback: number;
  behavior: FormBehavior;
  footprint: FootprintDef;
  /** CONTENT's footprint wording, for tooltips. */
  footprintText: string;
  /** Fails validation without an element (own, inherited or infused). */
  needsElement: boolean;
  /** Fails validation without at least one Emit branch. */
  needsEmit: boolean;
  /** Deals hit damage. "Damaging forms" in CONTENT §1.4 are the ones with this set. */
  damaging: boolean;
  /** Area form: On Hit fires on the first target hit only (CONTENT §1.5). */
  area: boolean;
  /** As a branch spell, may hit the entity it spawned from (DESIGN §5.3). */
  canHitSource: boolean;
  /** Ignores aim (Nova). */
  ignoresAim: boolean;
}

// ---------------------------------------------------------------------------------------------
// Elements (CONTENT §1.3)

export type AilmentKind = 'ignite' | 'chill' | 'shock' | 'wet';

export interface ElementDef extends RuneBase<'element', ElementId> {
  /** Type of the damage share it deals (Tide and Gale deal physical, DESIGN §7). */
  damageType: DamageType;
  manaMult: number;
  /** Added to the spell's crit chance. */
  critAdd: number;
  /** Ailment its hits build up, or null. Freeze comes from chill. */
  ailment: AilmentKind | null;
  /** Seconds of Wet it applies (Tide). */
  wetDuration?: number;
  /** Knockback multiplier (Gale ×2). */
  knockbackMult: number;
  /** Seconds of wind gust (Gale, rule 21). */
  gustDuration?: number;
  /** DESIGN §6.3 rule numbers its terrain effect uses (M3). */
  terrainRules: readonly number[];
}

// ---------------------------------------------------------------------------------------------
// Modifiers (CONTENT §1.4)

/**
 * Which forms a modifier fits: a form list, every damaging form, every form, or any spell that has
 * an element (own, inherited or infused).
 */
export type AppliesTo = readonly FormId[] | 'damaging' | 'any' | 'elemental';

/** What a modifier does, as data. Every field is optional; the compiler folds them together. */
export interface ModifierEffect {
  /** Extra instances, spread over `fanDeg` degrees in total. */
  extraInstances?: number;
  fanDeg?: number;
  /** Damage multiplier ("more"/"less"), e.g. 1.3 or 0.75. */
  more?: number;
  /** Extra targets passed through. */
  pierce?: number;
  /** After a hit, jumps to up to `count` more targets within `range`; each jump deals `lessPerChain` less, compounding. */
  chain?: { count: number; range: number; lessPerChain: number };
  /** Area multiplier (Wide 1.4, Focus 0.7). Lengths and radii scale by its square root. */
  areaMult?: number;
  /** Repeats the spell after `delay` seconds; the repeat's damage × `damageMult`. */
  echo?: { delay: number; damageMult: number };
  /** Homing toward the nearest enemy. */
  seeker?: { turnRateDeg: number };
  /** Cast time multiplier (Heavy 1.15 = 15% slower). */
  castTimeMult?: number;
  critChanceAdd?: number;
  critMultiAdd?: number;
  /** Terrain effect duration multiplier (M3). */
  terrainDurationMult?: number;
  /** Terrain footprint area multiplier (M3). */
  terrainAreaMult?: number;
  /** Ailment duration multiplier. */
  ailmentDurationMult?: number;
  /** Orb and Sigil lifetime multiplier. */
  durationMult?: number;
  /** On first hit, splits into `count` bolts at ±`angleDeg` that live `life` seconds. */
  fork?: { count: number; angleDeg: number; life: number };
  /** At end of life, flies back to the caster and can hit again. */
  returns?: boolean;
  /** Projectile speed multiplier (Bolt). */
  speedMult?: number;
  /** Lob flight time multiplier. */
  lobFlightTimeMult?: number;
}

export interface ModifierDef extends RuneBase<'modifier', ModifierId> {
  manaMult: number;
  appliesTo: AppliesTo;
  /** `inherit` tag (Infuse): also applies down the tree (DESIGN §5.3). */
  inherit: boolean;
  effect: ModifierEffect;
}

// ---------------------------------------------------------------------------------------------
// Branches (CONTENT §1.5)

export type BranchOrigin = 'hit_target' | 'end_point' | 'killed_target' | 'instance';
export type BranchAim = 'parent_direction' | 'last_direction' | 'away_from_caster' | 'nearest_enemy';

/** Proc rules, CONTENT §1.5. */
export type ProcDef =
  | { kind: 'on_hit'; maxProcs: number; maxProcsWithPierceOrChain: number; areaFirstTargetOnly: boolean }
  | { kind: 'on_expire'; maxProcs: number }
  | { kind: 'on_kill' }
  | { kind: 'emit'; interval: number; aimRange: number };

export interface BranchDef extends RuneBase<'branch', BranchId> {
  /** Parent forms it can attach to, or 'damaging'. */
  parents: readonly FormId[] | 'damaging';
  /** Damage multiplier on the child spell (On Hit 0.65 = 35% less). Multiplies down the tree. */
  damageMult: number;
  origin: BranchOrigin;
  aim: BranchAim;
  proc: ProcDef;
}

export type RuneDef = TriggerDef | FormDef | ElementDef | ModifierDef | BranchDef;
