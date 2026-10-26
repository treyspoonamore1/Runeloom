/**
 * Events of the Drowned Foundry's bosses (M8; ai/bosses/bellwether.ts, coil*.ts), part of
 * SimEvent (events.ts). Same conventions as enemyEvents.ts: positions in cells, times in seconds,
 * `id` the boss's id.
 *
 * Shared with the other bosses and the Fen kinds: 'bossAwake', 'bossPhase' (2 and 3), 'bossSummon'
 * (the Bellwether's Sparkflies), 'telegraph' and 'attack' with the AttackDef name (bell_snap,
 * toll_ring, shell_roll, self_toll, toll_foundry; coil_lunge, glass_spit, tail_thrash, coil_dive,
 * call_pylons), 'bellRung' / 'bellClosed' (the Bellwether's shell), 'swimmerStranded' (the Coil,
 * rule 31), 'pylonGlow' (each pylon, before the Coil's pylon storm), 'projectileSpawn' /
 * 'projectileEnd' (kind glass_spit). Persistent looks: `enemy.boss.fen` (actors/bossStateFen.ts:
 * coil, pulseGlowing, pylonGlowing, waveR), `enemy.special` (openLeft, stranded, dashSpeed for the
 * roll), `enemy.terrain.stunLeft`.
 */
import type { CoilMode } from './actors/bossStateFen';

export type BossEventM8 =
  /** The toll ring's wave starts expanding from (x, y) to `radius` cells over `seconds`. */
  | { type: 'bellWave'; id: number; x: number; y: number; radius: number; seconds: number }
  /** The shell roll ended against a wall: stunned for `seconds`. */
  | { type: 'bellRollStunned'; id: number; seconds: number; x: number; y: number }
  /** Phase 2: the self-toll landed, sending its own (enemy) charge into what it stands on. */
  | { type: 'bellSelfToll'; id: number; damage: number; x: number; y: number }
  /** The Glasswater Coil's state changed (DESIGN §10.5; actors/bossStateFen.ts CoilMode). */
  | { type: 'coilState'; id: number; state: CoilMode; x: number; y: number }
  /**
   * A pulse starts glowing: 'eye' (phases 1–2, all its water brightens: every water cell within
   * `reach` of (x, y) along the water) or 'body' (phase 3, its body glows and a ring on its water out
   * to `reach` cells). It lands in `seconds` unless (body) it is Overloaded first.
   */
  | { type: 'coilPulseGlow'; id: number; pulse: 'eye' | 'body'; seconds: number; reach: number; x: number; y: number }
  /** The pulse landed: enemy charge in its water for `damage` Storm ('waterElectrified' follows). */
  | { type: 'coilPulse'; id: number; pulse: 'eye' | 'body'; damage: number; reach: number; x: number; y: number }
  /** Phase 3: the pylons glow (with a 'pylonGlow' per pylon); lightning lands in `seconds`. */
  | { type: 'coilPylonGlow'; id: number; seconds: number; pylons: { x: number; y: number }[] }
  /** Phase 3: lightning struck the pylons for `damage` Storm, electrifying their pads and the rim. */
  | { type: 'coilPylonStorm'; id: number; damage: number; pylons: { x: number; y: number }[] }
  /**
   * Player charge reached its water during a Body pulse glow: the pulse is cancelled, it is stunned
   * for `stun` s, and the next Body pulse comes `delay` s later.
   */
  | { type: 'coilOverloaded'; id: number; stun: number; delay: number; x: number; y: number }
  /** It broke out of the ice: the ice within `radius` cells of (x, y) returned to water. */
  | { type: 'coilIceBreak'; id: number; radius: number; x: number; y: number }
  /** A glass spit landed: shallow water of `radius` cells on dry ground around (x, y) for `seconds`. */
  | { type: 'coilPuddle'; x: number; y: number; radius: number; seconds: number };
