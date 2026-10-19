/**
 * Visual feel values for entities on the chemistry grid (M3 phase B: DESIGN §6.3 rules 11–19,
 * 22, 25; §6.4 Wet, Oiled, Blind): wet drips and gloss, oil sheen, falls, charge hits, arcs,
 * doused Tinderlings, scorched shields, blindness and ice. Purely presentational. Lengths in
 * cells, times in seconds, rates per second.
 */
export const CREATURE = {
  // ---- Wet --------------------------------------------------------------------------------------
  /** Body tint while Wet (darker, cooler) and how much of it is mixed in. */
  wetTint: 0x6f8fb8,
  wetTintMix: 0.38,
  /** Drips per second falling off a wet body, and their color. */
  dripRate: 5,
  drip: 0x8fd0ff,
  /** Gloss highlight on a wet body: peak alpha and pulse rate (Hz). */
  glossAlpha: 0.75,
  glossHz: 1.3,

  // ---- Oiled ------------------------------------------------------------------------------------
  /** Body tint while Oiled (dark, slick) and how much of it is mixed in. */
  oilTint: 0x6a5a78,
  oilTintMix: 0.4,
  /** Iridescent sheen: alpha and hue cycle speed (turns per second). */
  sheenAlpha: 0.6,
  sheenSpeed: 0.35,
  /** Oiled and Ignited (rule 18, burns twice as hard): flame scale, deeper flame tint, danger glow and black smoke. */
  oilFireScale: 1.4,
  oilFireTint: 0xff8a62,
  oilFireGlow: 0xff3a14,
  oilFireGlowAlpha: 0.65,
  oilSmokeRate: 7,
  oilSmoke: 0x2a2228,

  // ---- Falls (rule 25) --------------------------------------------------------------------------
  /** Seconds the body takes to shrink into the gap, then the respawn pop at the safe spot. */
  fallTime: 0.42,
  popTime: 0.26,
  /** Tint the falling body fades toward: a pit, or deep water. */
  pitTint: 0x1a1218,
  waterTint: 0x2a5f9a,
  splash: 0xcfefff,

  // ---- Charge hits (rules 11, 12): cyan-white, distinct from Shock's violet and yellow -------------
  charge: 0xc8f6ff,
  chargeGlow: 0x5fd8ff,
  /** Seconds the body crackles after a charge hit. */
  chargeCrackle: 0.28,

  // ---- Arcs (rule 19) ---------------------------------------------------------------------------
  /** Seconds an arc stays lit, and the length of one jagged segment (cells). */
  arcLife: 0.15,
  arcSegment: 3.2,

  // ---- Tinderling doused / relit ----------------------------------------------------------------
  /** Grey body while doused: tint and mix. */
  dousedTint: 0x8a8a90,
  dousedMix: 0.35,
  /** Ash wash over a doused Tinderling (its dark coal can't be greyed by a tint alone). */
  ash: 0xa8a4a6,
  ashAlpha: 0.5,
  steam: 0xe8eef2,

  // ---- Shieldbearer shield ----------------------------------------------------------------------
  /** Embers shed by a scorching shield per second at full scorch. */
  shieldEmberRate: 6,
  charred: 0x3a2a22,

  // ---- Blind ------------------------------------------------------------------------------------
  /** Screen-edge haze while the player stands in smoke or steam: peak alpha and tints. */
  hazeAlpha: 0.32,
  hazeSmoke: 0x6a6070,
  hazeSteam: 0xdfe8ee,

  // ---- Ice --------------------------------------------------------------------------------------
  /** Slide streaks per second while moving on ice, minimum speed (cells/s) and color. */
  iceStreakRate: 14,
  iceMinSpeed: 3,
  ice: 0xe6f8ff,

  // ---- Status icon colors -----------------------------------------------------------------------
  iconWet: 0x6fc4ff,
  iconBlind: 0xe8e0f0,
} as const;

/** Hue (turns, 0–1) to a bright, slightly pastel RGB, for the oil sheen. */
export function hueRgb(h: number): number {
  const f = (n: number): number => {
    const k = (n + h * 6) % 6;
    const v = 1 - Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(255 * (0.55 + 0.45 * v));
  };
  return (f(5) << 16) | (f(3) << 8) | f(1);
}
