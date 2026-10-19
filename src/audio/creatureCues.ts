import { materialByCode } from '../../data/materials';
import type { CreatureSfxId } from '../../data/sfxCreature';
import type { GameState, SimEvent } from '../sim';

/** A creature sound to play (same shape as cues.ts Cue, over data/sfxCreature.ts ids). */
export interface CreatureCue {
  id: CreatureSfxId;
  x?: number;
  y?: number;
  gain?: number;
}

/** Positional unless it happened to the player (then centered). */
function at(id: CreatureSfxId, target: number | 'player', x: number, y: number, gain?: number): CreatureCue {
  const c: CreatureCue = target === 'player' ? { id } : { id, x, y };
  if (gain !== undefined) c.gain = gain;
  return c;
}

/** True if the cell under (x, y) is water (deep after an ice bridge broke), else a pit or a gap. */
function waterAt(s: GameState, x: number, y: number): boolean {
  const g = s.grid;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= g.width || cy >= g.height) return false;
  return materialByCode[g.ground[cy * g.width + cx]!]?.water != null;
}

/**
 * Sounds for entities on the chemistry grid (M3 phase B). Pure: reads the grid only to tell a
 * fall into water from a fall into a pit. Grid events themselves (fire, steam, ice, electrified
 * networks, explosions) are terrainCues.ts.
 */
export function creatureCues(e: SimEvent, s: GameState): CreatureCue[] {
  switch (e.type) {
    case 'wetChanged':
      return e.wet ? [at('stepWater', e.target, e.x, e.y)] : [];
    case 'oiledChanged':
      return e.oiled ? [at('oilSquelch', e.target, e.x, e.y)] : [];
    case 'fell': {
      const land = waterAt(s, e.fromX, e.fromY) ? 'fallSplash' : 'fallThud';
      // The player's fall must read instantly: full loudness, centered.
      return [at('fallWhoosh', e.target, e.fromX, e.fromY), at(land, e.target, e.fromX, e.fromY)];
    }
    case 'chargeHit':
      return [at('chargeZap', e.target, e.x, e.y)];
    case 'arc':
      return [{ id: 'arcCrackle', x: (e.x0 + e.x1) / 2, y: (e.y0 + e.y1) / 2 }];
    case 'tinderlingDoused':
      return [{ id: 'douseHiss', x: e.x, y: e.y }];
    case 'tinderlingRelit':
      return [{ id: 'relightWhoosh', x: e.x, y: e.y }];
    case 'shieldBurned':
      return [{ id: 'shieldCrack', x: e.x, y: e.y }];
    default:
      return [];
  }
}
