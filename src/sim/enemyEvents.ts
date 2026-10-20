import type { CellBounds } from './events';

/**
 * Events of the M4 enemies and bosses (src/sim/ai, src/sim/combat/enemyAttacks.ts,
 * actors/chemistry.ts, actors/hulkBlast.ts), part of SimEvent (events.ts). Same conventions:
 * positions in cells, times in seconds, `id` the enemy's id.
 *
 * Every new attack also sends 'telegraph' and 'attack' with its AttackDef.name: lunge,
 * hulk_slam, frost_bolt, frost_line, lightning_strike, mite_nip, matriarch_slam, tar_glob,
 * summon_hulks, fire_slam, charge, fire_breath, flood, call_storm. Persistent looks read the
 * enemy: `rarity` and `mods` (Magic blue, Rare yellow), `special` (fuseLeft, submerged,
 * trapped, dashSpeed), `boss` (phase, superheated, breakLeft, glowing, stormLeft).
 */
export type EnemyEvent =
  /** A Bog Lurker surfaced to lunge; its 1.2 s ripple telegraph is the 'telegraph' sent with it. */
  | { type: 'lurkerSurface'; id: number; x: number; y: number }
  /** A Bog Lurker went back under after its lunge. */
  | { type: 'lurkerSubmerge'; id: number; x: number; y: number }
  /** A Bog Lurker's water froze under it (trapped: it can't move or attack) or thawed (free again). */
  | { type: 'lurkerTrapped'; id: number; trapped: boolean; x: number; y: number }
  /** A Tar Hulk was ignited while Oiled: it explodes in `fuse` seconds unless it gets Wet first. */
  | { type: 'hulkFuse'; id: number; fuse: number; x: number; y: number }
  /** A Tar Hulk's lit fuse went out: it got Wet. */
  | { type: 'hulkFuseOut'; id: number; x: number; y: number }
  /**
   * A Tar Hulk exploded (its fuse ran out, or it died with the fuse lit): a world-owned fire
   * burst of `radius` cells for `damage` Fire that hurts everyone. An 'explosion' event (owner
   * world) follows for the shared explosion effects, then the Hulk's 'death'.
   */
  | { type: 'hulkExploded'; id: number; x: number; y: number; radius: number; damage: number }
  /**
   * The Tar Matriarch was ignited while Oiled: she flares in `fuse` seconds (a `radius`-cell
   * world-owned burst; e.special.fuseLeft counts down, like a Hulk's fuse) unless she gets Wet.
   */
  | { type: 'matriarchFuse'; id: number; fuse: number; radius: number; x: number; y: number }
  /** The Tar Matriarch's lit fuse went out (she lost her Ignite). */
  | { type: 'matriarchFuseOut'; id: number; x: number; y: number }
  /**
   * The Tar Matriarch flared: a world-owned fire burst of `radius` cells for `damage` Fire that
   * hurts everyone else in it; she took `selfDamage` (0 when she flared as she died). An
   * 'explosion' event (owner world) follows for the shared explosion effects.
   */
  | {
      type: 'matriarchFlare';
      id: number;
      x: number;
      y: number;
      radius: number;
      damage: number;
      selfDamage: number;
    }
  /** A Brood Kiln spawned Kiln Mites (their 'enemySpawn' events come first). */
  | { type: 'kilnSpawn'; id: number; spawned: number[]; x: number; y: number }
  /** A boss noticed the player: the fight begins (boss intro card, music). name: its display name. */
  | { type: 'bossAwake'; id: number; kind: string; name: string; x: number; y: number }
  /**
   * A boss started a new phase (2, 3). Tar Matriarch: 2 at half life, as she summons. Cinder
   * Warden: 2 as the flood lands, 3 as he calls the storm.
   */
  | { type: 'bossPhase'; id: number; kind: string; phase: number; x: number; y: number }
  /**
   * The Cinder Warden's Superheat changed: on (70% less damage taken) when phase 2 starts and
   * when a break ends; off for `seconds` when a Freeze breaks it (0 when it comes back on).
   */
  | { type: 'superheatChanged'; id: number; superheated: boolean; seconds: number; x: number; y: number }
  /** Phase 2: the channels overflowed; the bounds cover the cells that became shallow water. */
  | ({ type: 'flood'; id: number } & CellBounds)
  /** Phase 3: the braziers start glowing; their lightning lands in `seconds`. braziers: tile centers. */
  | { type: 'brazierStormCharge'; id: number; seconds: number; braziers: { x: number; y: number }[] }
  /**
   * Phase 3: lightning struck the braziers for `damage` Storm, electrifying the metal and water
   * connected to them ('metalElectrified' / 'waterElectrified' follow from the grid).
   */
  | { type: 'brazierStorm'; id: number; damage: number; braziers: { x: number; y: number }[] }
  /** A boss summoned enemies (the Tar Matriarch's Tar Hulks; their 'enemySpawn' events come first). */
  | { type: 'bossSummon'; id: number; kind: string; spawned: number[]; x: number; y: number };
