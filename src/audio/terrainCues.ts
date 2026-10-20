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
    // 'cellIgnited' whooshes come from TerrainSoundTracker: they depend on how much already burns.
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
 * Terrain sounds that need memory: the fire bed, ignition whooshes and the burnt-out crumble.
 *
 * The fire bed is not one sound per cell: every `countEvery` seconds it counts the burning cells
 * in about a screen around the player. Its level follows sqrt(cells / saturateAt), capped at 1,
 * smoothed so it swells and fades; a single quiet crackle retriggers at a rate and loudness that
 * follow the level, placed at the burning cells' centroid (so it pans). When the fire is out the
 * bed fades away over `tailSeconds`.
 *
 * A whoosh plays for an ignition of `whooshMinCells` or more, or for any ignition while little
 * burns on screen (a lone bramble catching must read). The busier the fire, the longer the gap
 * between whooshes and the quieter they are: spread is heard through the bed. The crumble plays
 * when a burn-out changed walkability (a bridge, floor, crate or bramble burnt away), which grass
 * burning to ash doesn't, spaced and softened the same way.
 */
export class TerrainSoundTracker {
  private walkVersion = -1;
  private grid: unknown = null;
  private sinceCount = Infinity;
  private untilCrackle = 0;
  private untilWhoosh = 0;
  private untilCrumble = 0;
  /** Burning cells around the player at the last count, and their centroid. */
  burning = 0;
  /** Smoothed fire-bed level, 0 to 1. */
  level = 0;
  /** 1 while something burns, falling to 0 over `tailSeconds` once it's out. */
  private tail = 0;
  private cx = 0;
  private cy = 0;

  constructor(private readonly random: () => number = Math.random) {}

  reset(): void {
    this.grid = null;
    this.walkVersion = -1;
    this.sinceCount = Infinity;
    this.untilCrackle = this.untilWhoosh = this.untilCrumble = 0;
    this.burning = this.level = this.tail = 0;
  }

  /** How saturated the fire on screen is right now, 0 to 1. */
  private get busy(): number {
    return Math.sqrt(Math.min(1, this.burning / T.saturateAt));
  }

  /** Cues for this frame: `dt` seconds since the last call. */
  cues(events: readonly SimEvent[], s: GameState, dt: number): Cue[] {
    const out: Cue[] = [];
    const g = s.grid;
    if (g !== this.grid) {
      // A new room: nothing carries over.
      this.reset();
      this.grid = g;
      this.walkVersion = g.walkVersion;
    }
    this.untilWhoosh -= dt;
    this.untilCrumble -= dt;
    const busy = this.busy;
    const soften = 1 - (1 - T.busyGain) * busy;

    let ignited: Bounds | null = null;
    for (const e of events) if (e.type === 'cellIgnited' && (!ignited || e.count > ignited.count)) ignited = e;
    if (ignited && this.untilWhoosh <= 0 && (ignited.count >= T.whooshMinCells || this.burning < T.freshFireCells)) {
      this.untilWhoosh = T.whooshGapMin + (T.whooshGapMax - T.whooshGapMin) * busy;
      out.push({ id: 'igniteWhoosh', ...center(ignited), gain: sized(ignited.count, 40) * soften });
    }

    if (g.walkVersion !== this.walkVersion) {
      this.walkVersion = g.walkVersion;
      if (this.untilCrumble <= 0)
        for (const e of events)
          if (e.type === 'burntOut') {
            this.untilCrumble = T.crumbleGapMin + (T.crumbleGapMax - T.crumbleGapMin) * busy;
            out.push({ id: 'burntCrumble', ...center(e), gain: soften });
            break;
          }
    }

    this.sinceCount += dt;
    if (this.sinceCount >= T.countEvery) {
      this.sinceCount = 0;
      this.count(s);
    }
    this.bed(dt, out);
    return out;
  }

  private bed(dt: number, out: Cue[]): void {
    const target = this.burning > 0 ? this.busy : 0;
    const tau = target > this.level ? T.riseSeconds : T.fallSeconds;
    this.level += (target - this.level) * (1 - Math.exp(-dt / tau));
    this.tail = this.burning > 0 ? 1 : Math.max(0, this.tail - dt / T.tailSeconds);
    if (this.tail <= 0) {
      this.untilCrackle = 0;
      this.level = 0;
      return;
    }
    this.untilCrackle -= dt;
    if (this.untilCrackle > 0) return;
    const interval = T.slowest + (T.fastest - T.slowest) * this.level;
    this.untilCrackle = interval * (0.6 + 0.8 * this.random());
    const gain = (T.quietest + (T.loudest - T.quietest) * this.level) * this.tail;
    out.push({ id: 'fireCrackle', x: this.cx, y: this.cy, gain });
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
