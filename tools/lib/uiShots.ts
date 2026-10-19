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
] as const;
export type UiShotId = (typeof uiShotIds)[number];

const ADV = 'scene=adventure&fixture=1&paused=1&seed=1';

export function uiShotUrl(base: string, id: UiShotId): string {
  if (id === 'title' || id === 'title_load') return `${base}/?fixture=1&seed=1`;
  if (id === 'hud') return `${base}/?${ADV}&ui=play&boss=cinder_warden`;
  if (id === 'death') return `${base}/?${ADV}&ui=play`;
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
        { type: 'roomEnter', roomId: s.room.id },
        {
          type: 'lootPicked',
          content: { kind: 'rune', rune: { uid: 901, rune: 'lob', level: 1, xp: 0, quality: 0 } },
        },
        { type: 'lootPicked', content: { kind: 'item', item } },
        { type: 'lootPicked', content: { kind: 'part', part: { uid: 902, part: 'ember_feather', tier: 2 } } },
        { type: 'lootPicked', content: { kind: 'scrap', amount: 3 } },
        { type: 'keyPicked', dungeon: 'kiln' },
        { type: 'heartSeedTaken' },
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
  } else if (id === 'loom') {
    // Strike's only copy sits in RMB: arming it shows why it can't go anywhere.
    await page.click('.lm-pouch .lm-chip.r-strike');
  }
  await settle(page);
}
