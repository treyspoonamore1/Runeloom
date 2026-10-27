import { c3, f1 } from './glslLib';
import { ATMO } from './regionLook';
import { TERRAIN as C } from './terrainColors';

/**
 * The atmosphere pass (M8; DESIGN §6.6, §14): fog over the floor, objects and loot, parted by the
 * player's lantern and lit braziers and thinned where fire and charge glow through it; Gale gust
 * streaks along each gust's direction, fading with its timer; faint drifting streaks for room
 * wind. Drawn below the fire pass, telegraphs, enemies and the player, so fog never hides threats.
 * Premultiplied output like the other passes.
 */
export const ATMO_MAIN = /* glsl */ `
/**
 * Dashes in lanes: along runs with the wind, across runs across it (cells). Dashes move at speed
 * (cells/s). density = share of lanes that carry a streak, hw = half width, len = dash period and
 * LANE = lane spacing (cells). Returns the coverage and writes the dark under-stroke's to shadow.
 */
float dashes(float along, float across, float speed, float density, float len, float hw, float LANE, float aa, out float shadow) {
  float lane = floor(across / LANE);
  ivec2 lc = ivec2(int(lane), 0);
  float h = hash2(lc, 1501);
  shadow = 0.0;
  if (h > density) return 0.0;
  float sp = speed * (0.75 + 0.5 * hash2(lc, 1502));
  float u = fract((along - uTime * sp) / len + hash2(lc, 1503));
  // A dash: a quick bright head and a tail that thins and fades behind it (upwind).
  float body = smoothstep(0.4, 0.47, u) * (1.0 - smoothstep(0.97, 1.0, u));
  float tail = smoothstep(0.4, 0.97, u);
  float c = (fract(across / LANE) - 0.5) * LANE + (hash2(lc, 1504) - 0.5) * 0.5;
  float w = hw * (0.45 + 0.55 * tail);
  shadow = body * band(c - w * 1.6, w * 1.2, aa) * tail;
  return body * band(c, w, aa) * (0.35 + 0.65 * tail);
}

/** Streaks blowing along dir (unit), in straight lanes across it. */
float streaks(vec2 p, vec2 dir, float speed, float density, float len, float hw, float LANE, float aa, out float shadow) {
  return dashes(dot(p, dir), dot(p, vec2(-dir.y, dir.x)), speed, density, len, hw, LANE, aa, shadow);
}

/**
 * Playtest 8: the radial burst around uBursts[k] that p belongs to, or -1. A pixel belongs to
 * a burst when it is within its reach and its cell blows away from that center (so a cone
 * crossing the burst keeps its own streaks).
 */
int burstAt(vec2 p, vec2 cellDir) {
  for (int k = 0; k < 8; k++) {
    vec4 b = uBursts[k];
    if (b.w <= 0.0) continue;
    vec2 d = p - b.xy;
    float r = length(d);
    if (r > b.z) continue;
    if (r < 1.5 || dot(d / r, cellDir) > 0.6) return k;
  }
  return -1;
}

void main() {
  vec2 p = vPos;
  float aa = max(fwidth(p.x), 1e-4) * 0.75;
  vec4 at = atmoAt(p);
  vec3 rgb = vec3(0.0);
  float a = 0.0;

  // Fog (rule 29): banks of mist drifting slowly, thick and thin patches, ragged edges.
  if (at.r > 0.003) {
    float n = fbm(p * vec2(0.045, 0.09) + vec2(uTime * 0.035, uTime * 0.01));
    vec2 q2 = p * 0.13 + vec2(-uTime * 0.05, uTime * 0.02) + n * 1.6;
    float n2 = (vnoise(q2) * 0.66 + vnoise(q2 * 2.03 + vec2(17.1, 3.7)) * 0.34);
    float edge = smoothstep(0.1, 0.75, at.r * 1.1 + (n - 0.5) * 0.6);
    float body = 0.6 + 0.4 * smoothstep(0.3, 0.75, n2);
    float dens = edge * body;
    // The lantern: a soft clear circle around the player (a faint haze stays), its rim wavering.
    float dl = length(p - uLantern.xy) + (n2 - 0.5) * 2.5;
    float lantern = mix(${f1(0.1)}, 1.0, smoothstep(uLantern.z - uLantern.w, uLantern.z + uLantern.w, dl));
    // Lit braziers part the fog and warm it.
    float lights = 1.0;
    float warm = 0.0;
    for (int i = 0; i < 8; i++) {
      vec4 L = uLights[i];
      if (L.w <= 0.0) continue;
      float k = (1.0 - smoothstep(L.z * 0.35, L.z, length(p - L.xy) + (n2 - 0.5) * 2.0)) * L.w;
      lights *= 1.0 - 0.85 * k;
      warm = max(warm, k);
    }
    // Fire and charge glow through it (DESIGN §14): charge shows which pool reaches which pylon.
    vec4 g = glowAt(p);
    vec4 fl = fieldsAt(p);
    float fire = clamp(g.r * 1.6 + fl.r, 0.0, 1.0);
    float charge = clamp(g.g * 1.8 + fl.g * 1.2, 0.0, 1.0);
    float thru = max(fire, charge);
    float fa = dens * lantern * lights * (1.0 - 0.8 * thru) * uWind.w;
    vec3 fc = mix(${c3(ATMO.fogShade)}, ${c3(ATMO.fogLight)}, smoothstep(0.35, 0.8, n2));
    fc = mix(fc, ${c3(ATMO.fogWarm)}, max(warm, fire) * 0.45);
    fc = mix(fc, ${c3(C.stormGlow)}, charge * 0.55);
    rgb = fc * fa;
    a = fa;
    // The lantern's rim catches a little warm light.
    float rim = band(dl - uLantern.z, uLantern.w * 0.5, uLantern.w * 0.5) * edge * 0.12 * uWind.w;
    rgb += ${c3(ATMO.fogWarm)} * rim;
  }

  // Gusts: #E8F4F0 streaks along the gust, fading with its timer (DESIGN §6.6 readability). The
  // direction is the pixel's own cell's: bilinear blending turns a radial gust's seams and center
  // into twisted lanes and noise (playtest 8). Radial gusts (Gale Lob, Nova) streak outward from
  // their center in wedge lanes, clear of the center itself.
  if (at.g > 0.01) {
    vec4 ac = atmoCell(p);
    vec2 v = ac.ba * 2.0 - 1.0;
    float lv = length(v);
    if (lv > 0.05) {
      vec2 dir = v / lv;
      float sh;
      // A faint pale wash shows the gust's shape; streaks show its direction.
      float wash = smoothstep(0.0, 0.6, at.g) * ${f1(0.1)};
      rgb = rgb * (1.0 - wash) + ${c3(ATMO.gale)} * wash;
      a = a + wash * (1.0 - a);
      float s;
      int k = burstAt(p, dir);
      if (k >= 0) {
        vec2 d = p - uBursts[k].xy;
        float r = length(d);
        // Lanes are wedges: angle × a fixed radius, so a lane keeps its streak as it fans out.
        float lanes = uBurstLook.z;
        float across = (atan(d.y, d.x) / (2.0 * PI) + 0.5) * lanes * 1.1;
        // Across units per cell of arc here: keeps the streaks' width and edges in cells.
        float k = lanes * 1.1 / (2.0 * PI * max(r, 0.5));
        s = dashes(r, across, uBurstLook.y, 0.85, uBurstLook.x, 0.27 * k, 1.1, aa * k, sh);
        float clear = smoothstep(0.8, 2.0, r);
        s *= clear * at.g;
        sh *= clear;
      } else s = streaks(p, dir, 22.0, 0.85, 8.0, 0.27, 1.1, aa, sh) * at.g;
      sh *= at.g * 0.6;
      rgb = rgb * (1.0 - sh) + ${c3(ATMO.galeShadow)} * sh;
      a = a + sh * (1.0 - a);
      float sa = s * 0.85;
      rgb = rgb * (1.0 - sa) + ${c3(ATMO.gale)} * sa;
      a = a + sa * (1.0 - a);
    }
  }

  // Room wind: faint, sparse streaks drifting the whole room's way.
  if (uWind.z > 0.5) {
    float sh;
    float s = streaks(p, uWind.xy, 6.0, 0.3, 14.0, 0.13, 1.5, aa, sh);
    float sa = s * ${f1(0.45)} * (1.0 - at.g);
    sh *= 0.12 * (1.0 - at.g);
    rgb = rgb * (1.0 - sh) + ${c3(ATMO.galeShadow)} * sh;
    a = a + sh * (1.0 - a);
    rgb = rgb * (1.0 - sa) + ${c3(ATMO.gale)} * sa;
    a = a + sa * (1.0 - a);
  }
  if (a < 0.002) discard;
  finalColor = vec4(rgb, a);
}
`;
