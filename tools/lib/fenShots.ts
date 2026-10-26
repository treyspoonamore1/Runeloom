/**
 * M8 Fen render shots (BUILD_PLAN M8 phase 1 task 4), for `npm run shots -- --set fen [--shot
 * fog,wind] [--viewport 390x844]`: fog with the lantern, gusts and room wind, lit and doused vents,
 * borrowed water and ice near expiry, the pylon warning, the F1 wind and borrowed overlays, and the
 * Fen and Foundry palettes next to region 1. Uses the render test rooms test/fen_render and
 * test/foundry_render until the Fen's own rooms exist. Until the Tide and wind rules merge, the
 * setups write the M8 grid fields directly (like a test; the renderer only reads them).
 */
import type { Page } from '@playwright/test';

export const fenShotIds = [
  'fog',
  'fog_glow',
  'gust',
  'gust_fog',
  'room_wind',
  'vents',
  'borrowed',
  'pylon',
  'objects',
  'overlay',
  'palette_fen',
  'palette_foundry',
  'palette_region1',
  'tide_real',
  'gale_real',
] as const;
export type FenShotId = (typeof fenShotIds)[number];

export async function runFenShot(page: Page, id: FenShotId): Promise<string> {
  // tsx compiles named functions with an `__name` helper that only exists in Node.
  await page.evaluate('window.__name = (f) => f');
  return page.evaluate(async (id) => {
    const R = window.__runeloom!;
    const load = <T>(path: string): Promise<T> => import(/* @vite-ignore */ path) as Promise<T>;
    const rooms = await load<typeof import('../../src/app/rooms')>('/src/app/rooms.ts');
    const S = await load<typeof import('../../src/sim')>('/src/sim/index.ts');
    const M = await load<typeof import('../../data/materials')>('/data/materials.ts');
    const WD = await load<typeof import('../../src/sim/grid/windDir')>('/src/sim/grid/windDir.ts');
    const WN = await load<typeof import('../../src/sim/grid/wind')>('/src/sim/grid/wind.ts');
    R.loop.stop();
    const roomId =
      id === 'palette_foundry'
        ? 'test/foundry_render'
        : id === 'palette_region1'
          ? 'emberwood/e3_riverbend'
          : 'test/fen_render';
    const st = S.createAdventure({
      seed: 1,
      rooms: rooms.roomTexts,
      startRoomId: roomId,
      tuning: R.session.state.tuning,
    });
    st.cheats.god = true;
    st.cheats.noAI = true;
    st.tuning.camera.lookAhead = 0;
    st.tuning.camera.edgeMargin = 0;
    st.tuning.camera.zoom = 1;
    R.session.adopt(st, 'adventure');
    const s = R.session.state;
    const g = s.grid;
    const W = g.width;
    const T = S.TILE_CELLS;
    const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    // Headless GL is a CPU rasterizer: render few frames, with a bigger dt to advance animation.
    const frames = async (seconds: number) => {
      const n = Math.max(2, Math.min(12, Math.ceil(seconds * 6)));
      for (let i = 0; i < n; i++) {
        R.renderer.handleEvents(R.session.drainEvents());
        R.renderer.render(R.session.state, 1, seconds / n);
        await raf();
      }
    };
    const place = (x: number, y: number) => {
      s.player.x = s.player.prevX = x;
      s.player.y = s.player.prevY = y;
      R.renderer.follow = { x, y };
    };
    const touched = () => {
      g.version++;
    };
    /** Writes a 60° gust cone (DESIGN §6.6) of radius r from (x, y) toward (dx, dy), clearing fog. */
    const gust = (x: number, y: number, dx: number, dy: number, r: number, ticks: number) => {
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      const dir = WD.windDirOf(ux, uy);
      for (let cy = Math.floor(y - r); cy <= y + r; cy++)
        for (let cx = Math.floor(x - r); cx <= x + r; cx++) {
          if (cx < 0 || cy < 0 || cx >= W || cy >= g.height) continue;
          const vx = cx + 0.5 - x;
          const vy = cy + 0.5 - y;
          const d = Math.hypot(vx, vy);
          if (d > r || (d > 0.5 && (vx * ux + vy * uy) / d < Math.cos(Math.PI / 6))) continue;
          const i = cy * W + cx;
          g.gustDir[i] = dir;
          g.gustTimer[i] = ticks;
          if (g.air[i] === M.AIR.fog) {
            g.air[i] = M.AIR.none;
            g.airTimer[i] = 160;
          }
        }
      touched();
    };
    const lightBraziers = () => {
      for (const o of s.objects) if (o.kind === 'brazier') o.on = true;
    };
    const charge = (x0: number, y0: number, x1: number, y1: number, ticks: number) => {
      for (let cy = y0; cy <= y1; cy++)
        for (let cx = x0; cx <= x1; cx++) {
          const i = cy * W + cx;
          const m = g.ground[i]!;
          if (m === M.MAT.shallow_water || m === M.MAT.deep_water || m === M.MAT.metal_floor) {
            g.charge[i] = ticks;
            g.owner[i] = M.OWNER.player;
          }
        }
      touched();
    };
    /** Borrowed terrain (rule 27): `mat` over `under`, `ticks` left. */
    const borrow = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      mat: number,
      under: number,
      ticks: number,
    ) => {
      for (let cy = y0; cy <= y1; cy++)
        for (let cx = x0; cx <= x1; cx++) {
          const i = cy * W + cx;
          g.ground[i] = mat;
          g.under[i] = under;
          g.borrowed[i] = 1;
          g.timer[i] = ticks;
        }
      touched();
    };
    const tile = (tx: number, ty: number): [number, number] => [(tx + 0.5) * T, (ty + 0.5) * T];
    let note = '';
    switch (id) {
      case 'fog': {
        place(...tile(29, 15));
        await frames(0.5);
        note = 'player inside the east fog bank: lantern circle, reeds and lake under mist';
        break;
      }
      case 'fog_glow': {
        place(...tile(27, 12));
        lightBraziers();
        // Player charge in the east lake (the pylon islet pool), glowing through the fog.
        charge(28 * T, 8 * T, 41 * T, 17 * T, 40);
        await frames(0.67);
        note = 'fog with a charged lake and a lit brazier: charge and the brazier part the fog';
        break;
      }
      case 'gust': {
        place(...tile(12, 14));
        gust(12 * T, 14 * T, 1, -1, 12, 40);
        await frames(0.33);
        note = 'a fresh Gale gust cone blowing north-east from the player over the walkway';
        break;
      }
      case 'gust_fog': {
        // A Gale bolt's gust: a 60° cone from its impact point deep in the fog (DESIGN §6.6).
        place(...tile(22, 14));
        gust(30 * T, 14 * T, 1, 0, 12, 30);
        await frames(0.33);
        note = 'a bolt gust blowing east inside the fog bank: its cone is cleared, streaks on top';
        break;
      }
      case 'room_wind': {
        place(...tile(12, 14));
        g.wind = 1;
        touched();
        await frames(0.5);
        note = 'room wind blowing east (faint drifting streaks everywhere)';
        break;
      }
      case 'vents': {
        place(...tile(17, 14));
        // Douse the south row (rule 30): bare grates, borrowed, relighting later.
        for (let tx = 19; tx <= 22; tx++)
          borrow(tx * T, 18 * T, tx * T + 3, 18 * T + 3, M.MAT.vent_doused, M.MAT.vent_lit, 150);
        await frames(2.33);
        note = 'lit vent wall (north, flames and shimmer) and the doused row (south, grates and steam)';
        break;
      }
      case 'borrowed': {
        place(...tile(9, 14));
        // Tide water on stone, 0.5 s left (flickering), a fresher strip (not yet), and borrowed ice.
        borrow(2 * T, 13 * T, 7 * T - 1, 14 * T - 1, M.MAT.shallow_water, M.MAT.stone, 10);
        borrow(2 * T, 14 * T, 7 * T - 1, 15 * T - 1, M.MAT.shallow_water, M.MAT.stone, 150);
        borrow(9 * T, 13 * T, 14 * T - 1, 15 * T - 1, M.MAT.ice, M.MAT.stone, 12);
        await frames(0.23);
        note =
          'top strip: borrowed water 0.5 s from going (blinks to stone); below: fresh borrowed water; right: borrowed ice near its end';
        break;
      }
      case 'pylon': {
        place(...tile(14, 13));
        // Step the sim to the moment the pylons start glowing (@pulse 4, glow 0.8 s first).
        for (let i = 0; i < 60 * 8; i++) {
          R.session.step({ moveX: 0, moveY: 0, aimX: s.player.x + 5, aimY: s.player.y, buttons: 0 });
          if (R.session.state.events.some((e) => e.type === 'pylonGlow')) break;
        }
        // Real-time frames: the warning's glow particles live a tenth of a second.
        for (let i = 0; i < 30; i++) {
          R.session.step({ moveX: 0, moveY: 0, aimX: s.player.x + 5, aimY: s.player.y, buttons: 0 });
          if (i >= 22) {
            R.renderer.handleEvents(R.session.drainEvents());
            R.renderer.render(R.session.state, 1, 1 / 60);
            await raf();
          }
        }
        note = 'the west pylon 0.5 s before its @pulse: warning glow and sparks';
        break;
      }
      case 'objects': {
        place(...tile(20, 13));
        // Power the west sealed switch, as a timed group would hold it.
        const q = s.objects.find((o) => o.kind === 'sealed_switch' && o.tx === 18);
        if (q) {
          q.on = true;
          q.timer = 2.5;
        }
        gust(22 * T + 2, 13 * T + 2, -1, 0, 6, 40);
        await frames(0.67);
        for (const o of s.objects) if (o.kind === 'wind_vane') o.on = true;
        if (q) q.timer = 1.6;
        await frames(0.5);
        note = 'west sealed switch powered (timed ring), wind vane spinning in a gust, lit vents';
        break;
      }
      case 'overlay': {
        place(...tile(12, 14));
        g.wind = 1;
        gust(12 * T, 14 * T, 1, -1, 12, 40);
        borrow(2 * T, 13 * T, 7 * T - 1, 15 * T - 1, M.MAT.shallow_water, M.MAT.stone, 20);
        borrow(14 * T, 15 * T, 18 * T - 1, 17 * T - 1, M.MAT.shallow_water, M.MAT.stone, 150);
        R.renderer.overlays.wind = true;
        R.renderer.overlays.borrowed = true;
        await frames(0.17);
        note = 'F1 wind (gust arrows, room wind lattice) and borrowed (blue; striped near expiry)';
        break;
      }
      case 'palette_fen': {
        place(...tile(11, 10));
        await frames(0.33);
        note = 'Fen palette: reeds, glassy water, rusted teal metal and pylon, lichen walls';
        break;
      }
      case 'palette_foundry': {
        place(...tile(14, 9));
        await frames(1);
        note = 'Foundry palette: dark sooted metal, sluice, vents, soot-dark stone';
        break;
      }
      case 'tide_real': {
        // The real rules (24, 27, 30): Tide on stone and on the vent row, then wait until 0.8 s are left.
        place(...tile(12, 15));
        const tide = (x: number, y: number, r: number) =>
          S.applyElement(s, {
            element: 'tide',
            shape: { kind: 'circle', x, y, r },
            owner: M.OWNER.player,
            sourceId: 0,
            hitDamage: 0,
            durationMult: 1,
          });
        tide(6 * T, 14 * T, 7);
        tide(21 * T, 18.5 * T, 6);
        const ticks = Math.round((s.tuning.tide.floodSeconds - 0.8) * 60);
        const idle = { moveX: 0, moveY: 0, aimX: s.player.x + 5, aimY: s.player.y, buttons: 0 };
        for (let i = 0; i < ticks; i++) R.session.step(idle);
        for (let i = 0; i < 6; i++) {
          R.session.step(idle);
          R.renderer.handleEvents(R.session.drainEvents());
          R.renderer.render(R.session.state, 1, 1 / 60);
          await raf();
        }
        note =
          'real Tide (rules 24, 27, 30) 0.8 s before it goes: the stone pool and the doused vents blink back';
        break;
      }
      case 'gale_real': {
        // A real Gale cone (rule 21 gust, rule 29 fog clear) blown east into the fog bank.
        place(...tile(24, 15));
        S.applyElement(s, {
          element: 'gale',
          shape: WN.galeCone(s, s.player.x, s.player.y, 1, 0, 1),
          owner: M.OWNER.player,
          sourceId: 0,
          hitDamage: 0,
          durationMult: 1,
          dirX: 1,
          dirY: 0,
        });
        const idle = { moveX: 0, moveY: 0, aimX: s.player.x + 5, aimY: s.player.y, buttons: 0 };
        for (let i = 0; i < 12; i++) {
          R.session.step(idle);
          if (i % 3 === 2) {
            R.renderer.handleEvents(R.session.drainEvents());
            R.renderer.render(R.session.state, 1, 3 / 60);
            await raf();
          }
        }
        note = 'a real Gale cone east from the player: streaks, fog cleared in its cone, the vane in it';
        break;
      }
      case 'palette_region1': {
        const p = s.player;
        place(p.x, p.y);
        await frames(0.33);
        note = `region 1 (${s.room.id}) unchanged`;
        break;
      }
    }
    return note;
  }, id);
}
