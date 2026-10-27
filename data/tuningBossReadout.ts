/**
 * How the Fen bosses' states read (playtest 8; render feel only, the sim never reads these):
 * the pop label over the Coil entering Stranded, Iced or Overloaded (render/bossPops.ts), and
 * the Glasswater Coil's Submerged, Surfaced and Exposed looks (render/bestiary/coilRig.ts).
 */
export const bossReadoutTuning = {
  /** Seconds the pop label ("STRANDED", "ICED") stays over the boss. */
  popSeconds: 1.6,
  /** Pop label height, pixels at 720p. */
  popSize: 30,
  /** Cells the pop label rises over its life. */
  popRise: 2.5,
  /** Cells above the boss's center the pop label starts (plus its radius). */
  popLift: 2,
  /** Coil Submerged: the body's opacity, 0–1. */
  coilSubmergedAlpha: 0.55,
  /** Coil Submerged: how far its body is tinted toward the deep water's color, 0–1. */
  coilSubmergedTint: 0.7,
  /** Coil Submerged: opacity of the water film over its body, 0–1. */
  coilWaterVeil: 0.5,
  /** Coil Submerged: ripples per second along its body. */
  coilRippleRate: 6,
  /** Coil Surfaced or Exposed: how far its body is brightened toward white, 0–1. */
  coilSurfacedBright: 0.2,
  /** Coil: droplets in the splash when it breaks the surface. */
  coilSplash: 18,
  /** Coil Surfaced (out of deep water's cover): foam rings per second around its head. */
  coilFoamRate: 4,
};
