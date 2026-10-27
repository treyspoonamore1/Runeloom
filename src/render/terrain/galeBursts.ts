import type { GameState, SimEvent } from '../../sim';

/** A radial gust for the atmosphere shader: its center and reach, cells. */
export interface GaleBurst {
  x: number;
  y: number;
  reach: number;
}

/** Most radial gusts the shader draws as bursts (uBursts[8]); older ones keep straight streaks. */
export const MAX_BURSTS = 8;

/**
 * Playtest 8: the centers of radial Gale gusts (DESIGN §6.6: Lob and Nova blow their footprint
 * away from its center), so the atmosphere pass can streak them outward from that center instead
 * of in straight lanes per quantized direction. The sim keeps only cells and a key per gust (the
 * spell instance id); the center comes from the Lob's landing event and the live Nova. Orb trails
 * are many small circles and keep the per-cell streaks. Reads sim state, never writes it.
 */
export class GaleBursts {
  private readonly centers = new Map<number, { x: number; y: number; reach: number; len: number }>();
  private readonly out: GaleBurst[] = [];

  handle(events: readonly SimEvent[]): void {
    for (const ev of events)
      if (ev.type === 'lobLand' && ev.elements.includes('gale'))
        this.centers.set(ev.id, { x: ev.x, y: ev.y, reach: 0, len: -1 });
  }

  /** The live radial gusts, newest last (at most MAX_BURSTS). */
  update(s: GameState): readonly GaleBurst[] {
    for (const inst of s.spells)
      if (inst.form === 'nova' && !this.centers.has(inst.id) && inst.spec.elements.some((e) => e.element === 'gale'))
        this.centers.set(inst.id, { x: inst.cx, y: inst.cy, reach: 0, len: -1 });
    this.out.length = 0;
    if (this.centers.size === 0) return this.out;
    const g = s.grid;
    const live = new Set<number>();
    for (const gust of g.gusts) {
      const c = gust.key > 0 ? this.centers.get(gust.key) : undefined;
      if (!c) continue;
      live.add(gust.key);
      // Its reach: the farthest cell it wrote (Saturate, Wide and Toad Bellows change it).
      if (gust.len !== c.len) {
        let r2 = 0;
        for (let k = 0; k < gust.len; k++) {
          const i = gust.cells[k]!;
          const dx = (i % g.width) + 0.5 - c.x;
          const dy = ((i / g.width) | 0) + 0.5 - c.y;
          r2 = Math.max(r2, dx * dx + dy * dy);
        }
        c.reach = Math.sqrt(r2) + 0.75;
        c.len = gust.len;
      }
      this.out.push(c);
    }
    // Forget centers whose gust ended, unless the spell is still writing (a Nova mid-expansion).
    for (const key of this.centers.keys())
      if (!live.has(key) && !s.spells.some((x) => x.id === key)) this.centers.delete(key);
    if (this.out.length > MAX_BURSTS) this.out.splice(0, this.out.length - MAX_BURSTS);
    return this.out;
  }

  reset(): void {
    this.centers.clear();
  }
}
