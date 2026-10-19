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
  bossPhase: null,
  superheatChanged: null,
  flood: null,
  kilnSpawn: null,
};

/**
 * AttackDef names of the M4 attacks (CONTENT §5). Guesses until data/enemies.ts has them: change
 * the string to the real name.
 */
export const M4_ATTACKS = {
  lurkerLunge: 'lurker_lunge',
  hulkSlam: 'hulk_slam',
  wispBolt: 'wisp_bolt',
  wispFrostLine: 'wisp_frost_line',
  stormStrike: 'lightning_strike',
  miteNip: 'mite_nip',
  matriarchSlam: 'matriarch_slam',
  tarGlob: 'tar_glob',
  summon: 'summon',
  wardenCharge: 'warden_charge',
  fireSlam: 'fire_slam',
  fireBreath: 'fire_breath',
  brazierStorm: 'brazier_storm',
} as const;

export type M4AttackKey = keyof typeof M4_ATTACKS;

const ATTACK_KEY_BY_NAME = new Map<string, M4AttackKey>(
  (Object.keys(M4_ATTACKS) as M4AttackKey[]).map((k) => [M4_ATTACKS[k], k]),
);

/** The M4 attack key for an AttackDef name, or undefined for M1 attacks. */
export function m4AttackKey(name: string): M4AttackKey | undefined {
  return ATTACK_KEY_BY_NAME.get(name);
}

/** Fields the new enemies may grow; read loosely so this compiles before and after they land. */
interface EnemyM4Fields {
  mods?: readonly string[];
  phase?: number;
  superheated?: boolean;
  submerged?: boolean;
  fuseLeft?: number;
}

const m4 = (e: Enemy): EnemyM4Fields => e as unknown as EnemyM4Fields;

/** Life fraction thresholds of the Cinder Warden's phases (DESIGN §10.3). */
export const WARDEN_PHASES = [0.66, 0.33] as const;

/** Tar Hulk fuse: seconds from ignition to the explosion (CONTENT §5), and its blast radius. */
export const HULK_FUSE = { seconds: 1.5, radius: 6 } as const;

export const M4_STATE = {
  /** Monster mod ids (Hasted, Incendiary, …) for the Rare name plate. */
  mods: (e: Enemy): readonly string[] => m4(e).mods ?? [],
  /** Boss phase 1–3. Fallback: the Warden's life thresholds; other kinds are always 1. */
  bossPhase(e: Enemy): number {
    const p = m4(e).phase;
    if (p !== undefined) return p;
    if (e.kind !== ('cinder_warden' as string)) return 1;
    const f = e.maxLife > 0 ? e.life / e.maxLife : 1;
    return f > WARDEN_PHASES[0] ? 1 : f > WARDEN_PHASES[1] ? 2 : 3;
  },
  /**
   * Superheated (70% less damage taken). Fallback: phases 2–3 while not frozen; the view adds the
   * 4 s break after a freeze itself.
   */
  superheated(e: Enemy): boolean | undefined {
    return m4(e).superheated;
  },
  /** A Bog Lurker under water. Fallback: submerged unless its lunge is landing or recovering. */
  lurkerSubmerged(e: Enemy): boolean {
    const s = m4(e).submerged;
    if (s !== undefined) return s;
    return !(e.attack.phase === 'active' || e.attack.phase === 'recover');
  },
  /**
   * Seconds left on a Tar Hulk's fuse, or undefined to let the view time it from when it became
   * Oiled and Ignited at once (CONTENT §5).
   */
  fuseLeft: (e: Enemy): number | undefined => m4(e).fuseLeft,
  /** Burning while Oiled: the fuse condition (CONTENT §5 Tar Hulk). */
  fuseCondition: (e: Enemy): boolean => e.ailments.ignite.timeLeft > 0 && e.terrain.oiledLeft > 0,
  frozen: (e: Enemy): boolean => e.ailments.freeze.timeLeft > 0,
};

/** Enemy kinds that are bosses (data/progression.ts bossKinds, repeated so audio needs no data import). */
export const BOSS_KINDS: ReadonlySet<string> = new Set(['tar_matriarch', 'cinder_warden']);

/** Where a sim event happened: x/y, or the tile center of the object named by `key`. */
export function eventPos(state: GameState, ev: Record<string, unknown>): { x: number; y: number } {
  if (typeof ev.x === 'number' && typeof ev.y === 'number') return { x: ev.x, y: ev.y };
  if (typeof ev.key === 'string') {
    const o = state.objects.find((ob) => ob.key === ev.key);
    if (o) return { x: (o.tx + 0.5) * TILE_CELLS, y: (o.ty + 0.5) * TILE_CELLS };
  }
  return { x: state.player.x, y: state.player.y };
}
