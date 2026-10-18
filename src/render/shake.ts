import { SHAKE } from './combatPalette';

/**
 * Render-only screen shake (DESIGN §4): kicks add up to SHAKE.max pixels at 720p, decay
 * linearly over SHAKE.decay seconds, and move the camera along smooth noise. Never fed by
 * damage over time. The sim never sees it.
 */
export class Shake {
  /** Current offset, CSS pixels. */
  x = 0;
  y = 0;
  private amp = 0;
  private time = Math.random() * 100;

  /** Adds a kick of `px` pixels at 720p. */
  kick(px: number): void {
    this.amp = Math.min(SHAKE.max, Math.max(this.amp, px) + px * 0.25);
  }

  reset(): void {
    this.amp = this.x = this.y = 0;
  }

  /** enabled: settings.screenShake. screenScale: screen height / 720. */
  update(dt: number, enabled: boolean, screenScale: number): void {
    this.time += dt;
    this.amp = Math.max(0, this.amp - (SHAKE.max / SHAKE.decay) * dt);
    if (!enabled || this.amp <= 0) {
      this.x = this.y = 0;
      return;
    }
    const t = this.time * SHAKE.hz;
    const a = this.amp * screenScale;
    this.x = a * (0.6 * Math.sin(t * 1.0) + 0.4 * Math.sin(t * 2.3 + 1.7));
    this.y = a * (0.6 * Math.sin(t * 1.3 + 0.5) + 0.4 * Math.sin(t * 2.9 + 3.1));
  }
}
