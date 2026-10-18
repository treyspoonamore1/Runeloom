import { Container, Sprite, type Texture } from 'pixi.js';
import type { Ailments } from '../sim';
import type { Atlas } from './atlas';
import { AIL, mixRgb, type BodyBox } from './ailmentPalette';
import type { ImmediatePool } from './particles';

const FLAMES = 3;
const CRYSTALS = 3;
const ZAPS = 3;
const TAU = Math.PI * 2;

/** Flame spots as fractions of the body box: x of half-width, y from top (0) to bottom (1), scale. */
const FLAME_SPOTS = [
  [-0.55, 0.42, 0.85],
  [0.05, 0.12, 1.1],
  [0.6, 0.5, 0.8],
] as const;
const CRYSTAL_SPOTS = [
  [-0.6, 0.3],
  [0.55, 0.22],
  [0.05, 0.62],
] as const;

/** What the parts read each frame besides the ailments. */
export interface PartsFrame {
  /** Seconds since the last frame (real time: effects keep living on a frozen body). */
  dt: number;
  /** Ignite dps ÷ max life (flame size); negative hides the flames (bodies that burn already). */
  burnRatio: number;
  /** Sideways velocity as a fraction of top speed, -1…1 (flames trail behind). */
  lean: number;
}

/** Shared textures for the drawn parts. */
export interface PartTextures {
  flame: Texture;
  crystal: Texture;
  zapA: Texture;
  zapB: Texture;
}

/**
 * Ailment visuals of one body (enemy or player): licking flames, frost crystals, storm arcs,
 * the ice block and the body tint (chill blue, frozen ice, a warm cast while burning).
 *
 * The ice block and its thaw cracks are sprites inside the body's animated container (`root`,
 * added to the body's lift), so they sort with it; they hold still while frozen, so they cost
 * almost nothing. Flames, crystals and arcs animate every frame, so they are drawn as particles
 * (draw()) into one shared pool above the bodies: hundreds of burning enemies then cost a
 * particle upload, not a scene-graph walk. Created lazily, reused with the pooled view.
 */
export class AilmentParts {
  readonly root = new Container();
  private readonly ice: Sprite;
  private readonly crack: Sprite;
  private time = Math.random() * 10;
  private lean = 0;
  private frozen = false;
  private chill = 0;
  private zapTimer = 0;
  private zapLit = 0;
  /** Per arc: x, y (body-local), rotation, length, thickness (signed), alpha. */
  private readonly zap = new Float32Array(ZAPS * 6);
  private tintKey = -1;
  /** Seconds left of the thaw melt, and of the freeze-start flash. */
  meltLeft = 0;
  freezeFlash = 0;
  wasFrozen = false;
  /** Set by the last update: the body froze, or thawed, this frame. */
  justFroze = false;
  justThawed = false;
  /** Smoothed flame intensity, 0 when not burning. */
  burn = 0;
  /** Particle spawn accumulators (owned by AilmentFx). */
  emberAcc = 0;
  flakeAcc = 0;
  sparkAcc = 0;

  constructor(
    atlas: Atlas,
    private readonly box: BodyBox,
    /** The container to tint (the body without its shadow). */
    private readonly tintTarget: Container,
  ) {
    this.ice = new Sprite(atlas.get('ice_block'));
    this.crack = new Sprite(atlas.get('ice_crack'));
    const h = box.bottom - box.top;
    const cy = (box.top + box.bottom) / 2;
    this.ice.position.set(0, cy);
    this.crack.position.set(0, cy);
    this.crack.scale.set((box.w * 1.1) / 2, (h * 0.5) / 2);
  }

  /**
   * Attaches or detaches a sprite. Pixi updates the transforms of every child of a moving body,
   * hidden or not, so unused parts stay out of the tree.
   */
  private show(s: Sprite, on: boolean): void {
    if (on) {
      if (!s.parent) this.root.addChild(s);
    } else if (s.parent) {
      this.root.removeChild(s);
    }
  }

