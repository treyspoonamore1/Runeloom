import { Rng } from './core/rng';
import { buildRoom, parseRoom, type Room } from './world/room';
import { createPlayer, type PlayerState } from './actors/player';
import { cloneTuning, type Tuning } from '../../data/tuning';

/** The complete simulation state. Everything the sim needs to continue lives here. */
export interface GameState {
  /** Ticks stepped since creation. */
  tick: number;
  seed: number;
  rng: Rng;
  tuning: Tuning;
  room: Room;
  player: PlayerState;
  /** Buttons held on the previous tick, for press detection. */
  prevButtons: number;
}

export interface CreateGameOptions {
  seed: number;
  /** Room file text (CONTENT §6). */
  roomText: string;
  tuning?: Tuning;
}

export function createGame(opts: CreateGameOptions): GameState {
  const tuning = cloneTuning(opts.tuning);
  const room = buildRoom(parseRoom(opts.roomText));
  return {
    tick: 0,
    seed: opts.seed,
    rng: new Rng(opts.seed),
    tuning,
    room,
    player: createPlayer(room.spawnX, room.spawnY, tuning.player.dodgeCharges),
    prevButtons: 0,
  };
}
