/**
 * The M8 wind grid bench for tools/bench.ts (DESIGN §12 "Wind"): the grid:typical_20pct workload
 * (256×256, ~20% active: a grass fire, Storm on a lake and a metal yard) with room wind on, 8 live
 * Gale-sized gusts and smoke on 30% of the active cells. Each sample is one grid tick (stepGrid
 * only; the hits, regrowth, gust writes and smoke top-up around it are not timed).
 */
import { performance } from 'node:perf_hooks';
import { AIR, MAT, OWNER } from '../../data/materials';
import { activeCount, applyElement, createGame, PLAYER_ID, stepGrid, writeGust } from '../../src/sim';
import { setAir } from '../../src/sim/grid/cells';

export interface GridBench {
  id: string;
  description: string;
  budgetMs: number | null;
  note?: () => string;
  setup(): () => number | void;
}

const TILES = 64;
const GRASS_ROWS = 14;

function windRoom(): string {
  const rows: string[] = [];
  for (let ty = 0; ty < TILES; ty++) {
    if (ty < GRASS_ROWS) rows.push('"'.repeat(TILES));
    else if (ty < 44) rows.push('.'.repeat(TILES));
    else rows.push('~'.repeat(28) + '.'.repeat(8) + 'm'.repeat(28));
  }
  return `@id bench/wind\n@wind e\n${rows.join('\n')}\n`;
}

const APP = { owner: OWNER.player, sourceId: PLAYER_ID, hitDamage: 10, durationMult: 1 } as const;

export function gridWindBench(budgetMs: number): GridBench {
  let activeSum = 0;
  let smokeSum = 0;
  let gustSum = 0;
  let samples = 0;
  let cells = 1;
  return {
    id: 'grid:wind',
    description:
      'Chemistry grid tick, 256×256 ~20% active with room wind, 8 live gusts, smoke on 30% of active cells',
    budgetMs,
    note: () => {
      const n = Math.max(1, samples);
      return (
        `mean active ${((100 * activeSum) / n / cells).toFixed(1)}% of cells, ` +
        `smoke ${((100 * smokeSum) / Math.max(1, activeSum)).toFixed(1)}% of active, ${(gustSum / n).toFixed(1)} live gusts`
      );
    },
    setup() {
      const state = createGame({ seed: 1, roomText: windRoom(), spawnRoomEnemies: false });
      const g = state.grid;
      cells = g.width * g.height;
      const grassRows = GRASS_ROWS * 4;
      const stone0 = grassRows * g.width;
      const stoneN = (44 - GRASS_ROWS) * 4 * g.width;
      let cursor = 0;
      let t = 0;
      return () => {
        const row = (t % grassRows) * g.width;
        for (let i = row; i < row + g.width; i++)
          if (g.ground[i] === MAT.ash && g.fire[i] === 0 && g.airTimer[i] === 0) g.ground[i] = MAT.grass;
        if (t % 40 === 0)
          for (let k = 0; k < 4; k++)
            applyElement(state, {
              ...APP,
              element: 'fire',
              shape: { kind: 'circle', x: 32 + 64 * k, y: 8 + ((t / 40) % 4) * 13, r: 2 },
            });
        if (t % 20 === 0)
          for (const [x, y] of [
            [20, 196],
            [60, 236],
            [100, 210],
            [20, 246],
            [200, 220],
          ])
            applyElement(state, { ...APP, element: 'storm', shape: { kind: 'circle', x: x!, y: y!, r: 2 } });
        // A new gust every 5 grid ticks: 2 s each, so 8 are always live (the team cap).
        if (t % 5 === 0) {
          const k = (t / 5) % 16;
          writeGust(state, {
            x: 16 + (k % 8) * 30,
            y: k < 8 ? 30 : 120,
            dirX: 1,
            dirY: k % 2 === 0 ? 0.4 : -0.4,
            radius: 12,
            angleDeg: 60,
            seconds: 2,
            team: 'player',
          });
        }
        // Top smoke up to 30% of the active cells, on the stone band (it drifts east from there).
        let smoke = 0;
        let al = g.active.list;
        for (let k = 0; k < g.active.len; k++) if (g.air[al[k]!] === AIR.smoke) smoke++;
        const want = Math.floor(0.3 * activeCount(g.active)) - smoke;
        for (let k = 0; k < want; k++) {
          setAir(g, stone0 + cursor, AIR.smoke, 80);
          cursor = (cursor + 7) % stoneN;
        }
        t++;
        const t0 = performance.now();
        stepGrid(state);
        const ms = performance.now() - t0;
        activeSum += activeCount(g.active);
        let sm = 0;
        al = g.active.list; // the merge swaps the list's buffer
        for (let k = 0; k < g.active.len; k++) if (g.air[al[k]!] === AIR.smoke) sm++;
        smokeSum += sm;
        gustSum += g.gusts.length;
        samples++;
        return ms;
      };
    },
  };
}
