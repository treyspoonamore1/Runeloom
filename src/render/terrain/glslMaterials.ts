import { edgeTable } from './glslEdges';
import { c3, f1 } from './glslLib';
import { TERRAIN as C, TERRAIN_FX as FX, TERRAIN_LINE as L } from './terrainColors';

/**
 * Ground classification and material looks. classify() picks, per pixel, the material with the
 * largest bilinear weight among the 4 cells around it, so region borders are smooth curves (a
 * frost circle is round, not a staircase) while tile-aligned rooms keep straight edges.
 */
export const MATERIALS = /* glsl */ `
${edgeTable()}

struct Cls { int a; int b; float wa; float wb; vec2 grad; };

/** Bramble edges are scalloped: its weight wobbles with noise. */
float matBias(int g, vec2 p) {
  if (g == M_BRAMBLE) return 0.82 + 0.36 * vnoise(p * 2.3);
  return 1.0;
}

Cls classify(vec2 p) {
  vec2 q = p - 0.5;
  ivec2 c = ivec2(floor(q));
  vec2 t = q - floor(q);
  int g[4];
  float w[4];
  vec2 dw[4];
  g[0] = groundAt(c);
  g[1] = groundAt(c + ivec2(1, 0));
  g[2] = groundAt(c + ivec2(0, 1));
  g[3] = groundAt(c + ivec2(1, 1));
  w[0] = (1.0 - t.x) * (1.0 - t.y);
  w[1] = t.x * (1.0 - t.y);
  w[2] = (1.0 - t.x) * t.y;
  w[3] = t.x * t.y;
  dw[0] = vec2(-(1.0 - t.y), -(1.0 - t.x));
  dw[1] = vec2(1.0 - t.y, -t.x);
  dw[2] = vec2(-t.y, 1.0 - t.x);
  dw[3] = vec2(t.y, t.x);
  for (int i = 0; i < 4; i++) {
    float b = matBias(g[i], p);
    w[i] *= b;
    dw[i] *= b;
  }
  for (int i = 1; i < 4; i++) {
    for (int j = 0; j < i; j++) {
      if (g[j] == g[i] && w[i] >= 0.0) {
        w[j] += w[i];
        dw[j] += dw[i];
        w[i] = -1.0;
      }
    }
  }
  Cls r;
  r.a = g[0]; r.wa = -1.0; r.b = g[0]; r.wb = -1.0; r.grad = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    if (w[i] > r.wa) {
      r.b = r.a; r.wb = r.wa;
      r.a = g[i]; r.wa = w[i]; r.grad = dw[i];
    } else if (w[i] > r.wb) {
      r.b = g[i]; r.wb = w[i];
    }
  }
  if (r.wb < 0.0) { r.b = r.a; r.wb = 0.0; }
  return r;
}

vec3 pick4(vec3 a, vec3 b, vec3 c, vec3 d, float h) {
  int i = min(3, int(h * 4.0));
  return i == 0 ? a : i == 1 ? b : i == 2 ? c : d;
}
vec3 pick3(vec3 a, vec3 b, vec3 c, float h) {
  int i = min(2, int(h * 3.0));
  return i == 0 ? a : i == 1 ? b : c;
}

vec3 shadeStone(vec2 p, float aa) {
  ivec2 tile = ivec2(floor(p / 4.0));
  vec2 f = p - vec2(tile) * 4.0;
  float h = hash2(tile, 0);
  vec3 col = pick4(${c3(C.stone[0])}, ${c3(C.stone[1])}, ${c3(C.stone[2])}, ${c3(C.stone[3])}, h);
  col *= 1.0 + (vnoise(p * 0.6) - 0.5) * 0.035;
  float gd = min(min(f.x, 4.0 - f.x), min(f.y, 4.0 - f.y));
  col = mix(col, ${c3(C.stoneGrout)}, band(gd, ${f1(L.detail * 0.4)}, aa));
  if (hash2(tile, 7) > 0.88) {
    vec2 cp = vec2(1.0 + h * 2.0, 1.0 + hash2(tile, 9) * 2.0);
    col = mix(col, ${c3(C.stoneChip)}, ellipseMask(f, cp, vec2(0.3, 0.2), aa));
  }
  return col;
}

vec3 shadeDirt(vec2 p, float aa) {
  ivec2 tile = ivec2(floor(p / 4.0));
  vec2 f = p - vec2(tile) * 4.0;
  vec3 col = pick3(${c3(C.dirt[0])}, ${c3(C.dirt[1])}, ${c3(C.dirt[2])}, hash2(tile, 0));
  col *= 1.0 + (vnoise(p * 1.7) - 0.5) * 0.05;
  for (int i = 0; i < 2; i++) {
    float hx = hash2(tile, 11 + i);
    float hy = hash2(tile, 21 + i);
    if (hx < 0.3) continue;
    col = mix(col, ${c3(C.dirtPebble)}, ellipseMask(f, vec2(0.6 + hx * 2.8, 0.6 + hy * 2.8), vec2(0.3, 0.2), aa));
  }
  return col;
}

/** One tuft of three blades fanning up from its base; returns the distance to the nearest blade. */
float tuft(vec2 f, vec2 b, float sway) {
  vec2 s = vec2(sway, 0.0);
  float d = segDist(f, b + vec2(-0.45, -0.5) + s, b + vec2(-0.1, 0.0));
  d = min(d, segDist(f, b + vec2(0.0, -0.8) + s * 1.3, b));
  return min(d, segDist(f, b + vec2(0.45, -0.5) + s, b + vec2(0.1, 0.0)));
}

vec3 shadeGrass(vec2 p, float aa) {
  ivec2 tile = ivec2(floor(p / 4.0));
  vec2 f = p - vec2(tile) * 4.0;
  vec3 col = pick3(${c3(C.grass[0])}, ${c3(C.grass[1])}, ${c3(C.grass[2])}, hash2(tile, 0));
  col *= 1.0 + (vnoise(p * 0.9) - 0.5) * 0.04;
  float hw = ${f1(L.detail * 0.5)};
  for (int i = 0; i < 2; i++) {
    float hx = hash2(tile, 31 + i);
    float hy = hash2(tile, 36 + i);
    float sway = 0.07 * sin(uTime * 1.7 + hx * 9.0 + p.x * 0.15);
    float d = tuft(f, vec2(0.7 + hx * 2.6, 1.3 + hy * 2.2), sway);
    col = mix(col, ${c3(C.grassBlade)}, band(d, hw, aa));
  }
  float lx = hash2(tile, 41);
  if (lx >= 0.5) {
    float sway = 0.07 * sin(uTime * 1.7 + lx * 9.0 + p.x * 0.15);
    float d = tuft(f, vec2(0.7 + lx * 2.6, 1.3 + hash2(tile, 46) * 2.2), sway);
    col = mix(col, ${c3(C.grassBladeLight)}, band(d, hw, aa));
  }
  return col;
}

/** Thorny clumps: rounded leaf masses with dark creases and pale thorns. */
vec3 shadeBramble(vec2 p, float aa) {
  vec2 q = p * 0.6;
  vec2 i = floor(q);
  float f1d = 9.0;
  float f2d = 9.0;
  vec2 site = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      ivec2 c = ivec2(i) + ivec2(x, y);
      vec2 s = vec2(c) + vec2(hash2(c, 301), hash2(c, 302)) * 0.8 + 0.1;
      float d = length(q - s);
      if (d < f1d) { f2d = f1d; f1d = d; site = s; }
      else if (d < f2d) f2d = d;
    }
  }
  // Each clump is lit from the top-left: lighter toward its upper-left side.
  vec2 rel = (q - site);
  float lit = clamp(0.6 - dot(rel, vec2(0.75, 0.75)) - f1d * 0.2, 0.0, 1.0);
  vec3 col = mix(${c3(C.bramble)}, ${c3(C.brambleLight)}, smoothstep(0.25, 0.75, lit));
  // Leaf texture inside each clump, dark creases between clumps.
  col *= 0.92 + 0.16 * vnoise(p * 2.6);
  col = mix(col, ${c3(C.brambleDark)}, 1.0 - smoothstep(0.0, 0.1 + aa * 0.6, f2d - f1d));
  // Thorns: short pale spikes scattered on a finer lattice.
  vec2 tq = p * 1.3;
  ivec2 tc = ivec2(floor(tq));
  float th = hash2(tc, 311);
  if (th < 0.45) {
    vec2 tf = (tq - vec2(tc)) / 1.3;
    vec2 c0 = vec2(0.2 + hash2(tc, 312) * 0.37, 0.2 + hash2(tc, 313) * 0.37);
    float ang = th * 40.0;
    vec2 dir = vec2(cos(ang), sin(ang)) * 0.24;
    // A curved thorn: dark base stroke, pale tip.
    float d = segDist(tf, c0 - dir, c0 + dir * 0.5);
    col = mix(col, ${c3(C.ink)}, band(d, 0.06, aa) * 0.85);
    col = mix(col, ${c3(C.thorn)}, band(segDist(tf, c0 - dir * 0.95, c0 - dir * 0.2), 0.035, aa));
  }
  return col;
}

vec3 shadeWood(vec2 p, int flags, float aa) {
  float ph = 4.0 / 3.0;
  float row = floor(p.y / ph);
  float off = hash2(ivec2(int(row), 0), 401) * 4.0;
  float u = p.x + off;
  float seg = floor(u / 4.0);
  ivec2 id = ivec2(int(seg), int(row));
  vec3 col = pick3(${c3(C.wood)}, ${c3(C.woodLight)}, ${c3(C.woodDark)}, hash2(id, 402));
  // Grain: soft streaks along the plank.
  float grain = vnoise(vec2(u * 0.5, p.y * 5.0 + hash2(id, 403) * 10.0));
  col *= 0.94 + grain * 0.1;
  vec3 gap = (flags & F_OVER_WATER) != 0 ? ${c3(C.deepShade)} : ${c3(C.woodGap)};
  float fy = (p.y - row * ph) / ph;
  float gy = min(fy, 1.0 - fy) * ph;
  float fu = u - seg * 4.0;
  float gx = min(fu, 4.0 - fu);
  col = mix(col, gap, max(band(gy, 0.07, aa), band(gx, 0.06, aa)));
  // Nails near each plank end.
  float ny = (fy - 0.5) * ph;
  float nd = min(length(vec2(fu - 0.35, ny)), length(vec2(fu - 3.65, ny)));
  col = mix(col, ${c3(C.woodGap)}, 1.0 - smoothstep(0.07 - aa, 0.07 + aa, nd));
  return col;
}

vec3 shadeWater(vec2 p, bool deep, Cls cl, float aa) {
  ivec2 tile = ivec2(floor(p / 4.0));
  vec2 f = p - vec2(tile) * 4.0;
  vec3 col = deep ? ${c3(C.deep)} : ${c3(C.shallow)};
  // Darker band under the upper shore (the bank's shade), like M0.
  float bandH = deep ? 1.1 : 0.8;
  int up = groundAt(ivec2(floor(vec2(p.x, p.y - bandH))));
  bool upWet = deep ? up == M_DEEP_WATER : isWater(up);
  if (!upWet) col = deep ? ${c3(C.deepShade)} : ${c3(C.shallowShade)};
  col += (vnoise(p * 0.45 + vec2(uTime * 0.25, uTime * 0.12)) - 0.5) * 0.045;
  // Ripples: small arcs that grow, drift and fade (M0's loop, continuous).
  float phase = uTime / ${f1(FX.ripplePeriod)};
  int marks = deep ? 1 : 2;
  float hw = deep ? ${f1(L.detail * 0.75)} : ${f1(L.detail * 0.6)};
  vec3 rc = deep ? ${c3(C.deepRipple)} : ${c3(C.shallowRipple)};
  float breathe = 0.85 + 0.15 * sin(phase * TAU);
  for (int m = 0; m < 2; m++) {
    if (m >= marks) break;
    float q = fract(phase + hash2(tile, 50 + m));
    float life = sin(PI * q);
    if (life < 0.2) continue;
    float len = (deep ? 0.85 : 0.55) * (0.5 + 0.5 * life);
    vec2 c = vec2(0.9 + hash2(tile, 60 + m) * 2.2 + (q - 0.5) * 0.6, 1.0 + hash2(tile, 70 + m) * 2.2);
    float u = (f.x - c.x) / len;
    float yc = c.y - 0.35 * len * (1.0 - u * u);
    float d = abs(u) <= 1.0
      ? abs(f.y - yc) / sqrt(1.0 + 0.49 * u * u)
      : min(length(f - c - vec2(len, 0.0)), length(f - c + vec2(len, 0.0)));
    col = mix(col, rc, band(d, hw, aa) * breathe * smoothstep(0.2, 0.4, life));
  }
  // Foam dashes just inside the shore, breathing in and out.
  if (!isWater(cl.b) && !isIce(cl.b) && cl.a != cl.b) {
    float dist = (cl.wa - cl.wb) * 0.5;
    float inset = 0.24 + 0.08 * sin(phase * TAU);
    bool horiz = abs(cl.grad.y) > abs(cl.grad.x);
    float along = horiz ? p.x : p.y;
    float perp = horiz ? p.y : p.x;
    int a = int(floor(along / 4.0));
    int e = int(floor(perp / 4.0 + 0.5));
    float h = hash2(horiz ? ivec2(a, e) : ivec2(e, a), 80);
    float s = float(a) * 4.0 + 0.4 + h * 0.6;
    float t = float(a + 1) * 4.0 - 0.4 - (1.0 - h) * 0.6;
    float dash = step(s, along) * step(along, t);
    col = mix(col, ${c3(C.foam)}, band(dist - inset, ${f1(L.detail * 0.7)}, aa) * dash * 0.8);
  }
  return col;
}

/** Voronoi crack lines; more cells crack as progress rises. */
float cracks(vec2 p, float progress, float aa) {
  vec2 q = p * 0.8;
  vec2 i = floor(q);
  float d1 = 9.0; float d2 = 9.0;
  float h1 = 1.0; float h2 = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      ivec2 c = ivec2(i) + ivec2(x, y);
      vec2 s = vec2(c) + vec2(hash2(c, 501), hash2(c, 502));
      float d = length(q - s);
      float h = hash2(c, 503);
      if (d < d1) { d2 = d1; h2 = h1; d1 = d; h1 = h; }
      else if (d < d2) { d2 = d; h2 = h; }
    }
  }
  float on = step(min(h1, h2), progress * 1.15);
  float w = 0.03 + 0.05 * progress;
  return on * (1.0 - smoothstep(w, w + aa * 0.8 + 0.02, (d2 - d1) * 0.5));
}

vec3 shadeIce(vec2 p, bool bridge, float phase, float aa) {
  vec3 col = bridge ? ${c3(C.iceBridge)} : ${c3(C.ice)};
  col = mix(col, ${c3(C.iceShade)}, smoothstep(0.55, 0.85, fbm(p * 0.35)) * 0.6);
  int up = groundAt(ivec2(floor(vec2(p.x, p.y - 0.6))));
  if (!isIce(up) && !isWater(up)) col = mix(col, ${c3(C.iceShade)}, 0.7);
  // Sheen: two diagonal streaks sweeping slowly.
  float s = fract((p.x + p.y * 0.7) * 0.06 - uTime * 0.07);
  float sheen = band(s - 0.5, 0.012, 0.01) + 0.5 * band(s - 0.535, 0.006, 0.008);
  col = mix(col, ${c3(C.iceSheen)}, sheen * 0.8);
  // Glints: little four-point stars twinkling on some cells.
  ivec2 cc = ivec2(floor(p * 0.5));
  float gh = hash2(cc, 520);
  if (gh < 0.22) {
    vec2 gc = (vec2(cc) + 0.25 + vec2(hash2(cc, 521), hash2(cc, 522)) * 0.5) * 2.0;
    vec2 d = abs(p - gc);
    float tw = pow(max(0.0, sin(uTime * 2.2 + gh * 40.0)), 6.0);
    float star = max(1.0 - smoothstep(0.0, 0.05 + aa, d.y) , 0.0) * (1.0 - smoothstep(0.0, 0.45, d.x));
    star = max(star, (1.0 - smoothstep(0.0, 0.05 + aa, d.x)) * (1.0 - smoothstep(0.0, 0.45, d.y)));
    col = mix(col, vec3(1.0), star * tw);
  }
  if (bridge) {
    if (phase > 0.0) {
      float k = cracks(p, phase, aa);
      float hl = cracks(p + vec2(0.06, 0.06), phase, aa);
      col = mix(col, vec3(1.0), hl * 0.6);
      col = mix(col, ${c3(C.crack)}, k);
      float sink = smoothstep(0.65, 1.0, phase);
      float flick = 0.75 + 0.25 * sin(uTime * 22.0);
      col = mix(col, ${c3(C.deep)}, sink * 0.45 * flick);
    }
  } else if (phase > 0.0) {
    // Thawing: wetter and bluer.
    col = mix(col, ${c3(C.shallow)}, phase * 0.55);
  }
  return col;
}

vec3 shadeMud(vec2 p, float aa) {
  vec3 col = ${c3(C.mud)};
  col = mix(col, ${c3(C.mudDark)}, smoothstep(0.45, 0.7, fbm(p * 0.55)) * 0.75);
  float g = vnoise(p * 1.4 + vec2(3.1, 7.7));
  col = mix(col, ${c3(C.mudGloss)}, smoothstep(0.8, 0.86, g) * 0.55);
  ivec2 cc = ivec2(floor(p * 0.7));
  if (hash2(cc, 610) < 0.25) {
    vec2 bc = (vec2(cc) + 0.3 + vec2(hash2(cc, 611), hash2(cc, 612)) * 0.4) / 0.7;
    float r = length(p - bc);
    col = mix(col, ${c3(C.mudDark)}, band(r - 0.22, 0.05, aa) * 0.8);
  }
  return col;
}

vec3 shadeMetal(vec2 p, float aa) {
  // One riveted plate per tile, bevelled: light top-left lip, dark bottom-right.
  vec2 plate = floor(p / 4.0);
  vec2 f = p - plate * 4.0;
  vec3 col = ${c3(C.metal)} * (0.96 + hash2(ivec2(plate), 701) * 0.08);
  col *= 0.97 + vnoise(vec2(p.x * 0.25, p.y * 5.0)) * 0.05;
  float lo = min(f.x, f.y);
  float hi = max(f.x, f.y);
  col = mix(col, ${c3(C.metalLight)}, 1.0 - smoothstep(0.22 - aa, 0.22 + aa, lo));
  col = mix(col, ${c3(C.metalDark)}, smoothstep(3.78 - aa, 3.78 + aa, hi));
  col = mix(col, ${c3(C.rivet)}, 1.0 - smoothstep(0.06 - aa, 0.06 + aa, min(lo, 4.0 - hi)));
  // A diagonal tread line across the plate.
  float tread = abs(fract((f.x + f.y) * 0.25) - 0.5);
  col = mix(col, ${c3(C.metalLight)}, band(tread, 0.025, aa * 0.25) * 0.5);
  vec2 rc = vec2(f.x < 2.0 ? 0.6 : 3.4, f.y < 2.0 ? 0.6 : 3.4);
  float rd = length(f - rc);
  col = mix(col, ${c3(C.rivet)}, 1.0 - smoothstep(0.2 - aa, 0.2 + aa, rd));
  col = mix(col, ${c3(C.metalLight)}, 1.0 - smoothstep(0.07 - aa, 0.07 + aa, length(f - rc + 0.06)));
  return col;
}

vec3 shadeAsh(vec2 p, float aa) {
  vec3 col = ${c3(C.ash)} * (0.95 + vnoise(p * 0.8) * 0.1);
  ivec2 c = ivec2(floor(p * 2.5));
  float h = hash2(c, 801);
  vec2 sp = (vec2(c) + 0.25 + vec2(hash2(c, 802), hash2(c, 803)) * 0.5) / 2.5;
  float d = length(p - sp);
  if (h < 0.3) col = mix(col, ${c3(C.ashDark)}, 1.0 - smoothstep(0.06, 0.06 + aa + 0.02, d));
  else if (h > 0.85) col = mix(col, ${c3(C.ashLight)}, 1.0 - smoothstep(0.05, 0.05 + aa + 0.02, d));
  return col;
}

vec3 shadePit(vec2 p, float aa) {
  vec3 col = ${c3(C.pit)};
  // The far bank's earth face drops into the pit under its upper edge (1.5 cells), with strata.
  float y = p.y;
  bool up1 = groundAt(ivec2(floor(vec2(p.x, y - 1.0)))) != M_PIT;
  bool up2 = groundAt(ivec2(floor(vec2(p.x, y - 2.0)))) != M_PIT;
  float d = up1 ? fract(y) : (up2 ? 1.0 + fract(y) : 9.0);
  if (d < 1.6) {
    vec3 face = mix(${c3(C.pitWall)}, col, smoothstep(0.2, 1.6, d));
    float strata = band(fract(d * 1.6 + vnoise(vec2(p.x * 0.7, 0.0)) * 0.4) - 0.5, 0.06, aa);
    face = mix(face, face * 0.7, strata * (1.0 - smoothstep(0.8, 1.6, d)));
    col = face;
  }
  return col;
}

vec3 shadeMaterial(int g, vec2 p, Cls cl, vec4 code, float aa) {
  int flags = byteOf(code.g);
  if (g == M_STONE) return shadeStone(p, aa);
  if (g == M_DIRT) return shadeDirt(p, aa);
  if (g == M_GRASS) return shadeGrass(p, aa);
  if (g == M_BRAMBLE) return shadeBramble(p, aa);
  if (g == M_WOOD) return shadeWood(p, flags, aa);
  if (g == M_SHALLOW_WATER) return shadeWater(p, false, cl, aa);
  if (g == M_DEEP_WATER) return shadeWater(p, true, cl, aa);
  if (g == M_ICE || g == M_ICE_BRIDGE) {
    float phase = byteOf(code.a) == g ? code.b : 0.0;
    return shadeIce(p, g == M_ICE_BRIDGE, phase, aa);
  }
  if (g == M_RIME) return shadeIce(p, false, 0.0, aa);
  if (g == M_MUD) return shadeMud(p, aa);
  if (g == M_METAL_FLOOR) return shadeMetal(p, aa);
  if (g == M_ASH) return shadeAsh(p, aa);
  if (g == M_PIT) return shadePit(p, aa);
  if (g == M_METAL_PYLON) return ${c3(C.pylon)};
  return ${c3(C.wallTop)};
}
`;
