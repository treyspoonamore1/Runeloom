import type { Texture } from 'pixi.js';
import type { Ailments } from '../sim';
import type { Atlas } from './atlas';
import { AIL, mixRgb } from './ailmentPalette';
import { ImmediatePool } from './particles';

/** Grid-state bits for StatusIcons.row (M3: DESIGN §14 Wet, Oiled; §6.4 Blind). */
export const ICON_WET = 1;
export const ICON_OIL = 2;
export const ICON_BLIND = 4;

/**
 * Status icons above bodies (DESIGN §14): an Ignite flame, Shock with its percentage, and a
 * chill meter that fills toward Freeze and becomes a snowflake while frozen. Only active
 * ailments show; the row is centered over the head. Sizes are fixed in screen pixels (like
 * damage numbers), so the row stays legible at any zoom. One ParticleContainer, redrawn each frame.
 */
export class StatusIcons {
  readonly pool: ImmediatePool;
  private readonly tex: {
    ignite: Texture;
    freeze: Texture;
    shock: Texture;
    meterBg: Texture;
    meterFill: Texture;
    pct: Texture;
    digits: Texture[];
    wet: Texture;
    oil: Texture;
    blind: Texture;
  };
  private time = 0;
  /** Cells per 720p screen pixel this frame. */
  private u = 1 / 8;

  constructor(atlas: Atlas, capacity: number) {
    this.pool = new ImmediatePool(atlas.get('icon_ignite'), capacity);
    this.tex = {
      ignite: atlas.get('icon_ignite'),
      freeze: atlas.get('icon_freeze'),
      shock: atlas.get('icon_shock'),
      meterBg: atlas.get('meter_bg'),
      meterFill: atlas.get('meter_fill'),
      pct: atlas.get('digit_pct'),
      digits: Array.from({ length: 10 }, (_, d) => atlas.get(`digit_${d}`)),
      wet: atlas.get('icon_wet'),
      oil: atlas.get('icon_oil'),
      blind: atlas.get('icon_blind'),
    };
  }

  /** cellsPerPx: world cells per screen pixel at 720p (screen scale ÷ camera scale). */
  begin(dt: number, cellsPerPx: number): void {
    this.time += dt;
    this.u = cellsPerPx;
    this.pool.begin();
  }

  end(): void {
    this.pool.end();
  }

  /** Cells between a body's top and the row's middle. */
  get lift(): number {
    return AIL.iconLift * this.u;
  }

  /** Draws the row for `a` (and the ICON_* grid states in `flags`) centered at x with its middle at y (cells). */
  row(a: Ailments, x: number, y: number, flags = 0): void {
    const ignite = a.ignite.timeLeft > 0;
    const frozen = a.freeze.timeLeft > 0;
    const chill = !frozen && a.chill > 0.5;
    const shock = a.shock.timeLeft > 0;
    if (!ignite && !frozen && !chill && !shock && flags === 0) return;
    const u = this.u;
    const I = AIL.icon * u;
    const gap = AIL.iconGap * u;
    const adv = AIL.digitAdvance * u;
    const meterW = AIL.meterW * u;
    const pct = shock ? Math.max(1, Math.min(99, Math.round(a.shock.effect * 100))) : 0;
    const nDigits = pct >= 10 ? 2 : 1;
    const shockW = I * 0.85 + (nDigits + 1) * adv;
    let w = -gap;
    if (ignite) w += I + gap;
    if (shock) w += shockW + gap;
    if (frozen) w += I + gap;
    if (chill) w += meterW + gap;
    for (let b = ICON_WET; b <= ICON_BLIND; b <<= 1) if (flags & b) w += I + gap;
    let cx = x - w / 2;

    // Icon textures are 1.2 cells across at scale 1, digits 1.2 tall.
    if (ignite) {
      this.put(this.tex.ignite, cx + I / 2, y, I / 1.2, 0xffffff, fadeOut(a.ignite.timeLeft));
      cx += I + gap;
    }
    if (shock) {
      const al = fadeOut(a.shock.timeLeft);
      this.put(this.tex.shock, cx + I * 0.42, y, I / 1.2, 0xffffff, al);
      let dx = cx + I * 0.85 + adv / 2;
      const ds = (AIL.digitH * u) / 1.2;
      if (nDigits === 2) {
        this.put(this.tex.digits[Math.floor(pct / 10)]!, dx, y, ds, AIL.storm, al);
        dx += adv;
      }
      this.put(this.tex.digits[pct % 10]!, dx, y, ds, AIL.storm, al);
      this.put(this.tex.pct, dx + adv, y, ds * 0.9, AIL.storm, al);
      cx += shockW + gap;
    }
    if (frozen) {
      const pulse = 1 + 0.08 * Math.sin(this.time * 9);
      this.put(this.tex.freeze, cx + I / 2, y, (I / 1.2) * 1.1 * pulse, 0xffffff, 1);
      cx += I + gap;
    }
    if (chill) {
      const h = AIL.meterH * u;
      const bg = this.pool.next(this.tex.meterBg);
      if (bg) {
        bg.x = cx + meterW / 2;
        bg.y = y;
        bg.scaleX = meterW / 2;
        bg.scaleY = h / 0.5;
        bg.paint(0xffffff, 1);
      }
      const f = Math.min(1, a.chill / 100);
      const fill = this.pool.next(this.tex.meterFill);
      if (fill) {
        const pad = 1.5 * u;
        fill.x = cx + pad;
        fill.y = y;
        fill.scaleX = (meterW - pad * 2) * f;
        fill.scaleY = (h - pad) / 0.3;
        // Near the freeze threshold the meter whitens and pulses.
        const hot = f > 0.75 ? (f - 0.75) / 0.25 : 0;
        const pulse = hot > 0 ? 0.5 + 0.5 * Math.sin(this.time * 14) : 0;
        fill.paint(hot > 0 ? mixRgb(AIL.frost, 0xffffff, hot * (0.3 + 0.4 * pulse)) : AIL.frost, 1);
      }
    }
    // Grid states after the ailments: Wet, Oiled, Blind.
    if (chill) cx += meterW + gap;
    if (flags & ICON_WET) {
      this.put(this.tex.wet, cx + I / 2, y, I / 1.2, 0xffffff, 1);
      cx += I + gap;
    }
    if (flags & ICON_OIL) {
      this.put(this.tex.oil, cx + I / 2, y, I / 1.2, 0xffffff, 1);
      cx += I + gap;
    }
    if (flags & ICON_BLIND) this.put(this.tex.blind, cx + I / 2, y, I / 1.2, 0xffffff, 1);
  }

  private put(t: Texture, x: number, y: number, scale: number, tint: number, alpha: number): void {
    const p = this.pool.next(t);
    if (!p) return;
    p.x = x;
    p.y = y;
    p.scaleX = p.scaleY = scale;
    p.paint(tint, alpha);
  }
}

/** Icons blink out over their last 0.4 s. */
function fadeOut(timeLeft: number): number {
  return timeLeft >= 0.4 ? 1 : 0.35 + 0.65 * (timeLeft / 0.4);
}
