/**
 * Boss fight screenshots for `npm run shots -- --set fight [--room k5] [--at 4,12,20]`: the room's
 * per-encounter sim (bots/campaignEncounter.ts, the campaign bot with the reference character,
 * seed 1) is played in the page up to each time in --at (seconds of fight), then the whole room is
 * drawn. Deterministic, so a shot shows exactly what `npm run sim -- --encounters` plays. The HUD
 * and the stats overlay aren't refreshed for the adopted state (they show the page's start).
 */
import type { Page } from '@playwright/test';

export interface FightShotOptions {
  /** Region room short id (k5, k10), or a Fen boss arena (bellwether, coil). */
  room: string;
  seed: number;
  /** Fight seconds to stop at. */
  at: number;
  /**
   * 'fit': the whole room above the bottom HUD; 'play': play zoom (1) centered between the
   * player and the boss, as a phone or laptop sees it in play.
   */
  view?: 'fit' | 'play';
}

/** Plays the encounter to `at` seconds in the page and draws it. Returns a one-line summary. */
export async function showFight(page: Page, o: FightShotOptions): Promise<string> {
  // tsx compiles named functions with an `__name` helper that only exists in Node.
  await page.evaluate('window.__name = (f) => f');
  return page.evaluate(async (o) => {
    const R = window.__runeloom!;
    // Served by the Vite dev server; a variable path keeps Node's resolver out of it.
    const load = <T>(path: string): Promise<T> => import(/* @vite-ignore */ path) as Promise<T>;
    const rooms = await load<typeof import('../../src/app/rooms')>('/src/app/rooms.ts');
    const S = await load<typeof import('../../src/sim')>('/src/sim/index.ts');
    const E = await load<typeof import('../../src/sim/bots/campaignEncounter')>(
      '/src/sim/bots/campaignEncounter.ts',
    );
    R.loop.stop();
    let caught: import('../../src/sim').GameState | null = null;
    let start = -1;
    const stop = new Error('stop');
    // M8: the Fen bosses' test arenas, played by the boss bot (bots/fenBossBot.ts, with Tide).
    const fen: Record<string, { roomId: string; start: { x: number; y: number } }> = {
      bellwether: { roomId: 'test/boss_bellwether', start: { x: 52, y: 74 } },
      coil: { roomId: 'test/boss_coil', start: { x: 62, y: 88 } },
    };
    const F = fen[o.room]
      ? await load<typeof import('../../src/sim/bots/fenBossBot')>('/src/sim/bots/fenBossBot.ts')
      : null;
    try {
      if (F) {
        const f = fen[o.room]!;
        F.runFenBossFight({
          rooms: rooms.roomTexts,
          roomId: f.roomId,
          seed: o.seed,
          tide: 'tide',
          start: f.start,
          onStep: (st) => {
            if (start < 0) start = st.tick;
            if ((st.tick - start) / S.SIM_HZ >= o.at) {
              caught = st;
              throw stop;
            }
          },
        });
      } else
        E.runEncounter({
          rooms: rooms.roomTexts,
          key: o.room as import('../../src/sim/bots/campaign').RoomKey,
          seed: o.seed,
          onTick: (_k, st) => {
            if (start < 0) start = st.tick;
            if ((st.tick - start) / S.SIM_HZ >= o.at) {
              caught = st;
              throw stop;
            }
          },
        });
    } catch (e) {
      if (e !== stop) throw e;
    }
    const st = caught as import('../../src/sim').GameState | null;
    if (st === null) return `fight over before ${o.at} s`;
    const w = st.room.width * S.CELL_PX;
    const h = st.room.height * S.CELL_PX;
    const cam = st.tuning.camera;
    cam.lookAhead = 0;
    cam.edgeMargin = 0;
    // Camera scale is CELL_PX × (height / 720) × zoom; the bottom HUD covers hudInset of the
    // screen, and a room smaller than the view is centered above it (src/render/camera.ts), so
    // fitting the room into the rest shows all of it.
    cam.zoom = o.view === 'play' ? 1 : Math.min((innerWidth * 720) / (innerHeight * w), (720 * (1 - cam.hudInset)) / h);
    const boss = st.enemies.find((e) => e.boss && !e.dead);
    R.renderer.follow =
      o.view === 'play' && boss ? { x: (st.player.x + boss.x) / 2, y: (st.player.y + boss.y) / 2 } : null;
    R.session.adopt(st, 'adventure');
    const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    for (let i = 0; i < 6; i++) {
      R.renderer.handleEvents(R.session.drainEvents());
      R.renderer.render(R.session.state, 1, 1 / 60);
      await raf();
    }
    const p = st.player;
    const parts = st.enemies
      .filter((e) => !e.dead)
      .map((e) => {
        const a = e.attack.phase === 'none' ? '' : ` ${e.attack.name}:${e.attack.phase}`;
        const f = e.special.fuseLeft > 0 ? ` fuse ${e.special.fuseLeft.toFixed(1)}s` : '';
        const b = e.boss ? ` life ${Math.round(e.life)} phase ${e.boss.phase}` : '';
        return `${e.kind}${b}${a}${f}`;
      });
    let tar = 0;
    let tarFire = 0;
    for (let i = 0; i < st.grid.tar.length; i++)
      if (st.grid.tar[i] === 1 && st.grid.surface[i] !== 0) {
        tar++;
        if (st.grid.fire[i]! > 0) tarFire++;
      }
    return `t=${o.at}s player ${Math.round(p.life)}/${Math.round(p.maxLife)}; tar cells ${tar} (${tarFire} burning); ${parts.join(', ')}`;
  }, o);
}
