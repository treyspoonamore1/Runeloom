import { f1, c3 } from './glslLib';
import { TERRAIN as C, TERRAIN_FX as FX, TERRAIN_LINE as L, TERRAIN_ONESHOT as O } from './terrainColors';
import { GRID_HZ } from './terrainPack';

/**
 * The fragment mains, one program per pass:
 *   ground  materials, edges, wet, oil, scorch, charge crackle (bottom of the world)
 *   fire    flames, embers, glow, hostile-hazard edges (above props and walls, below entities)
 *   air     smoke and steam (above entities)
 * Output is premultiplied alpha: rgb with alpha 0 adds light (glow) under normal blending.
 */

/** Wet darkening + gloss, oil sheen, scorch under fire and charge crackle on top of a material. */
const SURFACES = /* glsl */ `
vec3 applyWet(vec3 col, vec2 p, float wet, float aa) {
  float k = smoothstep(0.35, 0.6, wet + (vnoise(p * 1.3) - 0.5) * 0.25);
  // Wet ground is darker and a little more saturated (multiplied by itself).
  vec3 dark = col * mix(vec3(1.0), col, 0.55) * 0.86;
  col = mix(col, dark, k);
  // A soft, broad sheen rather than spots.
  float gloss = smoothstep(0.55, 0.8, vnoise(p * 0.3 + vec2(uTime * 0.03, 0.0)));
  return col + gloss * k * 0.07;
}

vec3 applyOil(vec3 col, vec2 p, float oil, bool onWater, float aa) {
  float edge = 0.5 + (vnoise(p * 0.8) - 0.5) * 0.3;
  float d = oil - edge;
  if (d < -0.2) return col;
  // Thin-film sheen: broad rainbow bands drifting slowly across the slick.
  float film = vnoise(p * 0.11 + vec2(uTime * 0.02, -uTime * 0.015));
  vec3 rainbow = 0.5 + 0.5 * cos(TAU * (film * 1.6 + p.x * 0.015 + vec3(0.0, 0.33, 0.67)));
  float bandK = smoothstep(0.45, 0.75, vnoise(p * 0.18 + vec2(-uTime * 0.03, uTime * 0.02)));
  vec3 oc = mix(${c3(C.oil)}, rainbow * 0.7, 0.3 * bandK);
  if (onWater) oc = mix(oc, col, 0.18);
  float spec = smoothstep(0.86, 0.9, vnoise(p * 0.45 + vec2(uTime * 0.02, 0.0)));
  oc += spec * 0.08;
  float inside = smoothstep(-aa, aa, d);
  col = mix(col, oc, inside);
  return mix(col, ${c3(C.oilEdge)}, band(d, ${f1(L.detail * 0.55)}, aa) * 0.85);
}

vec3 applyCharge(vec3 col, vec2 p, float cs, float aa) {
  float k = smoothstep(0.02, 0.5, cs);
  col = mix(col, col * 0.7 + ${c3(C.stormGlow)} * 0.3, 0.6 * k);
  // Arcs: ridges of noise, re-rolled 15 times a second so they crackle and flow sideways. A gate
  // noise shows only some of them at a time; stronger charge opens more.
  float tq = floor(uTime * 15.0);
  float arcs = 0.0;
  float halo = 0.0;
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    vec2 q = p * (0.45 + 0.2 * fl) + vec2(uTime * 0.9 + fl * 7.3, tq * 0.731 + fl * 3.1);
    float n = (lnoise(q) + 0.45 * lnoise(q * 2.9 + 5.0)) / 1.45;
    float r = abs(n - 0.5) / max(fwidth(n) / max(aa, 1e-4), 0.05);
    float gate = smoothstep(0.68 - 0.1 * k, 0.76 - 0.1 * k, vnoise(p * 0.2 + vec2(tq * 0.37, fl * 11.0)));
    arcs = max(arcs, gate * (1.0 - smoothstep(0.05, 0.05 + aa * 1.5, r)));
    halo = max(halo, gate * (1.0 - smoothstep(0.08, 0.35, r)));
  }
  col = mix(col, ${c3(C.stormGlow)}, halo * 0.75 * k);
  col = mix(col, ${c3(C.stormCore)}, arcs * k);
  // Fresh electrify events: a bright front racing out from the origin across the charged cells.
  for (int i = 0; i < 4; i++) {
    vec4 pu = uPulses[i];
    if (pu.w <= 0.0) continue;
    float front = pu.z * ${f1(O.pulseSpeed)};
    float d = length(p - pu.xy) - front;
    float fade = 1.0 - pu.z / ${f1(O.pulseLife)};
    float b = exp(-d * d / ${f1(O.pulseWidth * O.pulseWidth)}) * fade * pu.w;
    col = mix(col, mix(${c3(C.stormCore)}, vec3(1.0), 0.5), clamp(b, 0.0, 1.0) * 0.85);
  }
  return col;
}
`;

