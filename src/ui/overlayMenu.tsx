import type { Renderer } from '../render/renderer';
import { DEBUG_MATERIAL, DEBUG_OWNER } from '../render/terrain/terrainColors';

type Flags = Renderer['overlays'];

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

function Swatch(p: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginRight: '6px' }}>
      <span
        style={{
          width: '9px',
          height: '9px',
          background: p.color,
          border: '1px solid rgba(255,255,255,0.35)',
          display: 'inline-block',
        }}
      />
      {p.label}
    </span>
  );
}

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
      {row('material', 'material')}
      {row('fire', 'fire (heat)')}
      {row('charge', 'charge')}
      {row('wet', 'wet')}
      {row('owner', 'owner')}
      {row('wind', 'wind (M8)')}
      {row('borrowed', 'borrowed (M8)')}
      {p.overlays.material && (
        <div style={{ fontSize: '10px', lineHeight: '15px', maxWidth: '220px', marginTop: '4px' }}>
          {Object.entries(DEBUG_MATERIAL).map(([id, c]) => (
            <Swatch key={id} color={hex(c)} label={id.replace('_', ' ')} />
          ))}
          <Swatch color="#9e40e6" label="oil (stripes)" />
        </div>
      )}
      {p.overlays.owner && (
        <div style={{ fontSize: '10px', lineHeight: '15px', marginTop: '4px' }}>
          {(['world', 'player', 'enemy'] as const).map((o, i) => (
            <Swatch key={o} color={hex(DEBUG_OWNER[i]!)} label={o} />
          ))}
        </div>
      )}
    </div>
  );
}
