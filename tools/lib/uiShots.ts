/**
 * M4 menu and HUD screenshots for `npm run shots -- --set ui`: each opens the adventure scene with
 * fixture data (?fixture=1), opens a screen through window.__runeloom.ui and sets up what is worth
 * looking at (a tooltip, a dialog, toasts). The death shot drives the session like a test.
 */
import type { Page } from '@playwright/test';

export const uiShotIds = [
  'title',
  'title_load',
  'inventory',
  'fuse',
  'tree',
  'map',
  'hud',
  'death',
  'loom',
  'craft',
  'filter',
  'filter_floor',
  'pause',
  'volatile',
  'rifts',
  'rift_hud',
  'rift_map',
  'rift_wires',
  'rift_boss',
  'rift_wires_warn',
  'hearth_buildings',
  'hearth_garden',
  'hearth_expeditions',
  'hearth_salvage',
  'hearth_spindlewright',
  'hearth_rekindle',
  'hearth_confirm',
  'hearth_cartographer',
  'hearth_hud',
  'hearth_away',
  'hud_twin',
  'loom_twin',
] as const;
export type UiShotId = (typeof uiShotIds)[number];

const ADV = 'scene=adventure&fixture=1&paused=1&seed=1';

export function uiShotUrl(base: string, id: UiShotId): string {
  if (id === 'title' || id === 'title_load') return `${base}/?fixture=1&seed=1`;
  if (id === 'hud') return `${base}/?${ADV}&ui=play&boss=cinder_warden`;
  if (id === 'hud_twin' || id === 'loom_twin') return `${base}/?${ADV}&ui=play`;
  if (id === 'death') return `${base}/?${ADV}&ui=play`;
  if (id === 'pause') return `${base}/?${ADV}&ui=pause`;
  // The Hearth (M7) with a fixture lit Hearth: every tab, the Rekindle confirmation, the HUD with
  // its counters and toasts, and the offline modal.
  if (id === 'hearth_hud' || id === 'hearth_away') return `${base}/?${ADV}&ui=play`;
  if (id.startsWith('hearth_')) return `${base}/?${ADV}&ui=hearth`;
  // The bench crafts with the real sim, so it runs on a real hero (fixture bases aren't real items).
  if (
    id === 'craft' ||
    id === 'filter' ||
    id === 'filter_floor' ||
    id === 'volatile' ||
    id.startsWith('rift')
  )
    return `${base}/?scene=adventure&paused=1&seed=1&ui=play`;
  return `${base}/?${ADV}&ui=${id === 'fuse' ? 'inventory' : id}`;
}

const settle = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

