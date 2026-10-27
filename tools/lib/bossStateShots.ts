/**
 * Playtest 8 boss state shots, for `npm run shots -- --set boss [--shot coil_iced,bell_rung]
 * [--viewport 390x844]`: the Glasswater Coil and the Old Bellwether held in each of their states
 * in their test arenas, with the boss bar's state line and the pop label over the Coil. Each shot
 * shows the boss in the state before for a few frames, then sets the state (as the sim would:
 * the flags app/bossStatus.ts reads, written directly like a test; the renderer only reads them),
 * so entering it splashes and pops. The loop runs paused meanwhile, so the HUD refreshes but
 * nothing steps; it stops before the capture.
 */
import type { Page } from '@playwright/test';

export const bossShotIds = [
  'coil_submerged',
  'coil_surfaced',
  'coil_exposed',
  'coil_stranded',
  'coil_iced',
  'coil_overloaded',
  'bell_shelled',
  'bell_rung',
  'bell_rolling',
] as const;
export type BossShotId = (typeof bossShotIds)[number];

/** Sets the shot up in the page; returns the boss bar's state line. */
export async function runBossShot(page: Page, id: BossShotId): Promise<string> {
  // tsx compiles named functions with an `__name` helper that only exists in Node.
  await page.evaluate('window.__name = (f) => f');
  return page.evaluate(async (id) => {
    const R = window.__runeloom!;
    const load = <T>(path: string): Promise<T> => import(/* @vite-ignore */ path) as Promise<T>;
    const rooms = await load<typeof import('../../src/app/rooms')>('/src/app/rooms.ts');
    const S = await load<typeof import('../../src/sim')>('/src/sim/index.ts');
    const M = await load<typeof import('../../data/materials')>('/data/materials.ts');
    const coil = id.startsWith('coil');
    const st = S.createAdventure({
      seed: 1,
      rooms: rooms.roomTexts,
      startRoomId: coil ? 'test/boss_coil' : 'test/boss_bellwether',
      tuning: R.session.state.tuning,
    });
    st.cheats.god = true;
    st.tuning.camera.lookAhead = 0;
    st.tuning.camera.zoom = 1;
    // Software GL draws a frame in a fraction of a second: keep the pop up for the capture.
    st.tuning.bossReadout.popSeconds = 30;
    R.loop.paused = true;
    R.session.adopt(st, 'adventure');
    const s = R.session.state;
    const e = s.enemies.find((x) => x.boss)!;
    const f = e.boss!.fen!;
    const g = s.grid;
    const frames = async (n: number) => {
      for (let i = 0; i < n; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()));
    };
    const put = (x: number, y: number, px: number, py: number) => {
      e.x = e.prevX = x;
      e.y = e.prevY = y;
      s.player.x = s.player.prevX = px;
      s.player.y = s.player.prevY = py;
      const d = Math.hypot(px - x, py - y) || 1;
      e.facingX = (px - x) / d;
      e.facingY = (py - y) / d;
      R.renderer.follow = { x: (x + px) / 2, y: (y + py) / 2 };
    };
    const phase = (n: number, life: number) => {
      e.boss!.phase = n;
      e.life = e.maxLife * life;
    };
    const line = (length: number, width: number) => {
      e.attack.shape = { kind: 'line', length, width, dirX: e.facingX, dirY: e.facingY };
      e.attack.originX = e.x;
      e.attack.originY = e.y;
    };
    if (coil) {
      if (id === 'coil_submerged') {
        phase(2, 0.55);
        put(64, 54, 64, 80);
        f.coil = 'submerged';
        await frames(10);
      } else if (id === 'coil_surfaced') {
        phase(1, 0.8);
        put(64, 58, 64, 80);
        f.coil = 'submerged';
        await frames(4);
        f.coil = 'surfaced';
        e.attack.name = 'coil_lunge';
        e.attack.phase = 'windup';
        e.attack.timeLeft = 0.35;
        line(22, 10);
        await frames(4);
      } else if (id === 'coil_exposed') {
        phase(2, 0.5);
        put(64, 70, 70, 84);
        f.coil = 'submerged';
        await frames(4);
        f.coil = 'exposed';
        await frames(6);
      } else if (id === 'coil_stranded') {
        phase(2, 0.45);
        put(52, 78, 70, 86);
        f.coil = 'exposed';
        await frames(4);
        e.special.stranded = true;
        f.coil = 'stranded';
        await frames(6);
      } else if (id === 'coil_iced') {
        phase(2, 0.5);
        put(64, 58, 64, 80);
        f.coil = 'submerged';
        await frames(4);
        for (let y = 52; y < 65; y++)
          for (let x = 57; x < 72; x++)
            if ((x - 64.5) ** 2 + (y - 58.5) ** 2 < 36) g.ground[y * g.width + x] = M.MAT.ice;
        g.version++;
        e.special.trapped = true;
        f.coil = 'iced';
        await frames(6);
      } else {
        phase(3, 0.25);
        put(64, 56, 64, 80);
        f.coil = 'submerged';
        await frames(4);
        f.overloadLeft = 2;
        e.terrain.stunLeft = 2;
        f.coil = 'overloaded';
        await frames(6);
      }
    } else {
      put(52, 40, 52, 62);
      if (id === 'bell_shelled') {
        await frames(8);
      } else if (id === 'bell_rung') {
        await frames(4);
        e.special.openLeft = 4;
        e.terrain.stunLeft = 1.2;
        await frames(6);
      } else {
        phase(2, 0.4);
        await frames(4);
        e.special.dashSpeed = 40;
        e.attack.name = 'shell_roll';
        e.attack.phase = 'active';
        e.attack.timeLeft = 0.5;
        line(30, 10);
        await frames(6);
      }
    }
    // Hold the last frame: a running loop keeps software GL busy and slows the next page load.
    R.loop.stop();
    R.renderer.render(s, 0, 1 / 60);
    return document.querySelector('.ad-boss-state')?.textContent ?? '(no state line)';
  }, id);
}
