/**
 * Dungeon-item screenshots for `npm run shots -- --set item [--shot frost_panel]`: the K6 rune
 * shrine before and after it is taken, the Frost item-get panel (the hero holding the rune
 * overhead), the Loom it opens with Enter, and the Storm panel after the Cinder Warden dies. Each drives a new-game adventure
 * in the page like play does: the sim steps through the session, the HUD opens the panel itself.
 */
import type { Page } from '@playwright/test';

export const itemShotIds = [
  'shrine_before',
  'frost_panel',
  'frost_loom',
  'shrine_after',
  'storm_panel',
] as const;
export type ItemShotId = (typeof itemShotIds)[number];

export function itemShotUrl(base: string): string {
  return `${base}/?scene=adventure&paused=1&seed=1`;
}

export async function runItemShot(page: Page, id: ItemShotId): Promise<void> {
  // tsx compiles named functions with an `__name` helper that only exists in Node.
  await page.evaluate('window.__name = (f) => f');
  await page.evaluate(
    async ({ id }) => {
      const R = window.__runeloom!;
      const load = <T>(path: string): Promise<T> => import(/* @vite-ignore */ path) as Promise<T>;
      const rooms = await load<typeof import('../../src/app/rooms')>('/src/app/rooms.ts');
      const S = await load<typeof import('../../src/sim')>('/src/sim/index.ts');
      const P = await load<typeof import('../../data/progression')>('/data/progression.ts');
      const I = await load<typeof import('../../src/sim/items/items')>('/src/sim/items/items.ts');
      const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      const idle = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };
      const steps = async (n: number, input = idle) => {
        for (let i = 0; i < n; i++) R.session.step(input);
        await raf();
        await raf();
      };
      const k10 = id === 'storm_panel';
      const roomId = k10 ? P.regionRooms.k10 : P.regionRooms.k6;
      const st = S.createAdventure({
        seed: 1,
        rooms: rooms.roomTexts,
        startRoomId: k10 ? roomId : P.regionRooms.k5,
        tuning: R.session.state.tuning,
      });
      if (!k10) {
        // A hero arriving at K6: the runes of every room before it, plus a third Cast from a drop
        // (so the panel can suggest a new weave; the Storm shot shows the swap suggestion).
        const order = Object.values(P.regionRooms);
        for (const id of order.slice(0, order.indexOf(roomId)))
          for (const r of P.guaranteedRunes[id] ?? [])
            S.grantContent(st, { kind: 'rune', rune: I.makeRune(st.hero, r) });
        S.grantContent(st, { kind: 'rune', rune: I.makeRune(st.hero, 'cast') });
        S.enterRoom(st, roomId, { kind: 'edge', from: 'e' });
      }
      st.tuning.camera.lookAhead = 0;
      // The setup's own unlock events would toast: keep only the arrival (the room banner).
      const arrival = st.events.filter((e) => e.type === 'roomEnter');
      st.events.length = 0;
      st.events.push(...arrival);
      R.session.adopt(st, 'adventure');
      // adopt keeps the session's cheats: set them on the adopted state.
      R.session.state.cheats.noAI = !k10;
      R.session.state.cheats.god = true;
      const s = R.session.state;
      const p = s.player;
      const put = (x: number, y: number) => {
        p.x = p.prevX = x;
        p.y = p.prevY = y;
      };
      await steps(1);
      if (k10) {
        const boss = s.enemies.find((e) => e.kind === 'cinder_warden')!;
        put(boss.x, boss.y + 22);
        await steps(30);
        S.dealDirectDamage(s, boss, boss.life + 1e6, S.PLAYER_ID);
        await steps(10);
        // The panel waits ~2 s of play after the Warden dies (data/ui.ts).
        for (let i = 0; i < 12; i++) await steps(12);
        await wait(700);
        return;
      }
      const shrine = s.objects.find((o) => o.kind === 'rune_shrine')!;
      const T = (t: number) => (t + 0.5) * S.TILE_CELLS;
      put(T(shrine.tx - 2), T(shrine.ty));
      p.faceX = 1;
      p.faceY = 0;
      await steps(2);
      if (id === 'shrine_before') {
        await wait(400);
        return;
      }
      // Walk into the shrine: the HUD opens the Frost panel on the next frame.
      for (let i = 0; i < 40 && !shrine.on; i++)
        R.session.step({ ...idle, moveX: 1, aimX: T(shrine.tx), aimY: T(shrine.ty) });
      await steps(1);
      await wait(700);
      if (id === 'frost_loom') {
        // Enter on the panel: the Loom opens on the suggested slot with Frost picked.
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        await raf();
        await raf();
        await wait(500);
      }
      if (id === 'shrine_after') {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
        put(T(shrine.tx - 3), T(shrine.ty + 1));
        await steps(2);
        // The pose lasts 1.5 s of render time; software-GL frames are slow, so wait well past it.
        await wait(6000);
      }
    },
    { id },
  );
}
