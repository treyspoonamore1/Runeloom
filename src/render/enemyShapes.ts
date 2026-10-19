import type { AtlasEntry } from './atlas';
import { ENEMY, INK } from './combatPalette';
import type { Pen } from './pen';

/**
 * Baked enemy parts (DESIGN §15: flat shapes, thick dark outlines). Local units are cells,
 * (0, 0) is the collision center unless noted, +y is south. Each kind also gets a `<kind>_flash`
 * entry: the body and head drawn from the same paths in plain white, for the hit flash.
 *
 * A color function `k` maps each color: identity for the normal art, white for the flash.
 */
type K = (color: number) => number;
const NORMAL: K = (c) => c;
const WHITE: K = () => 0xffffff;
const O = ENEMY.outline;

/** Closed smooth blob through points at the given radii, evenly spaced, starting east. */
export function blob(p: Pen, cx: number, cy: number, rx: number, ry: number, radii: readonly number[]): Pen {
  const n = radii.length;
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    px.push(cx + Math.cos(a) * rx * radii[i]!);
    py.push(cy + Math.sin(a) * ry * radii[i]!);
  }
  const mid = (i: number) => [(px[i % n]! + px[(i + 1) % n]!) / 2, (py[i % n]! + py[(i + 1) % n]!) / 2];
  const [mx, my] = mid(n - 1);
  p.moveTo(mx!, my!);
  for (let i = 0; i < n; i++) {
    const [ex, ey] = mid(i);
    p.quad(px[i]!, py[i]!, ex!, ey!);
  }
  return p.close();
}

// ---- Tinderling: a living ember -------------------------------------------------------------

const TIND_RADII = [1.06, 0.95, 1.08, 0.97, 1.04, 0.94, 1.1, 0.97];

function tinderBody(p: Pen, k: K): void {
  const c = ENEMY.tinderling;
  blob(p, 0, -0.15, 1.15, 1.02, TIND_RADII).fill(k(c.coalShade));
  if (k === NORMAL) {
    blob(p, -0.12, -0.27, 0.95, 0.84, TIND_RADII).fill(c.coal);
    p.ellipse(-0.42, -0.62, 0.34, 0.2).fill(c.coalLight);
    // Glowing cracks: a soft under-glow, then the bright line.
    const cracks = [
      [-0.75, 0.25, -0.35, 0.05, -0.45, -0.3, -0.1, -0.5],
      [0.25, 0.7, 0.45, 0.35, 0.3, 0.05, 0.6, -0.15],
      [-0.15, 0.45, 0.05, 0.25],
    ];
    for (const w of [0.32, 0.13]) {
      for (const cr of cracks) {
        p.moveTo(cr[0]!, cr[1]!);
        for (let i = 2; i < cr.length; i += 2) p.lineTo(cr[i]!, cr[i + 1]!);
        p.stroke(w, w > 0.2 ? c.crack : c.flameInner, w > 0.2 ? 0.45 : 1);
      }
    }
  }
  blob(p, 0, -0.15, 1.15, 1.02, TIND_RADII).stroke(O, k(INK));
}

function tinderEyes(p: Pen): void {
  const c = ENEMY.tinderling;
  for (const s of [-1, 1]) {
    p.ellipse(s * 0.3, 0, 0.21, 0.26).fill(c.eye).stroke(0.1, INK);
    p.circle(s * 0.3 + 0.03, 0.04, 0.1).fill(INK);
  }
}

/** Flame tongue, base at (0, 0), pointing up. */
function flamePath(p: Pen, s: number): Pen {
  return p
    .moveTo(0, -1.25 * s)
    .quad(0.58 * s, -0.5 * s, 0.42 * s, -0.02 * s)
    .quad(0, 0.32 * s, -0.42 * s, -0.02 * s)
    .quad(-0.58 * s, -0.5 * s, 0, -1.25 * s)
    .close();
}

function tinderFlame(p: Pen): void {
  const c = ENEMY.tinderling;
  flamePath(p, 1).fill(c.flameOuter).stroke(0.13, INK);
  flamePath(p, 0.62).fill(c.flameInner);
  flamePath(p, 0.3).fill(c.flameCore);
}

// ---- Shieldbearer: bulky, big wooden shield on its facing side ----------------------------

function torsoPath(p: Pen): Pen {
  return p
    .moveTo(-1.5, -1.25)
    .quad(-2.0, 0, -1.62, 1.15)
    .quad(0, 1.8, 1.62, 1.15)
    .quad(2.0, 0, 1.5, -1.25)
    .quad(0, -1.7, -1.5, -1.25)
    .close();
}

