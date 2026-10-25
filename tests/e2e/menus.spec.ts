import { expect, test, type Page } from '@playwright/test';

/**
 * Regression (M5): menus mutate the hero in place, and @preact/signals skips re-rendering children
 * whose props are shallowly equal, so the inventory bag and the crafting bench kept showing the
 * hero as it was before an edit. Screens now pass the hero revision down as a prop.
 */
async function adventureWith(page: Page): Promise<void> {
  await page.goto('/?scene=adventure&paused=1&seed=1&ui=play');
  await page.waitForFunction(() => window.__runeloom?.ready === true, undefined, { timeout: 60_000 });
  await page.evaluate(() => {
    const h = window.__runeloom!.session.state.hero;
    h.items.push({
      uid: h.nextUid++,
      base: 'wool_hood',
      rarity: 'normal',
      itemLevel: 9,
      affixes: [],
      fused: [],
    });
    h.currency = { loom_shuttle: 2 };
  });
}

test.describe('adventure menus re-render after an edit', () => {
  test('equipping from the bag removes the item from the bag', async ({ page }) => {
    await adventureWith(page);
    await page.evaluate(() => window.__runeloom!.ui!.open('inventory'));
    const tile = page.locator('.inv-bag .inv-tile[aria-label^="Wool Hood"]');
    await expect(tile).toHaveCount(1);
    await tile.click();
    await expect(tile).toHaveCount(0);
    await expect(page.locator('.inv-bag')).toContainText('No items yet');
    await expect(page.locator('.inv-left')).toContainText('Wool Hood');
  });

  test('right-click equips, shift-click salvages Normal gear at once, Ctrl-click opens the bench', async ({
    page,
  }) => {
    await adventureWith(page);
    await page.evaluate(() => {
      const h = window.__runeloom!.session.state.hero;
      for (const base of ['travelers_cloak', 'leather_boots'])
        h.items.push({ uid: h.nextUid++, base, rarity: 'normal', itemLevel: 4, affixes: [], fused: [] });
      window.__runeloom!.ui!.open('inventory');
    });
    const scrap = () => page.evaluate(() => window.__runeloom!.session.state.hero.threadScrap);
    const before = await scrap();
    await page.click('.inv-bag .inv-tile[aria-label^="Wool Hood"]', { button: 'right' });
    await expect(page.locator('.inv-left')).toContainText('Wool Hood');
    await page.click('.inv-bag .inv-tile[aria-label^="Traveler"]', { modifiers: ['Shift'] });
    await expect(page.locator('.inv-bag .inv-tile[aria-label^="Traveler"]')).toHaveCount(0);
    await expect(page.locator('.mn-note.ok')).toContainText('Thread Scrap');
    expect(await scrap()).toBeGreaterThan(before);
    await page.click('.inv-bag .inv-tile[aria-label^="Leather"]', { modifiers: ['Control'] });
    await expect(page.locator('.cr-cur').first()).toBeVisible();
    await expect(page.locator('.cr-targets .inv-card.cr-sel')).toContainText('Leather Boots');
  });

  test('the padlock keeps an item from bulk salvage, and the choice is saved', async ({ page }) => {
    await adventureWith(page);
    await page.evaluate(() => {
      const h = window.__runeloom!.session.state.hero;
      for (const base of ['travelers_cloak', 'leather_boots'])
        h.items.push({ uid: h.nextUid++, base, rarity: 'normal', itemLevel: 4, affixes: [], fused: [] });
      window.__runeloom!.ui!.open('inventory');
    });
    const cloak = page.locator('.inv-bag .inv-tile[aria-label^="Traveler"]');
    await cloak.focus();
    await page.keyboard.press('k');
    await expect(cloak).toHaveClass(/kept/);
    await page.click('.inv-bulk');
    await expect(page.locator('.mn-dialog')).toContainText('2 items');
    await page.click('.mn-dialog .mn-btn.danger');
    await expect(page.locator('.inv-tile')).toHaveCount(1);
    await expect(cloak).toHaveCount(1);
    // A sort choice survives a reload (browser storage).
    await page.selectOption('.inv-sel >> nth=0 >> select', 'newest');
    const saved = await page.evaluate(() => localStorage.getItem('runeloom.inventory.v1'));
    expect(JSON.parse(saved!).sort).toBe('newest');
  });

  test('a craft updates the wallet and the item list', async ({ page }) => {
    await adventureWith(page);
    await page.evaluate(() => window.__runeloom!.ui!.open('craft'));
    await page.click('.cr-cur >> text=Loom Shuttle');
    await expect(page.locator('.cr-cur.sel')).toContainText('×2');
    await page.click('.cr-targets .inv-card >> text=Wool Hood');
    await page.click('.cr-use .mn-btn');
    await expect(page.locator('.cr-cur.sel')).toContainText('×1');
    await expect(page.locator('.cr-targets .inv-card.r-rare')).toHaveCount(1);
    await expect(page.locator('.cr-lines .cr-new').first()).toBeVisible();
  });
});
