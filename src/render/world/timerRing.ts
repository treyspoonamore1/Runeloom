import { Graphics, type Container } from 'pixi.js';
import type { WorldObject } from '../../sim/world/objects';
import { ELEMENT, INK } from '../combatPalette';

const TAU = Math.PI * 2;

/**
 * A ring that empties as a timed switch's hold runs out (o.timer: seconds left). The full value is
 * the largest left seen since it was powered.
 */
export class TimerRing {
  readonly g = new Graphics();
  private full = 0;
  constructor(
    parent: Container,
    private readonly cy: number,
  ) {
    parent.addChild(this.g);
  }
  update(o: WorldObject, t: number): void {
    const g = this.g.clear();
    if (!o.on || o.timer <= 0) {
      this.full = 0;
      return;
    }
    this.full = Math.max(this.full, o.timer);
    const k = Math.min(1, o.timer / this.full);
    const r = 2.1;
    const a0 = -Math.PI / 2;
    // Flashes in its last second: the group is about to lose this switch.
    const warn = o.timer < 1 ? 0.5 + 0.5 * Math.sin(t * TAU * 6) : 1;
    g.circle(0, this.cy, r).stroke({ width: 0.42, color: INK, alpha: 0.45 });
    g.arc(0, this.cy, r, a0, a0 + TAU * k).stroke({ width: 0.26, color: ELEMENT.storm, alpha: 0.95 * warn });
  }
}
