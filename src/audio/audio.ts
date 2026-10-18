import type { GameState, SimEvent } from '../sim';

/** Sound effects driven by sim events (DESIGN §13). */
export interface AudioSystem {
  /** Plays sounds for the events since the last frame. */
  handleEvents(events: readonly SimEvent[], state: GameState): void;
  /** Browsers only allow audio after a user gesture: call from the first click or key press. */
  unlock(): void;
  /** Master volume, 0 to 1. */
  setVolume(v: number): void;
  readonly volume: number;
}

/**
 * SCAFFOLD STUB: silent. The M1 HUD/audio task implements ZzFX presets (data/sfx.ts),
 * voice limiting and per-sound repeat limits.
 */
export function createAudio(): AudioSystem {
  return {
    handleEvents() {},
    unlock() {},
    setVolume() {},
    volume: 1,
  };
}
