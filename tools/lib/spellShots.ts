/**
 * Spell look shots (playtest 8, "the gale visual looked weird on a lob"), for
 * `npm run shots -- --set spells [--shot lob_gale,bolt_gale] [--at 15,31,45,90]`: one weave cast
 * once from the walkway of test/fen_render (outside its fog bank), shot at each tick after the
 * cast in --at (default: mid-flight, landing, and through the 2 s gust).
 */
import type { Page } from '@playwright/test';

/** Each shot: a weave in slot 1, cast once toward a point 8 tiles east of the player. */
export const spellShots = {
  lob_gale: 'Cast > Lob[Gale]',
  lob_fire: 'Cast > Lob[Fire]',
  lob_frost: 'Cast > Lob[Frost]',
  lob_tide: 'Cast > Lob[Tide]',
  bolt_gale: 'Cast > Bolt[Gale]',
  strike_gale: 'Cast > Strike[Gale]',
  nova_gale: 'Cast > Nova[Gale]',
} as const;
export type SpellShotId = keyof typeof spellShots;
export const spellShotIds = Object.keys(spellShots) as SpellShotId[];

/** Ticks after the cast: Lob mid-flight, just landed, then through the gust. */
export const SPELL_SHOT_TICKS = [15, 30, 34, 38, 45, 90];

/** Sets up the room, the weave and the cast; leaves the sim on the cast tick. */
export async function startSpellShot(page: Page, id: SpellShotId): Promise<void> {
  await page.evaluate('window.__name = (f) => f');
  await page.evaluate(async (notation) => {
    const R = window.__runeloom!;
    const load = <T>(path: string): Promise<T> => import(/* @vite-ignore */ path) as Promise<T>;
    const rooms = await load<typeof import('../../src/app/rooms')>('/src/app/rooms.ts');
    const S = await load<typeof import('../../src/sim')>('/src/sim/index.ts');
    R.loop.stop();
    // Sandbox mode: the weave needs no rune items.
    const st = S.createGame({
      seed: 1,
      rooms: rooms.roomTexts,
      roomId: 'test/fen_render',
      tuning: R.session.state.tuning,
      loadout: { spindleId: 'heartwood', notations: [notation] },
    });
    st.tuning.camera.lookAhead = 0;
    st.tuning.camera.edgeMargin = 0;
    st.tuning.camera.zoom = 1.6;
    R.session.adopt(st, 'sandbox');
    Object.assign(R.session.state.cheats, { god: true, noAI: true, infiniteMana: true });
    const s = R.session.state;
    const T = S.TILE_CELLS;
    s.player.x = s.player.prevX = 6.5 * T;
    s.player.y = s.player.prevY = 16.5 * T;
    R.renderer.follow = { x: 10.5 * T, y: 16.5 * T };
    const w = window as unknown as { __spellAim: [number, number] };
    w.__spellAim = [14.5 * T, 16.5 * T];
    const [ax, ay] = w.__spellAim;
    R.session.step({ moveX: 0, moveY: 0, aimX: ax, aimY: ay, buttons: 1 });
    R.renderer.handleEvents(R.session.drainEvents());
    R.renderer.render(R.session.state, 1, 1 / 60);
  }, spellShots[id]);
}

/** Steps the sim `ticks` ticks (aim held, no buttons), rendering every third tick and the last. */
export async function advanceSpellShot(page: Page, ticks: number): Promise<void> {
  await page.evaluate(async (ticks) => {
    const R = window.__runeloom!;
    const [ax, ay] = (window as unknown as { __spellAim: [number, number] }).__spellAim;
    const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    let since = 0;
    for (let i = 0; i < ticks; i++) {
      R.session.step({ moveX: 0, moveY: 0, aimX: ax, aimY: ay, buttons: 0 });
      R.renderer.handleEvents(R.session.drainEvents());
      since++;
      if (since === 3 || i === ticks - 1) {
        R.renderer.render(R.session.state, 1, since / 60);
        since = 0;
        await raf();
      }
    }
  }, ticks);
}

/** Shoots each spell at each tick in `at` into `dir`; returns the files written. */
export async function spellShotSet(
  page: Page,
  url: string,
  dir: string,
  prefix: string,
  only: SpellShotId[],
  at: number[],
): Promise<string[]> {
  const written: string[] = [];
  for (const id of only) {
    await page.goto(url);
    await page.waitForFunction(() => window.__runeloom?.ready === true, undefined, { timeout: 30_000 });
    await startSpellShot(page, id);
    let tick = 0;
    for (const t of [...at].sort((x, y) => x - y)) {
      await advanceSpellShot(page, t - tick);
      tick = t;
      const file = `${dir}/${prefix}_spell_${id}_t${String(t).padStart(3, '0')}.png`;
      await page.screenshot({ path: file, timeout: 120_000 });
      const info = await page.evaluate(() => {
        const s = window.__runeloom!.session.state;
        return `${s.room.id} tick ${s.tick} spells ${s.spells.length} player ${s.player.x},${s.player.y}`;
      });
      console.log(`shot ${id} at tick ${t}: ${info}`);
      written.push(file);
    }
  }
  return written;
}
