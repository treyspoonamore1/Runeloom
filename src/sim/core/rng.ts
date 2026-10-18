import { hashString } from './hash';

export type RngState = [number, number, number, number];

/**
 * Seeded sfc32 generator. The only source of randomness allowed in src/sim.
 * Use fork(label) to give a system its own stream, so adding random calls in
 * one system doesn't shift the sequence another system sees.
 */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    // splitmix32 expands the seed into 4 well-mixed words.
    let s = seed >>> 0;
    const mix = (): number => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = mix();
    this.b = mix();
    this.c = mix();
    this.d = mix();
    for (let i = 0; i < 12; i++) this.nextU32();
  }

  static fromState(state: Readonly<RngState>): Rng {
    const r = new Rng(0);
    [r.a, r.b, r.c, r.d] = state;
    return r;
  }

  getState(): RngState {
    return [this.a, this.b, this.c, this.d];
  }

  /** Uniform 32-bit unsigned integer. */
  nextU32(): number {
    const t0 = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    const t = (t0 + this.d) | 0;
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform float in [0, 1). */
  float(): number {
    return this.nextU32() / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.float();
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.float() * n);
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.float() < p;
  }

  /** A new independent stream. Advances this stream by one step. */
  fork(label: string): Rng {
    return new Rng((this.nextU32() ^ hashString(label)) >>> 0);
  }
}
