export interface Range {
  min: number;
  max: number;
  step: number;
  integer: boolean;
}

/** Slider range from a default value: 0 to 4x default (symmetric when negative). */
export function rangeFor(def: number): Range {
  const integer = Number.isInteger(def);
  const a = Math.abs(def);
  if (integer) {
    const max = Math.max(4 * a, a === 0 ? 10 : 4);
    return { min: def < 0 ? -max : 0, max, step: 1, integer };
  }
  const max = 4 * a;
  let step = 0.001;
  if (a >= 100) step = 1;
  else if (a >= 10) step = 0.1;
  else if (a >= 0.5) step = 0.01;
  return { min: def < 0 ? -max : 0, max, step, integer };
}

type Obj = Record<string, unknown>;

/** Copies src's values into dst in place, keeping dst's object identity. */
export function assignDeep(dst: Obj, src: Obj): void {
  for (const [k, v] of Object.entries(src)) {
    const cur = dst[k];
    if (v !== null && typeof v === 'object' && cur !== null && typeof cur === 'object')
      assignDeep(cur as Obj, v as Obj);
    else dst[k] = v;
  }
}