  /** Back to no ailments (the view was rebound to a new body). */
  reset(): void {
    this.root.visible = true;
    this.root.removeChildren();
    this.meltLeft = this.freezeFlash = this.burn = this.chill = 0;
    this.emberAcc = this.flakeAcc = this.sparkAcc = 0;
    this.zapLit = 0;
    this.frozen = this.wasFrozen = this.justFroze = this.justThawed = false;
    this.tintKey = -1;
    this.tintTarget.tint = 0xffffff;
  }

  /** True while anything is still showing (an ailment, or a melt finishing). */
  get active(): boolean {
    return this.burn > 0 || this.meltLeft > 0 || this.tintKey !== 0 || this.zapLit > 0;
  }

  update(a: Ailments, f: PartsFrame): void {
    const dt = f.dt;
    this.time += dt;
    this.lean = f.lean;
    this.chill = a.chill;
    const frozen = a.freeze.timeLeft > 0;
    this.frozen = frozen;
    this.justFroze = frozen && !this.wasFrozen;
    this.justThawed = !frozen && this.wasFrozen;
    if (this.justFroze) {
      this.freezeFlash = AIL.freezeFlash;
      this.meltLeft = 0;
    } else if (this.justThawed) {
      this.meltLeft = AIL.meltTime;
    }
    this.wasFrozen = frozen;
    this.freezeFlash = Math.max(0, this.freezeFlash - dt);
    this.meltLeft = Math.max(0, this.meltLeft - dt);

    // Flames flare up fast and die down a little slower.
    const burning = a.ignite.timeLeft > 0 && f.burnRatio >= 0;
    const target = burning
      ? AIL.igniteMin + (1 - AIL.igniteMin) * Math.min(1, Math.sqrt(f.burnRatio / AIL.igniteFull))
      : 0;
    this.burn += (target - this.burn) * (1 - Math.exp(-dt / (target > this.burn ? 0.06 : 0.18)));
    if (this.burn < 0.01) this.burn = 0;

    this.updateIce(frozen);
    this.updateZaps(a, dt);
    this.updateTint(frozen);
  }

  /** Emits this body's flames, crystals and arcs. (x, y): the body's origin in world cells. */
  draw(pool: ImmediatePool, tex: PartTextures, x: number, y: number): void {
    const b = this.box;
    const h = b.bottom - b.top;
    const t = this.time;
    if (this.burn > 0) {
      const dim = this.frozen ? 0.6 : 1;
      for (let i = 0; i < FLAMES; i++) {
        // Weak ignites show fewer tongues.
        if (i !== 1 && this.burn <= 0.45 + i * 0.08) continue;
        const p = pool.next(tex.flame);
        if (!p) return;
        const [fx, fy, fs] = FLAME_SPOTS[i]!;
        const s = fs * this.burn * dim;
        const n = 0.6 * Math.sin(t * (12 + i * 3.3) + i) + 0.4 * Math.sin(t * (29 + i * 4.1) + i * 2);
        p.x = x + fx * b.w;
        p.y = y + b.top + fy * h;
        p.scaleX = s * (1 - 0.1 * n);
        p.scaleY = s * (1 + 0.22 * n);
        p.rotation = -this.lean * 0.5 + 0.12 * Math.sin(t * 7 + i * 2.1);
        p.paint(0xffffff, this.frozen ? 0.5 : 1);
      }
    }
    if (!this.frozen && this.chill > AIL.crystalFrom) {
      for (let i = 0; i < CRYSTALS; i++) {
        const from = AIL.crystalFrom + i * AIL.crystalStep;
        if (this.chill <= from) break;
        const p = pool.next(tex.crystal);
        if (!p) return;
        const g = Math.min(1, (this.chill - from) / AIL.crystalStep);
        const [cx, cy] = CRYSTAL_SPOTS[i]!;
        p.x = x + cx * b.w;
        p.y = y + b.top + cy * h;
        p.scaleX = p.scaleY = 0.55 + 0.45 * g;
        p.rotation = i * 0.7;
        p.paint(0xffffff, 0.6 + 0.4 * g);
      }
    }
    const z = this.zap;
    for (let i = 0; i < this.zapLit; i++) {
      const o = i * 6;
      if (z[o + 5]! <= 0) continue;
      const p = pool.next(i % 2 ? tex.zapB : tex.zapA);
      if (!p) return;
      p.x = x + z[o]!;
      p.y = y + z[o + 1]!;
      p.rotation = z[o + 2]!;
      p.scaleX = z[o + 3]!;
      p.scaleY = z[o + 4]!;
      p.paint(0xffffff, z[o + 5]!);
    }
  }

