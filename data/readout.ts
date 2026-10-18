/**
 * Reference dummy scenes (DESIGN §5.5) and the DPS readout's assumptions. The sim builds these
 * rooms programmatically (src/sim/weave/runtime/scenes.ts); nothing here is read from disk.
 * Units: cells, seconds.
 */

export type ReferenceSceneId = 'dummy_single' | 'dummy_pack' | 'dummy_grid';

export interface ReferenceSceneDef {
  /** Room size in tiles (4×4 cells each), including a one-tile wall border. Floor is stone. */
  tilesW: number;
  tilesH: number;
  /** Player position, cells. */
  playerX: number;
  playerY: number;
  /** Distance from the player to the center of the dummies, along +x. */
  centerDistance: number;
  /** Dummies on a `cols` × `rows` grid `spacing` cells apart around the center, row by row. */
  cols: number;
  rows: number;
  spacing: number;
  /** Leave the middle grid cell empty (dummy_pack: a 3×3 grid without its center). */
  skipCenter: boolean;
}

export const referenceScenes = {
  /** 1 dummy 20 cells from the player. */
  dummy_single: {
    tilesW: 24,
    tilesH: 16,
    playerX: 24,
    playerY: 32,
    centerDistance: 20,
    cols: 1,
    rows: 1,
    spacing: 3,
    skipCenter: false,
  },
  /** 8 dummies in a 3×3 grid without its center, 3 cells apart, center 20 cells away. */
  dummy_pack: {
    tilesW: 24,
    tilesH: 16,
    playerX: 24,
    playerY: 32,
    centerDistance: 20,
    cols: 3,
    rows: 3,
    spacing: 3,
    skipCenter: true,
  },
  /** 100 dummies in a 10×10 grid, 3 cells apart, for stress tests. */
  dummy_grid: {
    tilesW: 32,
    tilesH: 20,
    playerX: 20,
    playerY: 40,
    centerDistance: 30,
    cols: 10,
    rows: 10,
    spacing: 3,
    skipCenter: false,
  },
} satisfies Record<ReferenceSceneId, ReferenceSceneDef>;

/** Enemy kind the scenes place (DESIGN §5.5: 500 life, 0 resistances, never moves or dies). */
export const REFERENCE_DUMMY = 'dummy';

export const readoutRules = {
  /**
   * On Dodge, On Hurt and On Crit weaves assume their event happens this often (DESIGN §5.5),
   * still limited by the trigger's ICD. Natural events of those kinds are ignored meanwhile.
   */
  forcedEventInterval: 1,
  /**
   * Close-range root forms can't reach dummies 20 cells away, so the player stands closer: the
   * scene center sits at this fraction of the form's reach (Strike reach, Nova radius, Swath
   * length, Orb orbit radius) when that is nearer than the scene's own distance.
   */
  closeRangeFraction: 0.6,
};
