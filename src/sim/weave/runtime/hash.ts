/** Hashes the spell runtime's state (hashState calls this). Programs and specs are covered by notation + spindle + path. */
import { damageTypes } from '../../../../data/combatTypes';
import type { DamagePacket } from '../../combat/damage';
import type { Hasher } from '../../core/hash';
import type { GameState } from '../../state';
import type { SpawnAt } from './types';

export function hashPacket(h: Hasher, d: DamagePacket): void {
  for (const t of damageTypes) h.num(d.base[t]);
  h.num(d.critChance).num(d.critMultiplier).num(d.increased).u32(d.more.length);
  for (const m of d.more) h.num(m);
  h.num(d.ailmentDuration ?? 1).num(d.chillGain ?? 1).bool(d.increasedByType !== undefined);
  if (d.increasedByType) for (const t of damageTypes) h.num(d.increasedByType[t]);
}

function str(h: Hasher, s: string | null): void {
  h.string(s ?? '-').byte(0);
}

function path(h: Hasher, p: readonly string[]): void {
  h.u32(p.length);
  for (const seg of p) str(h, seg);
}

function at(h: Hasher, a: SpawnAt): void {
  h.num(a.x).num(a.y).num(a.dirX).num(a.dirY).num(a.aimX).num(a.aimY).num(a.sourceId);
  h.bool(a.echo).num(a.damageMult).bool(a.fromPlayer);
}

export function hashWeaveState(h: Hasher, state: GameState): void {
  const w = state.weaves;
  str(h, w.spindleId);
  h.num(w.capacity ?? -1).u32(w.slots.length);
  for (const s of w.slots) {
    str(h, s.notation);
    h.num(s.cooldownLeft).num(s.periodLeft);
  }
  h.bool(state.cheats.infiniteMana === true).u32(state.triggerForcing).u32(state.nextCastId);
  for (const x of state.spellRng.getState()) h.u32(x);

  h.u32(state.triggerQueue.length);
  for (const q of state.triggerQueue) {
    str(h, q.event);
    h.num(q.targetId).num(q.x).num(q.y).num(q.dirX).num(q.dirY).num(q.amount);
  }

  h.u32(state.casts.length);
  for (const c of state.casts) {
    h.u32(c.id).num(c.slot);
    str(h, c.trigger);
    str(h, c.notation);
    str(h, c.spindleId);
    h.num(c.capacity ?? -1).u32(c.spawned).u32(c.dropped).u32(c.refs);
  }

  h.u32(state.pendingSpells.length);
  for (const ps of state.pendingSpells) {
    h.u32(ps.castId).num(ps.delayLeft);
    path(h, ps.spec.path);
    at(h, ps.at);
  }

  h.u32(state.spells.length);
  for (const s of state.spells) {
    h.u32(s.id).u32(s.castId).num(s.slot);
    str(h, s.form);
    path(h, s.spec.path);
    h.u32(s.depth).num(s.sourceId).bool(s.echo);
    hashPacket(h, s.packet);
    h.num(s.x).num(s.y).num(s.dirX).num(s.dirY).num(s.vx).num(s.vy).num(s.radius);
    h.num(s.age).num(s.lifeLeft).num(s.pierceLeft).num(s.chainLeft);
    h.num(s.fromX).num(s.fromY).num(s.toX).num(s.toY).num(s.cx).num(s.cy).bool(s.followsPlayer);
    h.u32(s.hitIds.length);
    for (const id of s.hitIds) h.u32(id);
    for (const c of s.hitCooldowns) h.num(c);
    h.u32(s.hitCount);
    for (const n of s.procs) h.u32(n);
    for (const e of s.emitLeft) h.num(e);
    h.num(s.refunded).bool(s.ended);
    str(h, s.endReason);
  }
}
