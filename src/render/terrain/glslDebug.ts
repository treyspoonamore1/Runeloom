import { c3 } from './glslLib';
import { DEBUG_MATERIAL_BY_CODE, DEBUG_OWNER } from './terrainColors';

/** Bits of the debug pass's uFlags uniform, one per F1 grid overlay. */
export const DEBUG_BITS = {
  material: 1,
  fire: 2,
  charge: 4,
  wet: 8,
  owner: 16,
  wind: 32,
  borrowed: 64,
} as const;

const n = DEBUG_MATERIAL_BY_CODE.length;

/**
 * F1 grid overlays: exact per-cell values (nearest, current upload, no interpolation), stacked in
 * order material → wet → borrowed → fire → charge → owner → wind, with faint cell lines. Wind (M8):
 * an arrow per gusting cell (brighter while the gust is fresh) and big faint arrows on a 16-cell
 * lattice for the room wind. Borrowed (M8): a Tide-blue tint, striped in its last seconds.
 */
export const DEBUG_MAIN = /* glsl */ `
const vec3 DBG_MAT[${n}] = vec3[${n}](${DEBUG_MATERIAL_BY_CODE.map((c) => c3(c ?? 0)).join(', ')});
const vec3 DBG_OWNER[3] = vec3[3](${DEBUG_OWNER.map(c3).join(', ')});

vec3 heatRamp(float t) {
  vec3 a = vec3(0.25, 0.0, 0.3);
  vec3 b = vec3(0.95, 0.2, 0.1);
  vec3 c = vec3(1.0, 0.85, 0.2);
  return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, (t - 0.5) * 2.0);
}

void over(inout vec4 acc, vec3 col, float a) {
  acc.rgb = acc.rgb * (1.0 - a) + col * a;
  acc.a = acc.a + a * (1.0 - acc.a);
}

/** Coverage of an arrow pointing along dir in a box of half-size s centered at c. */
float arrow(vec2 p, vec2 c, vec2 dir, float s, float aa) {
  vec2 q = (p - c) / s;
  vec2 perp = vec2(-dir.y, dir.x);
  float al = dot(q, dir);
  float ac = abs(dot(q, perp));
  float shaft = step(-0.75, al) * step(al, 0.1) * (1.0 - smoothstep(0.1, 0.1 + aa / s, ac));
  float head = step(0.0, al) * step(al, 0.8) * (1.0 - smoothstep(0.0, aa / s, ac - (0.8 - al) * 0.6));
  return max(shaft, head);
}

void main() {
  vec2 p = vPos;
  ivec2 cell = ivec2(floor(p));
  vec4 code = texelFetch(uCodes, cell, 0);
  vec4 fl = texelFetch(uFields, cell, 0);
  vec4 m = texelFetch(uMasks, cell, 0);
  int bits = int(uFlags + 0.5);
  int flags = byteOf(code.g);
  vec4 acc = vec4(0.0);
  if ((bits & ${DEBUG_BITS.material}) != 0) {
    over(acc, DBG_MAT[byteOf(code.a)], 0.85);
    if ((flags & F_OIL) != 0) {
      float stripe = step(0.5, fract((p.x + p.y) * 1.5));
      over(acc, vec3(0.62, 0.25, 0.9), stripe * 0.8);
    }
  }
  if ((bits & ${DEBUG_BITS.wet}) != 0 && m.g > 0.0) over(acc, vec3(0.2, 0.45, 1.0), 0.3 + 0.55 * m.g);
  vec4 ex = texelFetch(uExtra, cell, 0);
  if ((bits & ${DEBUG_BITS.borrowed}) != 0 && ex.b > 0.5) {
    float stripe = ex.g > 0.0 ? step(0.5, fract((p.x - p.y) * 1.2)) : 1.0;
    over(acc, vec3(0.18, 0.48, 1.0), 0.55 * stripe + 0.15);
  }
  if ((bits & ${DEBUG_BITS.fire}) != 0 && fl.r > 0.0) over(acc, heatRamp(fl.r), 0.9);
  if ((bits & ${DEBUG_BITS.charge}) != 0 && fl.g > 0.0) over(acc, mix(vec3(0.45, 0.3, 1.0), vec3(1.0, 0.95, 0.3), fl.g), 0.9);
  if ((bits & ${DEBUG_BITS.owner}) != 0) {
    bool effect = fl.r > 0.0 || fl.g > 0.0 || fl.b > 0.0 || fl.a > 0.0;
    int owner = (flags >> F_OWNER_SHIFT) & 3;
    if (effect) over(acc, DBG_OWNER[min(owner, 2)], 0.75);
  }
  float aa = fwidth(p.x);
  if ((bits & ${DEBUG_BITS.wind}) != 0) {
    if (uWind.z > 0.5) {
      vec2 c = (floor(p / 16.0) + 0.5) * 16.0;
      over(acc, vec3(0.0), arrow(p, c + vec2(0.4, 0.4), uWind.xy, 5.0, aa) * 0.35);
      over(acc, vec3(0.91, 0.96, 0.94), arrow(p, c, uWind.xy, 5.0, aa) * 0.55);
    }
    vec4 at = texelFetch(uAtmo, cell, 0);
    if (at.g > 0.0) {
      vec2 v = at.ba * 2.0 - 1.0;
      vec2 dir = length(v) > 0.05 ? normalize(v) : vec2(1.0, 0.0);
      over(acc, vec3(0.2, 0.75, 0.65), 0.25 + 0.25 * at.g);
      over(acc, vec3(1.0), arrow(p, floor(p) + 0.5, dir, 0.45, aa) * (0.55 + 0.45 * at.g));
    }
  }
  vec2 f = fract(p);
  float line = 1.0 - smoothstep(0.0, aa * 1.2, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
  over(acc, vec3(0.0), line * 0.18);
  finalColor = vec4(acc.rgb, acc.a);
}
`;
