import type { GameState } from '../sim';

/**
 * The arena's wave state as the AI agent defines it on `GameState.arena`. Read defensively so
 * the HUD and audio work before and after that field exists.
 */
export interface ArenaView {
  wave: number;
  phase: 'intermission' | 'fighting';
  /** Seconds left in the intermission (or, while fighting, whatever the wave timer is). */
  timer: number;
  spawnedTotal: number;
  killedTotal: number;
}

export function readArena(state: GameState): ArenaView | null {
  const a = (state as { arena?: Partial<ArenaView> }).arena;
  if (!a || typeof a.wave !== 'number') return null;
  return {
    wave: a.wave,
    phase: a.phase === 'fighting' ? 'fighting' : 'intermission',
    timer: typeof a.timer === 'number' ? a.timer : 0,
    spawnedTotal: a.spawnedTotal ?? 0,
    killedTotal: a.killedTotal ?? 0,
  };
}

/** Enemies that count toward "remaining": alive and not training dummies. */
export function enemiesRemaining(state: GameState): number {
  let n = 0;
  for (const e of state.enemies) if (!e.dead && e.kind !== 'dummy') n++;
  return n;
}

export type WaveTransition = 'started' | 'cleared' | 'reset' | null;

/**
 * Turns successive arena snapshots into one-off transitions: a wave began (phase entered
 * 'fighting', or the wave number rose while fighting), a wave was cleared (fighting →
 * intermission), or the arena restarted (wave number dropped).
 */
export class WaveWatcher {
  private wave = 0;
  private phase: ArenaView['phase'] = 'intermission';

  update(a: ArenaView | null): { transition: WaveTransition; wave: number } {
    if (!a) return { transition: null, wave: 0 };
    let transition: WaveTransition = null;
    if (a.wave < this.wave) transition = a.phase === 'fighting' ? 'started' : 'reset';
    else if (a.phase === 'fighting' && (this.phase !== 'fighting' || a.wave > this.wave))
      transition = 'started';
    else if (a.phase === 'intermission' && this.phase === 'fighting') transition = 'cleared';
    this.wave = a.wave;
    this.phase = a.phase;
    return { transition, wave: a.wave };
  }
}
