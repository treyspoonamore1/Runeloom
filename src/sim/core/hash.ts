/**
 * FNV-1a (32-bit) over raw bytes. Used for state hashes (determinism checks,
 * debug overlay) and for deriving RNG fork seeds from labels.
 */
export class Hasher {
  private h = 0x811c9dc5;
  private readonly f64 = new Float64Array(1);
  private readonly f64Bytes = new Uint8Array(this.f64.buffer);

  byte(b: number): this {
    this.h ^= b & 0xff;
    this.h = Math.imul(this.h, 0x01000193) >>> 0;
    return this;
  }

  u32(n: number): this {
    const v = n >>> 0;
    this.byte(v)
      .byte(v >>> 8)
      .byte(v >>> 16)
      .byte(v >>> 24);
    return this;
  }

  /** Hashes the exact IEEE-754 bits, so -0, NaN payloads and tiny drifts all change the hash. */
  num(n: number): this {
    this.f64[0] = n;
    for (let i = 0; i < 8; i++) this.byte(this.f64Bytes[i]!);
    return this;
  }

  bool(b: boolean): this {
    return this.byte(b ? 1 : 0);
  }

  bytes(view: ArrayBufferView): this {
    const u8 = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    for (let i = 0; i < u8.length; i++) this.byte(u8[i]!);
    return this;
  }

  string(s: string): this {
    for (let i = 0; i < s.length; i++) this.u32(s.charCodeAt(i));
    return this;
  }

  digest(): number {
    return this.h >>> 0;
  }

  hex(): string {
    return this.digest().toString(16).padStart(8, '0');
  }
}

export function hashString(s: string): number {
  return new Hasher().string(s).digest();
}
