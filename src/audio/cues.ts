import { lookKind } from '../../data/enemies';
import type { GameState, SimEvent } from '../sim';
import {
  ailmentSfx,
  attackSfx,
  audioTuning,
  beamSfx,
  castSfx,
  deathSfx,
  hitSfx,
  impactSfx,
  spawnGain,
  telegraphSfx,
  type SfxId,
} from '../../data/sfx';
import type { DamageType } from '../../data/combatTypes';
import type { ElementId } from '../../data/runes';

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
    // Spell sounds come per instance from 'spellSpawn' (Echo, branches and triggers included),
    // so the 'cast' release itself is silent.
    case 'spellSpawn': {
      const id = (castSfx as Partial<Record<string, SfxId>>)[e.form];
      if (!id) return [];
      const gain = e.echo ? spawnGain.echo : e.depth > 0 ? spawnGain.branch : 1;
      // Root spells start at the player: centered. Branches sound where they spawn.
      return [e.depth > 0 ? { id, gain, x: e.x, y: e.y } : { id, gain }];
    }
    case 'beamFire':
      return [{ id: beamSfx[damageTypeOf(e.elements[0])], x: e.fromX, y: e.fromY }];
    case 'lobLand':
      return [{ id: 'lobLand', x: e.x, y: e.y }];
    case 'chainJump':
      return [{ id: 'chainZap', x: e.toX, y: e.toY }];
    case 'manaRefund':
      return [{ id: 'manaChime' }];
    case 'triggerFired':
      // Button triggers (Cast, and Channel's 5 fires a second) get no tick; the spell's own sound plays.
      return e.trigger === 'cast' || e.trigger === 'channel' ? [] : [{ id: 'triggerTick', x: e.x, y: e.y }];
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
      // A hit a state cut (playtest 8) sits back under its clank (fenBossCues.ts).
      const out: Cue[] = [{ id: hitSfx[e.damageType], x: e.x, y: e.y }];
      if (e.reduced !== undefined) out[0]!.gain = audioTuning.reducedHitGain;
      if (e.crit) out.push({ id: 'crit', x: e.x, y: e.y });
      return out;
    }
    case 'evaded':
      return [{ id: 'evaded' }];
    case 'death':
      if (e.shattered) return [{ id: 'shatter', x: e.x, y: e.y }];
      return [{ id: deathSfx[lookKind(e.kind)] ?? 'deathDefault', x: e.x, y: e.y }];
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

function damageTypeOf(id: ElementId | undefined): DamageType {
  return id === 'fire' || id === 'frost' || id === 'storm' ? id : 'physical';
}

/**
 * Spell sounds that need memory across events: a quiet tick when an Orb hits (hits name their
 * spell instance) and a pulse when a Sigil emits (an emitted spell spawns exactly at the sigil).
 * Tracks only live orbs and sigils, from their spawn and end events.
 */
export class SpellCueTracker {
  private readonly orbs = new Set<number>();
  private readonly sigils = new Map<number, { x: number; y: number }>();

  reset(): void {
    this.orbs.clear();
    this.sigils.clear();
  }

  cues(e: SimEvent): Cue[] {
    switch (e.type) {
      case 'spellSpawn':
        if (e.form === 'orb') this.orbs.add(e.id);
        else if (e.form === 'sigil') this.sigils.set(e.id, { x: e.toX, y: e.toY });
        if (e.depth > 0 && this.sigils.size > 0)
          for (const sg of this.sigils.values())
            if (Math.abs(sg.x - e.x) < 1e-6 && Math.abs(sg.y - e.y) < 1e-6)
              return [{ id: 'sigilPulse', x: e.x, y: e.y }];
        return [];
      case 'spellEnd':
        this.orbs.delete(e.id);
        this.sigils.delete(e.id);
        return [];
      case 'hit':
        return e.spellId !== undefined && this.orbs.has(e.spellId) ? [{ id: 'orbTick', x: e.x, y: e.y }] : [];
      default:
        return [];
    }
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
