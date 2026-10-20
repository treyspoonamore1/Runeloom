import { Emblem } from './icons';
import { ControlsList } from './controls';

/** Title card shown until the first click. The sim stays paused underneath. */
export function StartScreen(p: { onPlay(): void }) {
  return (
    <div class="rl-screen rl-start" role="dialog" aria-label="Runeloom">
      <div class="rl-col">
        <Emblem />
        <h1 class="rl-title">Runeloom</h1>
        <p class="rl-sub">Sandbox scene</p>
        <div class="rl-rule">
          <i />
        </div>
        <ControlsList />
        <button
          class="rl-btn rl-play"
          type="button"
          ref={(el) => el?.focus({ preventScroll: true })}
          onClick={p.onPlay}
        >
          Click to play
        </button>
        <p class="rl-hint">
          Best with sound on. Press <kbd>Enter</kbd> to start. <kbd>Esc</kbd> pauses; reload without
          <kbd>?scene=</kbd> for the title screen.
        </p>
      </div>
    </div>
  );
}
