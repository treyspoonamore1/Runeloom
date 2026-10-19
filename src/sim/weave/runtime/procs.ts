/**
 * What happens when a spell instance hits: damage through applyHit, On Crit noting, the "Closer
 * pays more" mana refund, Chain jumps and branch procs (CONTENT §1.5: On Hit, On Kill, On Expire,
 * Emit). Children spawn in spec.children order when several proc on one event.
 */
import { PLAYER_ID, type Enemy } from '../../actors/enemies';
import { DT } from '../../core/constants';
import { type DamagePacket, type HitResult } from '../../combat/damage';
import { applyHit, directionOr } from '../../combat/hits';
import { emit } from '../../events';
import type { GameState } from '../../state';
import type { BranchSpec, SpellSpec } from '../program';
import { nearestEnemy } from './geom';
import { noteCrit } from './queue';
import { spawnSpell } from './spawn';
import type { SpellInstance } from './types';

/** Timers within this of zero count as elapsed (absorbs 1/60 rounding). */
export const TIME_EPSILON = 1e-9;

/** True if the instance may hit `e`: alive, and not the entity it spawned from unless its spec allows. */
export function canTarget(inst: SpellInstance, e: Enemy): boolean {
  return !e.dead && (inst.spec.canHitSource || e.id !== inst.sourceId);
}

/** How far a spec reaches toward a point aim (Lob, Sigil), 0 for forms that only use a direction. */
export function aimReach(spec: SpellSpec): number {
  const p = spec.params;
  return p.form === 'lob' || p.form === 'sigil' ? p.range : 0;
}

/**
 * One hit by `inst` on `e`: knockback along (kbX, kbY), branch aim along (dirX, dirY) (the
 * parent's direction). Returns the hit result, or null if nothing landed.
 */
export function spellHit(
  state: GameState,
  inst: SpellInstance,
  e: Enemy,
  kbX: number,
  kbY: number,
  dirX: number,
  dirY: number,
  packet: DamagePacket = inst.packet,
): HitResult | null {
  const spec = inst.spec;
  const res = applyHit(state, e, packet, {
    sourceId: PLAYER_ID,
    dirX: kbX,
    dirY: kbY,
    knockback: spec.knockback,
    killHitstop: inst.form === 'strike' ? state.tuning.feel.hitstopStrikeKill : undefined,
    spellId: inst.id,
    form: inst.form,
  });
  if (res === null) return null;
  inst.hitCount++;
  if (res.crit) noteCrit(state, e.id, e.x, e.y, kbX, kbY);
  refundMana(state, inst, e);
  const kids = spec.children;
  for (let i = 0; i < kids.length; i++) {
    const c = kids[i]!;
    const proc = c.proc;
    if (proc.kind === 'on_hit') {
      if (inst.procs[i]! >= proc.maxProcsPerInstance) continue;
      if (proc.firstTargetOnly && inst.hitCount !== 1) continue;
      inst.procs[i]!++;
      spawnChild(state, inst, c, e.x, e.y, dirX, dirY, e.id);
    } else if (proc.kind === 'on_kill' && e.dead) {
      inst.procs[i]!++;
      const p = state.player;
      const [ax, ay] = directionOr(p.x, p.y, e.x, e.y, dirX, dirY);
      spawnChild(state, inst, c, e.x, e.y, ax, ay, e.id);
    }
  }
  return res;
}

/** Spawns a branch's spell from (x, y) along unit (dirX, dirY); a point aim lands at its full reach. */
export function spawnChild(
  state: GameState,
  inst: SpellInstance,
  c: BranchSpec,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  sourceId: number,
  aimX = x + dirX * aimReach(c.spec),
  aimY = y + dirY * aimReach(c.spec),
): void {
  spawnSpell(state, inst.cast, c.spec, {
    x,
    y,
    dirX,
    dirY,
    aimX,
    aimY,
    sourceId,
    echo: false,
    damageMult: 1,
    fromPlayer: false,
  });
}

