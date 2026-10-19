/**
 * Gallery exhibits that are enemies: render-only stand-ins built from a spawned dummy and then
 * given an M4 kind (the sim can't spawn those kinds yet). The gallery never steps the sim; this
 * module poses the stand-ins every frame (walk, attack cycle, ailments) for the renderer to read.
 */
import { spawnEnemy, type AttackPhase, type AttackShape, type Enemy, type EnemyRarity, type GameState } from '../../sim';
import type { EnemyKind } from '../../../data/enemies';
import { M4_ATTACKS, type M4AttackKey } from '../m4Wiring';
import { M4_LOOK, type M4Kind } from '../../render/bestiary/bestiaryPalette';

export type Pose = 'idle' | 'move' | 'attack';

export interface ActorSpec {
  kind: M4Kind | 'tinderling' | 'shieldbearer' | 'ember_archer';
  x: number;
  y: number;
  label: string;
  pose?: Pose;
  attack?: { key: M4AttackKey; shape: AttackShape; windup: number; dx?: number; dy?: number };
  rarity?: EnemyRarity;
  mods?: string[];
  /** Life fraction (boss phases). */
  life?: number;
  frozen?: boolean;
  wet?: boolean;
  oiled?: boolean;
  /** Burning (true), or burning from this many seconds after the section is shown (a fuse lit on cue). */
  burning?: boolean | number;
  facing?: [number, number];
  /** Hold the attack in this phase (a surfaced lunge, a summon in progress). */
  force?: AttackPhase;
  /** A Brood Kiln that hatches mites every 5 s (the gallery feeds the spawn events). */
  spawns?: boolean;
}

export interface Actor {
  spec: ActorSpec;
  e: Enemy;
}

const RADIUS: Record<string, number> = { tinderling: 1, shieldbearer: 2, ember_archer: 1.4 };

export function spawnActor(s: GameState, spec: ActorSpec): Actor {
  const e = spawnEnemy(s, 'dummy', spec.x, spec.y, { facingX: spec.facing?.[0] ?? 1, facingY: spec.facing?.[1] ?? 0.2 });
  e.kind = spec.kind as EnemyKind;
  e.radius = spec.kind in M4_LOOK ? M4_LOOK[spec.kind as M4Kind].radius : (RADIUS[spec.kind] ?? 1);
  e.rarity = spec.rarity ?? 'normal';
  if (spec.mods) (e as unknown as { mods: string[] }).mods = spec.mods;
  e.maxLife = 100;
  e.life = 100 * (spec.life ?? 1);
  return { spec, e };
}

const FOREVER = 1e6;

/** Poses every actor for gallery time t (seconds since the section was shown). hold: stop windups at this progress (shots). */
export function poseActors(actors: readonly Actor[], t: number, hold: number | null): void {
  for (const { spec, e } of actors) {
    e.prevX = e.x;
    e.prevY = e.y;
    if (spec.pose === 'move') {
      const speed = spec.kind in M4_LOOK ? M4_LOOK[spec.kind as M4Kind].speed : 15;
      const amp = 2.5;
      const w = speed / amp;
      const x = spec.x + Math.sin(t * w * 0.35) * amp;
      e.prevX = x - Math.cos(t * w * 0.35) * amp * w * 0.35 / 60;
      e.x = x;
      e.facingX = Math.cos(t * w * 0.35) >= 0 ? 1 : -1;
      e.facingY = 0.15;
    }
    const a = e.attack;
    if (spec.pose === 'attack' && spec.attack) {
      const at = spec.attack;
      a.name = M4_ATTACKS[at.key];
      a.shape = at.shape;
      a.originX = e.x + (at.dx ?? 0);
      a.originY = e.y + (at.dy ?? 0);
      const cycle = at.windup + 0.1 + 0.5 + 0.8;
      // Held windups still start from the top, so the telegraph sees the whole windup length.
      const u = hold !== null ? Math.min(hold, t / at.windup) : (t % cycle) / at.windup;
      if (spec.force) {
        a.phase = spec.force;
        a.timeLeft = 0.2;
      } else if (hold !== null || u < 1) {
        a.phase = 'windup';
        a.timeLeft = at.windup * (1 - Math.min(u, 0.999));
      } else {
        const r = (t % cycle) - at.windup;
        if (r < 0.1) [a.phase, a.timeLeft] = ['active', 0.1 - r];
        else if (r < 0.6) [a.phase, a.timeLeft] = ['recover', 0.6 - r];
        else [a.phase, a.timeLeft] = ['none', 0];
      }
    }
    const ail = e.ailments;
    if (spec.frozen) ail.freeze.timeLeft = FOREVER;
    if (spec.burning !== undefined && spec.burning !== false) {
      const on = spec.burning === true || t >= spec.burning;
      ail.ignite.timeLeft = on ? FOREVER : 0;
      ail.ignite.dps = 4;
    }
    if (spec.wet) e.terrain.wetLeft = FOREVER;
    if (spec.oiled) e.terrain.oiledLeft = FOREVER;
  }
}
