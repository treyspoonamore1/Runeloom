/** Public sim API. App, tools and tests import from here. */
export { SIM_HZ, DT, GRID_EVERY, TILE_CELLS, CELL_PX } from './core/constants';
export { Rng, type RngState } from './core/rng';
export { Hasher, hashString } from './core/hash';
export { Button, NEUTRAL_INPUT, isHeld, wasPressed, type InputFrame, type ButtonName } from './core/input';
export { createGame, type GameState, type CreateGameOptions, type GameMode, type Cheats } from './state';
export { step } from './step';
export { hashState, hashHex } from './hashState';
export { parseRoom, buildRoom, isSolidCell, RoomParseError, type Room, type RoomData } from './world/room';
export type { PlayerState } from './actors/player';
export { scenarios, findScenario, type Scenario } from './scenarios';
export { runScenario, runFrames, createScenarioGame, type RunResult } from './run';
export { isDodging, isInvulnerable, dodgeSpeed } from './actors/player';
export { moveCircle, circleOverlapsSolid, type CircleBody } from './actors/collision';
export { SPATIAL_BUCKET_CELLS } from './core/constants';
export { isShotSolidCell } from './world/room';
export { SpatialHash, type HashBody } from './core/spatialHash';
export type { SimEvent, SimEventType, Team, ProjectileEndReason, DeathCause, TimedAilment } from './events';
export {
  PLAYER_ID,
  spawnEnemy,
  spawnRoomEnemies,
  type Enemy,
  type EnemyAI,
  type EnemyAttackState,
  type EnemyShield,
  type AttackPhase,
  type EnemyRarity,
  type SpawnOptions,
} from './actors/enemies';
export { addKnockback, stepKnockback } from './actors/knockback';
export { playerMaxLife, playerMaxMana, killPlayer, respawnPlayer } from './actors/playerVitals';
export {
  resolveHit,
  makePacket,
  scaleByLevel,
  zeroAmounts,
  type DamagePacket,
  type DamageTarget,
  type HitResult,
} from './combat/damage';
export { applyHit, addHitstop, killEnemy, type HitInfo } from './combat/hits';
export {
  createAilments,
  clearAilments,
  applyHitAilments,
  applyIgnite,
  addChill,
  freezeTarget,
  applyShock,
  actionSpeed,
  chillSlow,
  shockEffect,
  isFrozen,
  isIgnited,
  isImmune,
  isBoss,
  type Ailments,
  type AilmentTarget,
  type IgniteState,
  type FreezeState,
  type ShockState,
} from './combat/ailments';
export { stepAilments } from './combat/ailmentTick';
export { isBlockedByShield } from './combat/shield';
export {
  circleHitsShape,
  pointInAttackShape,
  circleIntersectsSector,
  circleIntersectsLine,
  type AttackShape,
} from './combat/shapes';
export {
  startEnemyAttack,
  stepEnemyAttack,
  resolveEnemyAttack,
  enemyAttackPacket,
  attackDefFor,
} from './combat/enemyAttacks';
export {
  spawnProjectile,
  circleHitsShotWall,
  anyShotSolid,
  type Projectile,
  type SpawnProjectileOptions,
} from './combat/projectiles';
export * from './weave/runtime';
export { stepEnemyAI, prepareEnemyAI, aggro } from './ai';
export { hasLineOfSight, hasWalkLine, segmentClear } from './world/los';
export {
  createArenaState,
  waveComposition,
  waveAreaLevel,
  compositionSize,
  edgeSpawnTiles,
  pickSpawnPoint,
  spawnGroup,
  spawnWave,
  startArenaWave,
  killAllEnemies,
  stepArena,
  type ArenaState,
  type PendingSpawn,
} from './world/waves';
export { kiterInput } from './bots/kiter';
export * from './weave';
export { createGrid, cellIndex, inGrid, gridWalkable, materialOf, type Grid } from './grid/grid';
export {
  createLabState,
  runStation,
  runAllStations,
  stepLab,
  nearestStation,
  stationArea,
  stationZone,
  type LabState,
  type LabTask,
  type LabElementTask,
  type LabActionTask,
  type CellRect,
} from './world/lab';
export { applyElement, type TerrainElement, type Footprint, type ElementApplication } from './grid/paint';
export { stepGrid, busy as gridCellBusy } from './grid/tick';
export { markActive, activeCount, type ActiveSet } from './grid/active';
export { wakeRegion, wakeAll, syncWalkability } from './grid/region';
export { setGround, WORLD_SOURCE_ID, gridTicks } from './grid/cells';
export {
  cellAt,
  chargeEventInfo,
  iceCrackProgress,
  terrainFireDps,
  refLife,
  areaLevel,
  hazardHurts,
  type CellView,
} from './grid/query';
export type { ChargeEvent, Blast } from './grid/grid';
export type { CellBounds, ElectrifyFields } from './events';
export {
  isWet,
  isOiled,
  isStunned,
  createTerrainState,
  CHARGE_MEMORY,
  type TerrainState,
} from './actors/terrainState';
export { stepEntityTerrain, cellIndexAt } from './actors/terrain';
export { applyBlasts } from './actors/blasts';
export { isSafeCell, fall } from './actors/falling';
export { isDoused, burningOwner } from './actors/chemistry';
export { hurtsEnemies } from './ai/hazards';
export { extinguish, teamOf, teamOfSource, shockFor } from './combat/ailments';
export { dealDirectDamage } from './combat/hits';
// ---- M4: the character, items, loot and saves ----
export { createHero, refreshHero, heroModsOf, passivePointsEarned } from './hero/hero';
export { emptyHeroMods, type HeroMods, type ByType } from './hero/mods';
export {
  EQUIP_SLOTS,
  type EquipSlot,
  type HeroState,
  type Item,
  type ItemRarity,
  type RuneItem,
  type FusePart,
  type AffixRoll,
} from './hero/types';
export { applyHeroEdit, type HeroEdit, type TimedHeroEdit } from './hero/edits';
export { newGameHero, newGameRunes, setupNewGameWeaves } from './hero/newGame';
export { grantXp, killXpFor, baseKillXp } from './hero/xp';
export {
  runeOrder,
  runeCounts,
  freeRunes,
  slotOfRune,
  socketedUids,
  usesRuneItems,
  assignRunes,
  grantRuneXp,
} from './hero/runes';
export { unlockRune } from './hero/unlock';
export { onEnemyKilled } from './hero/onKill';
export { onRoomCleared } from './hero/rewards';
export { addHeartSeed, addLoomShard } from './hero/pickups';
export type { HeroEvent } from './hero/events';
export {
  stepLoot,
  dropLoot,
  collectRoomLoot,
  grantContent,
  type LootDrop,
  type LootContent,
} from './items/loot';
export {
  rollKillLoot,
  dropKillLoot,
  rollSpindle,
  rollGear,
  partTierFor,
  spindleBasesAt,
} from './items/drops';
export { rollAffixSet, rollMagicAffixes, eligibleAffixes, tiersAt } from './items/affixRoll';
export { kindOfBase, slotsForKind, baseName, equippedSpindle, findItem, equippedSlotOf } from './items/items';
export {
  makeSave,
  parseSave,
  restoreSave,
  loadSave,
  hashProgress,
  SAVE_FORMAT,
  SAVE_VERSION,
  type SaveData,
  type SaveGameInit,
  type SavedWeaves,
} from './save';
export {
  heroMaxLife,
  heroMaxMana,
  playerDodgeCharges,
  playerDodgeRecharge,
  playerMoveSpeed,
} from './actors/playerVitals';
// ---- M4 world and puzzles (src/sim/world, src/sim/bots/script.ts) ----
export {
  createWorldState,
  roomFlags,
  dungeonOf,
  loomStoneId,
  cloneWorld,
  type WorldState,
  type RoomFlags,
  type RoomSource,
  type Edge,
  type Arrival,
  type PendingTransition,
  type TransitionReason,
} from './world/worldState';
export {
  buildObjects,
  stepObjects,
  objectAt,
  objectCenter,
  OBJECT_KIND_BY_CHAR,
  OBJECT_CHAR,
  type ObjectKind,
  type WorldObject,
} from './world/objects';
export { enterRoom, processTransition, requestRespawn } from './world/transition';
export {
  createAdventure,
  loomStoneHere,
  restAtLoomStone,
  travelToLoomStone,
  type AdventureOptions,
} from './world/adventure';
export {
  buildRegionMap,
  layoutRooms,
  type RegionMap,
  type MapNode,
  type MapLoomStone,
} from './world/regionMap';
export { parseLinkCondition, linkMet, type LinkCondition } from './world/objectLinks';
export { markRoomCleared, repopulateRooms, roomBossKinds, bossRoomDone } from './world/roomClear';
export { exitTilesOn, exitEdge, arrivalPoint, EXIT_CHAR, OPPOSITE } from './world/exits';
export type { WorldEvent } from './world/worldEvents';
export { runScript, ScriptDriver, type ScriptCommand, type ScriptResult } from './bots/script';
export { findPath, tileWalkable } from './bots/scriptPath';
export { tourInput } from './bots/tour';