function shieldBody(p: Pen, k: K): void {
  const c = ENEMY.shieldbearer;
  torsoPath(p).fill(k(c.armor));
  if (k === NORMAL) {
    p.moveTo(0.35, 1.7).quad(1.2, 1.5, 1.62, 1.15).quad(2.0, 0, 1.5, -1.25).quad(1.25, 0.4, 0.35, 1.7);
    p.close().fill(c.armorShade);
    p.moveTo(-1.72, 0.62).quad(0, 1.12, 1.72, 0.62).stroke(0.5, c.leather, 1, 'butt');
    p.roundRect(-0.3, 0.6, 0.6, 0.45, 0.1).fill(c.helmShade).stroke(0.1, INK);
    p.moveTo(-1.0, -0.6).quad(-1.3, 0, -1.1, 0.35).stroke(0.18, c.armorLight);
  }
  torsoPath(p).stroke(O * 1.1, k(INK));
  for (const s of [-1, 1]) {
    p.circle(s * 1.5, -1.05, 0.66).fill(k(c.armorLight)).stroke(O, k(INK));
  }
  // Helmet sits on the torso.
  p.circle(0, -1.7, 1.0).fill(k(c.helm));
  if (k === NORMAL) {
    p.moveTo(0.35, -0.82).arc(0, -1.7, 1.0, 1.2, -0.6, true).quad(0.65, -1.2, 0.35, -0.82).close();
    p.fill(c.helmShade);
    p.moveTo(0, -2.68).lineTo(0, -2.0).stroke(0.22, c.helmShade);
  }
  p.circle(0, -1.7, 1.0).stroke(O, k(INK));
}

/** Visor slit, centered at (0, 0); shifted toward the facing direction. */
function shieldVisor(p: Pen): void {
  const c = ENEMY.shieldbearer;
  p.roundRect(-0.62, -0.17, 1.24, 0.34, 0.15).fill(c.visor);
  p.circle(-0.26, 0, 0.08).circle(0.26, 0, 0.08).fill(c.eye);
}

/** Shield arc pointing +x, matching the 100° block arc (CONTENT §5). */
export const SHIELD_HALF_ANGLE = (50 * Math.PI) / 180;
const SH_IN = 2.15;
const SH_OUT = 3.25;

function shieldPath(p: Pen): Pen {
  const a = SHIELD_HALF_ANGLE;
  return p.arc(0, 0, SH_OUT, -a, a).arc(0, 0, SH_IN, a, -a, true).close();
}

function shieldShape(p: Pen): void {
  const c = ENEMY.shieldbearer;
  const a = SHIELD_HALF_ANGLE;
  // Ground hint of the protected arc.
  p.arc(0, 0, 3.95, -a, a).stroke(0.2, c.arcHint, 0.7);
  shieldPath(p).fill(c.wood);
  p.arc(0, 0, SH_IN + 0.25, -a, a).arc(0, 0, SH_IN, a, -a, true).close().fill(c.woodShade);
  for (const t of [-0.5, 0, 0.5]) {
    const ang = t * a;
    p.moveTo(Math.cos(ang) * SH_IN, Math.sin(ang) * SH_IN)
      .lineTo(Math.cos(ang) * SH_OUT, Math.sin(ang) * SH_OUT)
      .stroke(0.1, c.woodGrain);
  }
  p.arc(0, 0, SH_OUT - 0.08, -a, a).stroke(0.24, c.rim, 1, 'butt');
  shieldPath(p).stroke(O, INK);
  p.circle((SH_IN + SH_OUT) / 2, 0, 0.42).fill(c.boss).stroke(0.14, INK);
  for (const s of [-1, 1]) {
    const ang = s * a * 0.78;
    p.circle(Math.cos(ang) * 2.7, Math.sin(ang) * 2.7, 0.12).fill(c.rim);
  }
}

function shieldFlash(p: Pen): void {
  shieldPath(p).fill(0xffffff).stroke(O, 0xffffff);
}

function boot(p: Pen): void {
  p.ellipse(0, 0, 0.5, 0.36).fill(ENEMY.shieldbearer.boot).stroke(0.16, INK);
}

// ---- Ember Archer: lean, hooded, bow toward its target -------------------------------------

function archerCloakPath(p: Pen): Pen {
  return p
    .moveTo(-0.66, -0.95)
    .bez(-1.0, -0.35, -1.25, 0.55, -1.12, 1.05)
    .quad(0, 1.48, 1.12, 1.05)
    .bez(1.25, 0.55, 1.0, -0.35, 0.66, -0.95)
    .quad(0, -1.22, -0.66, -0.95)
    .close();
}

