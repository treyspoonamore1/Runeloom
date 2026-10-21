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
] as const;
export type UiShotId = (typeof uiShotIds)[number];

const ADV = 'scene=adventure&fixture=1&paused=1&seed=1';

export function uiShotUrl(base: string, id: UiShotId): string {
  if (id === 'title' || id === 'title_load') return `${base}/?fixture=1&seed=1`;
  if (id === 'hud') return `${base}/?${ADV}&ui=play&boss=cinder_warden`;
  if (id === 'death') return `${base}/?${ADV}&ui=play`;
  if (id === 'pause') return `${base}/?${ADV}&ui=pause`;
  // The bench crafts with the real sim, so it runs on a real hero (fixture bases aren't real items).
  if (id === 'craft' || id === 'filter' || id === 'filter_floor')
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
  } else if (id === 'loom') {
    // Strike's only copy sits in RMB: arming it shows why it can't go anywhere.
    await page.click('.lm-pouch .lm-chip.r-strike');
  }
  await settle(page);
}
