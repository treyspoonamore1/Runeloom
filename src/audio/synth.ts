import type { SfxDef, ZzfxLayer, ZzfxShape } from '../../data/sfx';

/** The 21 positional ZzFX arguments, in ZzFX 1.4 order. */
export type ZzfxArgs = number[];

const SHAPES: Record<ZzfxShape, number> = { sine: 0, triangle: 1, saw: 2, tan: 3, noise: 4, square: 5 };

/** Converts a named layer to ZzFX's positional arguments (volume … filter). `at` is not a ZzFX argument. */
export function layerToArgs(l: ZzfxLayer): ZzfxArgs {
  return [
    l.volume ?? 1,
    l.randomness ?? 0.02,
    l.frequency,
    l.attack ?? 0,
    l.sustain ?? 0,
    l.release ?? 0.1,
    SHAPES[l.shape ?? 'sine'],
    l.shapeCurve ?? 1,
    l.slide ?? 0,
    l.deltaSlide ?? 0,
    l.pitchJump ?? 0,
    l.pitchJumpTime ?? 0,
    l.repeatTime ?? 0,
    l.noise ?? 0,
    l.modulation ?? 0,
    l.bitCrush ?? 0,
    l.delay ?? 0,
    l.sustainVolume ?? 1,
    l.decay ?? 0,
    l.tremolo ?? 0,
    l.filter ?? 0,
  ];
}

export type SampleBuilder = (...args: ZzfxArgs) => ArrayLike<number>;

/**
 * Renders every layer with `build` (ZZFX.buildSamples), sums them at their start offsets and
 * scales the result so its loudest sample is `def.gain` (0 to 1). Returns mono samples.
 */
export function mixSfx(def: SfxDef, build: SampleBuilder, sampleRate: number): Float32Array {
  const parts = def.layers.map((l) => ({
    offset: Math.max(0, Math.round((l.at ?? 0) * sampleRate)),
    samples: build(...layerToArgs(l)),
  }));
  let length = 0;
  for (const p of parts) length = Math.max(length, p.offset + p.samples.length);
  const out = new Float32Array(length);
  for (const p of parts) for (let i = 0; i < p.samples.length; i++) out[p.offset + i]! += p.samples[i]!;
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]!));
  if (peak > 0) {
    const k = def.gain / peak;
    for (let i = 0; i < out.length; i++) out[i]! *= k;
  }
  return out;
}
