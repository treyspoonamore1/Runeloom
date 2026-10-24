import type { SimEvent } from '../sim';
import type { M4SoundCue } from './m4Cues';

/**
 * Sounds for the Hearth's events (M7, data/sfxHearth.ts). Pure. All centered: they are about the
 * hub or the character, not a place in the room. Ember pickups go through m4Cues.ts (loot).
 */
export function hearthSounds(e: SimEvent): M4SoundCue[] {
  switch (e.type) {
    case 'stationUse':
      return [{ id: 'stationUse' }];
    case 'buildingUpgraded':
      return [{ id: 'buildingUpgrade' }];
    case 'hearthLit':
      return [{ id: 'hearthLit' }];
    case 'expeditionReturned':
      return [{ id: 'expeditionBell' }];
    default:
      return [];
  }
}
