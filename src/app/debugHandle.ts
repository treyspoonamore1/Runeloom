import type { Session } from './session';
import type { GameLoop } from './loop';
import type { Renderer } from '../render/renderer';

/**
 * window.__runeloom: a handle for Playwright tests, screenshots and the browser
 * console. Not part of gameplay.
 */
export interface DebugHandle {
  session: Session;
  loop: GameLoop;
  renderer: Renderer;
  /** Current sim state hash as 8 hex digits. */
  stateHash(): string;
  /** Runs a scenario headlessly in the page and returns its final hash (browser determinism test). */
  runScenarioHash(id: string, ticks: number, seed: number): string;
  /** True once the game has booted and rendered. */
  ready: boolean;
}

declare global {
  interface Window {
    __runeloom?: DebugHandle;
  }
}

export function installDebugHandle(h: Omit<DebugHandle, 'ready'>): void {
  window.__runeloom = { ...h, ready: false };
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (window.__runeloom) window.__runeloom.ready = true;
    }),
  );
}
