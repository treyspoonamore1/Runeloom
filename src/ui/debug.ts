import type { Session } from '../app/session';
import type { GameLoop, FrameStats } from '../app/loop';
import type { InputSampler } from '../app/input';
import type { Renderer } from '../render/renderer';

export interface DebugContext {
  session: Session;
  loop: GameLoop;
  renderer: Renderer;
  input: InputSampler;
  /** DOM layer above the canvas for overlay UI. */
  uiRoot: HTMLElement;
}

export interface DebugUI {
  /** Called once per rendered frame. */
  frame(stats: FrameStats): void;
}

/**
 * SCAFFOLD STUB. The M0 debug task replaces this with the dev console (backtick),
 * F1 overlays, F2 tuning panel and the stats overlay.
 */
export function createDebugUI(_ctx: DebugContext): DebugUI {
  return { frame() {} };
}
