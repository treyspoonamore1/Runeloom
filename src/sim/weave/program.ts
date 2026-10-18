/**
 * SpellProgram: the compiled, validated form of a weave and the spell runtime's only input
 * (DESIGN §5.3). Every rune number the runtime needs is resolved here at compile time, so the
 * runtime never looks up rune data per tick and never calls trig: angles arrive as precomputed
 * unit-vector rotations (see angles.ts for the convention).
 *
 * Units: cells, seconds, cells per second, degrees (informational only), fractions for chances.
 * Multipliers are factors: 1.3 = 30% more, 0.75 = 25% less.
 *
 * What is NOT in here (the runtime adds it from character state): "increased" damage from the
 * passive tree, gear and spindle implicits (`increased` below only holds rune sources, which is
 * none in M2); resistances and Shock on the target; the Strike/Nova mana refund ("Closer pays
 * more", CONTENT §1.2), whose numbers live in tuning; spindle chill gain.
 */
import type { DamageAmounts, DamageType } from '../../../data/combatTypes';
import type {
  AilmentKind,
  BranchAim,
  BranchId,
  BranchOrigin,
  ElementId,
  FormId,
  TriggerAim,
  TriggerEvent,
  TriggerId,
  TriggerOrigin,
} from '../../../data/runes';
import type { Rotation } from './angles';
import type { WeavePath } from './tree';

export interface SpellProgram {
  /** Canonical notation of the compiled tree (for logs, replays, the console). */
  notation: string;
  trigger: TriggerSpec;
  root: SpellSpec;
  /** Total complexity (DESIGN §5.4), ≤ the Capacity it was compiled for. */
  complexity: number;
  /** Mana paid when the root fires: trigger mana mult × root.manaCost. Channel: per fire. */
  mana: number;
  /** Seconds from press to release basis (form cast time × Heavy ÷ cast speed); 0 if the trigger ignores cast time. */
  castTime: number;
  /** Rune level the damage was scaled for. */
  runeLevel: number;
  /** At most this many instances per cast across the whole tree; extra spawns are dropped and counted. */
  spawnCap: number;
}

/** When and how the root spell fires. */
export interface TriggerSpec {
  id: TriggerId;
  event: TriggerEvent;
  /** Fires on its own; the slot button does nothing. Automatic triggers pay mana when they fire and skip if short. */
  automatic: boolean;
  /** Only 'cast': the cast takes `SpellProgram.castTime`. Others release instantly without interrupting movement. */
  usesCastTime: boolean;
  manaMult: number;
  /** Internal cooldown in seconds per trigger rune, 0 for none. */
  icd: number;
  /** Seconds between fires for 'interval' (Pulse, already level-scaled) and 'held' (Channel); else null. */
  period: number | null;
  origin: TriggerOrigin;
  aim: TriggerAim;
  /** Search radius for aim 'nearest_enemy'; null otherwise. With no enemy in range the trigger doesn't fire. */
  aimRange: number | null;
  /** 'hurt': one hit must deal at least this fraction of max life. */
  hurtThreshold: number | null;
  /** Movement slow while active (Channel 0.4), else 0. */
  moveSlow: number;
}

/** One element of a spell, after inheritance and Infuse. */
export interface ElementShare {
  element: ElementId;
  damageType: DamageType;
  /** Share of base damage (elements split evenly). Also scales its ailment build-up and terrain effect. */
  share: number;
  ailment: AilmentKind | null;
  /** Seconds of Wet applied (Tide), else 0. */
  wetDuration: number;
  /** 'own': in this spell's slots. 'inherited': copied from the parent because this spell had none. 'infused': added by an ancestor's Infuse. */
  source: 'own' | 'inherited' | 'infused';
}

/** One labeled "more"/"less" damage multiplier, for the runtime and the Loom tooltip. */
export interface MoreMult {
  /** Rune id that causes it ('heavy', 'split', 'on_hit', …). */
  source: string;
  /** Player-facing, e.g. 'Heavy' or 'On Hit branch (depth 1)'. */
  label: string;
  /** Factor, e.g. 1.3. DamagePacket.more wants `mult − 1`. */
  mult: number;
}

/** Form-specific behavior numbers, after Wide/Focus (area), Swift (speed) and Lingering (duration). */
export type FormParams =
  | {
      form: 'bolt';
      speed: number;
      /** Seconds before it expires. */
      life: number;
      /** Collision radius. */
      radius: number;
    }
  | {
      form: 'nova';
      /** Final ring radius. Each target is hit once, as the ring reaches it. Nova ignores aim. */
      radius: number;
      /** Seconds for the ring to grow from 0 to `radius`. */
      expandTime: number;
    }
  | {
      form: 'beam';
      /** Instant line, stopped by walls. Hits the first target (more with Pierce). */
      length: number;
      width: number;
    }
  | {
      form: 'lob';
      /** Max distance to the aim point. */
      range: number;
      flightTime: number;
      burstRadius: number;
      /** Branch spells only (depth > 0): lands on a random point within this radius of its origin (sim RNG), ignoring aim. Null at the root. */
      randomLandRadius: number | null;
    }
  | {
      form: 'orb';
      /** Orbits the caster at this distance, starting along the aim direction. */
      orbitRadius: number;
      revolutionsPerSecond: number;
      /** Rotate the orb's offset from the caster by this every 60 Hz tick. */
      tickRotation: Rotation;
      duration: number;
      /** Hit radius. */
      radius: number;
      /** A target is hit at most once per this many seconds. */
      hitInterval: number;
    }
  | {
      form: 'strike';
      arcDeg: number;
      /** cos(arcDeg / 2): a target is inside when dot(aimDir, toTargetDir) ≥ this. */
      halfAngleCos: number;
      reach: number;
    }
  | {
      form: 'swath';
      /** Strip from the caster toward the aim. Hits each entity in it once. */
      length: number;
      width: number;
    }
  | {
      form: 'sigil';
      /** Placed at the aim point, at most this far. Deals no damage; exists for its Emit branches. */
      range: number;
      duration: number;
    };

