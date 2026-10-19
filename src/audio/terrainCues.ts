import type { GameState, SimEvent } from '../sim';
import { terrainAudio as T, type SfxId } from '../../data/sfx';
import type { Cue } from './cues';

type Bounds = { count: number; minX: number; minY: number; maxX: number; maxY: number };

const center = (b: Bounds): { x: number; y: number } => ({ x: (b.minX + b.maxX + 1) / 2, y: (b.minY + b.maxY + 1) / 2 });

/** Loudness growing with the number of cells an event covers: 0.55 for one, 1 at `full`. */
const sized = (count: number, full: number): number => 0.55 + 0.45 * Math.min(1, count / full);

/** Sounds for one batched grid event (DESIGN §6, §13). Pure. */
export function terrainCues(e: SimEvent): Cue[] {
  switch (e.type) {
    case 'cellIgnited':
      // Spread is heard through the fire bed; only a real ignition (a hit, oil catching) whooshes.
      return e.count >= T.whooshMinCells ? [{ id: 'igniteWhoosh', ...center(e), gain: sized(e.count, 40) }] : [];
    case 'steam':
      return [{ id: 'steamHiss', ...center(e), gain: sized(e.count, 30) }];
    case 'iceFormed':
      return [{ id: 'iceForm', ...center(e), gain: sized(e.count, 60) }];
    case 'iceBreaking':
      return [{ id: 'iceCrack', ...center(e), gain: sized(e.count, 30) }];
    case 'iceBroke':
      return [{ id: 'iceBreak', ...center(e), gain: sized(e.count, 30) }];
    case 'waterElectrified':
    case 'metalElectrified': {
      const big = e.cells >= T.bigNetwork;
      const id: SfxId =
        e.type === 'waterElectrified' ? (big ? 'zapWaterBig' : 'zapWater') : big ? 'zapMetalBig' : 'zapMetal';
      // A hand-off across water ↔ metal is the same hit continuing: a little softer.
      return [{ id, x: e.x, y: e.y, gain: (e.handoff ? 0.7 : 1) * sized(e.cells, T.bigNetwork * 2) }];
    }
    case 'explosion':
      return [{ id: 'explosionBoom', x: e.x, y: e.y }];
    default:
      return [];
  }
}

/**
 * Terrain sounds that need memory: the fire bed and the burnt-out crumble.
 *
 * The fire bed is not one sound per cell: every `countEvery` seconds it counts the burning cells
 * in about a screen around the player, then retriggers a single quiet crackle at a rate and
 * loudness that grow with that count, placed at the burning cells' centroid (so it pans).
 * The crumble plays when a burn-out changed walkability (a bridge, floor or crate burnt away),
 * which grass burning to ash doesn't.
 */
export class TerrainSoundTracker {
  private walkVersion = -1;
  private grid: unknown = null;
  private sinceCount = Infinity;
  private untilCrackle = 0;
  /** Burning cells around the player at the last count, and their centroid. */
  burning = 0;
  private cx = 0;
  private cy = 0;

  constructor(private readonly random: () => number = Math.random) {}

  reset(): void {
    this.grid = null;
    this.walkVersion = -1;
    this.sinceCount = Infinity;
    this.untilCrackle = 0;
    this.burning = 0;
  }

  /** Cues for this frame: `dt` seconds since the last call. */
  cues(events: readonly SimEvent[], s: GameState, dt: number): Cue[] {
    const out: Cue[] = [];
    const g = s.grid;
    if (g !== this.grid) {
      this.grid = g;
      this.walkVersion = g.walkVersion;
    }
    if (g.walkVersion !== this.walkVersion) {
      this.walkVersion = g.walkVersion;
      for (const e of events)
        if (e.type === 'burntOut') {
          out.push({ id: 'burntCrumble', ...center(e) });
          break;
        }
    }
    this.sinceCount += dt;
    if (this.sinceCount >= T.countEvery) {
      this.sinceCount = 0;
      this.count(s);
    }
    if (this.burning > 0) {
      this.untilCrackle -= dt;
      if (this.untilCrackle <= 0) {
        const k = Math.sqrt(Math.min(1, this.burning / T.hugeFire));
        const interval = T.slowest + (T.fastest - T.slowest) * k;
        this.untilCrackle = interval * (0.6 + 0.8 * this.random());
        out.push({ id: 'fireCrackle', x: this.cx, y: this.cy, gain: T.quietest + (T.loudest - T.quietest) * k });
      }
    } else {
      this.untilCrackle = 0;
    }
    return out;
  }

  private count(s: GameState): void {
    const g = s.grid;
    const x0 = Math.max(0, Math.floor(s.player.x - T.viewHalfW));
    const x1 = Math.min(g.width, Math.ceil(s.player.x + T.viewHalfW));
    const y0 = Math.max(0, Math.floor(s.player.y - T.viewHalfH));
    const y1 = Math.min(g.height, Math.ceil(s.player.y + T.viewHalfH));
    let n = 0;
    let sx = 0;
    let sy = 0;
    const fire = g.fire;
    for (let y = y0; y < y1; y++) {
      const row = y * g.width;
      for (let x = x0; x < x1; x++) {
        if (fire[row + x] === 0) continue;
        n++;
        sx += x;
        sy += y;
      }
    }
    this.burning = n;
    if (n > 0) {
      this.cx = sx / n + 0.5;
      this.cy = sy / n + 0.5;
    }
  }
}
