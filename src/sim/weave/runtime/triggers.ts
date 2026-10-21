/**
 * The trigger phase of a tick (CONTENT §1.1): the Cast wind-up flow, Pulse, and the event
 * triggers (On Dodge, Harvest, On Crit, On Hurt) fed by the trigger queue. Every automatic
 * trigger pays its weave's mana when it fires and skips when short; each has its ICD. Nothing
 * fires while the player is dead or frozen (queued events are dropped).
 *
 * Passives and Fuse parts (hero/effects.ts): extra weaves (Cinder Heart) are offered Pulse and
 * events after slots 0–3, firing as slot −1; Living Loom makes automatic triggers free and
 * gives them a shared cooldown.
 */
import { isDodging } from '../../actors/player';
import { DT } from '../../core/constants';
import { isHeld, wasPressed, type InputFrame } from '../../core/input';
import { isFrozen, actionSpeed } from '../../combat/ailments';
import { directionOr } from '../../combat/hits';
import { emit } from '../../events';
import type { GameState } from '../../state';
import type { SpellProgram } from '../program';
import { cancelCast, endCast } from './castState';
import { nearestEnemy } from './geom';
import { LOADOUT_SLOTS, SLOT_BUTTONS } from './loadout';
import { aimReach, TIME_EPSILON } from './procs';
import { openCast, spawnSpell } from './spawn';
import type { TriggerQueueEntry } from './types';
import type { WeaveSlot } from './loadout';
import {
  autoTriggerMana,
  autoTriggerReady,
  noteAutoTriggerFired,
  tickHeroTriggers,
} from '../../hero/effects';

/** Pays `cost` mana; false (nothing paid) if short. With cheats.infiniteMana it always pays. */
export function payMana(state: GameState, cost: number): boolean {
  if (state.cheats.infiniteMana) return true;
  const p = state.player;
  if (p.mana < cost) return false;
  p.mana -= cost;
  return true;
}

/** True if the player can pay `cost` now. */
function canPay(state: GameState, cost: number): boolean {
  return state.cheats.infiniteMana === true || state.player.mana >= cost;
}

/**
 * Fires a program's root spell from (x, y) along unit (dirX, dirY) with aim point (aimX, aimY)
 * (mana already paid). Sends 'triggerFired' and returns the cast id.
 */
export function fireProgram(
  state: GameState,
  slot: number,
  program: SpellProgram,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  aimX: number,
  aimY: number,
  sourceId: number,
  fromPlayer: boolean,
): number {
  const cast = openCast(state, slot, program.trigger.id, program);
  emit(state, {
    type: 'triggerFired',
    slot,
    trigger: program.trigger.id,
    castId: cast.id,
    x,
    y,
    dirX,
    dirY,
    mana: program.mana,
  });
  spawnSpell(state, cast, program.root, {
    x,
    y,
    dirX,
    dirY,
    aimX,
    aimY,
    sourceId,
    echo: false,
    damageMult: 1,
    fromPlayer,
  });
  return cast.id;
}

/**
 * Order: ICDs count down → Cast flow (M1 casting) → Pulse → queued events in arrival order,
 * each offered to slots 0–3.
 */
export function stepWeaves(state: GameState, input: InputFrame): void {
  const p = state.player;
  for (const s of state.weaves.slots) {
    // An ICD of d seconds set on tick T is ready again on tick T + 60d.
    if (s.cooldownLeft > 0) {
      s.cooldownLeft -= DT;
      if (s.cooldownLeft <= TIME_EPSILON) s.cooldownLeft = 0;
    }
  }
  tickHeroTriggers(state);
  const blocked = p.dead || isFrozen(p);
  if (!p.dead) {
    if (blocked) cancelCast(state);
    else stepCast(state, input);
  }
  stepChannel(state, input, blocked);
  stepPulse(state, blocked);
  stepQueue(state, input, blocked);
}

/**
 * Cast-trigger slots, as M1 casting: while casting, the cast advances at actionSpeed; at
 * castReleaseFraction of its duration it releases (mana paid, root spell along the current aim)
 * and it ends at its full duration. Otherwise, unless dodging, the lowest held Cast slot with a
 * working weave and enough mana starts a cast (its first tick counts); holding recasts. A press
 * that can't pay sends 'castFailed'. Automatic slots ignore their button.
 */
