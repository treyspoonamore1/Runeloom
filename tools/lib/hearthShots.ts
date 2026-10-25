/**
 * Hearth hub screenshots (M7), for `npm run shots -- --set hearth [--shot unlit,mid,max]
 * [--viewport 390x844]`: the hub as an adventure game with hero.hearth set up per shot (building
 * levels, planted runes, expeditions), once zoomed to fit the room and once at play zoom by the
 * station the shot stands at (its "F" prompt showing).
 */
import type { Page } from '@playwright/test';

export const hearthShotIds = ['unlit', 'mid', 'max'] as const;
export type HearthShotId = (typeof hearthShotIds)[number];

interface ShotSetup {
  lit: boolean;
  levels: Record<string, number>;
  garden: string[];
  /** Seconds left per expedition (0: back and ready). */
  expeditions: number[];
  /** The station to stand south of (its prompt shows), or null for the Loom Stone. */
  standAt: string | null;
  /** Ember drops on the floor beside the player (their loot look), next to a Thread Scrap for contrast. */
  embers?: number;
}

const SETUPS: Record<HearthShotId, ShotSetup> = {
  unlit: { lit: false, levels: {}, garden: [], expeditions: [], standAt: null },
  mid: {
    lit: true,
    levels: { kindling_pit: 8, rune_garden: 10, expedition_board: 4, salvage_loom: 1 },
    garden: ['fire', 'bolt'],
    expeditions: [300],
    standAt: 'spindlewright',
    embers: 6,
  },
  max: {
    lit: true,
    levels: { kindling_pit: 25, rune_garden: 20, expedition_board: 15, salvage_loom: 10 },
    garden: ['fire', 'frost', 'bolt', 'nova', 'pierce', 'cast'],
    expeditions: [0, 0, 420],
    standAt: 'expedition_board',
  },
};

export async function showHearth(page: Page, id: HearthShotId, view: 'fit' | 'play'): Promise<void> {
  await page.evaluate('window.__name = (f) => f');
  // The F3 stats panel would cover the north-west building.
  await page.addStyleTag({ content: '.dbg-stats { display: none !important; }' });
  await page.evaluate(
    async ({ setup, view }) => {
      const R = window.__runeloom!;
      const load = <T>(path: string): Promise<T> => import(/* @vite-ignore */ path) as Promise<T>;
      const rooms = await load<typeof import('../../src/app/rooms')>('/src/app/rooms.ts');
      const S = await load<typeof import('../../src/sim')>('/src/sim/index.ts');
      const items = await load<typeof import('../../src/sim/items/items')>('/src/sim/items/items.ts');
      const H = await load<typeof import('../../data/hearth')>('/data/hearth.ts');
      const L = await load<typeof import('../../src/sim/items/loot')>('/src/sim/items/loot.ts');
      R.loop.stop();
      const st = S.createAdventure({
        seed: 1,
        rooms: rooms.roomTexts,
        startRoomId: H.hearthRoom,
        tuning: R.session.state.tuning,
      });
      const h = st.hero.hearth;
      h.lit = setup.lit;
      for (const [b, l] of Object.entries(setup.levels)) h.buildings[b as keyof typeof h.buildings] = l;
      for (const r of setup.garden) {
        const rune = items.makeRune(st.hero, r as Parameters<typeof items.makeRune>[1], 5);
        st.hero.runes.push(rune);
        h.garden.push(rune.uid);
      }
      setup.expeditions.forEach((left, i) =>
        h.expeditions.push({ uid: 9000 + i, tier: 3, left, duration: 900, cycle: h.rekindles }),
      );
      if (setup.standAt) {
        const tiles = st.objects.filter((o) => o.kind === setup.standAt);
        const ty = Math.max(...tiles.map((o) => o.ty));
        const tx = Math.min(...tiles.filter((o) => o.ty === ty).map((o) => o.tx));
        st.player.x = st.player.prevX = (tx + 0.5) * S.TILE_CELLS;
        st.player.y = st.player.prevY = (ty + 1.5) * S.TILE_CELLS - 0.5;
      }
      if (setup.embers) {
        const x = st.player.x + 10;
        const y = st.player.y + 2;
        for (let i = 0; i < setup.embers; i++) L.dropLoot(st, x, y, { kind: 'embers', amount: 2 }, i).age = 9;
        L.dropLoot(st, x + 7, y, { kind: 'scrap', amount: 3 }).age = 9;
      }
      const w = st.room.tilesW * S.TILE_CELLS * S.CELL_PX;
      const hh = st.room.tilesH * S.TILE_CELLS * S.CELL_PX;
      st.tuning.camera.lookAhead = 0;
      st.tuning.camera.edgeMargin = 0;
      // Fit: the whole room above the HUD (tuning.camera.hudInset).
      const above = 720 * (1 - st.tuning.camera.hudInset);
      st.tuning.camera.zoom =
        view === 'fit' ? Math.min((innerWidth * 720) / (innerHeight * w), above / hh) : 1;
      R.session.adopt(st, 'adventure');
      const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      for (let i = 0; i < 40; i++) {
        R.renderer.handleEvents(R.session.drainEvents());
        R.renderer.render(R.session.state, 1, 1 / 60);
        if (i % 8 === 0) await raf();
      }
      await raf();
    },
    { setup: SETUPS[id], view },
  );
}