function archerBody(p: Pen, k: K): void {
  const c = ENEMY.ember_archer;
  if (k === NORMAL) {
    // Quiver on the back, arrow tips glowing.
    p.moveTo(-0.55, -0.35).lineTo(0.15, -2.15).stroke(0.62 + O, INK);
    p.moveTo(-0.55, -0.35).lineTo(0.15, -2.15).stroke(0.62, c.quiver);
    for (const dx of [-0.12, 0.14]) p.circle(0.2 + dx, -2.3 + dx * 0.4, 0.15).fill(c.arrowTip).stroke(0.08, INK);
  }
  archerCloakPath(p).fill(k(c.cloak));
  if (k === NORMAL) {
    p.moveTo(0.1, 1.38).quad(0.8, 1.3, 1.12, 1.05).bez(1.25, 0.55, 1.0, -0.35, 0.66, -0.95);
    p.quad(0.9, 0.3, 0.1, 1.38).close().fill(c.cloakShade);
    p.moveTo(-1.02, 0.98).quad(0, 1.36, 1.02, 0.98).stroke(0.22, c.trim);
    p.moveTo(-0.62, -0.6).lineTo(0.7, 0.35).stroke(0.18, c.quiver);
  }
  archerCloakPath(p).stroke(O, k(INK));
  // Hood with a peak.
  p.moveTo(-0.55, -1.75).quad(0, -2.75, 0.55, -1.75).close().fill(k(c.hood)).stroke(O * 0.8, k(INK));
  p.circle(0, -1.2, 0.84).fill(k(c.hood)).stroke(O, k(INK));
}

function archerFace(p: Pen): void {
  const c = ENEMY.ember_archer;
  p.ellipse(0, 0, 0.5, 0.4).fill(c.hoodInner);
  p.ellipse(-0.18, 0.02, 0.1, 0.07).ellipse(0.18, 0.02, 0.1, 0.07).fill(c.eye);
}

/** Bow with the grip at (0, 0), belly toward +x. String tips at (BOW_TIP_X, ±BOW_TIP_Y). */
export const BOW_TIP_X = -0.58;
export const BOW_TIP_Y = 1.2;
function bow(p: Pen): void {
  const c = ENEMY.ember_archer;
  const a = 0.9;
  p.arc(-1.5, 0, 1.5, -a, a).stroke(0.26 + O, INK);
  p.arc(-1.5, 0, 1.5, -a, a).stroke(0.26, c.bow);
  p.arc(-1.5, 0, 1.44, -a * 0.6, a * 0.2).stroke(0.08, c.bowLight);
  p.roundRect(-0.14, -0.3, 0.3, 0.6, 0.1).fill(c.quiver).stroke(0.1, INK);
}

/** Nocked arrow, nock at (0, 0), pointing +x. */
function nockedArrow(p: Pen): void {
  const c = ENEMY.ember_archer;
  p.moveTo(0, 0).lineTo(2.0, 0).stroke(0.14 + 0.16, INK);
  p.moveTo(0, 0).lineTo(2.0, 0).stroke(0.14, c.arrowShaft);
  p.poly([0, 0, -0.1, -0.24, 0.35, 0, -0.1, 0.24]).fill(c.string);
  p.circle(2.05, 0, 0.32).fill({ color: c.arrowTip, alpha: 0.35 });
  p.poly([1.85, -0.2, 2.3, 0, 1.85, 0.2]).fill(c.arrowTip).stroke(0.08, INK);
}

// ---- Training dummy --------------------------------------------------------------------------

