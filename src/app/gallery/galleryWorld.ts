/** Gallery exhibits that aren't enemies: puzzle objects, loot, transitions and moments. */
import type { Container } from 'pixi.js';
import type { GameState, SimEvent } from '../../sim';
import type { Renderer } from '../../render/renderer';
import type { SectionId } from './galleryRoom';

export class GalleryWorld {
  private events: SimEvent[] = [];
  constructor(
    readonly state: GameState,
    readonly renderer: Renderer,
    readonly labels: Container,
  ) {}
  show(id: SectionId): void {
    void id;
  }
  update(t: number, dt: number): void {
    void t;
    void dt;
  }
  takeEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