function stepCast(state: GameState, input: InputFrame): void {
  const p = state.player;
  if (p.castSlot >= 0) {
    advanceCast(state, input);
    return;
  }
  if (isDodging(p)) return;
  for (let slot = 0; slot < LOADOUT_SLOTS; slot++) {
    const button = SLOT_BUTTONS[slot]!;
    const prog = state.weaves.slots[slot]!.program;
    if (prog === null || prog.trigger.event !== 'press' || !isHeld(input.buttons, button)) continue;
    if (!canPay(state, prog.mana)) {
      if (wasPressed(state.prevButtons, input.buttons, button))
        emit(state, { type: 'castFailed', slot, spell: prog.root.form, reason: 'mana' });
      continue;
    }
    p.castSlot = slot;
    p.castSpell = state.loadout[slot] ?? null;
    p.castTime = prog.castTime / state.tuning.player.castSpeed;
    p.castLeft = p.castTime;
    p.castReleased = false;
    emit(state, {
      type: 'castStart',
      slot,
      spell: prog.root.form,
      castTime: p.castTime,
      castRelease: p.castTime * state.tuning.player.castReleaseFraction,
    });
    advanceCast(state, input);
    return;
  }
}

function advanceCast(state: GameState, input: InputFrame): void {
  const p = state.player;
  p.castLeft -= DT * actionSpeed(state, p);
  if (!p.castReleased) {
    const releaseAt = p.castTime * state.tuning.player.castReleaseFraction;
    if (p.castTime - p.castLeft >= releaseAt - TIME_EPSILON) {
      const slot = p.castSlot;
      const prog = state.weaves.slots[slot]!.program;
      if (prog === null || !payMana(state, prog.mana)) {
        cancelCast(state);
        return;
      }
      p.castReleased = true;
      emit(state, {
        type: 'cast',
        slot,
        spell: prog.root.form,
        x: p.x,
        y: p.y,
        dirX: p.aimDirX,
        dirY: p.aimDirY,
      });
      fireProgram(state, slot, prog, p.x, p.y, p.aimDirX, p.aimDirY, input.aimX, input.aimY, -1, true);
    }
  }
  if (p.castLeft <= TIME_EPSILON) endCast(state);
}

/**
 * Channel (M5, CONTENT §1.1): while its slot's button is held (not dodging, not frozen), fires
 * every `period` seconds from the player along the aim, paying the weave's mana each time (the
 * trigger's 0.3 mana multiplier is already in it) and ignoring cast time. The first fire comes
 * on the press; releasing the button resets the timer. Short on mana, it skips that beat.
 * Moving while a Channel button is held is slower (runtime/channel.ts, actors/player.ts).
 */
function stepChannel(state: GameState, input: InputFrame, blocked: boolean): void {
  const p = state.player;
  state.weaves.slots.forEach((s, slot) => {
    const prog = s.program;
    if (prog === null || prog.trigger.event !== 'held') return;
    if (!isHeld(input.buttons, SLOT_BUTTONS[slot]!)) {
      s.periodLeft = 0;
      return;
    }
    const due = s.periodLeft <= TIME_EPSILON;
    if (due) s.periodLeft += prog.trigger.period ?? 0;
    s.periodLeft -= DT;
    if (!due || blocked || isDodging(p)) return;
    if (!payMana(state, prog.mana)) {
      if (wasPressed(state.prevButtons, input.buttons, SLOT_BUTTONS[slot]!))
        emit(state, { type: 'castFailed', slot, spell: prog.root.form, reason: 'mana' });
      return;
    }
    fireProgram(state, slot, prog, p.x, p.y, p.aimDirX, p.aimDirY, input.aimX, input.aimY, -1, true);
  });
}

/**
 * Pulse: when its period is up, fire at the nearest visible enemy in range; skip (the period
 * restarts) if there is none or mana is short. A period of d seconds fires every 60d ticks.
 */
function stepPulse(state: GameState, blocked: boolean): void {
  state.weaves.slots.forEach((s, slot) => pulseSlot(state, s, slot, blocked));
  for (const s of state.heroFx.bonus) pulseSlot(state, s, -1, blocked);
}

function pulseSlot(state: GameState, s: WeaveSlot, slot: number, blocked: boolean): void {
  const p = state.player;
  const prog = s.program;
  if (prog === null || prog.trigger.event !== 'interval') return;
  const due = s.periodLeft <= TIME_EPSILON;
  if (due) s.periodLeft += prog.trigger.period ?? 0;
  s.periodLeft -= DT;
  if (!due || blocked) return;
  const t = nearestEnemy(state, p.x, p.y, prog.trigger.aimRange ?? Infinity, null, true);
  if (t === null || !payAuto(state, prog)) return;
  const [dx, dy] = directionOr(p.x, p.y, t.x, t.y, p.aimDirX, p.aimDirY);
  fireProgram(state, slot, prog, p.x, p.y, dx, dy, t.x, t.y, -1, true);
}

