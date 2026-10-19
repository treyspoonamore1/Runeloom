/**
 * Per-material lookups as typed arrays indexed by material code, for the grid tick's hot loop
 * (derived from data/materials.ts once at load).
 */
import { materialByCode } from '../../../data/materials';

const n = materialByCode.length;

/** Rule 2 spread chance into a cell of this material; 0 = not flammable. */
export const SPREAD = new Float64Array(n);
/** Smoke while burning: 0 none, 1 light, 2 dense. */
export const SMOKE = new Uint8Array(n);
/** 1 if the material timer counts down to a revert (ice, ice bridge, temporary shallow water). */
export const REVERTS = new Uint8Array(n);
/** 1 if fire on it does more than burn: melts (rule 5) or dries (rule 23). */
export const FIRE_SPECIAL = new Uint8Array(n);

export const SMOKE_NONE = 0;
export const SMOKE_LIGHT = 1;
export const SMOKE_DENSE = 2;

export function smokeCode(kind: 'none' | 'light' | 'dense'): number {
  return kind === 'dense' ? SMOKE_DENSE : kind === 'light' ? SMOKE_LIGHT : SMOKE_NONE;
}

for (let c = 0; c < n; c++) {
  const m = materialByCode[c];
  if (!m) continue;
  SPREAD[c] = m.flammable?.spreadChance ?? 0;
  SMOKE[c] = smokeCode(m.flammable?.smoke ?? 'none');
  REVERTS[c] = m.revertSeconds !== undefined || m.revertsToUnder === true ? 1 : 0;
  FIRE_SPECIAL[c] = m.fireTo !== undefined || m.driesAfter !== undefined ? 1 : 0;
}