function dummyBody(p: Pen, k: K): void {
  const c = ENEMY.dummy;
  // Stand and post.
  p.roundRect(-1.1, 1.15, 2.2, 0.38, 0.12).fill(k(c.postShade)).stroke(O * 0.8, k(INK));
  p.roundRect(-0.24, -0.9, 0.48, 2.2, 0.1).fill(k(c.post)).stroke(O * 0.8, k(INK));
  // Crossbar arms with straw tufts.
  p.roundRect(-1.95, -0.78, 3.9, 0.36, 0.14).fill(k(c.post)).stroke(O * 0.8, k(INK));
  for (const s of [-1, 1]) {
    blob(p, s * 2.0, -0.6, 0.38, 0.32, [1, 0.8, 1.1, 0.85, 1.05, 0.8]).fill(k(c.straw)).stroke(O * 0.7, k(INK));
  }
  // Straw bundle.
  p.ellipse(0, 0.12, 1.05, 1.22).fill(k(c.straw));
  if (k === NORMAL) {
    p.ellipse(0.3, 0.3, 0.65, 0.95).fill(c.strawShade);
    p.ellipse(-0.15, 0.08, 0.8, 1.05).fill(c.straw);
    for (let i = -3; i <= 3; i++) {
      p.moveTo(i * 0.24, -0.9 + Math.abs(i) * 0.05).lineTo(i * 0.3, 1.15 - Math.abs(i) * 0.06);
      p.stroke(0.06, i % 2 ? c.strawLight : c.strawShade);
    }
    p.circle(0, 0.2, 0.5).fill(c.targetLight).stroke(0.08, INK);
    p.circle(0, 0.2, 0.32).fill(c.target);
    p.circle(0, 0.2, 0.13).fill(c.targetLight);
    for (const y of [-0.65, 0.95]) p.moveTo(-0.85, y).quad(0, y + 0.18, 0.85, y).stroke(0.16, c.rope);
  }
  p.ellipse(0, 0.12, 1.05, 1.22).stroke(O, k(INK));
  // Sack head.
  p.circle(0, -1.62, 0.74).fill(k(c.sack));
  if (k === NORMAL) {
    p.moveTo(0.2, -1.0).arc(0, -1.62, 0.74, 1.3, -0.5, true).quad(0.5, -1.25, 0.2, -1.0).close();
    p.fill(c.sackShade);
    for (const s of [-1, 1]) {
      const x = s * 0.26;
      const y = -1.66;
      p.moveTo(x - 0.11, y - 0.11).lineTo(x + 0.11, y + 0.11).moveTo(x + 0.11, y - 0.11).lineTo(x - 0.11, y + 0.11);
      p.stroke(0.08, c.stitch);
    }
  }
  p.circle(0, -1.62, 0.74).stroke(O, k(INK));
  p.moveTo(-0.32, -0.95).lineTo(0.32, -0.95).stroke(0.2, k(c.rope));
}

function entry(name: string, x0: number, y0: number, x1: number, y1: number, draw: (p: Pen) => void): AtlasEntry {
  return { name, x0, y0, x1, y1, draw };
}

export function enemyAtlasEntries(): AtlasEntry[] {
  return [
    entry('tinderling_body', -1.5, -1.5, 1.5, 1.2, (p) => tinderBody(p, NORMAL)),
    entry('tinderling_flash', -1.5, -1.5, 1.5, 1.2, (p) => tinderBody(p, WHITE)),
    entry('tinderling_eyes', -0.6, -0.4, 0.6, 0.4, tinderEyes),
    entry('tinderling_flame', -0.7, -1.4, 0.7, 0.45, tinderFlame),
    entry('tinderling_leg', -0.3, -0.25, 0.3, 0.25, (p) => p.ellipse(0, 0, 0.22, 0.17).fill(INK)),
    entry('shieldbearer_body', -2.25, -2.95, 2.25, 2.0, (p) => shieldBody(p, NORMAL)),
    entry('shieldbearer_flash', -2.25, -2.95, 2.25, 2.0, (p) => shieldBody(p, WHITE)),
    entry('shieldbearer_visor', -0.7, -0.25, 0.7, 0.25, shieldVisor),
    entry('shieldbearer_shield', -0.5, -3.4, 4.2, 3.4, shieldShape),
    entry('shieldbearer_shield_flash', -0.5, -2.8, 3.5, 2.8, shieldFlash),
    entry('shieldbearer_boot', -0.6, -0.45, 0.6, 0.45, boot),
    entry('ember_archer_body', -1.4, -2.75, 1.4, 1.65, (p) => archerBody(p, NORMAL)),
    entry('ember_archer_flash', -1.4, -2.75, 1.4, 1.65, (p) => archerBody(p, WHITE)),
    entry('ember_archer_face', -0.55, -0.45, 0.55, 0.45, archerFace),
    entry('ember_archer_bow', -0.8, -1.5, 0.3, 1.5, bow),
    entry('ember_archer_arrow', -0.3, -0.4, 2.45, 0.4, nockedArrow),
    entry('dummy_body', -2.5, -2.5, 2.5, 1.7, (p) => dummyBody(p, NORMAL)),
    entry('dummy_flash', -2.5, -2.5, 2.5, 1.7, (p) => dummyBody(p, WHITE)),
  ];
}
