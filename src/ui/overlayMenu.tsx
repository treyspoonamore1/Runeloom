import type { Renderer } from '../render/renderer';

type Flags = Renderer['overlays'];

const FUTURE = ['material, fire, charge, wet, owner (M3)'];

export function OverlayMenu(p: { overlays: Flags; visible: { value: boolean }; rev: { value: number } }) {
  if (!p.visible.value) return null;
  void p.rev.value; // re-render after a toggle
  const flags = p.overlays as unknown as Record<string, boolean>;
  const row = (key: string, label: string) => (
    <label>
      <input
        type="checkbox"
        checked={!!flags[key]}
        onChange={(e) => {
          flags[key] = (e.currentTarget as HTMLInputElement).checked;
          p.rev.value++;
        }}
      />
      {label}
    </label>
  );
  return (
    <div class="dbg-panel dbg-menu">
      <h4>Overlays (F1)</h4>
      {row('grid', 'grid')}
      {row('hitboxes', 'hitboxes')}
      {row('aiTargets', 'AI targets')}
      {FUTURE.map((t) => (
        <label class="dis" key={t}>
          <input type="checkbox" disabled />
          {t}
        </label>
      ))}
    </div>
  );
}