  private updateIce(frozen: boolean): void {
    // Ice block while frozen; on thaw it swells, cracks and melts away.
    const melting = this.meltLeft > 0;
    this.show(this.ice, frozen || melting);
    this.show(this.crack, melting);
    const b = this.box;
    const sx = (b.w * 1.3) / 2;
    const sy = ((b.bottom - b.top) * 0.62) / 2;
    if (frozen) {
      const fl = this.freezeFlash / AIL.freezeFlash;
      // Crystallize: the block snaps in from slightly larger, then holds still.
      const s = 1 + 0.12 * fl * fl;
      this.ice.scale.set(sx * s, sy * s);
      this.ice.alpha = 0.95;
    } else if (melting) {
      const u = 1 - this.meltLeft / AIL.meltTime;
      this.ice.alpha = 0.95 * (1 - u) * (1 - u);
      this.ice.scale.set(sx * (1 + 0.08 * u), sy * (1 - 0.25 * u));
      this.crack.alpha = u < 0.3 ? 1 : 1 - (u - 0.3) / 0.7;
    }
  }

  private updateZaps(a: Ailments, dt: number): void {
    if (a.shock.timeLeft <= 0) {
      this.zapLit = 0;
      return;
    }
    // Strength 0 at 5%, 1 at 50% increased damage taken.
    const k = Math.min(1, Math.max(0, (a.shock.effect - 0.05) / 0.45));
    const rate = AIL.zapRateMin + (AIL.zapRateMax - AIL.zapRateMin) * k;
    this.zapLit = 1 + Math.round(k * (ZAPS - 1));
    const z = this.zap;
    this.zapTimer -= dt;
    if (this.zapTimer > 0) {
      for (let i = 0; i < this.zapLit; i++) {
        const o = i * 6 + 5;
        if (z[o]! > 0) z[o] = Math.max(0.35, z[o]! - dt * 8);
      }
      return;
    }
    this.zapTimer = 1 / rate;
    const b = this.box;
    const h = b.bottom - b.top;
    for (let i = 0; i < this.zapLit; i++) {
      // An arc jumping between two random points on the body; sometimes one skips a beat.
      const o = i * 6;
      z[o] = (Math.random() * 2 - 1) * b.w * 0.85;
      z[o + 1] = b.top + (0.15 + Math.random() * 0.7) * h;
      z[o + 2] = Math.random() * TAU;
      z[o + 3] = (0.45 + 0.35 * k) * b.w * (0.7 + Math.random() * 0.6);
      z[o + 4] = (0.7 + 0.5 * k) * (Math.random() < 0.5 ? -1 : 1);
      z[o + 5] = Math.random() < 0.15 ? 0 : this.frozen ? 0.7 : 1;
    }
  }

  private updateTint(frozen: boolean): void {
    // Quantized so the container tint (which reparses colors) only changes a few times a second.
    let key: number;
    let tint: number;
    if (frozen) {
      const fl = Math.round((this.freezeFlash / AIL.freezeFlash) * 4);
      key = 1000 + fl;
      tint = mixRgb(AIL.frozenTint, 0xffffff, fl / 4);
    } else {
      const c = Math.round((Math.min(100, this.chill) / 100) * 16);
      const b = this.burn > 0 ? Math.round(this.burn * 4) : 0;
      key = c * 8 + b;
      tint = mixRgb(0xffffff, AIL.chillTint, (c / 16) * AIL.chillTintMax);
      if (b > 0) tint = mixRgb(tint, AIL.igniteTint, (b / 4) * 0.5);
    }
    if (key === this.tintKey) return;
    this.tintKey = key;
    this.tintTarget.tint = tint;
  }
}
