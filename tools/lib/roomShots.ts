/**
 * Region room screenshots (BUILD_PLAN M4 acceptance "screenshots of every room on load"), for
 * `npm run shots -- --set rooms [--room e1,k7]`: each room as a new-game adventure (createAdventure,
 * handed to the page with session.adopt), so objects, enemies and their rarity draw as in play;
 * once zoomed to fit the whole room (the layout) and once at play zoom where the player arrives
 * (readability at real scale).
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
export async function showRoom(page: Page, roomId: string, view: 'fit' | 'play'): Promise<void> {
  const arrive = roomId !== startRoom;
  // tsx compiles named functions with an `__name` helper that only exists in Node.
  await page.evaluate('window.__name = (f) => f');
  await page.evaluate(
    async ({ roomId, view, arrive }) => {
      const R = window.__runeloom!;
      // Served by the Vite dev server; a variable path keeps Node's resolver out of it.
      const load = <T>(path: string): Promise<T> => import(/* @vite-ignore */ path) as Promise<T>;
      const rooms = await load<typeof import('../../src/app/rooms')>('/src/app/rooms.ts');
      const S = await load<typeof import('../../src/sim')>('/src/sim/index.ts');
      R.loop.stop();
      const data = S.parseRoom(rooms.roomText(roomId));
      const w = data.tilesW * S.TILE_CELLS * S.CELL_PX;
      const h = data.tilesH * S.TILE_CELLS * S.CELL_PX;
      // A new-game adventure in this room: objects, enemies (with rarity) and pickups as in play.
      const st = S.createAdventure({
        seed: 1,
        rooms: rooms.roomTexts,
        startRoomId: roomId,
        tuning: R.session.state.tuning,
      });
      // Arrive where play order enters: through the room's first @exit (the start room: its Loom Stone).
      const exit = data.header.exits[0];
      if (view === 'play' && arrive && exit) {
        const from = S.OPPOSITE[exit.dir as 'w' | 'e' | 'n' | 's'];
        S.enterRoom(st, roomId, { kind: 'edge', from });
      }
      st.tuning.camera.lookAhead = 0;
      st.tuning.camera.edgeMargin = 0;
      // Camera scale is CELL_PX × (height / 720) × zoom (src/render/camera.ts).
      st.tuning.camera.zoom = view === 'fit' ? Math.min((innerWidth * 720) / (innerHeight * w), 720 / h) : 1;
      R.session.adopt(st, 'adventure');
      const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      for (let i = 0; i < 4; i++) {
        R.renderer.handleEvents(R.session.drainEvents());
        R.renderer.render(R.session.state, 1, 1 / 60);
        await raf();
      }
    },
    { roomId, view, arrive },
  );
}
