import { expect, test, type Page } from '@playwright/test';
import { upgradeCost } from '../../src/sim/meta/view';

/** M7 smoke test: light the Hearth, build two buildings at their stations, send an expedition, apply offline time. */

async function command(page: Page, text: string): Promise<void> {
  await page.keyboard.press('Backquote');
  await page.waitForTimeout(300);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.keyboard.press('Backquote');
  await page.waitForTimeout(300);
}

/** Puts the player just below the station's tile and presses Interact; the Hearth menu should open. */
async function useStation(page: Page, station: string): Promise<void> {
  await page.evaluate((kind) => {
    const s = window.__runeloom!.session.state;
    const o = s.objects.find((x) => x.kind === kind);
    if (!o) throw new Error(`no ${kind} in the hub`);
    s.player.x = (o.tx + 0.5) * 4;
    s.player.y = (o.ty + 1) * 4 + 1;
  }, station);
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyF');
}

const hearth = (page: Page) =>
  page.evaluate(() => {
    const s = window.__runeloom!.session.state;
    return { ...s.hero.hearth, room: s.room.id, paused: window.__runeloom!.loop.paused };
  });

test('the Hearth: build, send an expedition, offline progress', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });

  await page.goto('/?scene=adventure&seed=1');
  await page.waitForFunction(() => window.__runeloom?.ready === true, undefined, { timeout: 60_000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  await command(page, 'hearth');
  await command(page, 'embers 5000');
  await expect.poll(async () => (await hearth(page)).room, { timeout: 20_000 }).toBe('hearth/hearth');
  expect((await hearth(page)).embers).toBe(5000);
  await expect(page.locator('.ad-embers')).toBeVisible();
  await expect(page.locator('.ad-embers')).toHaveAttribute('aria-label', /Embers: 5000/);

  // Kindling Pit: opens the Hearth menu on Buildings; Build takes Embers and sets level 1.
  await useStation(page, 'kindling_pit');
  const menu = page.locator('.hx');
  await expect(menu).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.hx-tab[aria-selected="true"]')).toContainText('Buildings');
  const pit = page.locator('.hx-card[aria-label="Kindling Pit"]');
  await expect(pit).toBeVisible();
  await pit.getByRole('button', { name: /Build/ }).click();
  await expect.poll(async () => (await hearth(page)).buildings.kindling_pit).toBe(1);
  const afterPit = await hearth(page);
  expect(afterPit.embers).toBeLessThan(5000);
  expect(afterPit.embers).toBe(5000 - upgradeCost('kindling_pit', 0));
  await expect(pit.locator('.hx-lv')).toContainText('Lv 1');

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0, { timeout: 20_000 });
  expect((await hearth(page)).paused).toBe(false);

  // Expedition Board: build it, send a tier 1 Weaver.
  await useStation(page, 'expedition_board');
  await expect(menu).toBeVisible({ timeout: 20_000 });
  await page.locator('.hx-tab', { hasText: 'Buildings' }).click();
  const board = page.locator('.hx-card[aria-label="Expedition Board"]');
  await board.getByRole('button', { name: /Build/ }).click();
  await expect.poll(async () => (await hearth(page)).buildings.expedition_board).toBe(1);
  await page.locator('.hx-tab', { hasText: 'Expedition' }).click();
  await page.getByRole('button', { name: /^Tier 1/ }).click();
  await expect.poll(async () => (await hearth(page)).expeditions.length).toBe(1);
  await expect(page.locator('.hx-card[aria-label="Tier 1 expedition"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0, { timeout: 20_000 });

  // Offline progress: one hour takes time off the expedition.
  const before = (await hearth(page)).expeditions[0]!;
  await command(page, 'offline 1');
  await expect
    .poll(async () => (await hearth(page)).expeditions[0]?.left ?? 0, { timeout: 20_000 })
    .toBeLessThan(before.left);

  expect(problems).toEqual([]);
});
