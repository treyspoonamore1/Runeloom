/**
 * Playtest 8 shots (`npm run shots -- --set hits [--shot shell_hit,note_long] [--viewport 960x540]`):
 * - shell_hit: the player's hits on a Shelled Bellshell (small grey numbers with a shield mark)
 *   next to the same hits on a Copperback in the same ford (normal numbers);
 * - shell_ring: the moment the player's charge in its water rings a Bellshell (flash, RUNG!);
 * - shell_open: a second later: the shell lifted open, the Rung icon, ring waves;
 * - hint_shell, hint_coil: the one-time hint toasts after five reduced hits (real hits, real HUD);
 * - note_long: the longest Fen @note (F7's) in the center banner.
 * Real sim setups on test/fen_render and test/boss_coil, AI off; the HUD gets the drained events
 * through window.__runeloom.ui.events, with toasts and banners held.
 */
import type { Page } from '@playwright/test';

export const hitShotIds = ['shell_hit', 'shell_ring', 'shell_open', 'hint_shell', 'hint_coil', 'note_long'] as const;
export type HitShotId = (typeof hitShotIds)[number];

export const hitShotUrl = (base: string): string => `${base}/?scene=adventure&seed=1&paused=1&ui=play`;

export async function runHitShot(page: Page, id: HitShotId): Promise<string> {
  await page.evaluate('window.__name = (f) => f');
  return page.evaluate(async (id) => {
    const R = window.__runeloom!;
    const load = <T>(path: string): Promise<T> => import(/* @vite-ignore */ path) as Promise<T>;
    const rooms = await load<typeof import('../../src/app/rooms')>('/src/app/rooms.ts');
    const S = await load<typeof import('../../src/sim')>('/src/sim/index.ts');
    const M = await load<typeof import('../../data/materials')>('/data/materials.ts');
    R.loop.stop();
    R.ui!.hold(true);
    const coil = id === 'hint_coil';
    const st = S.createAdventure({
      seed: 1,
      rooms: rooms.roomTexts,
      startRoomId: coil ? 'test/boss_coil' : 'test/fen_render',
      tuning: R.session.state.tuning,
    });
    st.tuning.camera.lookAhead = 0;
    st.tuning.camera.edgeMargin = 0;
    R.session.adopt(st, 'adventure');
    const s = R.session.state;
    // After adopt: it keeps the session's cheats.
    s.cheats.god = true;
    s.cheats.noAI = true;
    const T = S.TILE_CELLS;
    const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    const pump = () => {
      const ev = R.session.drainEvents();
      R.renderer.handleEvents(ev);
      R.ui!.events(ev as never);
    };
    const frames = async (seconds: number, n = 4) => {
      for (let i = 0; i < n; i++) {
        pump();
        R.renderer.render(R.session.state, 1, seconds / n);
        await raf();
      }
    };
    const idle = () => ({ moveX: 0, moveY: 0, aimX: s.player.x + 5, aimY: s.player.y, buttons: 0 });
    const place = (x: number, y: number) => {
      s.player.x = s.player.prevX = x;
      s.player.y = s.player.prevY = y;
      R.renderer.follow = { x, y };
    };
    /** A player hit outside a step: its events go to the session's queue like a step's. */
    const hitPlayer = (e: import('../../src/sim').Enemy, n: number) => {
      s.events.length = 0;
      S.applyHit(s, e, S.makePacket(n, { physical: 1 }, 0, s.tuning.combat.critMultiplier), {
        sourceId: S.PLAYER_ID,
        dirX: 1,
        dirY: 0,
        knockback: 0,
      });
      R.session.pendingEvents.push(...s.events);
    };
    const tile = (tx: number, ty: number): [number, number] => [(tx + 0.5) * T, (ty + 0.5) * T];
    await frames(0.2, 2);
    switch (id) {
      case 'shell_hit':
      case 'hint_shell': {
        place(...tile(3, 9));
        const b = S.spawnEnemy(s, 'bellshell', ...tile(7, 7));
        const c = S.spawnEnemy(s, 'copperback', ...tile(7, 11));
        R.session.step(idle());
        for (let i = 0; i < 5; i++) {
          hitPlayer(b, 110 + i * 7);
          if (id === 'shell_hit') hitPlayer(c, 110 + i * 7);
          await frames(i < 4 ? 0.16 : 0.08, 1);
        }
        return id === 'shell_hit'
          ? 'five player hits on a Shelled Bellshell (top) and on a Copperback (bottom)'
          : 'the Shelled hint toast after five reduced hits';
      }
      case 'shell_ring':
      case 'shell_open': {
        place(...tile(3, 9));
        const b = S.spawnEnemy(s, 'bellshell', ...tile(7, 9));
        R.session.step(idle());
        // The player's Storm in the water beside it (rules 11–12): the charge rings it.
        S.applyElement(s, {
          element: 'storm',
          shape: { kind: 'circle', x: tile(9, 9)[0], y: tile(9, 9)[1], r: 0.6 },
          owner: M.OWNER.player,
          sourceId: S.PLAYER_ID,
          hitDamage: 40,
          durationMult: 1,
        });
        for (let i = 0; i < 8 && b.special.openLeft <= 0; i++) R.session.step(idle());
        if (id === 'shell_ring') {
          await frames(0.1, 2);
          return `the moment the player's charge rings it (open ${b.special.openLeft.toFixed(2)} s)`;
        }
        for (let i = 0; i < 60; i++) R.session.step(idle());
        await frames(0.4, 4);
        return `a second after the ring: open ${b.special.openLeft.toFixed(1)} s, stunned ${b.terrain.stunLeft.toFixed(1)} s`;
      }
      case 'hint_coil': {
        const c = s.enemies.find((e) => e.kind === 'glasswater_coil')!;
        S.aggro(s, c);
        c.x = c.prevX = 62;
        c.y = c.prevY = 46;
        c.vx = c.vy = 0;
        c.attack.phase = 'none';
        c.attack.timeLeft = 0;
        place(62, 74);
        R.session.step(idle());
        for (let i = 0; i < 5; i++) {
          hitPlayer(c, 400);
          await frames(0.06, 1);
        }
        await frames(0.12, 2);
        return `the Submerged hint toast after five reduced hits on the Coil (${c.boss!.fen!.coil})`;
      }
      case 'note_long': {
        place(...tile(10, 14));
        await frames(0.1, 1);
        R.ui!.events([
          { type: 'note', text: 'The vents ahead burn with no fuel but heat. Drown them for a while, and walk through.' },
        ] as never);
        await frames(0.2, 2);
        return "F7's note (the longest Fen @note) in the center banner";
      }
    }
    return '';
  }, id);
}
