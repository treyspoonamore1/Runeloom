import type { EnemyKind } from '../../data/enemies';
import { ELEMENT } from './combatPalette';

/**
 * Visual constants for entity ailments (DESIGN §6.4, §14): Ignite, Chill, Freeze and Shock on
 * enemies and the player, their status icons, shatter and DoT numbers. Purely presentational.
 * Lengths in cells, times in seconds, rates per second.
 */
export const AIL = {
  // ---- Ignite ----------------------------------------------------------------------------------
  fire: ELEMENT.fire,
  fireInner: 0xffc94a,
  fireCore: 0xfff2c8,
  /** Ignite dps ÷ max life at which the flames reach full size (a bolt for ~40% of life). */
  igniteFull: 0.2,
  /** Smallest flame intensity (a weak ignite still reads). */
  igniteMin: 0.35,
  /** Warm glow under a burning body: scale per body half-width and peak alpha. */
  igniteGlowScale: 2.1,
  igniteGlowAlpha: 0.5,
  /** Embers shed per second at full intensity, standing and running. */
  emberRate: 7,
  emberRunRate: 22,
  /** Warm tint mixed into a burning body. */
  igniteTint: 0xffd2b0,

  // ---- Chill / Freeze --------------------------------------------------------------------------
  frost: ELEMENT.frost,
  /** Body tint at full chill (mixed in proportionally) and while frozen. */
  chillTint: 0x6aa8ff,
  chillTintMax: 0.7,
  frozenTint: 0xb4e2ff,
  /** Chill above which frost crystals grow on the body, and points per extra crystal. */
  crystalFrom: 30,
  crystalStep: 22,
  /** Frost flakes drifting off a chilled body per second at full chill. */
  flakeRate: 5,
  ice: 0xc8f2ff,
  iceDeep: 0x5fb6e6,
  iceRim: 0x24506e,
  /** Freeze start: crystallize flash seconds. Thaw: crack-and-melt seconds. */
  freezeFlash: 0.18,
  meltTime: 0.38,
  water: 0x7fd0ff,

  // ---- Shock -----------------------------------------------------------------------------------
  storm: ELEMENT.storm,
  stormGlow: ELEMENT.stormGlow,
  /** Arcs jumping across the body: re-rolls per second at the weakest and strongest shock. */
  zapRateMin: 7,
  zapRateMax: 20,
  /** Seconds one arc stays lit. */
  zapLife: 0.06,

  // ---- Shatter ---------------------------------------------------------------------------------
  shatterShards: 16,

  // ---- Status icons (DESIGN §14), in screen pixels at 720p ---------------------------------------
  /** Icon size, gap between items, and height of the row's middle above the body's top. */
  icon: 13,
  iconGap: 2,
  iconLift: 8,
  /** Chill meter width and height. */
  meterW: 17,
  meterH: 5,
  /** Shock digits: height and advance. */
  digitH: 11,
  digitAdvance: 6.5,

  // ---- Player ----------------------------------------------------------------------------------
  /** Screen-edge tint while the player burns or is frozen: peak alpha. */
  edgeBurn: 0.24,
  edgeFrozen: 0.32,
  edgeChill: 0.08,

  /** Global cap on ailment particles spawned per second (embers, flakes, sparks), so 300 burning enemies stay cheap. */
  spawnBudget: 450,
} as const;

/**
 * Where effects sit on each body, relative to its collision center (the view's root origin):
 * half-width, top of the drawing (head or flames), bottom (feet) and a center height.
 */
export interface BodyBox {
  w: number;
  top: number;
  bottom: number;
}

export const BODY: Record<EnemyKind | 'player', BodyBox> = {
  tinderling: { w: 1.25, top: -2.0, bottom: 1.0 },
  shieldbearer: { w: 1.95, top: -2.9, bottom: 1.9 },
  ember_archer: { w: 1.2, top: -2.7, bottom: 1.5 },
  dummy: { w: 1.2, top: -2.35, bottom: 1.6 },
  player: { w: 1.45, top: -2.05, bottom: 1.45 },
};

/** Extra height of the status row over kinds whose drawing pokes above `top` (Tinderling flames). */
export const ICON_EXTRA: Partial<Record<EnemyKind, number>> = { tinderling: 0.4 };

/** Mixes `rgb` toward `to` by t (0–1). */
export function mixRgb(rgb: number, to: number, t: number): number {
  const r = (rgb >> 16) & 255;
  const g = (rgb >> 8) & 255;
  const b = rgb & 255;
  const r2 = (to >> 16) & 255;
  const g2 = (to >> 8) & 255;
  const b2 = to & 255;
  return (
    (Math.round(r + (r2 - r) * t) << 16) | (Math.round(g + (g2 - g) * t) << 8) | Math.round(b + (b2 - b) * t)
  );
}
