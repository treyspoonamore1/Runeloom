import { damageTypes, type DamageAmounts } from '../../data/combatTypes';
import { Hasher } from './core/hash';
import type { AttackShape } from './combat/shapes';
import type { DamagePacket } from './combat/damage';
import type { GameState } from './state';

/**
 * Hash of all simulation state that affects the future. Two runs with the same
 * seed and inputs must produce the same hash on every tick. Add every new piece
 * of sim state here when you add it to GameState.
 *
 * Not hashed: `events` (output only), `enemyHash` (rebuilt from `enemies` every step),
 * prevX/prevY (render interpolation only).
 */
export function hashState(state: GameState): number {
  const h = new Hasher();
  h.u32(state.tick).u32(state.seed).u32(state.prevButtons);
  for (const w of state.rng.getState()) h.u32(w);
  for (const w of state.combatRng.getState()) h.u32(w);
  h.string(state.room.id);
  h.u32(state.nextId).num(state.hitstopLeft);
  h.u32(state.loadout.length);
  for (const s of state.loadout) h.string(s ?? '-').byte(0);

  const p = state.player;
  h.num(p.x).num(p.y).num(p.vx).num(p.vy);
  h.num(p.aimDirX).num(p.aimDirY).num(p.faceX).num(p.faceY);
  h.num(p.dodgeCharges).num(p.dodgeRechargeLeft).num(p.dodgeLeft);
  h.num(p.dodgeDirX).num(p.dodgeDirY).num(p.iframesLeft);
  h.u32(p.level).num(p.life).num(p.maxLife).num(p.mana).num(p.maxMana);
  amounts(h, p.resist);
  h.num(p.shock).num(p.kbX).num(p.kbY).bool(p.dead).num(p.respawnLeft);
  h.u32(p.castSlot + 1)
    .string(p.castSpell ?? '-')
    .num(p.castLeft)
    .num(p.castTime)
    .bool(p.castReleased);

  h.u32(state.enemies.length);
  for (const e of state.enemies) {
    h.u32(e.id).string(e.kind).byte(0);
    h.num(e.x).num(e.y).num(e.vx).num(e.vy).num(e.kbX).num(e.kbY);
    h.num(e.radius).num(e.facingX).num(e.facingY).num(e.life).num(e.maxLife);
    amounts(h, e.resist);
    h.num(e.shock).u32(e.areaLevel).string(e.rarity).bool(e.dead);
    h.string(e.ai.mode).byte(0).num(e.ai.timer).num(e.ai.targetId).num(e.ai.cooldown);
    const a = e.attack;
    h.string(a.phase).byte(0).num(a.timeLeft).string(a.name).byte(0).num(a.originX).num(a.originY);
    shape(h, a.shape);
    h.bool(e.shield !== null);
    if (e.shield) h.num(e.shield.halfAngleCos).num(e.shield.burnLeft);
  }

  h.u32(state.projectiles.length);
  for (const pr of state.projectiles) {
    h.u32(pr.id).string(pr.team).byte(0).u32(pr.ownerId).string(pr.kind).byte(0);
    h.num(pr.x).num(pr.y).num(pr.vx).num(pr.vy).num(pr.radius).num(pr.lifeLeft);
    packet(h, pr.damage);
    h.num(pr.knockback).u32(pr.pierceLeft).bool(pr.ended);
    h.u32(pr.hitIds.length);
    for (const id of pr.hitIds) h.u32(id);
  }
  return h.digest();
}

function amounts(h: Hasher, a: DamageAmounts): void {
  for (const t of damageTypes) h.num(a[t]);
}

function packet(h: Hasher, d: DamagePacket): void {
  amounts(h, d.base);
  h.num(d.critChance).num(d.critMultiplier).num(d.increased).u32(d.more.length);
  for (const m of d.more) h.num(m);
}

function shape(h: Hasher, s: AttackShape): void {
  h.string(s.kind).byte(0);
  switch (s.kind) {
    case 'circle':
      h.num(s.r);
      break;
    case 'cone':
      h.num(s.r).num(s.halfAngleCos).num(s.dirX).num(s.dirY);
      break;
    case 'line':
      h.num(s.length).num(s.width).num(s.dirX).num(s.dirY);
      break;
  }
}

export function hashHex(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0');
}
