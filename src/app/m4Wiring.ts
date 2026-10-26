/**
 * M4 wiring table: everything the M4 visuals and sounds need from the sim that the sim does not
 * define yet, in one place. When an M4 sim branch lands, wiring a visual is a one-line change
 * here:
 *
 * - `M4_EVENTS`: the sim event type for each cue, or null to derive the cue from state changes
 *   (src/app/m4Signals.ts). Setting a name makes the detector listen for that event and stop
 *   deriving it; `eventPos` reads its position (x/y, or `key` of a WorldObject).
 * - `M4_ATTACKS`: the AttackDef names of the new enemy attacks. Telegraph accents, poses and
 *   sounds key off these.
 * - `M4_STATE`: accessors for enemy state the contracts don't carry yet (mods, boss phase,
 *   Superheat, a surfaced Bog Lurker, a lit Tar Hulk fuse). Each has a fallback that reads what
 *   exists today.
 *
 * Presentation only: nothing here writes sim state.
 */
import { TILE_CELLS, type Enemy, type GameState } from '../sim';
import { m4Enemies } from '../../data/enemiesM4';

/** Cue types the M4 visuals and sounds react to (see M4Cue in m4Signals.ts). */
export type M4CueType =
  | 'roomEnter'
  | 'levelUp'
  | 'lootDropped'
  | 'lootPicked'
  | 'doorOpened'
  | 'chestOpened'
  | 'pickup'
  | 'loomStoneActivated'
  | 'plateClick'
  | 'switchPowered'
  | 'blockMoved'
  | 'brazierLit'
  | 'bossPhase'
  | 'superheatChanged'
  | 'flood'
  | 'kilnSpawn';

/**
 * Sim event type per cue. null: derived from state (objects' `on`, tile moves, loot ids, hero
 * level, room id, boss life, kiln-mite spawns near a kiln). 'roomEnter' is in the M4 contract
 * (src/sim/world/transition.ts) but the room id change is detected too, so either works.
 */
export const M4_EVENTS: Record<M4CueType, string | null> = {
  roomEnter: null,
  levelUp: null,
  lootDropped: null,
  lootPicked: null,
  doorOpened: null,
  chestOpened: null,
  pickup: null,
  loomStoneActivated: null,
  plateClick: null,
  switchPowered: null,
  blockMoved: null,
  brazierLit: null,
  // The enemies' events (src/sim/enemyEvents.ts).
  bossPhase: 'bossPhase',
  superheatChanged: 'superheatChanged',
  flood: 'flood',
  kilnSpawn: 'kilnSpawn',
};

/**
 * AttackDef names of the M4 attacks (data/enemiesM4.ts, data/bosses.ts). The Warden's 'flood'
 * attack has no accent of its own: the 'flood' cue covers it.
 */
export const M4_ATTACKS = {
  lurkerLunge: 'lunge',
  hulkSlam: 'hulk_slam',
  wispBolt: 'frost_bolt',
  wispFrostLine: 'frost_line',
  stormStrike: 'lightning_strike',
  miteNip: 'mite_nip',
  matriarchSlam: 'matriarch_slam',
  tarGlob: 'tar_glob',
  tarRush: 'tar_rush',
  summon: 'summon_hulks',
  wardenCharge: 'charge',
  fireSlam: 'fire_slam',
  fireBreath: 'fire_breath',
  brazierStorm: 'call_storm',
  // M8 Glasswater Fen (data/enemiesFen.ts): looks and accents in render/bestiary/fen*.
  pikeLeap: 'pike_leap',
  copperPinch: 'copper_pinch',
  heronBeak: 'heron_beak',
  puddleSpit: 'puddle_spit',
  slagSlam: 'slag_slam',
  sparkZap: 'spark_zap',
  bullGore: 'bull_gore',
  bullCharge: 'bull_charge',
  toadCroak: 'croak',
  bellBite: 'bell_bite',
} as const;

export type M4AttackKey = keyof typeof M4_ATTACKS;

const ATTACK_KEY_BY_NAME = new Map<string, M4AttackKey>(
  (Object.keys(M4_ATTACKS) as M4AttackKey[]).map((k) => [M4_ATTACKS[k], k]),
);

/** The M4 attack key for an AttackDef name, or undefined for M1 attacks. */
export function m4AttackKey(name: string): M4AttackKey | undefined {
  return ATTACK_KEY_BY_NAME.get(name);
}

/** Life fraction thresholds of the Cinder Warden's phases (DESIGN §10.3), for the gallery. */
export const WARDEN_PHASES = [0.66, 0.33] as const;

/** Tar Hulk fuse: seconds from ignition to the explosion, and its blast radius (data/enemiesM4.ts). */
export const HULK_FUSE = {
  seconds: m4Enemies.tar_hulk.chemistry.explodes.fuse,
  radius: m4Enemies.tar_hulk.chemistry.explodes.radius,
} as const;

/** The enemies' own state (Enemy.mods, .special, .boss; src/sim/actors/enemyState.ts). */
export const M4_STATE = {
  /** Monster mod ids (Hasted, Incendiary, …) for the Rare name plate. */
  mods: (e: Enemy): readonly string[] => e.mods,
  /** Boss phase from 1; 1 for other kinds. */
  bossPhase: (e: Enemy): number => e.boss?.phase ?? 1,
  /** Superheated (the Warden takes far less damage); undefined for non-bosses. */
  superheated: (e: Enemy): boolean | undefined => e.boss?.superheated,
  /** A Bog Lurker under water. */
  lurkerSubmerged: (e: Enemy): boolean => e.special.submerged,
  /** Seconds left on a Tar Hulk's lit fuse (0: none). */
  fuseLeft: (e: Enemy): number | undefined => e.special.fuseLeft,
  /** Burning while Oiled: the fuse condition (CONTENT §5 Tar Hulk). */
  fuseCondition: (e: Enemy): boolean => e.ailments.ignite.timeLeft > 0 && e.terrain.oiledLeft > 0,
  frozen: (e: Enemy): boolean => e.ailments.freeze.timeLeft > 0,
};

/** Enemy kinds that are bosses (data/progression.ts bossKinds, repeated so audio needs no data import). */
export const BOSS_KINDS: ReadonlySet<string> = new Set([
  'tar_matriarch',
  'cinder_warden',
  'rift_matriarch',
  'rift_warden',
]);

/** Where a sim event happened: x/y, or the tile center of the object named by `key`. */
export function eventPos(state: GameState, ev: Record<string, unknown>): { x: number; y: number } {
  if (typeof ev.x === 'number' && typeof ev.y === 'number') return { x: ev.x, y: ev.y };
  if (typeof ev.key === 'string') {
    const o = state.objects.find((ob) => ob.key === ev.key);
    if (o) return { x: (o.tx + 0.5) * TILE_CELLS, y: (o.ty + 0.5) * TILE_CELLS };
  }
  return { x: state.player.x, y: state.player.y };
}
