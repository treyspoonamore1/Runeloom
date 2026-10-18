/** The controls list shown on the start screen and the pause menu. */
export const CONTROLS: ReadonlyArray<{ keys: string[]; label: string }> = [
  { keys: ['WASD'], label: 'Move' },
  { keys: ['Mouse'], label: 'Aim' },
  { keys: ['LMB', 'RMB'], label: 'Weave slots 1–2' },
  { keys: ['Q', 'E'], label: 'Weave slots 3–4' },
  { keys: ['Tab'], label: 'Loom (spell editor)' },
  { keys: ['Space'], label: 'Dodge' },
  { keys: ['Esc'], label: 'Pause' },
  { keys: ['`'], label: 'Dev console' },
  { keys: ['F1', 'F2', 'F3'], label: 'Debug' },
  { keys: ['F9'], label: 'Save replay' },
];

/** Keys as keycaps; F1, F2, F3 collapse to "F1–F3". */
function capLabels(keys: string[]): string[] {
  return keys.length === 3 && keys[0] === 'F1' ? ['F1–F3'] : keys;
}

export function ControlsList() {
  return (
    <div class="rl-controls">
      {CONTROLS.map((c) => (
        <div class="rl-ctl" key={c.label}>
          <span class="rl-keys">
            {capLabels(c.keys).map((k) => (
              <span class="rl-cap" key={k}>
                {k}
              </span>
            ))}
          </span>
          {c.label}
        </div>
      ))}
    </div>
  );
}
