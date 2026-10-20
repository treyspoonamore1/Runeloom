import { AIR, MAT, OWNER, SURFACE, materials, materialByCode } from '../../../data/materials';
import { GRID_EVERY, SIM_HZ, TILE_CELLS, type Grid } from '../../sim';
import { TERRAIN_FX } from './terrainColors';

/**
 * Packs the chemistry grid into RGBA8 data textures for the terrain shader (DESIGN §12). Pure
 * TypeScript, no Pixi: the view uploads the buffers. Every buffer is a Uint8Array with a
 * Uint32Array view, one texel per cell (row-major, like the grid), written as one 32-bit word per
 * texel (little-endian: byte 0 = R).
 *
 *   codes  (nearest)  R display ground · G flags (oil, tar, owner, air, ember, over water) · B phase · A true ground
 *   fields (linear)   R fire · G charge strength · B smoke · A steam      (two copies: prev/cur)
 *   masks  (linear)   R oil · G wet · B hazard (fire or charge, any owner) · A hostile hazard
 *   glow   (linear, one texel per tile, blurred)  R fire · G charge · B smoke · A steam
 *
 * "Display ground" is what the floor shader paints: props (crates, barrels, barricades, braziers,
 * objects) are drawn by the baked prop layer, so the floor under them shows their `under`
 * material (or stone). "Hostile" = owned by world or enemy: those hazards get the pulsing edge
 * (DESIGN §14).
 */

/** Bits of the codes G channel. */
export const FLAG = {
  oil: 1,
  /** Bits 1–2: OWNER code. */
  ownerShift: 1,
  /** Bits 3–4: AIR code. */
  airShift: 3,
  /** B holds the low byte of the grid tick the cell's fire went out (embers). */
  ember: 32,
  /** Wood over deep water (a bridge), not over a pit. */
  overWater: 64,
  /** The oil is the Tar Matriarch's tar (grid.tar): fire on it is world-owned. */
  tar: 128,
} as const;

export const GRID_HZ = SIM_HZ / GRID_EVERY;

const PROP_CODES = new Set<number>([MAT.crate, MAT.barricade, MAT.oil_barrel, MAT.brazier, MAT.object]);
/** Raised blocks the baked layer draws; a change in their count re-bakes it. */
const BLOCK_CODES = new Set<number>([MAT.wall, MAT.metal_pylon, MAT.object, MAT.brazier]);

const isProp = new Uint8Array(256);
const isBlock = new Uint8Array(256);
for (const c of PROP_CODES) isProp[c] = 1;
for (const c of BLOCK_CODES) isBlock[c] = 1;

const CRACK_TICKS = Math.round((materials.ice_bridge.crackSeconds ?? 1.5) * GRID_HZ);
const THAW_TICKS = Math.round(TERRAIN_FX.thawShowSeconds * GRID_HZ);
const EMBER_TICKS = Math.round(TERRAIN_FX.emberSeconds * GRID_HZ);

export class TerrainPack {
  readonly width: number;
  readonly height: number;
  readonly tilesW: number;
  readonly tilesH: number;
  readonly codes: Uint8Array;
  /** fields[cur] is the newest upload, fields[1 - cur] the one before. */
  readonly fields: [Uint8Array, Uint8Array];
  cur = 0;
  readonly masks: Uint8Array;
  readonly glow: Uint8Array;
  /** Changed texel range of the last pack, per buffer: [start, end) (empty when start >= end). */
  readonly dirty = { codes: [0, 0], fields: [0, 0], masks: [0, 0] };
  /** Count of raised-block cells; the baked layer re-bakes when it changes. */
  blockCells = 0;
  /** True while any cell shows embers, so the view repacks before the 8-bit tick wraps. */
  embersLive = false;

