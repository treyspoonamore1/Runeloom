import { spells, spellManaCost, type SpellDef, type SpellId } from '../../../data/spells';
import { PLAYER_ID } from '../actors/enemies';
import { isDodging } from '../actors/player';
import { DT } from '../core/constants';
import { Button, isHeld, wasPressed, type InputFrame } from '../core/input';
import { emit } from '../events';
import type { GameState } from '../state';
import { makePacket, type DamagePacket } from './damage';
import { applyHit, directionOr } from './hits';
import { spawnProjectile } from './projectiles';
import { circleIntersectsSector } from './shapes';

/** Number of weave slots (LMB, RMB, Q, E). */
export const LOADOUT_SLOTS = 4;

/** Button for each slot, in slot order. */
export const SLOT_BUTTONS: readonly number[] = [Button.Cast1, Button.Cast2, Button.Cast3, Button.Cast4];

/** A slot's spell, or null for an empty slot. M2 replaces spell ids with compiled weaves. */
export type Loadout = (SpellId | null)[];

/** M1 hardcoded loadout: Fire Bolt on LMB, Strike on RMB (CONTENT §9.1). */
export function defaultLoadout(): Loadout {
  return ['fire_bolt', 'strike', null, null];
}

/** Timers within this many seconds of zero count as expired (absorbs 1/60 rounding). */
const TIME_EPSILON = 1e-9;

// Scratch for Strike's enemy query.
const found: number[] = [];

/** Seconds a cast of `def` takes for this player (cast time ÷ cast speed). */
export function castDuration(state: GameState, def: SpellDef): number {
  return def.castTime / state.tuning.player.castSpeed;
}

/**
 * Casting for one tick, after the player moved:
 * - While casting, the cast advances; at castReleaseFraction of its duration it releases (mana is
 *   paid, the spell happens along the current aim) and it ends at its full duration.
 * - Otherwise, unless dead or dodging, the lowest held slot with a spell and enough mana starts a
 *   cast; its first tick counts toward the cast. Holding keeps recasting, one cast duration apart.
 * The player can move throughout. A press with too little mana sends 'castFailed'.
 */
export function stepCasting(state: GameState, input: InputFrame): void {
  const p = state.player;
  if (p.dead) return;
  if (p.castSlot >= 0) {
    advanceCast(state);
    return;
  }
  if (isDodging(p)) return;
  for (let slot = 0; slot < LOADOUT_SLOTS; slot++) {
    const button = SLOT_BUTTONS[slot]!;
    const id = state.loadout[slot] ?? null;
    if (id === null || !isHeld(input.buttons, button)) continue;
    const def: SpellDef = spells[id];
    if (p.mana < spellManaCost(def)) {
      if (wasPressed(state.prevButtons, input.buttons, button))
        emit(state, { type: 'castFailed', slot, spell: id, reason: 'mana' });
      continue;
    }
    p.castSlot = slot;
    p.castSpell = id;
    p.castTime = castDuration(state, def);
    p.castLeft = p.castTime;
    p.castReleased = false;
    emit(state, {
      type: 'castStart',
      slot,
      spell: id,
      castTime: p.castTime,
      castRelease: p.castTime * state.tuning.player.castReleaseFraction,
    });
    advanceCast(state);
    return;
  }
}

function advanceCast(state: GameState): void {
  const p = state.player;
  p.castLeft -= DT;
  if (!p.castReleased) {
    const releaseAt = p.castTime * state.tuning.player.castReleaseFraction;
    if (p.castTime - p.castLeft >= releaseAt - TIME_EPSILON) {
      const def = spells[p.castSpell!];
      const cost = spellManaCost(def);
      if (p.mana < cost) {
        cancelCast(state);
        return;
      }
      p.mana -= cost;
      p.castReleased = true;
      releaseSpell(state, p.castSlot, p.castSpell!, def);
    }
  }
  if (p.castLeft <= TIME_EPSILON) endCast(state);
}

function endCast(state: GameState): void {
  const p = state.player;
  p.castSlot = -1;
  p.castSpell = null;
  p.castLeft = 0;
  p.castTime = 0;
  p.castReleased = false;
}

/** Stops the current cast. Sends 'castCancel' if it hadn't released yet. */
export function cancelCast(state: GameState): void {
  const p = state.player;
  if (p.castSlot < 0) return;
  if (!p.castReleased) emit(state, { type: 'castCancel', slot: p.castSlot, spell: p.castSpell! });
  endCast(state);
}

/** The packet a player spell deals: base damage split by element share, base crit multiplier. */
export function spellPacket(state: GameState, def: SpellDef): DamagePacket {
  return makePacket(def.baseDamage, def.shares, def.critChance, state.tuning.combat.critMultiplier);
}

function releaseSpell(state: GameState, slot: number, id: SpellId, def: SpellDef): void {
  const p = state.player;
  const dirX = p.aimDirX;
  const dirY = p.aimDirY;
  emit(state, { type: 'cast', slot, spell: id, x: p.x, y: p.y, dirX, dirY });
  if (def.form === 'bolt') castBolt(state, def, dirX, dirY);
  else castStrike(state, def, dirX, dirY);
}

/** Bolt: a projectile from the player's center toward the aim point. */
function castBolt(state: GameState, def: SpellDef, dirX: number, dirY: number): void {
  const p = state.player;
  if (!def.projectile) throw new Error(`Spell ${def.name} has no projectile`);
  spawnProjectile(state, {
    team: 'player',
    ownerId: PLAYER_ID,
    x: p.x,
    y: p.y,
    dirX,
    dirY,
    def: def.projectile,
    damage: spellPacket(state, def),
    knockback: def.knockback,
  });
}

/**
 * Strike: hits every live enemy whose body touches the arc (apex at the player's center, `reach`
 * cells, ±acos(halfAngleCos) around the aim), once each, in enemyHash order. Ignores shields.
 * Knockback pushes away from the player. A kill adds feel.hitstopStrikeKill.
 */
function castStrike(state: GameState, def: SpellDef, dirX: number, dirY: number): void {
  const arc = def.arc;
  if (!arc) throw new Error(`Spell ${def.name} has no arc`);
  const p = state.player;
  const packet = spellPacket(state, def);
  const n = state.enemyHash.queryCircle(p.x, p.y, arc.reach, found);
  // Copy: applyHit can't change the hash, but keep the loop independent of the scratch array.
  const targets = found.slice(0, n);
  for (const idx of targets) {
    const e = state.enemies[idx]!;
    if (e.dead) continue;
    if (!circleIntersectsSector(e.x, e.y, e.radius, p.x, p.y, dirX, dirY, arc.halfAngleCos, arc.reach))
      continue;
    const [kx, ky] = directionOr(p.x, p.y, e.x, e.y, dirX, dirY);
    applyHit(state, e, packet, {
      sourceId: PLAYER_ID,
      dirX: kx,
      dirY: ky,
      knockback: def.knockback,
      killHitstop: state.tuning.feel.hitstopStrikeKill,
    });
  }
}
