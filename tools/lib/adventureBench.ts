/** The M4 adventure bench for tools/bench.ts (kept here so bench.ts stays small). */
import { performance } from 'node:perf_hooks';
import { createAdventure, step, tourInput } from '../../src/sim';
import { startRoom } from '../../data/progression';
import { loadAllRooms } from './rooms';
import { summarize } from './stats';

/** Structurally a tools/bench.ts Bench. */
export interface AdventureBench {
  id: string;
  description: string;
  budgetMs: number;
  reportOnly: boolean;
  onMeasureStart: () => void;
  note: () => string;
  setup(): () => number;
}

/**
 * M4 adventure: the tour bot (bots/tour.ts) walks the region (or the test world until the region
 * exists) in god mode, through exits and fights. Report only: ticks that change rooms include the
 * room load (parse, grid, objects, spawns), so the note gives those ticks apart.
 */
export function adventureBench(budgetMs: number): AdventureBench {
  const loads: number[] = [];
  let measuring = false;
  return {
    id: 'entity:adventure_tour',
    description: 'Adventure: tour bot through rooms (room loads included)',
    budgetMs,
    reportOnly: true,
    onMeasureStart: () => {
      measuring = true;
      loads.length = 0;
    },
    note: () => {
      if (loads.length === 0) return 'no room changes while measured';
      const l = summarize(loads);
      return `${loads.length} room change tick(s): mean ${l.mean.toFixed(3)} ms, max ${l.max.toFixed(3)} ms`;
    },
    setup() {
      const rooms = loadAllRooms();
      const roomId = rooms[startRoom] !== undefined ? startRoom : 'test/world_a';
      const state = createAdventure({ seed: 1, rooms, startRoomId: roomId });
      state.cheats.god = true;
      return () => {
        const t0 = performance.now();
        step(state, tourInput(state));
        const ms = performance.now() - t0;
        if (measuring && state.events.some((e) => e.type === 'roomEnter')) loads.push(ms);
        return ms;
      };
    },
  };
}