  private readonly codes32: Int32Array;
  private readonly fields32: [Int32Array, Int32Array];
  private readonly masks32: Int32Array;
  private readonly prevFire: Uint8Array;
  /** Grid tick + 1 when the cell's fire went out (0 = none). Render-side memory, not sim state. */
  private readonly emberTick: Uint32Array;
  private readonly glowAcc: Float32Array;
  private readonly glowTmp: Float32Array;
  /**
   * Quiet-word fast path: per 4-cell word, how many packs in a row it was quiet (no fire,
   * charge, air, wet, oil, timer or embers) with unchanged ground/owner/air/under (saturates at 2).
   * A word quiet for 2 packs holds its values in both field buffers, so it can be skipped.
   */
  private readonly quiet: Uint8Array;
  /** Ground, owner, air, under as of the last pack, to detect changes word by word. */
  private readonly last: { ground: Uint8Array; owner: Uint8Array; air: Uint8Array; under: Uint8Array };
  private readonly last32: { ground: Uint32Array; owner: Uint32Array; air: Uint32Array; under: Uint32Array };
  private readonly prevFire32: Uint32Array;
  private viewGrid: Grid | null = null;
  private views: Uint32Array[] | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tilesW = Math.ceil(width / TILE_CELLS);
    this.tilesH = Math.ceil(height / TILE_CELLS);
    const n = width * height;
    this.codes = new Uint8Array(n * 4);
    this.fields = [new Uint8Array(n * 4), new Uint8Array(n * 4)];
    this.masks = new Uint8Array(n * 4);
    this.glow = new Uint8Array(this.tilesW * this.tilesH * 4);
    this.codes32 = new Int32Array(this.codes.buffer);
    this.fields32 = [new Int32Array(this.fields[0].buffer), new Int32Array(this.fields[1].buffer)];
    this.masks32 = new Int32Array(this.masks.buffer);
    this.prevFire = new Uint8Array(n);
    this.emberTick = new Uint32Array(n);
    this.glowAcc = new Float32Array(this.tilesW * this.tilesH * 4);
    this.glowTmp = new Float32Array(this.tilesW * this.tilesH * 4);
    this.quiet = new Uint8Array(n >> 2);
    this.last = {
      ground: new Uint8Array(n),
      owner: new Uint8Array(n),
      air: new Uint8Array(n),
      under: new Uint8Array(n),
    };
    this.last32 = {
      ground: new Uint32Array(this.last.ground.buffer),
      owner: new Uint32Array(this.last.owner.buffer),
      air: new Uint32Array(this.last.air.buffer),
      under: new Uint32Array(this.last.under.buffer),
    };
    this.prevFire32 = new Uint32Array(this.prevFire.buffer, 0, n >> 2);
  }

  /**
   * 32-bit views of the grid's arrays (4 cells per word; timer 2 per word), or null when the
   * layout doesn't allow them. Built once per grid object.
   */
  private wordViews(grid: Grid): Uint32Array[] | null {
    if (grid === this.viewGrid) return this.views;
    this.viewGrid = grid;
    this.quiet.fill(0);
    const n = this.width * this.height;
    const arrays = [
      grid.fire,
      grid.charge,
      grid.airTimer,
      grid.wet,
      grid.surface,
      grid.ground,
      grid.owner,
      grid.air,
      grid.under,
    ];
    const ok =
      this.width % 4 === 0 && arrays.every((a) => a.byteOffset % 4 === 0) && grid.timer.byteOffset % 4 === 0;
    this.views = ok
      ? [
          ...arrays.map((a) => new Uint32Array(a.buffer, a.byteOffset, n >> 2)),
          new Uint32Array(grid.timer.buffer, grid.timer.byteOffset, n >> 1),
        ]
      : null;
    return this.views;
  }

  /**
   * Packs the whole grid. Writes into the older fields buffer and makes it current, so the
   * shader can blend from the previous upload to this one. Allocation-free.
   */
  pack(grid: Grid): void {
    const n = this.width * this.height;
    const { ground, surface, air, fire, charge, airTimer, timer, wet, under, owner } = grid;
    // Rule 11 falloff (0.25–1; 1 on metal). Grids built before the rules engine may lack it.
    const falloff: Float32Array | undefined = grid.chargeFalloff;
    // M4 Tar Matriarch tar marks; grids built by older fixtures may lack them.
    const tar: Uint8Array | undefined = grid.tar;
    const next = 1 - this.cur;
    const codes32 = this.codes32;
    const fields32 = this.fields32[next]!;
    const masks32 = this.masks32;
    const prevFire = this.prevFire;
    const emberTick = this.emberTick;
    const tick = grid.tick;
    const acc = this.glowAcc;
    acc.fill(0);
    const w = this.width;
    const tw = this.tilesW;
    let c0 = n;
    let c1 = 0;
    let f0 = n;
    let f1 = 0;
    let m0 = n;
    let m1 = 0;
    let blocks = 0;
    let embers = false;
    // Constants as locals: the hot loop runs once per cell.
    const mStone = MAT.stone;
    const mWood = MAT.wood;
    const mDeep = MAT.deep_water;
    const mIce = MAT.ice;
    const mBridge = MAT.ice_bridge;
    const sOil = SURFACE.oil;
    const aSmoke = AIR.smoke;
    const aSteam = AIR.steam;
    const oPlayer = OWNER.player;
    const fOil = FLAG.oil;
    const fTar = FLAG.tar;
    const fOverWater = FLAG.overWater;
    const fEmber = FLAG.ember;
    const ownerShift = FLAG.ownerShift;
    const airShift = FLAG.airShift;
    const crackTicks = CRACK_TICKS;
    const thawTicks = THAW_TICKS;
    const emberTicks = EMBER_TICKS;
    const chargeFade = TERRAIN_FX.chargeFadeTicks;
    const chargeMin = TERRAIN_FX.chargeMinStrength;
    const airScale = TERRAIN_FX.airFadeScale;
    const wetScale = TERRAIN_FX.wetFadeScale;
    const tc = TILE_CELLS;
    const propLut = isProp;
    const blockLut = isBlock;

    const views = this.wordViews(grid);
    const quiet = this.quiet;
    const last32 = this.last32;
    const prevFire32 = this.prevFire32;
    let quietNow = false;

    const h = this.height;
    let i = 0;
    for (let cy = 0; cy < h; cy++) {
      const rowTile = ((cy / tc) | 0) * tw;
      for (let cx = 0; cx < w; cx++, i++) {
        if (views !== null && (cx & 3) === 0) {
          // Fast path: a whole quiet, unchanged 4-cell word.
          const j = i >> 2;
          quietNow =
            (views[0]![j]! |
              views[1]![j]! |
              views[2]![j]! |
              views[3]![j]! |
              views[4]![j]! |
              prevFire32[j]!) ===
              0 &&
            (views[9]![j * 2]! | views[9]![j * 2 + 1]!) === 0 &&
            (emberTick[i]! | emberTick[i + 1]! | emberTick[i + 2]! | emberTick[i + 3]!) === 0 &&
            views[5]![j] === last32.ground[j] &&
            views[6]![j] === last32.owner[j] &&
            views[7]![j] === last32.air[j] &&
            views[8]![j] === last32.under[j];
          if (quietNow && quiet[j]! >= 2) {
            blocks +=
              blockLut[ground[i]!]! +
              blockLut[ground[i + 1]!]! +
              blockLut[ground[i + 2]!]! +
              blockLut[ground[i + 3]!]!;
            i += 3;
            cx += 3;
            continue;
          }
        }
        const g = ground[i]!;
        const f = fire[i]!;
        const ch = charge[i]!;
        const o = owner[i]!;
        const a = air[i]!;
        blocks += blockLut[g]!;

        // Codes.
        let disp = g;
        if (propLut[g] === 1) {
          const u = under[i]!;
          disp = propLut[u] === 1 ? mStone : u;
        }
        let flags = (o << ownerShift) | (a << airShift);
        if (surface[i] === sOil) flags |= tar !== undefined && tar[i] === 1 ? fOil | fTar : fOil;
        if (g === mWood && under[i] === mDeep) flags |= fOverWater;
        let phase = 0;
        const t = timer[i]!;
        if (g === mBridge) {
          if (t > 0 && t <= crackTicks) phase = Math.round(255 * (1 - t / crackTicks));
        } else if (g === mIce) {
          if (t > 0 && t <= thawTicks) phase = Math.round(255 * (1 - t / thawTicks));
        } else {
          // Embers: remember when the fire went out; the shader fades them by age.
          if (f === 0 && prevFire[i]! > 0) emberTick[i] = tick + 1;
          const et = emberTick[i]!;
          if (et !== 0) {
            if (tick + 1 - et > emberTicks || f > 0) emberTick[i] = 0;
            else {
              flags |= fEmber;
              phase = (et - 1) & 255;
              embers = true;
            }
          }
        }
        prevFire[i] = f;
        if (views !== null) {
          if ((cx & 3) === 3) {
            const j = i >> 2;
            quiet[j] = quietNow ? Math.min(2, quiet[j]! + 1) : 0;
            last32.ground[j] = views[5]![j]!;
            last32.owner[j] = views[6]![j]!;
            last32.air[j] = views[7]![j]!;
            last32.under[j] = views[8]![j]!;
          }
        }
        const code = disp | (flags << 8) | (phase << 16) | (g << 24);
        if (codes32[i] !== code) {
          codes32[i] = code;
          if (i < c0) c0 = i;
          c1 = i + 1;
        }

        // Fields.
        let cs = 0;
        if (ch > 0) {
          const fade = ch >= chargeFade ? 1 : ch / chargeFade;
          const s = falloff !== undefined ? Math.max(chargeMin, 255 * falloff[i]!) : 255;
          cs = Math.round(s * fade);
        }
        const at = airTimer[i]!;
        const dens = at === 0 ? 0 : Math.min(255, at * airScale);
        const smoke = a === aSmoke ? dens : 0;
        const steam = a === aSteam ? dens : 0;
        const fw = f | (cs << 8) | (smoke << 16) | (steam << 24);
        if (fields32[i] !== fw) {
          fields32[i] = fw;
          if (i < f0) f0 = i;
          f1 = i + 1;
        }

        // Masks.
        const hostile = o !== oPlayer;
        const oil = surface[i] === sOil ? 255 : 0;
        const wt = wet[i]!;
        const wetV = wt === 0 ? 0 : Math.min(255, wt * wetScale);
        const hz = f > 0 || ch > 0 ? 255 : 0;
        const hh = hostile ? hz : 0;
        const mw = oil | (wetV << 8) | (hz << 16) | (hh << 24);
        if (masks32[i] !== mw) {
          masks32[i] = mw;
          if (i < m0) m0 = i;
          m1 = i + 1;
        }

        // Glow accumulators per tile.
        if (fw !== 0) {
          const k = (rowTile + ((cx / tc) | 0)) * 4;
          acc[k] = acc[k]! + f;
          acc[k + 1] = acc[k + 1]! + cs;
          acc[k + 2] = acc[k + 2]! + smoke;
          acc[k + 3] = acc[k + 3]! + steam;
        }
      }
    }

    this.cur = next;
    this.dirty.codes[0] = c0;
    this.dirty.codes[1] = c1;
    this.dirty.fields[0] = f0;
    this.dirty.fields[1] = f1;
    this.dirty.masks[0] = m0;
    this.dirty.masks[1] = m1;
    this.blockCells = blocks;
    this.embersLive = embers;
    this.blurGlow();
  }

  /** Averages the per-tile sums and applies a 3×3 tent blur, into the glow bytes. */
  private blurGlow(): void {
    const tw = this.tilesW;
    const th = this.tilesH;
    const acc = this.glowAcc;
    const tmp = this.glowTmp;
    const inv = 1 / (TILE_CELLS * TILE_CELLS);
    // Horizontal pass [1 2 1] / 4, then vertical, clamped at the edges.
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const l = Math.max(0, x - 1);
        const r = Math.min(tw - 1, x + 1);
        for (let c = 0; c < 4; c++) {
          const row = y * tw;
          tmp[(row + x) * 4 + c] =
            (acc[(row + l) * 4 + c]! + 2 * acc[(row + x) * 4 + c]! + acc[(row + r) * 4 + c]!) * 0.25 * inv;
        }
      }
    }
    const out = this.glow;
    for (let y = 0; y < th; y++) {
      const u = Math.max(0, y - 1);
      const d = Math.min(th - 1, y + 1);
      for (let x = 0; x < tw; x++) {
        for (let c = 0; c < 4; c++) {
          const v =
            (tmp[(u * tw + x) * 4 + c]! + 2 * tmp[(y * tw + x) * 4 + c]! + tmp[(d * tw + x) * 4 + c]!) * 0.25;
          out[(y * tw + x) * 4 + c] = Math.min(255, Math.round(v * TERRAIN_FX.glowGain));
        }
      }
    }
  }
}

/** Material code → true if the baked block layer draws it. */
export function isBlockCode(code: number): boolean {
  return isBlock[code] === 1;
}

/** Material code → true if it's a prop drawn by the baked prop layer. */
export function isPropCode(code: number): boolean {
  return isProp[code] === 1;
}

/** Material id by code, for legends. */
export function materialName(code: number): string {
  return materialByCode[code]?.id ?? '?';
}
