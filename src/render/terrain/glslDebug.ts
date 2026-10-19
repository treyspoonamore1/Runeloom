import { c3 } from './glslLib';
import { DEBUG_MATERIAL_BY_CODE, DEBUG_OWNER } from './terrainColors';

/** Bits of the debug pass's uFlags uniform, one per F1 grid overlay. */
export const DEBUG_BITS = { material: 1, fire: 2, charge: 4, wet: 8, owner: 16 } as const;

const n = DEBUG_MATERIAL_BY_CODE.length;

/**
 * F1 grid overlays: exact per-cell values (nearest, current upload, no interpolation), stacked in
 * order material → wet → fire → charge → owner, with faint cell lines.
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
  if ((bits & ${DEBUG_BITS.fire}) != 0 && fl.r > 0.0) over(acc, heatRamp(fl.r), 0.9);
  if ((bits & ${DEBUG_BITS.charge}) != 0 && fl.g > 0.0) over(acc, mix(vec3(0.45, 0.3, 1.0), vec3(1.0, 0.95, 0.3), fl.g), 0.9);
  if ((bits & ${DEBUG_BITS.owner}) != 0) {
    bool effect = fl.r > 0.0 || fl.g > 0.0 || fl.b > 0.0 || fl.a > 0.0;
    int owner = (flags >> F_OWNER_SHIFT) & 3;
    if (effect) over(acc, DBG_OWNER[min(owner, 2)], 0.75);
  }
  vec2 f = fract(p);
  float aa = fwidth(p.x);
  float line = 1.0 - smoothstep(0.0, aa * 1.2, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
  over(acc, vec3(0.0), line * 0.18);
  finalColor = vec4(acc.rgb, acc.a);
}
`;
