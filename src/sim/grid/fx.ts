/** Turns the batched grid counters (cells.ts `fx`) into events, one per kind, and resets them. */
import { emit } from '../events';
import type { GameState } from '../state';
import { fx, type CellBatch } from './cells';

export function flushFx(state: GameState): void {
  flush(state, 'cellIgnited', fx.ignited);
  flush(state, 'tarIgnited', fx.tarIgnited);
  flush(state, 'burntOut', fx.burntOut);
  flush(state, 'iceBreaking', fx.iceBreaking);
  flush(state, 'iceBroke', fx.iceBroke);
}

/** Emits a batched grid event for `b` if it counted any cell, then empties it. */
export function flush(
  state: GameState,
  type: 'cellIgnited' | 'tarIgnited' | 'burntOut' | 'iceBreaking' | 'iceBroke' | 'steam' | 'iceFormed',
  b: CellBatch,
): void {
  if (b.count === 0) return;
  emit(state, { type, count: b.count, minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY });
  b.count = 0;
}