const GROUND_MAIN = /* glsl */ `
${SURFACES}
void main() {
  vec2 p = vPos;
  float aa = max(fwidth(p.x), 1e-4) * 0.75;
  Cls cl = classify(p);
  ivec2 cell = ivec2(floor(p));
  vec4 code = codesAt(cell);
  vec3 col = shadeMaterial(cl.a, p, cl, code, aa);
  // A shadow under bramble clumps, which stand taller than the floor.
  if (cl.a != M_BRAMBLE && groundAt(ivec2(floor(vec2(p.x, p.y - 0.7)))) == M_BRAMBLE) col *= 0.82;
  // The edge line between the two leading materials, colored by the higher-priority one.
  if (cl.a != cl.b) {
    int e = EDGE_P[cl.a] >= EDGE_P[cl.b] ? cl.a : cl.b;
    float w = EDGE_W[e];
    if (w > 0.0) col = mix(col, EDGE_COL[e], band((cl.wa - cl.wb) * 0.5, w * 0.5, aa));
  }
  vec4 m = masksAt(p);
  vec4 fl = fieldsAt(p);
  bool water = isWater(cl.a);
  if (m.g > 0.01 && !water) col = applyWet(col, p, m.g, aa);
  // Embers and scorch on cells whose fire just went out.
  int flags = byteOf(code.g);
  if ((flags & F_EMBER) != 0 && !water && !isIce(cl.a)) {
    float age = mod(uTick - code.b * 255.0, 256.0) / ${f1(FX.emberSeconds * GRID_HZ)};
    float k = clamp(1.0 - age, 0.0, 1.0);
    col = mix(col, ${c3(C.scorch)}, 0.35 * k);
    ivec2 ec = ivec2(floor(p * 2.0));
    float eh = hash2(ec, 901);
    if (eh < (cl.a == M_ASH ? 0.35 : 0.15)) {
      vec2 ep = (vec2(ec) + 0.25 + vec2(hash2(ec, 902), hash2(ec, 903)) * 0.5) * 0.5;
      float tw = 0.55 + 0.45 * sin(uTime * 5.0 + eh * 60.0);
      float dot = 1.0 - smoothstep(0.05, 0.12, length(p - ep));
      col = mix(col, ${c3(C.ember)} * 1.15, dot * k * tw);
    }
  }
  if (m.r > 0.05) col = applyOil(col, p, m.r, water, aa);
  // A bed of glowing coals under the flames.
  if (fl.r > 0.01) {
    float n = vnoise(p * 1.8 + vec2(0.0, uTime * 0.7));
    vec3 bed = mix(${c3(C.scorch)}, ${c3(C.fireDeep)}, smoothstep(0.35, 0.7, n));
    bed = mix(bed, ${c3(C.fireOuter)}, smoothstep(0.72, 0.85, n) * min(fl.r * 1.5, 1.0));
    col = mix(col, bed, smoothstep(0.0, 0.3, fl.r) * 0.9);
  }
  if (fl.g > 0.01) col = applyCharge(col, p, fl.g, aa);
  finalColor = vec4(col, 1.0);
}
`;

