/**
 * M8: the entity bench in a Fen fight (BUILD_PLAN M8 phase 1 "the entity bench in a Fen fight
 * room"), kept here so tools/bench.ts stays small. test/enemies_fen (area level 18) with all
 * seven Fen packs (39 enemies: swimmers routing through the pond, Copperbacks pulsing, Spark
 * Herons striking and spitting, Sparkfly clouds, Mirebull charges, toad croaks) closing on a
 * god-mode kiter bot that casts nothing, so the crowd stays. Every second a player Storm hit
 * (1 damage) lands in the ford and in the pond, so charge rings Bellshells, charges Copperbacks
 * and pops Sparkflies; the room's packs spawn again whenever fewer than 30 enemies live. The
 * whole step is timed, grid tick included.
 */
import {
  applyElement,
  applyLoadoutSpec,
  createGame,
  kiterInput,
  PLAYER_ID,
  spawnRoomEnemies,
  step,
  type GameState,
} from '../../src/sim';
import { OWNER } from '../../data/materials';
import { loadRoomText } from './rooms';

const MIN_ALIVE = 30;
const STORM_EVERY = 60;
/** Water cells in test/enemies_fen: the ford (tile row 14) and the pond (tile row 4). */
const STORM_AT: ReadonlyArray<readonly [number, number]> = [
  [62, 58],
  [22, 18],
];

export function fenFightSetup(): () => void {
  const state: GameState = createGame({ seed: 1, roomText: loadRoomText('test/enemies_fen') });
  state.cheats.god = true;
  applyLoadoutSpec(state, { spindleId: 'heartwood', notations: [null, null, null, null] });
  return () => {
    if (state.enemies.length < MIN_ALIVE) spawnRoomEnemies(state);
    if (state.tick % STORM_EVERY === 0)
      for (const [x, y] of STORM_AT)
        applyElement(state, {
          element: 'storm',
          shape: { kind: 'circle', x, y, r: 0.6 },
          owner: OWNER.player,
          sourceId: PLAYER_ID,
          hitDamage: 1,
          durationMult: 1,
        });
    step(state, kiterInput(state));
  };
}
