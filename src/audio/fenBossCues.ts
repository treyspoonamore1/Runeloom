import type { SimEvent } from '../sim';
import type { M4SoundCue } from './m4Cues';

/**
 * Sounds for the Glasswater Coil's charge warnings (M8, data/sfxFenBosses.ts). Pure. The pulse
 * glow is heard where the Coil is; the pylon glow comes from all four corners at once, so it is
 * centered. Its attacks' windups (the toll, the thrash) go through m4Cues.ts.
 */
export function fenBossSounds(e: SimEvent): M4SoundCue[] {
  switch (e.type) {
    case 'coilPulseGlow':
      return [{ id: 'coilPulseGlow', x: e.x, y: e.y }];
    case 'coilPylonGlow':
      return [{ id: 'coilPylonHum' }];
    default:
      return [];
  }
}
