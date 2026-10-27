/**
 * Screenshots of the second weave bar (playtest 8) for `npm run shots -- --set ui`: the HUD on
 * bar 1 and on bar 2 with weaves on both bars, the swap animation just after X, and the Loom
 * editing a bar-2 slot. The hero is the
 * fixture adventure hero plus the runes the bar-2 weaves need; bar 2 shares bar 1's Cast, Bolt and
 * Fire items, as the shared rune pouch allows.
 */
import type { Page } from '@playwright/test';

export const barShotIds = ['hud_bars', 'hud_bars2', 'hud_swap', 'loom_bars'] as const;
export type BarShotId = (typeof barShotIds)[number];

export function isBarShot(id: string): id is BarShotId {
  return (barShotIds as readonly string[]).includes(id);
}

export async function runBarShot(page: Page, id: BarShotId): Promise<void> {
  await page.evaluate(async (shot) => {
    const { refreshHero } = await import('/src/sim/hero/hero.ts' as string);
    const { applyWeave } = await import('/src/ui/loom/loadoutStore.ts' as string);
    const { makeRune } = await import('/src/sim/items/items.ts' as string);
    const { swapBar } = await import('/src/sim/weave/runtime/bars.ts' as string);
    const w = window.__runeloom!;
    const s = w.session.state;
    for (const r of ['lob', 'nova', 'frost', 'pulse', 'storm', 'on_dodge']) s.hero.runes.push(makeRune(s.hero, r, 3));
    refreshHero(s);
    applyWeave(w.session, 2, 'OnDodge > Nova[Frost]');
    applyWeave(w.session, 5, 'Cast > Lob[Fire]');
    applyWeave(w.session, 6, 'Cast > Nova[Frost]');
    applyWeave(w.session, 7, 'Pulse > Bolt[Storm]');
    if (shot !== 'hud_bars') swapBar(s);
    w.ui!.open(shot === 'loom_bars' ? 'loom' : 'play');
  }, id);
  if (id === 'loom_bars') await page.click('#lm-tab-5');
  await page.waitForTimeout(300);
  // hud_swap: the swap-in animation of the slot row, caught a few frames in.
  if (id === 'hud_swap') {
    await page.evaluate(() => window.__runeloom!.ui!.events([{ type: 'barSwap', bar: 1 } as never]));
    await page.waitForTimeout(40);
  }
}
