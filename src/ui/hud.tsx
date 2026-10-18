import type { GameState, SimEvent } from '../sim';
import type { Session } from '../app/session';
import type { GameLoop } from '../app/loop';
import type { InputSampler } from '../app/input';
import type { AudioSystem } from '../audio/audio';

export interface HudContext {
  session: Session;
  loop: GameLoop;
  input: InputSampler;
  /** DOM layer above the canvas. */
  uiRoot: HTMLElement;
  audio: AudioSystem;
}

/** The player-facing HUD: life, mana, dodge charges, spell slots, waves, start screen. */
export interface Hud {
  /** Sim events since the last frame (same batch the renderer gets). */
  handleEvents(events: readonly SimEvent[]): void;
  /** Called once per rendered frame after the sim has stepped. */
  frame(state: GameState): void;
}

/** SCAFFOLD STUB. The M1 HUD/audio task replaces this. */
export function createHud(_ctx: HudContext): Hud {
  return { handleEvents() {}, frame() {} };
}
