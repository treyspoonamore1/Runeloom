/**
 * Events of the M8 (Glasswater Fen) enemies and swimmers (src/sim/actors/strand.ts,
 * actors/fenChemistry.ts, ai/leaper.ts, ai/charger.ts, combat/enemyAttacksM8.ts), part of SimEvent
 * (events.ts). Same conventions as enemyEvents.ts: positions in cells, times in seconds, `id`
 * the enemy's id.
 *
 * Every Fen attack also sends 'telegraph' (at windup start, with its windup) and 'attack' (as it
 * lands) with its AttackDef.name: pike_leap, copper_pinch, heron_beak, puddle_spit, slag_slam,
 * spark_zap, bull_gore, bull_charge, croak, bell_bite. The telegraph's shape and origin are on
 * `enemy.attack` (shape, originX, originY) as for every enemy. Persistent looks read
 * `enemy.special` (actors/enemyStateM8.ts): stranded, strandTime, drying, submerged (Glasspike
 * hidden: the glint), leapLeft / leapTime / leapFrom / leapTo (the arc), chargedLeft (Copperback
 * antenna sparks), hot / crackedLeft (Slagshell glow or cracks), lureLeft / lureX / lureY
 * (Sparkfly circling a light), boggedLeft (Mirebull stuck in mud), openLeft / ringCooldown
 * (Bellshell shell open; ringing), and `enemy.terrain.stunLeft` for stuns.
 */
export type EnemyEventM8 =
  /**
   * Rule 31: a swimmer's water went away under it (stranded: true: helpless, then crawling to
   * water) or it got back into water (false).
   */
  | { type: 'swimmerStranded'; id: number; stranded: boolean; x: number; y: number }
  /** A Stranded swimmer has no water in reach and is drying out (true), or found water again (false). */
  | { type: 'swimmerDrying'; id: number; drying: boolean; x: number; y: number }
  /**
   * A Glasspike left the water: it flies from (fromX, fromY) to (toX, toY) over `seconds` (draw
   * an arc). Its 0.8 s flash and the landing circle were the 'telegraph' before it.
   */
  | {
      type: 'pikeLeap';
      id: number;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      seconds: number;
    }
  /** A Glasspike touched down (its bite resolves now); onWater false means it Strands. */
  | { type: 'pikeLand'; id: number; x: number; y: number; onWater: boolean }
  /** A Copperback became Charged for `seconds` (true; antenna sparks), or its charge ended (false). */
  | { type: 'copperCharged'; id: number; charged: boolean; seconds: number; x: number; y: number }
  /** A Charged Copperback electrified the water or metal under it as enemy charge for `damage` Storm. */
  | { type: 'copperPulse'; id: number; damage: number; x: number; y: number }
  /** A Slagshell got Wet and cracked in a puff of steam: no damage reduction, slower, for `seconds` once dry. */
  | { type: 'slagQuenched'; id: number; seconds: number; x: number; y: number }
  /** A Slagshell dried and heated again: Hot (70% less damage taken). */
  | { type: 'slagReheated'; id: number; x: number; y: number }
  /** A Sparkfly was drawn to a light at (lightX, lightY): it circles there for `seconds`. */
  | { type: 'sparkflyLured'; id: number; lightX: number; lightY: number; seconds: number }
  /** A Sparkfly died over water and popped: enemy charge in `reach` cells of its water for `damage` Storm. */
  | { type: 'sparkflyPop'; id: number; x: number; y: number; reach: number; damage: number }
  /** A Mirebull's charge ended in mud: bogged for `seconds` (it takes more damage). */
  | { type: 'bullBogged'; id: number; seconds: number; x: number; y: number }
  /** A Mirebull charged into a wall: stunned for `seconds`. */
  | { type: 'bullStunned'; id: number; seconds: number; x: number; y: number }
  /**
   * A Bellows Toad croaked: an enemy gust over its cone (apex (x, y), along (dirX, dirY), `radius`
   * cells, `angleDeg` wide) for `seconds`.
   */
  | {
      type: 'toadCroak';
      id: number;
      x: number;
      y: number;
      dirX: number;
      dirY: number;
      radius: number;
      angleDeg: number;
      seconds: number;
    }
  /**
   * Fire hit a Bellows Toad while it inflated: its marsh gas lit in a `radius`-cell world-owned
   * fire puff for `damage` Fire (an 'explosion' event follows); it is stunned for `stun` s.
   */
  | { type: 'toadGasLit'; id: number; x: number; y: number; radius: number; damage: number; stun: number }
  /** A Bellshell was rung by charge: stunned `stun` s, its shell open for `open` s. */
  | { type: 'bellRung'; id: number; stun: number; open: number; x: number; y: number }
  /** A Bellshell's shell closed again (it can ring again after `cooldown` s). */
  | { type: 'bellClosed'; id: number; cooldown: number; x: number; y: number }
  /** A Spark Heron's spit landed: shallow water of `radius` cells for `seconds` around (x, y). */
  | { type: 'heronPuddle'; id: number; x: number; y: number; radius: number; seconds: number };