const FIRE_MAIN = /* glsl */ `
float heatAt(vec2 p) {
  float f = fieldsAt(p).r;
  float hot = masksAt(p).r > 0.5 ? ${f1(FX.oilFireHeat)} : 1.0;
  return f * hot;
}

const float FL_S = ${f1(FX.tongueSpacing)};

/**
 * One flame tongue rooted near lattice point c: a teardrop that flickers in height and sways at
 * the tip. Returns how far inside it p is (0 at its edge, 1 on its axis); t = height fraction.
 */
float tongue(vec2 p, ivec2 c, out float t, out float heat) {
  t = 1.0;
  heat = 0.0;
  float hs = hash2(c, 921);
  if (hs > 0.8) return 0.0;
  vec2 b = (vec2(c) + 0.5 + (vec2(hash2(c, 922), hash2(c, 923)) - 0.5) * 0.7) * FL_S;
  heat = heatAt(b);
  if (heat < 0.04) return 0.0;
  float flick = 0.72 + 0.4 * vnoise(vec2(hs * 37.0, uTime * 5.5 + hs * 11.0));
  float h = (0.9 + ${f1(FX.flameRise)} * min(heat, 1.4)) * flick;
  float w = 0.55 + 0.4 * min(heat, 1.2);
  vec2 d = p - b;
  t = -d.y / h;
  if (t < -0.45 || t > 1.0) return 0.0;
  d.x -= sin(uTime * 5.0 + hs * 30.0) * 0.22 * max(t, 0.0) * h * 0.5;
  float hw = t < 0.0
    ? w * sqrt(max(0.0, 1.0 - (t / 0.45) * (t / 0.45)))
    : w * pow(1.0 - t, 0.8) * (1.0 + 0.6 * t);
  hw *= 0.85 + 0.3 * vnoise(vec2(p.x * 3.0, p.y * 2.0 + uTime * 6.0));
  return max(0.0, 1.0 - abs(d.x) / max(hw, 1e-3));
}

void main() {
  vec2 p = vPos;
  float aa = max(fwidth(p.x), 1e-4);
  vec4 g = glowAt(p);
  vec4 m = masksAt(p);
  // Nothing burning or charged within a tile or two: skip the flame math.
  if (g.r + g.g < 0.002 && m.b + m.a < 0.01) discard;
  vec3 rgb = vec3(0.0);
  float a = 0.0;
  // Flame tongues rooted at or below this pixel; the union gets one dark-red rim, toon bands inside.
  float best = 0.0;
  float bt = 1.0;
  float bh = 0.0;
  float heat = 0.0;
  if (g.r > 0.002) {
    ivec2 c0 = ivec2(floor(p / FL_S));
    for (int dy = 0; dy <= 2; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        float t;
        float h;
        float s = tongue(p, c0 + ivec2(dx, dy), t, h);
        heat = max(heat, h);
        if (s > best) { best = s; bt = t; bh = h; }
      }
    }
  }
  if (best > 0.0) {
    float fw = max(fwidth(best), 1e-3);
    float outer = smoothstep(0.0, fw * 1.5, best);
    float rim = 1.0 - smoothstep(0.16, 0.16 + fw * 1.5, best);
    float inner = smoothstep(0.42, 0.42 + fw * 1.5, best) * step(bt, 0.72);
    float core = smoothstep(0.7, 0.7 + fw * 1.5, best) * step(bt, 0.42) * step(0.5, bh);
    vec3 col = ${c3(C.fireOuter)};
    col = mix(col, ${c3(C.fireInner)}, inner);
    col = mix(col, ${c3(C.fireCore)}, core);
    col = mix(col, ${c3(C.fireDeep)}, rim * 0.85);
    a = outer;
    rgb = col * a;
  }
  // Sparks rising off the flames.
  if (heat > 0.05) {
    vec2 sp = vec2(p.x, p.y + uTime * 1.8) * 1.4;
    ivec2 sc = ivec2(floor(sp));
    float sh = hash2(sc, 911);
    if (sh < 0.3) {
      vec2 pos = vec2(hash2(sc, 912), hash2(sc, 913)) * 0.6 + 0.2;
      pos.x += sin(uTime * 3.0 + sh * 20.0) * 0.12;
      float life = fract(sp.y);
      float d = length(fract(sp) - pos) / 1.4;
      float s = (1.0 - smoothstep(0.03, 0.07 + aa, d)) * min(heat, 1.0) * (1.0 - life);
      rgb += ${c3(C.fireInner)} * s;
    }
  }
  // Warm glow around fire and violet glow around charge (additive: alpha untouched).
  float fg = max(g.r, fieldsAt(p).r * 0.5);
  rgb += ${c3(C.fireGlow)} * fg * ${f1(FX.fireGlow)} * (1.0 - a);
  rgb += ${c3(C.stormGlow)} * g.g * ${f1(FX.stormGlow)} * (1.0 - a);
  // Hostile hazards (world or enemy owned) get a pulsing red-magenta edge (DESIGN §14). The edge
  // follows the outline of the whole hazard area (m.b, any owner) where it belongs to hostile
  // cells (m.a), so a player-owned part of the same pool or fire gets no line across it.
  if (m.a > 0.05) {
    float pulse = mix(${f1(FX.hazardAlphaMin)}, ${f1(FX.hazardAlphaMax)},
      0.5 + 0.5 * sin(uTime * TAU * ${f1(FX.hazardHz)}));
    float e = band(m.b - 0.62, ${f1(L.hazard * 0.5)}, aa) * smoothstep(0.2, 0.5, m.a) * pulse;
    rgb = mix(rgb, ${c3(C.hazard)}, e);
    a = mix(a, 1.0, e);
  }
  finalColor = vec4(rgb, a);
}
`;

