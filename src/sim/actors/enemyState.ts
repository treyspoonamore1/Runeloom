/**
 * M4 enemy state beyond M1's: chemistry and dash state for every enemy, the fight state for
 * bosses. Fields of `Enemy` (actors/enemies.ts); hashed in hashState.ts.
 */
import type { Hasher } from '../core/hash';
import { createFenSpecial, hashFenSpecial, type FenSpecial } from './enemyStateM8';

/**
 * M4 per-enemy chemistry and attack state that isn't an ailment or terrain status. Plain data,
 * hashed; written by src/sim/ai and src/sim/combat/enemyAttacks.ts, read by render.
 */
export interface EnemySpecial extends FenSpecial {
  /** Tar Hulk: seconds until its lit fuse explodes (ignited while Oiled); 0 = no fuse. */
  fuseLeft: number;
  /** Bog Lurker: under the surface (true except while it attacks). */
  submerged: boolean;
  /** Bog Lurker: its water froze under it; it can't move or attack until the ice thaws. */
  trapped: boolean;
  /** Dash attack in progress (lunge, charge): unit direction and speed (cells/s); 0 speed = none. */
  dashX: number;
  dashY: number;
  dashSpeed: number;
  /** The current dash already hit the player. */
  dashHit: boolean;
  /** Id of the enemy that spawned it (a Brood Kiln's mites, the Matriarch's Hulks); -1 if none. */
  parentId: number;
  /** Cell index it last left an oil trail on (Tar Hulk, Matriarch); -1 before the first. */
  trailCell: number;
}

export function createEnemySpecial(): EnemySpecial {
  return {
    fuseLeft: 0,
    submerged: false,
    trapped: false,
    dashX: 0,
    dashY: 0,
    dashSpeed: 0,
    dashHit: false,
    parentId: -1,
    trailCell: -1,
    ...createFenSpecial(),
  };
}

/** A boss's fight state (ai/bosses). Plain data, hashed; render reads phase and superheated. */
export interface BossState {
  /** Current phase, from 1. */
  phase: number;
  /** A phase the boss has crossed into but not started yet (it waits for its attack to end); 0 = none. */
  pendingPhase: number;
  /** Cinder Warden phases 2–3: takes tuning.bosses.superheatDamageTaken × damage. */
  superheated: boolean;
  /** Seconds left of a Superheat break (a Freeze breaks it); 0 = not broken. */
  breakLeft: number;
  /** It was Frozen at the last check (a new Freeze is detected on the change). */
  wasFrozen: boolean;
  /** Chill builds only while it stands in water (Cinder Warden, phases 2–3). */
  chillNeedsWater: boolean;
  /** It stands in water this tick (shallow or oily water under its center). */
  inWater: boolean;
  /** Phase 3 brazier storm: seconds until the braziers start glowing, or (glowing) until the lightning lands. */
  stormLeft: number;
  /** Phase 3: the braziers are glowing (the lightning lands when stormLeft runs out). */
  glowing: boolean;
  /** Seconds before it picks its next attack. */
  gap: number;
  /** Tar Matriarch: seconds before being lit while Oiled can light her flare fuse again. */
  flareCooldown: number;
}

export function createBossState(): BossState {
  return {
    phase: 1,
    pendingPhase: 0,
    superheated: false,
    breakLeft: 0,
    wasFrozen: false,
    chillNeedsWater: false,
    inWater: false,
    stormLeft: 0,
    glowing: false,
    gap: 0,
    flareCooldown: 0,
  };
}

export function hashEnemySpecial(h: Hasher, s: EnemySpecial): void {
  h.num(s.fuseLeft).bool(s.submerged).bool(s.trapped).num(s.dashX).num(s.dashY).num(s.dashSpeed);
  h.bool(s.dashHit).num(s.parentId).num(s.trailCell);
  hashFenSpecial(h, s);
}

export function hashBossState(h: Hasher, b: BossState | null): void {
  h.bool(b !== null);
  if (b === null) return;
  h.u32(b.phase).u32(b.pendingPhase).bool(b.superheated).num(b.breakLeft).bool(b.wasFrozen);
  h.bool(b.chillNeedsWater).bool(b.inWater).num(b.stormLeft).bool(b.glowing).num(b.gap);
  h.num(b.flareCooldown);
}
