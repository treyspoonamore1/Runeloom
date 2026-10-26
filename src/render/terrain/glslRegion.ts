import { c3, f1 } from './glslLib';
import { FEN } from './regionLook';
import { TERRAIN_LINE as L } from './terrainColors';

/**
 * Region looks for the ground shader (CONTENT §13, regionLook.ts): Fen reeds, rusted teal and
 * sooted metal, glassy water, Foundry soot, and the furnace vents (lit and doused, rule 30).
 * Included in the material shader before shadeMaterial; uRegion picks the look per room.
 */
export const REGION_GLSL = /* glsl */ `
bool fenLook() { return uRegion > 0.5; }
bool foundryLook() { return uRegion > 1.5; }

/** Soot smudges (the Foundry): broad dark patches that darken the color. */
vec3 applySoot(vec3 col, vec2 p) {
  float s = smoothstep(0.55, 0.85, fbm(p * 0.18 + vec2(4.1, 1.3)));
  return mix(col, ${c3(FEN.soot)}, s * 0.45);
}

/** Reed beds: marsh ground with tall swaying blades, a few topped with cattail heads. */
vec3 shadeReeds(vec2 p, float aa) {
  ivec2 tile = ivec2(floor(p / 4.0));
  vec3 col = pick3(${c3(FEN.reed[0])}, ${c3(FEN.reed[1])}, ${c3(FEN.reed[2])}, hash2(tile, 0));
  col *= 1.0 + (vnoise(p * 0.7) - 0.5) * 0.08;
  col = mix(col, ${c3(FEN.reedEdge)}, smoothstep(0.6, 0.85, fbm(p * 0.4)) * 0.3);
  float hw = ${f1(L.detail * 0.45)};
  const float S = 1.3;
  ivec2 c0 = ivec2(floor(p / S));
  // Blades rise north of their base, so look at lattice cells at and below this pixel.
  for (int dy = 0; dy <= 2; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      ivec2 c = c0 + ivec2(dx, dy);
      // One hash per blade, split into bytes (the reed bed is the costliest Fen look).
      uint hh = hash3u(c.x, c.y, 1201);
      float h = float(hh & 255u) / 255.0;
      if (h > 0.62) continue;
      vec2 r = vec2(float((hh >> 8u) & 255u), float((hh >> 16u) & 255u)) / 255.0;
      float hl = float((hh >> 24u) & 255u) / 255.0;
      vec2 b = (vec2(c) + vec2(0.2 + 0.6 * r.x, 0.55 + 0.45 * r.y)) * S;
      float len = 1.5 + 1.3 * hl;
      float sway = 0.2 * sin(uTime * 1.3 + h * 17.0 + b.x * 0.2);
      vec2 tip = b + vec2(sway + (r.x - 0.5) * 0.6, -len);
      vec2 mid = mix(b, tip, 0.5) + vec2(sway * 0.4, 0.0);
      float d = min(segDist(p, b, mid), segDist(p, mid, tip));
      vec3 bc = h < 0.2 ? ${c3(FEN.reedBladeLight)} : ${c3(FEN.reedBlade)};
      col = mix(col, bc, band(d, hw * (1.0 - 0.4 * clamp((b.y - p.y) / len, 0.0, 1.0)), aa));
      if (h < 0.1) {
        vec2 hc = mix(b, tip, 0.8);
        col = mix(col, ${c3(FEN.reedHead)}, ellipseMask(p, hc, vec2(0.2, 0.42), aa));
      }
    }
  }
  return col;
}

/** Riveted plates in the given colors (the region 1 metal look, recolored). */
vec3 metalPlates(vec2 p, float aa, vec3 base, vec3 light, vec3 dark, vec3 rivet) {
  vec2 plate = floor(p / 4.0);
  vec2 f = p - plate * 4.0;
  vec3 col = base * (0.96 + hash2(ivec2(plate), 701) * 0.08);
  col *= 0.97 + vnoise(vec2(p.x * 0.25, p.y * 5.0)) * 0.05;
  float lo = min(f.x, f.y);
  float hi = max(f.x, f.y);
  col = mix(col, light, 1.0 - smoothstep(0.22 - aa, 0.22 + aa, lo));
  col = mix(col, dark, smoothstep(3.78 - aa, 3.78 + aa, hi));
  col = mix(col, rivet, 1.0 - smoothstep(0.06 - aa, 0.06 + aa, min(lo, 4.0 - hi)));
  float tread = abs(fract((f.x + f.y) * 0.25) - 0.5);
  col = mix(col, light, band(tread, 0.025, aa * 0.25) * 0.5);
  vec2 rc = vec2(f.x < 2.0 ? 0.6 : 3.4, f.y < 2.0 ? 0.6 : 3.4);
  float rd = length(f - rc);
  col = mix(col, rivet, 1.0 - smoothstep(0.2 - aa, 0.2 + aa, rd));
  col = mix(col, light, 1.0 - smoothstep(0.07 - aa, 0.07 + aa, length(f - rc + 0.06)));
  return col;
}

/** Rusted teal metal (Fen) or dark sooted metal (Foundry), with rust blooms at seams and rivets. */
vec3 shadeRegionMetal(vec2 p, float aa) {
  bool fd = foundryLook();
  vec3 col = fd
    ? metalPlates(p, aa, ${c3(FEN.foundryMetal)}, ${c3(FEN.foundryMetalLight)}, ${c3(FEN.foundryMetalDark)}, ${c3(FEN.soot)})
    : metalPlates(p, aa, ${c3(FEN.metal)}, ${c3(FEN.metalLight)}, ${c3(FEN.metalDark)}, ${c3(FEN.rivet)});
  vec2 f = p - floor(p / 4.0) * 4.0;
  float seam = min(min(f.x, 4.0 - f.x), min(f.y, 4.0 - f.y));
  float r = fbm(p * 0.45 + vec2(9.3, 2.1)) + (1.0 - smoothstep(0.0, 1.2, seam)) * 0.25;
  float rk = fd ? 0.45 : 0.75;
  col = mix(col, ${c3(FEN.rust)}, smoothstep(0.62, 0.78, r) * rk);
  col = mix(col, ${c3(FEN.rustDark)}, smoothstep(0.78, 0.9, r) * rk * 0.8);
  return fd ? applySoot(col, p) : col;
}

/** Glassy water: mirror bands of the overcast sky drifting over it, a crisp glint and sparkles. */
vec3 glassify(vec3 col, vec2 p, bool deep, float aa) {
  float u = p.y * 0.2 + p.x * 0.06 + vnoise(p * 0.07 + vec2(uTime * 0.02, 0.0)) * 1.3;
  float s = fract(u - uTime * 0.015);
  float refl = smoothstep(0.0, 0.2, s) * (1.0 - smoothstep(0.3, 0.55, s));
  col = mix(col, ${c3(FEN.sky)}, refl * (deep ? 0.13 : 0.2));
  float glint = band(s - 0.03, 0.014, 0.012) * (0.5 + 0.5 * vnoise(p * 0.4 + vec2(uTime * 0.1, 0.0)));
  col = mix(col, ${c3(FEN.sky)}, glint * (deep ? 0.35 : 0.55));
  ivec2 cc = ivec2(floor(p * 0.35));
  float gh = hash2(cc, 1301);
  if (gh < 0.1) {
    vec2 gc = (vec2(cc) + 0.25 + vec2(hash2(cc, 1302), hash2(cc, 1303)) * 0.5) / 0.35;
    vec2 d = abs(p - gc);
    float tw = pow(max(0.0, sin(uTime * 1.6 + gh * 70.0)), 8.0);
    float star = (1.0 - smoothstep(0.0, 0.05 + aa, d.y)) * (1.0 - smoothstep(0.0, 0.5, d.x));
    star = max(star, (1.0 - smoothstep(0.0, 0.05 + aa, d.x)) * (1.0 - smoothstep(0.0, 0.3, d.y)));
    col = mix(col, vec3(1.0), star * tw * 0.9);
  }
  return col;
}

/**
 * Furnace vent (rule 30): a dark grate of bars over a pit. Lit, the slots glow and flicker (the
 * flames are the fire pass, fed by the packer); doused, the slots are cold and damp.
 */
vec3 shadeVent(vec2 p, bool lit, float aa) {
  ivec2 tile = ivec2(floor(p / 4.0));
  vec2 f = p - vec2(tile) * 4.0;
  vec3 col;
  if (lit) {
    float n = vnoise(p * 1.1 + vec2(0.0, uTime * 1.8));
    float fl = 0.8 + 0.2 * sin(uTime * 11.0 + hash2(tile, 1401) * 30.0 + p.x * 0.8);
    col = mix(${c3(FEN.ventGlow)}, ${c3(FEN.ventHot)}, smoothstep(0.35, 0.85, n)) * fl;
  } else {
    col = ${c3(FEN.ventCold)} * (0.85 + 0.3 * vnoise(p * 0.9));
  }
  float t = fract(f.y / 0.8);
  float bar = band((t - 0.25) * 0.8, 0.15, aa);
  float frame = 1.0 - smoothstep(0.32 - aa, 0.32 + aa, min(min(f.x, 4.0 - f.x), min(f.y, 4.0 - f.y)));
  vec3 barCol = lit ? ${c3(FEN.grate)} : ${c3(FEN.grateBar)};
  col = mix(col, barCol, max(bar, frame));
  // The bars' lit upper lip: hot orange when lit, a wet grey sheen when doused.
  float lip = band((t - 0.13) * 0.8, 0.035, aa) * (1.0 - frame);
  col = mix(col, lit ? ${c3(FEN.ventGlow)} : ${c3(FEN.grateBarLight)}, lip * (lit ? 0.8 : 0.6));
  return foundryLook() ? applySoot(col, p) : col;
}
`;
