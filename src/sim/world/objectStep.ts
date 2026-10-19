/**
 * One tick of the world systems in adventure mode (called by stepObjects, objects.ts), in order:
 * room cleared and boss deaths → Storm charge on switches → timed braziers → pressure plates →
 * block pushes and slides → touches (chests, key doors, pickups, Loom Stones) → @link doors →
 * edge exits. Fire and Storm hits on objects happen earlier, inside applyElement (objectHits.ts).
 */
import { DT } from '../core/constants';
import type { InputFrame } from '../core/input';
import { emit } from '../events';
import type { GameState } from '../state';
import { objectCenter } from './objects';
import { stepBlocks } from './objectBlocks';
import { stepSwitches } from './objectHits';
import { stepLinks } from './objectLinks';
import { stepPlates, stepTouches } from './objectTouch';
import { stepRoomClear } from './roomClear';
import { stepExits } from './exits';

const TIME_EPSILON = 1e-9;

/** Lit braziers of a timed group count down and go out at 0 (the group that opened its door stays lit). */
function stepBraziers(state: GameState): void {
  for (const o of state.objects) {
    if (o.kind !== 'brazier' || !o.on || o.timer <= 0) continue;
    o.timer = o.timer > DT + TIME_EPSILON ? o.timer - DT : 0;
    if (o.timer > 0) continue;
    o.on = false;
    const c = objectCenter(o);
    emit(state, { type: 'brazierOut', key: o.key, x: c.x, y: c.y });
  }
}

export function stepObjectSystems(state: GameState, input: InputFrame | undefined): void {
  stepRoomClear(state);
  stepSwitches(state);
  stepBraziers(state);
  stepPlates(state);
  stepBlocks(state, input);
  stepTouches(state);
  stepLinks(state);
  stepExits(state);
}
