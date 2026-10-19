/** The settings rows (volume, damage numbers, screen shake, effect density): pause menu and title. */
import { signal } from '@preact/signals';
import { onSettingsChange, settings, updateSettings, type Settings } from '../app/settings';

/** Live copy of the settings for menus; the store itself is not reactive. */
const cfg = signal<Settings>({ ...settings });
onSettingsChange((s) => (cfg.value = { ...s }));

const DENSITIES: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: '100%' },
  { value: 0.6, label: '60%' },
  { value: 0.3, label: '30%' },
];

function Switch(p: { label: string; on: boolean; onChange(v: boolean): void }) {
  return (
    <div class="rl-row">
      <span>{p.label}</span>
      <button
        class="rl-switch"
        type="button"
        role="switch"
        aria-checked={p.on}
        aria-label={p.label}
        onClick={() => p.onChange(!p.on)}
      />
    </div>
  );
}

/** `tick`: feedback blip when a setting is committed. */
export function SettingsRows({ tick }: { tick(): void }) {
  const s = cfg.value;
  const vol = Math.round(s.volume * 100);
  return (
    <>
      <div class="rl-row">
        <span>Volume</span>
        <label class="rl-slider">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={vol}
            aria-label="Volume"
            onInput={(e) =>
              updateSettings({ volume: Number((e.currentTarget as HTMLInputElement).value) / 100 })
            }
            onChange={tick}
          />
          <output>{vol}%</output>
        </label>
      </div>
      <Switch
        label="Damage numbers"
        on={s.damageNumbers}
        onChange={(v) => {
          updateSettings({ damageNumbers: v });
          tick();
        }}
      />
      <Switch
        label="Screen shake"
        on={s.screenShake}
        onChange={(v) => {
          updateSettings({ screenShake: v });
          tick();
        }}
      />
      <div class="rl-row">
        <span>Effect density</span>
        <div class="rl-seg" role="group" aria-label="Effect density">
          {DENSITIES.map((d) => (
            <button
              key={d.value}
              type="button"
              aria-pressed={s.effectDensity === d.value}
              onClick={() => {
                updateSettings({ effectDensity: d.value });
                tick();
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
