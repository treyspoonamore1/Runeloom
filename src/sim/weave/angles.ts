/**
 * Unit-vector rotations computed with basic float arithmetic only (+, −, ×, ÷), so they are
 * bit-identical on every JS engine, unlike Math.cos/Math.sin (DECISIONS: determinism). Used by
 * the compiler; the runtime only multiplies by the results and never calls trig.
 */

/**
 * A rotation by angle θ as (cos θ, sin θ). Rotate a direction (x, y) by it with
 * x' = x·cos − y·sin, y' = x·sin + y·cos. Positive angles turn from +x toward +y (in the sim's
 * y-down world that is clockwise on screen). Its inverse is { cos, sin: −sin }.
 */
export interface Rotation {
  readonly cos: number;
  readonly sin: number;
}

export const IDENTITY_ROTATION: Rotation = { cos: 1, sin: 0 };

const PI = 3.141592653589793;

/**
 * Rotation by `deg` degrees. Reduces to |r| ≤ 45° plus a quarter-turn count, then sums Taylor
 * series (error below 1e-16). Multiples of 90° are exact.
 */
export function rotationDeg(deg: number): Rotation {
  const q = Math.round(deg / 90);
  const x = ((deg - q * 90) * PI) / 180;
  const x2 = x * x;
  // sin x = x − x³/3! + …, cos x = 1 − x²/2! + …, to the x¹⁹ and x²⁰ terms.
  let s = x;
  let c = 1;
  let ts = x;
  let tc = 1;
  for (let k = 1; k <= 9; k++) {
    ts *= -x2 / (2 * k * (2 * k + 1));
    tc *= -x2 / ((2 * k - 1) * (2 * k));
    s += ts;
    c += tc;
  }
  switch (((q % 4) + 4) % 4) {
    case 0:
      return { cos: c, sin: s };
    case 1:
      return { cos: 0 - s, sin: c }; // 0 − x avoids −0
    case 2:
      return { cos: 0 - c, sin: 0 - s };
    default:
      return { cos: s, sin: 0 - c };
  }
}

/**
 * `count` rotations spread evenly over `totalDeg` degrees, centred on 0 and ordered from the most
 * negative angle to the most positive (instance index order). One instance gets the identity.
 */
export function fanRotations(count: number, totalDeg: number): Rotation[] {
  if (count <= 1) return [IDENTITY_ROTATION];
  const out: Rotation[] = [];
  for (let i = 0; i < count; i++) out.push(rotationDeg(-totalDeg / 2 + (totalDeg * i) / (count - 1)));
  return out;
}
