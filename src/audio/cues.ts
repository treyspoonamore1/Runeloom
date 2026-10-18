import type { GameState, SimEvent } from '../sim';
import {
  ailmentSfx,
  attackSfx,
  audioTuning,
  castSfx,
  deathSfx,
  hitSfx,
  impactSfx,
  telegraphSfx,
  type SfxId,
} from '../../data/sfx';

/** One sound to play: which preset, where it happened (cells; omit for non-positional), and a loudness factor. */
export interface Cue {
  id: SfxId;
  x?: number;
  y?: number;
  gain?: number;
}

/** Sounds for one sim event. Pure: reads state only to find where a telegraphing enemy stands. */
export function cuesForEvent(e: SimEvent, state: GameState): Cue[] {
  switch (e.type) {
    case 'cast': {
      const id = castSfx[e.spell];
      return id ? [{ id }] : [];
    }
    case 'castFailed':
      return [{ id: 'castFailed' }];
    case 'projectileEnd': {
      const id = impactSfx[e.kind];
      if (!id || (e.reason !== 'hit' && e.reason !== 'wall')) return [];
      // A hit also plays the hit sound, so the impact sits back a little.
      return [{ id, x: e.x, y: e.y, gain: e.reason === 'hit' ? 0.7 : 1 }];
    }
    case 'hit': {
      if (e.target === 'player') return [{ id: 'playerHurt', gain: e.amount > 0 ? 1 : 0.6 }];
      const out: Cue[] = [{ id: hitSfx[e.damageType], x: e.x, y: e.y }];
      if (e.crit) out.push({ id: 'crit', x: e.x, y: e.y });
      return out;
    }
    case 'evaded':
      return [{ id: 'evaded' }];
    case 'death':
      if (e.shattered) return [{ id: 'shatter', x: e.x, y: e.y }];
      return [{ id: deathSfx[e.kind] ?? 'deathDefault', x: e.x, y: e.y }];
    case 'ailmentApplied': {
      // Chill comes with every frost hit: its tinkle grows with the chill total.
      const gain = e.ailment === 'chill' ? 0.4 + 0.6 * Math.min(1, e.magnitude / 100) : 1;
      return [at({ id: ailmentSfx[e.ailment], gain }, e)];
    }
    case 'freeze':
      return [at({ id: 'freeze' }, e)];
    case 'thaw':
      return [at({ id: 'thaw' }, e)];
    case 'dot':
      return e.amount > 0 ? [at({ id: 'burnTick' }, e)] : [];
    case 'playerDeath':
      return [{ id: 'playerDeath' }];
    case 'playerRespawn':
      return [{ id: 'respawn' }];
    case 'dodge':
      return [{ id: 'dodge' }];
    case 'telegraph': {
      const at = state.enemies.find((en) => en.id === e.id);
      return [{ id: telegraphSfx[e.attack] ?? 'telegraph', x: at?.x, y: at?.y }];
    }
    case 'attack': {
      const id = attackSfx[e.attack];
      return id ? [{ id, x: e.x, y: e.y }] : [];
    }
    case 'shieldBlock':
      return [{ id: 'shieldBlock', x: e.x, y: e.y }];
    default:
      return [];
  }
}

/** Places a cue at the event's position, unless it happened to the player (then it's centered). */
function at(c: Cue, e: { target: number | 'player'; x: number; y: number }): Cue {
  if (e.target !== 'player') {
    c.x = e.x;
    c.y = e.y;
  }
  return c;
}

/** Stereo pan (-1 left … 1 right) and loudness factor for a sound `dx, dy` cells from the player. */
export function spatialize(dx: number, dy: number): { pan: number; gain: number } {
  const t = audioTuning;
  const pan = Math.max(-1, Math.min(1, dx / t.panDistance)) * t.panRange;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const k = Math.min(1, dist / t.fadeDistance);
  return { pan, gain: 1 - k * (1 - t.farGain) };
}