/** An automatic trigger pays (nothing with Living Loom) unless Living Loom's cooldown runs. */
function payAuto(state: GameState, prog: SpellProgram): boolean {
  if (!autoTriggerReady(state) || !payMana(state, autoTriggerMana(state, prog))) return false;
  noteAutoTriggerFired(state);
  return true;
}

/** Event kinds the readout forces (DESIGN §5.5) instead of waiting for them. */
const FORCED: readonly TriggerQueueEntry['event'][] = ['dodge_start', 'hurt', 'crit'];

function stepQueue(state: GameState, input: InputFrame, blocked: boolean): void {
  const q = state.triggerQueue;
  if (state.triggerForcing > 0) {
    for (let i = q.length - 1; i >= 0; i--) if (FORCED.includes(q[i]!.event)) q.splice(i, 1);
    if (state.triggerForcingLeft <= 0) {
      state.triggerForcingLeft = state.triggerForcing;
      for (const ev of FORCED) forceEvent(state, ev);
    }
    state.triggerForcingLeft--;
  }
  if (q.length === 0) return;
  // Entries queued while these fire (crits from their hits) wait for the next tick.
  const list = q.splice(0, q.length);
  if (blocked) return;
  for (const entry of list) {
    state.weaves.slots.forEach((s, slot) => offerEntry(state, input, s, slot, entry));
    for (const s of state.heroFx.bonus) offerEntry(state, input, s, -1, entry);
  }
}

function offerEntry(
  state: GameState,
  input: InputFrame,
  s: WeaveSlot,
  slot: number,
  entry: TriggerQueueEntry,
): void {
  const prog = s.program;
  if (prog === null || prog.trigger.event !== entry.event || s.cooldownLeft > 0) return;
  const tr = prog.trigger;
  if (tr.event === 'hurt' && entry.amount < (tr.hurtThreshold ?? 0) - TIME_EPSILON) return;
  if (!payAuto(state, prog)) return;
  s.cooldownLeft = tr.icd;
  fireFromEntry(state, input, slot, prog, entry);
}

/** Origin and aim from the trigger's rules (TriggerOrigin, TriggerAim). */
function fireFromEntry(
  state: GameState,
  input: InputFrame,
  slot: number,
  prog: SpellProgram,
  entry: TriggerQueueEntry,
): void {
  const p = state.player;
  const tr = prog.trigger;
  const atPlayer = tr.origin === 'caster';
  // Dodge: from where it started. Hurt: from where the player is now.
  const x = atPlayer && entry.event !== 'dodge_start' ? p.x : entry.x;
  const y = atPlayer && entry.event !== 'dodge_start' ? p.y : entry.y;
  const sourceId = atPlayer ? -1 : entry.targetId;
  let dx = p.aimDirX;
  let dy = p.aimDirY;
  let ax = input.aimX;
  let ay = input.aimY;
  if (tr.aim !== 'cursor') {
    if (tr.aim === 'away_from_caster') [dx, dy] = directionOr(p.x, p.y, x, y, p.aimDirX, p.aimDirY);
    else if (entry.dirX !== 0 || entry.dirY !== 0) [dx, dy] = [entry.dirX, entry.dirY];
    const reach = aimReach(prog.root);
    ax = x + dx * reach;
    ay = y + dy * reach;
  }
  fireProgram(state, slot, prog, x, y, dx, dy, ax, ay, sourceId, atPlayer);
}

/**
 * Readout hook (DESIGN §5.5): queues one synthetic event of `event` if a slot listens — a dodge
 * along the aim, a hit worth all of the player's life, or a crit on the enemy nearest the player
 * along the line to it.
 */
function forceEvent(state: GameState, event: TriggerQueueEntry['event']): void {
  if (!state.weaves.slots.some((s) => s.program?.trigger.event === event)) return;
  const p = state.player;
  const base = { event, targetId: -1, x: p.x, y: p.y, dirX: 0, dirY: 0, amount: 0 };
  if (event === 'dodge_start') state.triggerQueue.push({ ...base, dirX: p.aimDirX, dirY: p.aimDirY });
  else if (event === 'hurt') state.triggerQueue.push({ ...base, amount: 1 });
  else {
    const t = nearestEnemy(state, p.x, p.y, Infinity, null, false);
    if (t === null) return;
    const [dx, dy] = directionOr(p.x, p.y, t.x, t.y, p.aimDirX, p.aimDirY);
    state.triggerQueue.push({ ...base, targetId: t.id, x: t.x, y: t.y, dirX: dx, dirY: dy });
  }
}
