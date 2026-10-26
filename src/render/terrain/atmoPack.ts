import { AIR } from '../../../data/materials';
import { WIND_DX, WIND_DY } from '../../sim/grid/windDir';
import type { Grid } from '../../sim';
import { TERRAIN_FX } from './terrainColors';
import { GRID_HZ } from './terrainPack';

/**
 * Packs the M8 grid fields (DESIGN §6.1, §6.5, §6.6) into two RGBA8 textures for the terrain
 * shaders, one texel per cell. Pure TypeScript, no Pixi; the view uploads them.
 *
 *   atmo  (linear)   R fog density · G gust strength · B gust x · A gust y   (0.5 = 0)
 *   extra (nearest)  R under code · G borrowed expiry (0 = not in its last seconds) · B borrowed · A 0
 *
 * Fog: an `air = fog` cell is full; a cleared fog cell (no air, fog mask, timer counting to its
 * return) thickens back over its last `fogReturnTicks`; smoke or steam on a fog cell hides it.
 * Gust strength fades with `gustTimer`. Expiry rises from 1 to 255 over a borrowed cell's last
 * `borrowedFlickerSeconds` (DESIGN §6.5: "the last 1.5 s of borrowed terrain flickers").
 * Rooms with no fog, gust or borrowed cell pack once and then skip.
 */

const FLICKER_TICKS = Math.round(TERRAIN_FX.borrowedFlickerSeconds * GRID_HZ);
const RETURN_TICKS = Math.round(TERRAIN_FX.fogReturnSeconds * GRID_HZ);
const GUST_FULL_TICKS = Math.round(TERRAIN_FX.gustFullSeconds * GRID_HZ);

/** Gust direction → packed x and y bytes (unit vectors, diagonals normalized). */
const DIR_X = new Uint8Array(9);
const DIR_Y = new Uint8Array(9);
for (let d = 0; d < 9; d++) {
  const len = Math.hypot(WIND_DX[d]!, WIND_DY[d]!) || 1;
  DIR_X[d] = Math.round(127.5 + 127.5 * (WIND_DX[d]! / len));
  DIR_Y[d] = Math.round(127.5 + 127.5 * (WIND_DY[d]! / len));
}

function anyWord(a: Uint8Array): boolean {
  const n = a.byteLength >> 2;
  const v = a.byteOffset % 4 === 0 ? new Uint32Array(a.buffer, a.byteOffset, n) : null;
  if (v) {
    for (let j = 0; j < n; j++) if (v[j] !== 0) return true;
    for (let i = n << 2; i < a.length; i++) if (a[i] !== 0) return true;
    return false;
  }
  for (let i = 0; i < a.length; i++) if (a[i] !== 0) return true;
  return false;
}

export class AtmoPack {
  readonly width: number;
  readonly height: number;
  readonly atmo: Uint8Array;
  readonly extra: Uint8Array;
  /** Changed texel ranges of the last pack: [start, end) (empty when start >= end). */
  readonly dirty = { atmo: [0, 0], extra: [0, 0] };
  /** The room has fog cells (its `@fog` mask is set somewhere). */
  hasFog = false;
  /** Any gust cell at the last pack. */
  gusts = false;
  /** Any borrowed cell at the last pack. */
  borrowed = false;
  private maskGrid: Grid | null = null;
  private clean = false;
  private readonly atmo32: Uint32Array;
  private readonly extra32: Uint32Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    const n = width * height;
    this.atmo = new Uint8Array(n * 4);
    this.extra = new Uint8Array(n * 4);
    this.atmo32 = new Uint32Array(this.atmo.buffer);
    this.extra32 = new Uint32Array(this.extra.buffer);
    this.clearAtmo();
  }

  /** Neutral gust vector (0.5, 0.5) everywhere, no fog. */
  private clearAtmo(): void {
    this.atmo32.fill(((128 << 16) | (128 << 24)) >>> 0);
  }

  /** True when the atmosphere pass has something to draw (fog, gusts) or room wind is on. */
  live(grid: Grid): boolean {
    return this.hasFog || this.gusts || grid.wind !== 0;
  }

  pack(grid: Grid): void {
    if (grid !== this.maskGrid) {
      this.maskGrid = grid;
      this.hasFog = anyWord(grid.fogMask);
      this.clean = false;
    }
    this.gusts = grid.gusts.length > 0 || anyWord(grid.gustTimer);
    this.borrowed = anyWord(grid.borrowed);
    const d = this.dirty;
    d.atmo[0] = d.atmo[1] = d.extra[0] = d.extra[1] = 0;
    if (!this.hasFog && !this.gusts && !this.borrowed) {
      if (this.clean) return;
      // Everything went quiet: one last pack writes the neutral values.
      this.clean = true;
    } else this.clean = false;

    const n = this.width * this.height;
    const { air, airTimer, gustDir, gustTimer, borrowed, timer, under, fogMask } = grid;
    const a32 = this.atmo32;
    const e32 = this.extra32;
    const aFog = AIR.fog;
    const aNone = AIR.none;
    const flicker = FLICKER_TICKS;
    const ret = RETURN_TICKS;
    const full = GUST_FULL_TICKS;
    let a0 = n;
    let a1 = 0;
    let e0 = n;
    let e1 = 0;
    for (let i = 0; i < n; i++) {
      // Fog.
      let fog = 0;
      const ai = air[i]!;
      if (ai === aFog) fog = 255;
      else if (ai === aNone && ((fogMask[i >> 3]! >> (i & 7)) & 1) === 1) {
        const t = airTimer[i]!;
        if (t > 0 && t < ret) fog = Math.round(255 * (1 - t / ret));
      }
      // Gusts.
      const gt = gustTimer[i]!;
      let gs = 0;
      let gx = 128;
      let gy = 128;
      if (gt > 0) {
        const dir = gustDir[i]!;
        if (dir > 0 && dir < 9) {
          gs = gt >= full ? 255 : Math.round((255 * gt) / full);
          gx = DIR_X[dir]!;
          gy = DIR_Y[dir]!;
        }
      }
      const aw = (fog | (gs << 8) | (gx << 16) | (gy << 24)) >>> 0;
      if (a32[i] !== aw) {
        a32[i] = aw;
        if (i < a0) a0 = i;
        a1 = i + 1;
      }
      // Borrowed terrain and its expiry.
      const b = borrowed[i]!;
      let exp = 0;
      if (b !== 0) {
        const t = timer[i]!;
        if (t > 0 && t <= flicker) exp = Math.max(1, Math.round(255 * (1 - t / flicker)));
      }
      const ew = (under[i]! | (exp << 8) | ((b !== 0 ? 255 : 0) << 16)) >>> 0;
      if (e32[i] !== ew) {
        e32[i] = ew;
        if (i < e0) e0 = i;
        e1 = i + 1;
      }
    }
    d.atmo[0] = a0;
    d.atmo[1] = a1;
    d.extra[0] = e0;
    d.extra[1] = e1;
  }
}

/** Unit vector of a wind direction (0: none). */
export function windVector(dir: number): [number, number] {
  if (dir <= 0 || dir > 8) return [0, 0];
  const len = Math.hypot(WIND_DX[dir]!, WIND_DY[dir]!);
  return [WIND_DX[dir]! / len, WIND_DY[dir]! / len];
}
