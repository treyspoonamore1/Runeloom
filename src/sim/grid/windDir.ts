/**
 * The 8 wind directions (DESIGN §6.6): 0 none, 1–8 the way it blows: E, NE, N, NW, W, SW, S, SE.
 * Grid y grows southward, so N is −y. Pure tables, shared by the room parser (`@wind`), the grid
 * (`Grid.wind`, `gustDir`) and wind.ts.
 */

export type WindDir = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Unit-free step of each direction: x and y in −1, 0, 1. Index 0 is "none". */
export const WIND_DX: readonly number[] = [0, 1, 1, 0, -1, -1, -1, 0, 1];
export const WIND_DY: readonly number[] = [0, 0, -1, -1, -1, 0, 1, 1, 1];

/** `@wind` names (CONTENT §6.2) → direction. */
export const WIND_BY_NAME: Readonly<Record<string, WindDir>> = {
  e: 1,
  ne: 2,
  n: 3,
  nw: 4,
  w: 5,
  sw: 6,
  s: 7,
  se: 8,
};

/** The direction name of a code ('' for none), for the debug overlay and messages. */
export function windName(dir: number): string {
  for (const [name, d] of Object.entries(WIND_BY_NAME)) if (d === dir) return name;
  return '';
}

/** tan(22.5°): the sector boundary between an axis direction and a diagonal. */
const TAN_22_5 = Math.SQRT2 - 1;

/**
 * Quantizes a vector to the nearest of the 8 directions (0 for a zero vector). Plain arithmetic,
 * no trig, so it is bit-identical everywhere.
 */
export function windDirOf(x: number, y: number): WindDir {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const sx = x > 0 ? 1 : -1;
  const sy = y > 0 ? 1 : -1;
  if (ay <= ax * TAN_22_5) return sx > 0 ? 1 : 5;
  if (ax <= ay * TAN_22_5) return sy > 0 ? 7 : 3;
  if (sx > 0) return sy > 0 ? 8 : 2;
  return sy > 0 ? 6 : 4;
}
