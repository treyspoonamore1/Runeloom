/**
 * Player-facing settings (DESIGN §14 "Settings"). Not sim state: they never affect the
 * simulation, only presentation. Persisted per browser when storage is available.
 */
export interface Settings {
  /** Master volume, 0 to 1. */
  volume: number;
  /** Ambient loops (the fire bed), 0 to 1, on top of the master volume. */
  ambient: number;
  /** Floating damage numbers. */
  damageNumbers: boolean;
  /** Camera shake on explosions and shatters. */
  screenShake: boolean;
  /** Opacity scale for the player's own effects when the screen is busy: 1, 0.6 or 0.3. */
  effectDensity: number;
}

const KEY = 'runeloom.settings.v1';
const DEFAULTS: Settings = { volume: 0.7, ambient: 0.6, damageNumbers: true, screenShake: true, effectDensity: 1 };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // Storage blocked (private window, sandboxed frame): fall back to defaults.
  }
  return { ...DEFAULTS };
}

/** The live settings object. Read it directly; change it with updateSettings. */
export const settings: Settings = load();

const listeners: Array<(s: Settings) => void> = [];

export function updateSettings(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Not persisted; still applies for this session.
  }
  for (const fn of listeners) fn(settings);
}

export function onSettingsChange(fn: (s: Settings) => void): void {
  listeners.push(fn);
}