/** Where the spell writes its elements' terrain effects (M3), already scaled. */
export type ResolvedFootprint =
  | { kind: 'impact'; radius: number }
  /** The spell's own (already area-scaled) hit shape, with every length × `scale` (Saturate). */
  | { kind: 'hit_shape'; scale: number }
  | { kind: 'line'; width: number }
  | { kind: 'trail'; radius: number; interval: number }
  | { kind: 'none' };

export interface SpellSpec {
  /** Where this spell sits in the source tree (tree.ts WeavePath), for UI and debug. */
  path: WeavePath;
  /** 0 for the root, +1 per branch. */
  depth: number;
  form: FormId;
  params: FormParams;
  /** In slot order; own elements first, then infused ones. Empty means physical (Strike). */
  elements: ElementShare[];
  /** Base damage share per type; sums to 1 for damaging forms (all physical if no element). */
  shares: DamageAmounts;
  /** Form base damage at `runeLevel` (× 1.11^(L−1)), plus the spindle's flat Strike bonus. 0 for Sigil. */
  baseDamage: number;
  /** Sum of "increased" from runes (0 in M2). The runtime adds character and gear sources. */
  increased: number;
  /** Every "more"/"less" multiplier in order: this spell's modifiers in slot order, then branch penalties from the top of the tree down. */
  more: MoreMult[];
  /** Product of `more`. */
  moreProduct: number;
  /** Form crit + Keen + element bonuses (Storm). */
  critChance: number;
  /** Base crit multiplier (tuning, 1.5) + Keen. */
  critMultiplier: number;
  /** Knockback distance in cells (× Gale). */
  knockback: number;
  /** Instances per cast of this spell (Split: 3). Spawn them in `rotations` order. */
  instances: {
    count: number;
    /** Total fan in degrees (0 for one instance). */
    fanDeg: number;
    /** One per instance: rotate the aim direction by it. Bolt rotates its velocity; Lob rotates its aim point about its origin. */
    rotations: Rotation[];
  };
  /** Extra targets passed through (Bolt, Beam). 0 = stops on the first hit. */
  pierce: number;
  /** Chain: after a hit, jumps to `count` more targets within `range`; jump k deals (1 − lessPerChain)^k. */
  chain: { count: number; range: number; lessPerChain: number } | null;
  /** Fork (Bolt): on first hit, splits into one bolt per rotation (relative to its direction) with `life` seconds. */
  fork: { count: number; rotations: Rotation[]; life: number } | null;
  /** Return (Bolt): at end of life, flies back to the caster and can hit again. */
  returns: boolean;
  /** Seeker (Bolt): turn toward the nearest enemy by at most `tickRotation` (or its inverse) per tick; snap when closer. */
  seeker: { turnRateDeg: number; tickRotation: Rotation } | null;
  /** Echo: repeat the spell (with its branches) `delay` s later from the same origin and aim, damage × `damageMult`. */
  echo: { delay: number; damageMult: number } | null;
  /** Ailment duration multiplier (Lingering 1.3). */
  ailmentDurationMult: number;
  /** Area multiplier applied (Wide 1.4 × Focus 0.7); lengths and radii were scaled by its square root. */
  areaMult: number;
  /** Terrain (M3): footprint, its area mult vs. the base footprint (Saturate 2), duration mult (Lingering 1.5). */
  terrain: { footprint: ResolvedFootprint; areaMult: number; durationMult: number };
  /** May hit the entity it spawned from (branch target, On Crit target). False for Bolt, Beam, Orb (DESIGN §5.3). */
  canHitSource: boolean;
  /** This spell's mana including its branches: form mana × Π item mana mults + 0.5 × Σ children's manaCost. */
  manaCost: number;
  /** Complexity of this spell's own runes (form + items), excluding branch runes. */
  complexity: number;
  /** Branch spells, in tree order (dispatch in this order when several proc on one event). */
  children: BranchSpec[];
}

/** How a branch fires (CONTENT §1.5), resolved for its parent. */
export type ProcRule =
  /** Fire on hits, at most `maxProcsPerInstance` per parent instance (3 with Pierce or Chain). Area forms: first target only. */
  | { kind: 'on_hit'; maxProcsPerInstance: number; firstTargetOnly: boolean }
  /** Fire once when the instance ends: life runs out, it stops on an enemy, or it hits a wall. */
  | { kind: 'on_expire'; maxProcsPerInstance: number }
  /** Fire once per enemy the parent kills. */
  | { kind: 'on_kill' }
  /** Fire every `interval` s while the parent lives, at the nearest enemy within `aimRange`; skip if none. */
  | { kind: 'emit'; interval: number; aimRange: number };

export interface BranchSpec {
  branch: BranchId;
  proc: ProcRule;
  origin: BranchOrigin;
  aim: BranchAim;
  /** This branch rune's damage penalty (also listed in the child's `more`). */
  damageMult: number;
  /** Branch rune complexity at this depth (base + 1 per depth beyond 1). */
  complexity: number;
  spec: SpellSpec;
}

/** Costs shown in the Loom (DESIGN §5.4). */
export interface WeaveCosts {
  complexity: number;
  capacity: number;
  mana: number;
  castTime: number;
}