/** On Expire: once per instance, from where it ended, along its last direction. */
export function fireOnExpire(state: GameState, inst: SpellInstance, stoppedOn: number): void {
  const kids = inst.spec.children;
  for (let i = 0; i < kids.length; i++) {
    const c = kids[i]!;
    if (c.proc.kind !== 'on_expire' || inst.procs[i]! >= c.proc.maxProcsPerInstance) continue;
    inst.procs[i]!++;
    spawnChild(state, inst, c, inst.x, inst.y, inst.dirX, inst.dirY, stoppedOn);
  }
}

/**
 * Emit: every interval while alive, a child at the nearest enemy within the branch's aim range of
 * the instance; skipped (but the timer still restarts) when there is none.
 */
export function stepEmits(state: GameState, inst: SpellInstance): void {
  const kids = inst.spec.children;
  for (let i = 0; i < kids.length; i++) {
    const c = kids[i]!;
    const proc = c.proc;
    if (proc.kind !== 'emit') continue;
    inst.emitLeft[i]! -= DT;
    if (inst.emitLeft[i]! > TIME_EPSILON) continue;
    inst.emitLeft[i]! += proc.interval;
    const t = nearestEnemy(state, inst.x, inst.y, proc.aimRange, null, false);
    if (t === null) continue;
    inst.procs[i]!++;
    const [dx, dy] = directionOr(inst.x, inst.y, t.x, t.y, inst.dirX, inst.dirY);
    spawnChild(state, inst, c, inst.x, inst.y, dx, dy, -1, t.x, t.y);
    if (inst.ended) return;
  }
}

/**
 * Chain (Bolt, Beam): after the instance's first direct hit on `from`, jump to the nearest new
 * target within range, again from there, until the jumps run out; jump k deals (1 − less)^k.
 * Jumps ignore shields and walls. Uses up every jump even if targets run out.
 */
export function chainFrom(state: GameState, inst: SpellInstance, from: Enemy): void {
  const chain = inst.spec.chain;
  if (chain === null || inst.chainLeft <= 0) return;
  let at = from;
  let mult = 1;
  const accept = (e: Enemy) => canTarget(inst, e) && !inst.hitIds.includes(e.id);
  while (inst.chainLeft > 0 && !inst.ended) {
    const next = nearestEnemy(state, at.x, at.y, chain.range, accept, false);
    if (next === null) break;
    inst.chainLeft--;
    mult *= 1 - chain.lessPerChain;
    inst.hitIds.push(next.id);
    emit(state, {
      type: 'chainJump',
      id: inst.id,
      castId: inst.castId,
      target: next.id,
      fromX: at.x,
      fromY: at.y,
      toX: next.x,
      toY: next.y,
    });
    const [dx, dy] = directionOr(at.x, at.y, next.x, next.y, inst.dirX, inst.dirY);
    spellHit(state, inst, next, dx, dy, dx, dy, withMore(inst.packet, mult));
    at = next;
  }
  inst.chainLeft = 0;
}

function withMore(p: DamagePacket, mult: number): DamagePacket {
  return { ...p, more: [...p.more, mult - 1] };
}

/**
 * "Closer pays more" (DESIGN §2.1, CONTENT §1.2): Strike and Nova restore mana per enemy hit
 * within tuning range of the live player, up to the per-instance cap. Sends 'manaRefund' with
 * the mana earned (before clamping at max mana).
 */
function refundMana(state: GameState, inst: SpellInstance, e: Enemy): void {
  const m = state.tuning.combat.manaOnHit;
  const per = inst.form === 'strike' ? m.strike : inst.form === 'nova' ? m.nova : 0;
  const p = state.player;
  if (per <= 0 || p.dead) return;
  const dx = e.x - p.x;
  const dy = e.y - p.y;
  if (dx * dx + dy * dy > m.range * m.range) return;
  const room = m.capPerInstance - inst.refunded;
  const amount = per < room ? per : room;
  if (amount <= 0) return;
  inst.refunded += amount;
  p.mana = p.mana + amount >= p.maxMana ? p.maxMana : p.mana + amount;
  emit(state, { type: 'manaRefund', amount, instanceId: inst.id, x: e.x, y: e.y });
}
