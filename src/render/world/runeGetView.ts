import { Container, Sprite } from 'pixi.js';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import { clamp, smoothstep } from '../mathx';
import { glyphName } from './runeShapes';
import { runeColors } from './shrineLook';
import type { WorldFx } from './worldFx';
import { RUNE_GET as R } from './worldPalette';

const TAU = Math.PI * 2;

/**
 * The dungeon-item pose (DESIGN §10.2): the hero holds the new rune overhead in a light burst.
 * The HUD calls `hold(rune)` when its item-get panel opens and `hold(null)` when it closes; the
 * pose lasts at least RUNE_GET.minTime either way, then fades. Presentation only: it reads the
 * player's drawn position and never touches sim state. `raise` (0–1) drives the player's staff.
 */
export class RuneGetView {
  /** World space, under the player: rays and the big glow. */
  readonly back = new Container();
  /** World space, over the player: the rune tablet and its sparkle. */
  readonly front = new Container();
  /** How far the pose is in, 0–1 (PlayerView.raise). */
  raise = 0;
  /** The held rune's light color (PlayerView.raiseTint). */
  tint = 0xffffff;
  private readonly rays: Sprite[] = [];
  private readonly glow: Sprite;
  private readonly halo: Sprite;
  private readonly tablet: Sprite;
  private glyph: Sprite;
  private rune: string | null = null;
  private holding = false;
  private t = -1;
  /** Seconds since the pose stopped holding (−1 while it holds or before it starts). */
  private out = -1;

  constructor(
    private readonly atlas: Atlas,
    private readonly fx: WorldFx,
  ) {
    this.glow = new Sprite(atlas.get('glow'));
    this.glow.blendMode = 'add';
    for (let i = 0; i < R.rays; i++) {
      const s = new Sprite(atlas.get('light_ray'));
      s.blendMode = 'add';
      this.rays.push(s);
    }
    this.back.addChild(this.glow, ...this.rays);
    this.halo = new Sprite(atlas.get('glow'));
    this.halo.blendMode = 'add';
    this.tablet = new Sprite(atlas.get('rune_tablet'));
    this.glyph = new Sprite(atlas.get('glyph_plain'));
    this.front.addChild(this.halo, this.tablet, this.glyph);
    this.back.visible = this.front.visible = false;
  }

  /** Starts (rune) or releases (null) the pose. */
  hold(rune: string | null): void {
    if (rune === null) {
      this.holding = false;
      return;
    }
    if (rune !== this.rune) {
      this.front.removeChild(this.glyph);
      this.glyph = new Sprite(this.atlas.get(glyphName(rune)));
      this.front.addChild(this.glyph);
    }
    const c = runeColors(rune);
    this.rune = rune;
    this.tint = c.light;
    this.tablet.tint = this.glow.tint = this.halo.tint = c.light;
    for (const r of this.rays) r.tint = c.light;
    this.glyph.tint = c.deep;
    this.holding = true;
    this.t = 0;
    this.out = -1;
  }

  reset(): void {
    this.holding = false;
    this.t = this.out = -1;
    this.raise = 0;
    this.back.visible = this.front.visible = false;
  }

  /** (x, y): the player's drawn position, cells. */
  update(dt: number, x: number, y: number): void {
    if (this.t < 0) return;
    this.t += dt;
    if (!this.holding && this.t >= R.minTime && this.out < 0) this.out = 0;
    if (this.out >= 0) this.out += dt;
    const up = smoothstep(0, R.raise, this.t);
    const down = this.out < 0 ? 1 : 1 - clamp(this.out / R.fade, 0, 1);
    const a = up * down;
    this.raise = a;
    if (this.out >= R.fade) {
      this.reset();
      return;
    }
    this.back.visible = this.front.visible = true;
    if (this.t - dt <= 0) this.sparkle(x, y - R.height, 18);
    const hy = y - R.height + Math.sin(this.t * 2.2) * R.bob - (1 - up) * 1.5;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
    this.glow.position.set(x, hy);
    this.glow.scale.set(R.glow * (0.9 + 0.1 * pulse) * (0.5 + 0.5 * up));
    this.glow.alpha = 0.5 * a;
    this.rays.forEach((r, i) => {
      r.position.set(x, hy);
      r.rotation = (i / this.rays.length) * TAU + this.t * R.spin;
      const len = 0.75 + 0.35 * Math.sin(this.t * 3 + i * 1.7);
      r.scale.set(1, len * R.rayLength * (0.4 + 0.6 * up));
      r.alpha = R.rayAlpha * a * (i % 2 ? 0.7 : 1);
    });
    this.halo.position.set(x, hy);
    this.halo.scale.set(2.8 + 0.5 * pulse);
    this.halo.alpha = 0.75 * a;
    for (const s of [this.tablet, this.glyph]) {
      s.position.set(x, hy);
      s.alpha = a;
      s.scale.set(R.size * (0.6 + 0.4 * up));
    }
    if (Math.random() < 10 * dt * a) this.sparkle(x, hy, 1);
  }

  private sparkle(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const ang = rand(0, TAU);
      const sp = rand(3, 7);
      const p = this.fx.one(this.fx.add, this.fx.t.star, x, y, rand(0.5, 0.9), this.tint, 0.5, 0.05);
      if (p) {
        p.vx = Math.cos(ang) * sp;
        p.vy = Math.sin(ang) * sp - 1;
        p.drag = 2.5;
      }
    }
  }
}