const AIR_MAIN = /* glsl */ `
void main() {
  vec2 p = vPos;
  // Clouds drift up off their cells (sampled from below) and thin out over open flames.
  vec4 fl = fieldsAt(p + vec2(0.0, ${f1(FX.airLift)}));
  vec4 g = glowAt(p + vec2(0.0, ${f1(FX.airLift)}));
  float flame = fieldsAt(p).r;
  float smoke = max(fl.b, g.b * 0.9) * (1.0 - 0.7 * smoothstep(0.0, 0.4, flame));
  float steam = max(fl.a, g.a * 0.9);
  if (smoke + steam < 0.004) discard;
  vec3 rgb = vec3(0.0);
  float a = 0.0;
  if (smoke > 0.004) {
    vec2 q = p * 0.3 + vec2(uTime * 0.1, uTime * 0.28);
    float n = fbm(q);
    float cloud = smoothstep(0.25, 0.8, smoothstep(0.0, 0.6, smoke) * 0.75 + n * 0.6 - 0.2);
    float lit = smoothstep(0.5, 0.75, fbm(q + vec2(-0.35, -0.45)));
    vec3 col = mix(${c3(C.smoke)}, ${c3(C.smokeLight)}, lit * 0.8);
    // Oil fires give darker, sootier smoke.
    float sooty = clamp(fieldsAt(p + vec2(0.0, 1.5)).r * masksAt(p + vec2(0.0, 1.5)).r * 3.0, 0.0, 1.0);
    col = mix(col, ${c3(C.oilSmoke)}, sooty);
    float sa = cloud * mix(${f1(FX.smokeAlpha)}, 0.75, sooty);
    rgb = col * sa;
    a = sa;
  }
  if (steam > 0.004) {
    vec2 q = p * 0.42 + vec2(-uTime * 0.18, uTime * 0.5);
    float n = fbm(q);
    float cloud = smoothstep(0.35, 0.7, smoothstep(0.0, 0.5, steam) * 0.7 + n * 0.6 - 0.2);
    float lit = smoothstep(0.45, 0.7, fbm(q + vec2(-0.3, -0.4)));
    vec3 col = mix(${c3(C.steamShade)}, ${c3(C.steam)}, lit);
    float sa = cloud * ${f1(FX.steamAlpha)};
    rgb = rgb * (1.0 - sa) + col * sa;
    a = a + sa * (1.0 - a);
  }
  finalColor = vec4(rgb, a);
}
`;

export const PASS_MAINS = { ground: GROUND_MAIN, fire: FIRE_MAIN, air: AIR_MAIN } as const;
