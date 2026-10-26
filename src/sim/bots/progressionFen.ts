/**
 * The Fen in the progression sim's route (BUILD_PLAN M8 phase 1 "Progression with the Fen"): when
 * the model player has completed tier 8 (riftGate.openTier) and the Glasswater Coil still lives,
 * tier 9 can't open, so it plays the Fen before its next rift. From the Hearth it fast travels
 * to K10's Loom Stone, opens the storm door with a Storm Lob on its switch (the door hums once the
 * best tier ever is 6), walks through and plays G1 to F10 with the Fen campaign bot
 * (bots/fenRun.ts), then rests at F10's Loom Stone (it wakes when the Coil dies) and travels home.
 */
import { hearthStone } from '../../../data/hearth';
import { regionRooms } from '../../../data/progression';
import { riftGate } from '../../../data/riftGate';
import { SIM_HZ } from '../core/constants';
import { NEUTRAL_INPUT } from '../core/input';
import { applyHeroEdit } from '../hero/edits';
import { deepRiftsOpen } from '../meta/view';
import type { GameState } from '../state';
import { step } from '../step';
import { enterRoom } from '../world/transition';
import { runFen, type FenRunResult } from './fenRun';
import { fenPacingMinutes } from './pacing';
import { restAtStone } from './riftLadder';

export interface ProgressionFen {
  /** Play hours when the Fen began and ended (human pacing). */
  startHours: number;
  endHours: number;
  /** Human minutes (bots/pacing.ts fenPacingMinutes, plus the travel there and back). */
  minutes: number;
  /** The best tier and level when it began, the level when it ended. */
  tier: number;
  levelBefore: number;
  levelAfter: number;
  deaths: number;
  coilDead: boolean;
  bellwetherSeconds: number | null;
  coilSeconds: number | null;
  failedSteps: string[];
}

/** Seconds of menus for the two Loom Stone fast travels (as a Hearth visit's). */
const TRAVEL_SECONDS = 30;

/** True when the model player should play the Fen now (tier 8 done, the Coil alive). */
export function fenDue(state: GameState): boolean {
  return !deepRiftsOpen(state.world) && state.hero.riftTier >= riftGate.openTier;
}

function travel(state: GameState, roomId: string, key: string): void {
  const err = applyHeroEdit(state, { kind: 'travel', roomId, key });
  if (err) throw new Error(`progressionFen: ${err}`);
  for (let i = 0; i < 10 * SIM_HZ && state.room.id !== roomId; i++) step(state, NEUTRAL_INPUT);
  if (state.room.id !== roomId) throw new Error(`progressionFen: travel to ${roomId} failed`);
}

/**
 * Plays the Fen from wherever the player rests (the Hearth) and comes home. Returns the run and
 * its human seconds; `hours` is the play time when it starts.
 */
export function playFenFromHome(
  state: GameState,
  hours: number,
  home: 'hearth' | 'k10',
): { fen: ProgressionFen; run: FenRunResult; seconds: number } {
  const hero = state.hero;
  const tier = hero.riftTier;
  const levelBefore = hero.level;
  restAtStone(state);
  const stone = state.world.loomStones.find((id) => id.startsWith(`${regionRooms.k10}#`));
  if (!stone) throw new Error("progressionFen: K10's Loom Stone isn't active");
  const k10Key = stone.slice(stone.indexOf('#') + 1);
  if (state.room.id !== regionRooms.k10) travel(state, regionRooms.k10, k10Key);
  restAtStone(state);
  const run = runFen(state, { stormDoor: true });
  // Home: F10's Loom Stone wakes once the Coil is dead; otherwise back to the respawn stone.
  for (let i = 0; i < 10 * SIM_HZ && state.player.dead; i++) step(state, NEUTRAL_INPUT);
  if (!state.objects.some((o) => o.kind === 'loom_stone' && o.on)) {
    const r = state.world.respawn;
    if (!r) throw new Error('progressionFen: no respawn Loom Stone');
    enterRoom(state, r.roomId, { kind: 'loomStone', key: r.key });
  }
  restAtStone(state);
  if (home === 'hearth') travel(state, hearthStone.roomId, hearthStone.key);
  else if (state.room.id !== regionRooms.k10) travel(state, regionRooms.k10, k10Key);
  const seconds = fenPacingMinutes(run) * 60 + TRAVEL_SECONDS;
  return {
    run,
    seconds,
    fen: {
      startHours: hours,
      endHours: hours + seconds / 3600,
      minutes: seconds / 60,
      tier,
      levelBefore,
      levelAfter: hero.level,
      deaths: run.deaths,
      coilDead: run.coilDead,
      bellwetherSeconds: run.bellwetherSeconds,
      coilSeconds: run.coilSeconds,
      failedSteps: run.failedSteps,
    },
  };
}
