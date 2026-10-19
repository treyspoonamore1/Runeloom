import { MAT } from '../../../data/materials';
import { FLAG } from './terrainPack';

/** A 0xRRGGBB color as a GLSL vec3 literal. */
export function c3(color: number): string {
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;
  return `vec3(${r.toFixed(4)}, ${g.toFixed(4)}, ${b.toFixed(4)})`;
}

/** A number as a GLSL float literal. */
export function f1(v: number): string {
  const s = String(v);
  return s.includes('.') || s.includes('e') ? s : `${s}.0`;
}

/** Material codes as GLSL int constants: M_STONE, M_SHALLOW_WATER, … */
const materialConsts = Object.entries(MAT)
  .map(([id, code]) => `const int M_${id.toUpperCase()} = ${code};`)
  .join('\n');

export const VERTEX = /* glsl */ `#version 300 es
in vec2 aPosition;
in vec2 aUV;
out vec2 vPos;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vPos = aPosition + aUV * 0.0;
}
`;

/**
 * Shared fragment header: inputs, uniforms, hashing (bit-identical to palette.ts hash2, so the
 * shader picks the same per-tile colors as the M0 bake), value noise and grid sampling.
 * World units are cells; vPos is the fragment's position in cells.
 */
export const LIB = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vPos;
out vec4 finalColor;

uniform sampler2D uCodes;
uniform sampler2D uFields;
uniform sampler2D uFieldsPrev;
uniform sampler2D uMasks;
uniform sampler2D uGlow;
uniform vec2 uSize;
uniform vec2 uGlowSize;
uniform float uTime;
uniform float uMix;
uniform float uTick;
uniform float uFlags;

${materialConsts}
const int F_OIL = ${FLAG.oil};
const int F_OWNER_SHIFT = ${FLAG.ownerShift};
const int F_AIR_SHIFT = ${FLAG.airShift};
const int F_EMBER = ${FLAG.ember};
const int F_OVER_WATER = ${FLAG.overWater};
const float PI = 3.14159265;
const float TAU = 6.2831853;

uint hash3u(int x, int y, int s) {
  uint h = (uint(x) * 374761393u) ^ (uint(y) * 668265263u) ^ (uint(s) * 1442695041u);
  h = (h ^ (h >> 13u)) * 1274126177u;
  return h ^ (h >> 16u);
}
/** Same as palette.ts hash2(x, y, salt): [0, 1). */
float hash2(ivec2 c, int s) { return float(hash3u(c.x, c.y, s) >> 8u) / 16777216.0; }

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  ivec2 c = ivec2(i);
  float a = hash2(c, 1001);
  float b = hash2(c + ivec2(1, 0), 1001);
  float d = hash2(c + ivec2(0, 1), 1001);
  float e = hash2(c + ivec2(1, 1), 1001);
  return mix(mix(a, b, u.x), mix(d, e, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.5 * vnoise(p);
  v += 0.25 * vnoise(p * 2.03 + vec2(17.1, 3.7));
  v += 0.125 * vnoise(p * 4.01 + vec2(-5.3, 11.9));
  return v / 0.875;
}

ivec2 clampCell(ivec2 c) { return clamp(c, ivec2(0), ivec2(uSize) - 1); }
vec4 codesAt(ivec2 c) { return texelFetch(uCodes, clampCell(c), 0); }
int groundAt(ivec2 c) { return int(codesAt(c).r * 255.0 + 0.5); }
int byteOf(float v) { return int(v * 255.0 + 0.5); }
/** Fire, charge, smoke, steam: bilinear between cells, blended from the previous grid upload. */
vec4 fieldsAt(vec2 p) {
  vec2 uv = p / uSize;
  return mix(texture(uFieldsPrev, uv), texture(uFields, uv), uMix);
}
vec4 masksAt(vec2 p) { return texture(uMasks, p / uSize); }
vec4 glowAt(vec2 p) { return texture(uGlow, p / (uGlowSize * 4.0)); }

bool isWater(int g) { return g == M_SHALLOW_WATER || g == M_DEEP_WATER; }
bool isIce(int g) { return g == M_ICE || g == M_ICE_BRIDGE; }

/** Coverage of a band |d| < hw, antialiased over aa. */
float band(float d, float hw, float aa) { return 1.0 - smoothstep(hw - aa, hw + aa, abs(d)); }
/** Distance from p to segment ab. */
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float ellipseMask(vec2 p, vec2 c, vec2 r, float aa) {
  float d = length((p - c) / r) - 1.0;
  return 1.0 - smoothstep(-aa / min(r.x, r.y), aa / min(r.x, r.y), d);
}
`;
