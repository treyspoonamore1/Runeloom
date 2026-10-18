/** Minimal typings for the parts of ZzFX 1.4 we use (the package ships none). */
declare module 'zzfx' {
  export const ZZFX: {
    volume: number;
    sampleRate: number;
    audioContext: AudioContext;
    buildSamples(...args: number[]): Float32Array;
  };
}
