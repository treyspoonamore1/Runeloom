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
    const bag = page.locator('.inv-bag .inv-grid');
    await expect(bag).toContainText('Wool Hood');
    await page.click('.inv-bag .inv-card >> text=Wool Hood');
    await expect(bag).toHaveCount(0);
    await expect(page.locator('.inv-left')).toContainText('Wool Hood');
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
