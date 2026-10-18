import type { DamageAmounts, DamageType } from '../../data/combatTypes';
import { spells } from '../../data/spells';
import type { AtlasEntry } from './atlas';
import { ELEMENT, FX, INK, PROJ } from './combatPalette';
import type { Pen } from './pen';

/**
 * Per-element looks shared by every spell form (DESIGN §14 element colors). Form views (bolt
 * today; Nova, Beam, Lob, Orb, Swath, Sigil later) pick their colors and textures here by the
 * spell's dominant damage type, so a new element or form only touches this table.
 */
export interface ElementLook {
  /** Bright center, rim and halo colors. */
  core: number;
  rim: number;
  glow: number;
  glowAlpha: number;
  /** Trail streak color and alpha. */
  trail: number;
  trailAlpha: number;
  /** Colors of sparks, embers and hit bursts. */
  sparks: readonly number[];
  /** Atlas texture of a projectile's core, pointing +x. */
  boltCore: string;
  /** In-flight particles: 'ember' (rise and fade), 'flake' (drift), 'spark' (crackle). */
  shed: 'ember' | 'flake' | 'spark';
  /** The core jitters and flickers (storm). */
  crackle: boolean;
}

const LOOKS: Record<DamageType, ElementLook> = {
  fire: {
    core: PROJ.boltCore,
    rim: PROJ.boltRim,
    glow: PROJ.boltGlow,
    glowAlpha: 0.45,
    trail: PROJ.boltTrail,
    trailAlpha: 0.9,
    sparks: [PROJ.boltCore, PROJ.boltRim, 0xffe9a0],
    boltCore: 'bolt_core',
    shed: 'ember',
    crackle: false,
  },
  frost: {
    core: 0xeafcff,
    rim: ELEMENT.frost,
    glow: ELEMENT.frost,
    glowAlpha: 0.4,
    trail: 0xbfeeff,
    trailAlpha: 0.75,
    sparks: [ELEMENT.frost, 0xe6fbff, 0xffffff],
    boltCore: 'bolt_frost',
    shed: 'flake',
    crackle: false,
  },
  storm: {
    core: 0xfffbe0,
    rim: ELEMENT.storm,
    glow: ELEMENT.stormGlow,
    glowAlpha: 0.55,
    trail: ELEMENT.stormGlow,
    trailAlpha: 0.7,
    sparks: [ELEMENT.storm, ELEMENT.stormGlow, 0xffffff],
    boltCore: 'bolt_storm',
    shed: 'spark',
    crackle: true,
  },
  physical: {
    core: 0xffffff,
    rim: FX.ivory,
    glow: FX.ivory,
    glowAlpha: 0.3,
    trail: FX.ivory,
    trailAlpha: 0.6,
    sparks: [FX.ivory, 0xffffff, FX.spark],
    boltCore: 'bolt_plain',
    shed: 'ember',
    crackle: false,
  },
};

/** The look of a bolt (and, for now, any form) of this element. */
export function boltLook(element: DamageType): ElementLook {
  return LOOKS[element];
}

/** The damage type with the largest share (ties go to the first in fire, frost, storm, physical). */
export function dominantType(amounts: DamageAmounts): DamageType {
  let best: DamageType = 'physical';
  let v = amounts.physical;
  for (const t of ['storm', 'frost', 'fire'] as const) {
    if (amounts[t] >= v && amounts[t] > 0) {
      best = t;
      v = amounts[t];
    }
  }
  return best;
}

/** Element of a spell by id, from its damage shares (fire for unknown ids). */
export function spellElement(id: string): DamageType {
  const def = (spells as Record<string, { shares?: Partial<DamageAmounts> }>)[id];
  if (!def?.shares) return 'fire';
  const s = def.shares;
  return dominantType({ physical: s.physical ?? 0, fire: s.fire ?? 0, frost: s.frost ?? 0, storm: s.storm ?? 0 });
}

// ---- Baked cores for the non-fire bolts ------------------------------------------------------

/** Icy shard: a long faceted diamond with a white edge. */
function frostCore(p: Pen): void {
  const pts = [1.25, 0, 0.15, -0.55, -0.95, 0, 0.15, 0.55];
  p.poly(pts).fill(ELEMENT.frost).stroke(0.14, INK);
  p.poly([1.25, 0, 0.15, -0.55, -0.1, 0]).fill(0xeafcff);
  p.poly([1.25, 0, -0.1, 0, 0.15, 0.55]).fill({ color: 0x6fc4ea, alpha: 0.9 });
  p.moveTo(-0.6, 0).lineTo(0.9, 0).stroke(0.06, 0xffffff, 0.9);
}

/** Crackling spark: a jagged star with a white-hot center. */
function stormCore(p: Pen): void {
  const pts: number[] = [];
  const R = [1.1, 0.42, 0.85, 0.38, 1.0, 0.45, 0.8, 0.4, 0.95, 0.36];
  for (let i = 0; i < R.length; i++) {
    const a = (i / R.length) * Math.PI * 2;
    pts.push(Math.cos(a) * R[i]!, Math.sin(a) * R[i]!);
  }
  p.poly(pts).fill(ELEMENT.storm).stroke(0.13, INK);
  p.circle(0.05, 0, 0.36).fill(0xfffbe0);
}

function plainCore(p: Pen): void {
  p.circle(0, 0, 0.9).fill(FX.ivory).stroke(0.14, INK);
  p.circle(0.15, 0, 0.45).fill(0xffffff);
}

export function elementAtlasEntries(): AtlasEntry[] {
  return [
    { name: 'bolt_frost', x0: -1.1, y0: -0.7, x1: 1.4, y1: 0.7, draw: frostCore },
    { name: 'bolt_storm', x0: -1.2, y0: -1.2, x1: 1.2, y1: 1.2, draw: stormCore },
    { name: 'bolt_plain', x0: -1, y0: -1, x1: 1, y1: 1, draw: plainCore },
  ];
}