export async function runUiShot(page: Page, id: UiShotId): Promise<void> {
  await page.evaluate('window.__name = (f) => f');
  await settle(page);
  if (id === 'title' || id === 'title_load') {
    // Two saves, so Continue and the slot list have something to show.
    await page.evaluate(async (load) => {
      const ui = window.__runeloom!.ui!;
      await ui.flow.saveTo('slot1');
      await ui.flow.handleEvents([{ type: 'roomEnter' } as never]);
      await new Promise((r) => setTimeout(r, 200));
      await ui.flow.refresh();
      ui.open(load ? 'title:load' : 'title');
    }, id === 'title_load');
  } else if (id.startsWith('hearth_') && id !== 'hearth_hud' && id !== 'hearth_away') {
    const tab: Record<string, string> = {
      hearth_garden: 'Rune Garden',
      hearth_expeditions: 'Expeditions',
      hearth_salvage: 'Salvage Loom',
      hearth_spindlewright: 'Spindlewright',
      hearth_rekindle: 'Rekindle',
      hearth_confirm: 'Rekindle',
      hearth_cartographer: 'Cartographer',
    };
    const name = tab[id];
    if (name) await page.click(`.hx-tab >> text=${name}`);
    if (id === 'hearth_confirm') await page.click('.hx-card >> text=Rekindle…');
    if (id === 'hearth_buildings') await page.click('.hx-card .mn-btn.gold >> nth=0');
    if (id === 'hearth_expeditions') {
      // Collect the returned expedition (a Weaver frees up), then send it out again on tier 4.
      await page.click('.hx-card .mn-btn.gold >> text=Collect');
      await page.click('.hx-chip >> text=Tier 4');
    }
    await page.waitForTimeout(id === 'hearth_buildings' ? 250 : 150);
  } else if (id === 'hearth_hud') {
    await page.evaluate(() => {
      const ui = window.__runeloom!.ui!;
      ui.hold(true);
      ui.events([
        { type: 'buildingUpgraded', building: 'kindling_pit', level: 7 },
        { type: 'expeditionReturned', uid: 1, tier: 2 },
        { type: 'autoSalvaged', base: 'wool_hood', rarity: 'normal', scrap: 2, x: 0, y: 0 },
        { type: 'autoSalvaged', base: 'wool_hood', rarity: 'magic', scrap: 3, x: 0, y: 0 },
        { type: 'mutationBought', mutation: 'bright_hearth', count: 3 },
        { type: 'lootPicked', content: { kind: 'embers', amount: 8 } },
        { type: 'hearthLit', embers: 150 },
      ]);
    });
    await page.waitForTimeout(500);
  } else if (id === 'hearth_away') {
    await page.evaluate(() => {
      const ui = window.__runeloom!.ui!;
      ui.flow.offline.value = { seconds: 8 * 3600, scrap: 214, runeXp: 5120, runeLevels: 3, expeditionsReturned: 2 };
      window.__runeloom!.loop.paused = true;
    });
    await page.waitForTimeout(500);
  } else if (id === 'inventory') {
    await page.hover('.inv-grid .inv-card >> nth=2');
  } else if (id === 'fuse') {
    await page.click('.inv-socket.full');
  } else if (id === 'tree') {
    const box = await page.locator('.tr-node.available >> nth=0').boundingBox();
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  } else if (id === 'hud') {
    await page.evaluate(() => {
      const ui = window.__runeloom!.ui!;
      const s = window.__runeloom!.session.state;
      ui.hold(true);
      const item = {
        uid: 900,
        base: 'wool_cloak',
        rarity: 'magic',
        itemLevel: 6,
        affixes: [{ id: 'life', tier: 1, value: 30 }],
        fused: [],
      };
      ui.events([
        { type: 'roomEnter', id: s.room.id, name: s.room.name, level: s.room.level },
        {
          type: 'lootPicked',
          content: { kind: 'rune', rune: { uid: 901, rune: 'lob', level: 1, xp: 0, quality: 0 } },
        },
        { type: 'lootPicked', content: { kind: 'item', item } },
        { type: 'lootPicked', content: { kind: 'part', part: { uid: 902, part: 'ember_feather', tier: 2 } } },
        { type: 'lootPicked', content: { kind: 'scrap', amount: 3 } },
        { type: 'chestOpened', dungeon: 'kiln', big: false, count: 1 },
        { type: 'pickup', kind: 'heart_seed', total: 1 },
        { type: 'levelUp', level: 7 },
      ]);
    });
    await page.waitForTimeout(500);
  } else if (id === 'death') {
    await page.evaluate(() => {
      const s = window.__runeloom!.session;
      const p = s.state.player;
      p.life = 0;
      p.dead = true;
      p.respawnLeft = 2;
    });
    await page.waitForTimeout(700);
  } else if (id === 'craft') {
    // A few real items and currencies, then a Loom Shuttle on a Normal hood: the new Rare's
    // affixes show with their tiers, marked as new.
    await page.evaluate(() => {
      const s = window.__runeloom!.session.state;
      const h = s.hero;
      const add = (it: Record<string, unknown>) =>
        h.items.push({ uid: h.nextUid++, fused: [], ...it } as never);
      add({ base: 'wool_hood', rarity: 'normal', itemLevel: 9, affixes: [] });
      add({
        base: 'travelers_cloak',
        rarity: 'rare',
        name: 'Cinder Shroud',
        itemLevel: 8,
        affixes: [
          { id: 'life_flat', tier: 1, value: 27 },
          { id: 'fire_resist', tier: 2, value: 14 },
          { id: 'mana_regen', tier: 3, value: 1 },
        ],
      });
      add({
        base: 'bone_charm',
        rarity: 'magic',
        itemLevel: 6,
        affixes: [{ id: 'elemental_damage', tier: 2, value: 9 }],
      });
      add({ base: 'wool_hood', rarity: 'unique', unique: 'pyre_hood', itemLevel: 6, affixes: [] });
      h.currency = {
        weavers_knot: 4,
        spool_of_change: 7,
        loom_shuttle: 2,
        chaos_skein: 1,
        unpick: 1,
        rune_polish: 3,
      };
      window.__runeloom!.ui!.open('craft');
    });
    await settle(page);
    await page.click('.cr-cur >> text=Loom Shuttle');
    await page.click('.cr-targets .inv-card >> text=Wool Hood');
    await page.click('.cr-use .mn-btn');
    await page.waitForTimeout(300);
  } else if (id === 'filter') {
    await page.evaluate(() => window.__runeloom!.ui!.open('filter'));
    await settle(page);
    await page.click('.lf-presets .mn-btn >> text=Hide plain gear');
    await page.waitForTimeout(2500); // the preset's note fades
  } else if (id === 'filter_floor') {
    // Six drops around the player under "Hide plain gear": the Normal hood is gone, the Rare
    // cloak, the unique and the Golden Needle stand in beams, the rest show plainly.
    await page.evaluate(async () => {
      const store = await import('/src/app/lootFilterStore.ts' as string);
      const { lootFilterPresets } = await import('/src/sim/items/lootFilter.ts' as string);
      store.setLootFilter(
        lootFilterPresets.find((p: { name: string }) => p.name === 'Hide plain gear').filter,
      );
      const s = window.__runeloom!.session.state;
      const p = s.player;
      const it = (base: string, rarity: string, extra = {}) => ({
        kind: 'item',
        item: { uid: 0, base, rarity, itemLevel: 5, affixes: [], fused: [], ...extra },
      });
      const drops = [
        it('wool_hood', 'normal'),
        it('travelers_cloak', 'rare', { name: 'Cinder Shroud' }),
        it('bone_charm', 'magic'),
        it('wool_hood', 'unique', { unique: 'pyre_hood' }),
        { kind: 'currency', currency: 'golden_needle', amount: 1 },
        { kind: 'currency', currency: 'weavers_knot', amount: 1 },
      ];
      drops.forEach((content, i) =>
        s.loot.push({
          id: 9000 + i,
          x: p.x - 10 + (i % 3) * 10,
          y: p.y - 7 + Math.floor(i / 3) * 12,
          content,
          age: 5,
        } as never),
      );
    });
    await page.waitForTimeout(600);
  } else if (id === 'volatile') {
    // A Volatile Rare dies beside the player; 0.6 s into its 1 s fuse the blast telegraph fills.
    await page.evaluate(async () => {
      const { spawnEnemy } = await import('/src/sim/actors/enemies.ts' as string);
      const { killEnemy } = await import('/src/sim/combat/hits.ts' as string);
      const session = window.__runeloom!.session;
      const s = session.state;
      s.cheats.noAI = true;
      const e = spawnEnemy(s, 'shieldbearer', s.player.x + 8, s.player.y + 1, {
        rarity: 'rare',
        mods: ['volatile'],
      });
      killEnemy(s, e, 0, 'hit');
      for (let i = 0; i < 36; i++)
        session.step({ moveX: 0, moveY: 0, aimX: s.player.x + 1, aimY: s.player.y, buttons: 0 });
    });
    await page.waitForTimeout(300);
  } else if (id.startsWith('rift')) {
    // A real game at E1's Loom Stone with three sigils; then the map's sigil list, or a rift
    // opened from it (its HUD plate, its map with a few rooms visited, a Live Wires pulse).
    await page.evaluate(async (shot) => {
      const { makeSigil } = await import('/src/sim/items/sigils.ts' as string);
      const { sendHeroEdit } = await import('/src/app/hero.ts' as string);
      const w = window.__runeloom!;
      const session = w.session;
      const s = session.state;
      const still = { moveX: 0, moveY: 0, aimX: s.player.x + 1, aimY: s.player.y, buttons: 0 };
      session.step(still);
      const h = s.hero;
      h.riftTier = 3;
      h.level = 14;
      const add = (tier: number, mods: string[]) => {
        const g = makeSigil(h, tier, mods);
        h.sigils.push(g);
        return g.uid;
      };
      const wires = add(4, ['hardened', 'live_wires', 'floodplain']);
      add(2, []);
      add(6, ['brutal', 'teeming', 'drought', 'choking_smoke']);
      if (shot === 'rifts') {
        w.ui!.open('map');
        return;
      }
      sendHeroEdit(session, { kind: 'openRift', uid: wires });
      if (shot === 'rift_map') {
        for (const id of Object.keys(s.rooms)
          .filter((r) => r.startsWith('rift/0/'))
          .slice(0, 5))
          s.world.flags[id] = { visited: true, cleared: true, rewardsPaid: false, opened: [], taken: [] };
        w.ui!.open('map');
        return;
      }
      if (shot === 'rift_boss') {
        // The boss arena, 3 s into the fight (god mode): the Rift Matriarch or Warden drawn.
        s.world.pending = { roomId: 'rift/0/boss', arrival: { kind: 'edge', from: 'n' }, reason: 'exit' };
        session.step(still);
        s.cheats.god = true;
        for (let i = 0; i < 180; i++) session.step(still);
        w.ui!.open('play');
        return;
      }
      s.cheats.noAI = true;
      if (shot === 'rift_wires' || shot === 'rift_wires_warn') {
        // The first room past the entry with a pylon, the player beside one, 4 s of play.
        s.world.pending = { roomId: 'rift/0/r1', arrival: { kind: 'default' }, reason: 'exit' };
        session.step(still);
        s.cheats.god = true;
        for (let i = 0; i < 300; i++) {
          session.step(still);
          if (s.events.some((e) => e.type === 'pylonPulse')) break;
        }
        if (shot === 'rift_wires_warn') {
          // 0.8 s before the next pulse, then play live so the warning glow animates.
          for (let i = 0; i < 4 * 60 - 48; i++) session.step(still);
          w.ui!.open('play');
          w.loop.paused = false;
          return;
        }
      }
      w.ui!.open('play');
    }, id);
    await page.waitForTimeout(id === 'rift_wires' ? 120 : id === 'rift_wires_warn' ? 450 : 400);
  } else if (id === 'hud_twin' || id === 'loom_twin') {
    // The hero with the Twin Threads mutation: the fifth slot (R) shows in the HUD and the Loom,
    // holding a Pulse Nova made from three runes given here.
    await page.evaluate(async (shot) => {
      const { refreshHero } = await import('/src/sim/hero/hero.ts' as string);
      const { applyWeave } = await import('/src/ui/loom/loadoutStore.ts' as string);
      const w = window.__runeloom!;
      const s = w.session.state;
      const { makeRune } = await import('/src/sim/items/items.ts' as string);
      s.hero.hearth.mutations.twin_threads = 1;
      for (const r of ['pulse', 'nova', 'fire']) s.hero.runes.push(makeRune(s.hero, r, 2));
      refreshHero(s);
      applyWeave(w.session, 4, 'Pulse > Nova[Fire]');
      w.ui!.open(shot === 'loom_twin' ? 'loom' : 'play');
    }, id);
    await page.waitForTimeout(300);
  } else if (id === 'loom') {
    // Strike's only copy sits in RMB: arming it shows why it can't go anywhere.
    await page.click('.lm-pouch .lm-chip.r-strike');
  }
  await settle(page);
}
