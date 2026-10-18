/** Per-form behavior: placement at spawn, instant resolution, and the per-tick step. */
import type { GameState } from '../../../state';
import type { SpawnAt, SpellInstance } from '../types';
import { fireBeam } from './beam';
import { initBolt, stepBolt } from './bolt';
import { fireStrike, fireSwath, initLob, initNova, stepLob, stepNova } from './area';
import { initOrb, initSigil, stepOrb, stepSigil } from './orbit';

/**
 * Sets a new instance's geometry. (aimX, aimY) is its aim point after the fan rotation; dirX/dirY
 * are already set. Runs before 'spellSpawn' is sent.
 */
export function initForm(state: GameState, inst: SpellInstance, at: SpawnAt, aimX: number, aimY: number): void {
  switch (inst.form) {
    case 'bolt':
      return initBolt(inst);
    case 'nova':
      return initNova(inst);
    case 'lob':
      return initLob(state, inst, aimX, aimY);
    case 'orb':
      return initOrb(state, inst, at.fromPlayer);
    case 'sigil':
      return initSigil(state, inst, aimX, aimY);
    case 'beam':
    case 'strike':
    case 'swath':
      return;
  }
}

/** Instant forms hit and end right after spawning (Beam, Strike, Swath). */
export function resolveInstant(state: GameState, inst: SpellInstance): void {
  switch (inst.form) {
    case 'beam':
      return fireBeam(state, inst);
    case 'strike':
      return fireStrike(state, inst);
    case 'swath':
      return fireSwath(state, inst);
    default:
      return;
  }
}

/** One 60 Hz tick of a live, non-instant instance (prevX/prevY and age already updated). */
export function stepForm(state: GameState, inst: SpellInstance): void {
  switch (inst.form) {
    case 'bolt':
      return stepBolt(state, inst);
    case 'nova':
      return stepNova(state, inst);
    case 'lob':
      return stepLob(state, inst);
    case 'orb':
      return stepOrb(state, inst);
    case 'sigil':
      return stepSigil(state, inst);
    case 'beam':
    case 'strike':
    case 'swath':
      return;
  }
}
