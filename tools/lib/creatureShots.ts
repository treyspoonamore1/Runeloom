/**
 * Debug shots of entities on the chemistry grid (M3 phase B), for `npm run shots -- --set
 * creature`: each runs a Chemistry Lab station (or adds an enemy to one) in the page, steps the
 * session and leaves the frame worth looking at. Runs in the browser through page.evaluate; it
 * drives the session like a test (it may write sim state), the renderer only reads it.
 */
import type { Page } from '@playwright/test';

export const creatureShotIds = ['wet', 'oiled', 'oilfire', 'arc', 'charge', 'fall', 'doused', 'shield', 'blind'] as const;
export type CreatureShotId = (typeof creatureShotIds)[number];

export async function runCreatureShot(page: Page, id: CreatureShotId): Promise<void> {
  // tsx compiles named functions with an `__name` helper that only exists in Node.
  await page.evaluate('window.__name = (f) => f');
  await page.evaluate(async (id) => {
    const R = window.__runeloom!;
    // Served by the Vite dev server; a variable path keeps Node's resolver out of it.
    const load = <T>(path: string): Promise<T> => import(/* @vite-ignore */ path) as Promise<T>;
    const lab = await load<typeof import('../../src/sim/world/lab')>('/src/sim/world/lab.ts');
    const data = await load<typeof import('../../data/lab')>('/data/lab.ts');
    const S = await load<typeof import('../../src/sim')>('/src/sim/index.ts');
    R.loop.stop();
    const s = R.session.state;
    s.cheats.god = true;
    s.tuning.camera.lookAhead = 0;
    s.tuning.camera.zoom = 2;
    const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    const frame = async (n = 1, dt = 1 / 60) => {
      for (let i = 0; i < n; i++) {
        R.renderer.handleEvents(R.session.drainEvents());
        R.renderer.render(R.session.state, 1, dt);
        await raf();
      }
    };
    const tick = () => {
      const p = R.session.state.player;
      R.session.step({ moveX: 0, moveY: 0, aimX: p.x + 10, aimY: p.y, buttons: 0 });
    };
    // Renders every 10th tick (the GPU in headless runs can't keep up with every tick).
    const run = async (n: number) => {
      for (let i = 0; i < n; i++) {
        tick();
        if (i % 10 === 9 || i === n - 1) await frame(1, 10 / 60);
      }
    };
    const until = async (type: string, max: number) => {
      for (let i = 0; i < max; i++) {
        tick();
        if (R.session.state.events.some((e) => e.type === type)) return frame(1);
        if (i % 10 === 9) await frame(1, 10 / 60);
      }
    };
    const station = (rule: number) => {
      const list = data.labStations;
      const idx = list.findIndex((x) => x.rule === rule);
      const r = list[idx]!.rect;
      const p = s.player;
      p.x = p.prevX = (r.tx + r.w / 2) * 4;
      p.y = p.prevY = (r.ty + r.h) * 4 - 3;
      lab.runStation(s, idx);
      return { x0: r.tx * 4, y0: r.ty * 4 };
    };
    switch (id) {
      case 'wet':
        station(15);
        await run(90);
        break;
      case 'oiled':
        station(17);
        await run(90);
        break;
      case 'oilfire':
        station(18);
        await run(150);
        break;
      case 'arc':
        station(19);
        await until('arc', 300);
        break;
      case 'charge':
        station(11);
        await until('chargeHit', 300);
        await frame(2);
        break;
      case 'fall': {
        const a = station(25);
        s.player.x = s.player.prevX = a.x0 + 12;
        s.player.y = s.player.prevY = a.y0 + 9;
        await until('fell', 900);
        await frame(7);
        break;
      }
      case 'doused': {
        const a = station(15);
        s.cheats.noAI = true;
        await frame(20);
        S.spawnEnemy(s, 'tinderling', a.x0 + 8, a.y0 + 12);
        await until('tinderlingDoused', 60);
        await frame(10);
        break;
      }
      case 'shield': {
        const a = station(16);
        s.cheats.noAI = true;
        await frame(20);
        S.spawnEnemy(s, 'shieldbearer', a.x0 + 7, a.y0 + 10);
        await run(150);
        break;
      }
      case 'blind': {
        const a = station(4);
        s.cheats.noAI = true;
        for (const [x, y] of [
          [6, 8],
          [18, 12],
          [12, 6],
        ] as const)
          S.spawnEnemy(s, 'ember_archer', a.x0 + x, a.y0 + y);
        await run(110);
        // Into the steam: the player's screen edge hazes.
        const g = s.grid;
        for (let yy = a.y0; yy < a.y0 + 24; yy++)
          for (let xx = a.x0; xx < a.x0 + 24; xx++)
            if (g.air[yy * g.width + xx] !== 0) {
              s.player.x = s.player.prevX = xx + 0.5;
              s.player.y = s.player.prevY = yy + 0.5;
              yy = 1e9;
              break;
            }
        await run(12);
        break;
      }
    }
  }, id);
}
