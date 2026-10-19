/**
 * Region room screenshots (BUILD_PLAN M4 acceptance "screenshots of every room on load"), for
 * `npm run shots -- --set rooms [--room e1,k7]`: each room loaded in the page through
 * `session.reset({ roomId })`, once zoomed to fit the whole room (the layout) and once at play zoom
 * where the player arrives (readability at real scale).
 *
 * Until the M4 enemies land, @spawn lines naming kinds that data/enemies.ts doesn't have yet are
 * left out of the page's copy of the room (spawning them would throw); the file is unchanged.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { regionRooms, startRoom } from '../../data/progression';
import { ROOMS_DIR } from './rooms';

export type RoomShort = keyof typeof regionRooms;

/** Region rooms that have a file, in play order. */
export function authoredRegionRooms(): RoomShort[] {
  return (Object.keys(regionRooms) as RoomShort[]).filter((s) =>
    existsSync(join(ROOMS_DIR, `${regionRooms[s]}.txt`)),
  );
}

/**
 * Loads one room in the page; 'fit' zooms out to the whole room, 'play' keeps zoom 1 where the player
 * arrives: just inside the room's first @exit, or at its Loom Stone for the start room.
 */
export async function showRoom(page: Page, roomId: string, view: 'fit' | 'play'): Promise<string[]> {
  const arrive = roomId !== startRoom;
  // tsx compiles named functions with an `__name` helper that only exists in Node.
  await page.evaluate('window.__name = (f) => f');
  const dropped = await page.evaluate(
    async ({ roomId, view, arrive }) => {
      const R = window.__runeloom!;
      // Served by the Vite dev server; a variable path keeps Node's resolver out of it.
      const load = <T>(path: string): Promise<T> => import(/* @vite-ignore */ path) as Promise<T>;
      const rooms = await load<typeof import('../../src/app/rooms')>('/src/app/rooms.ts');
      const enemies = await load<typeof import('../../data/enemies')>('/data/enemies.ts');
      const S = await load<typeof import('../../src/sim')>('/src/sim/index.ts');
      const dropped: string[] = [];
      const text = rooms
        .roomText(roomId)
        .split('\n')
        .filter((line) => {
          const m = /^@spawn \d+ enemy:(\w+)/.exec(line);
          if (m && !enemies.isEnemyKind(m[1]!)) {
            dropped.push(line);
            return false;
          }
          return true;
        })
        .join('\n');
      R.loop.stop();
      const data = S.parseRoom(text);
      const w = data.tilesW * S.TILE_CELLS * S.CELL_PX;
      const h = data.tilesH * S.TILE_CELLS * S.CELL_PX;
      // A fresh game in this room (not session.reset, so the page's bundled room text stays as is).
      const st = S.createGame({ seed: 1, rooms: { ...rooms.roomTexts, [roomId]: text }, roomId });
      st.tuning.camera.lookAhead = 0;
      st.tuning.camera.edgeMargin = 0;
      // Camera scale is CELL_PX × (height / 720) × zoom (src/render/camera.ts).
      st.tuning.camera.zoom = view === 'fit' ? Math.min((innerWidth * 720) / (innerHeight * w), 720 / h) : 1;
      R.session.state = st;
      R.renderer.setRoom(st);
      // Arrive where play order enters: the first exit tile found on the room's first @exit edge.
      const exit = data.header.exits[0];
      if (view === 'play' && arrive && exit) {
        const ch = { w: '<', e: '>', n: '^', s: 'v' }[exit.dir as 'w' | 'e' | 'n' | 's'];
        const y = data.rows.findIndex((r) => r.includes(ch));
        if (y >= 0) {
          const x = data.rows[y]!.indexOf(ch);
          const inward = { w: [1, 0], e: [-1, 0], n: [0, 1], s: [0, -1] }[exit.dir as 'w' | 'e' | 'n' | 's'];
          st.player.x = (x + 0.5 + inward[0]! * 2) * S.TILE_CELLS;
          st.player.y = (y + 0.5 + inward[1]! * 2) * S.TILE_CELLS;
          st.player.prevX = st.player.x;
          st.player.prevY = st.player.y;
        }
      }
      const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      for (let i = 0; i < 3; i++) {
        R.renderer.handleEvents(R.session.drainEvents());
        R.renderer.render(R.session.state, 1, 1 / 60);
        await raf();
      }
      return dropped;
    },
    { roomId, view, arrive },
  );
  return dropped;
}
