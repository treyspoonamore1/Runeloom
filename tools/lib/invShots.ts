/**
 * Inventory screenshots (M7.5) for `npm run shots -- --set ui --shot inventory_bag,...`. They run
 * on a real game (not the fixtures): a level 12 hero with gear rolled by the loot code from the
 * seed, so item names, affix tiers and the upgrade arrows are the real ones.
 */
import type { Page } from '@playwright/test';

export const invShotIds = [
  'inventory_bag',
  'inventory_compare',
  'inventory_salvage',
  'inventory_parts',
  'inventory_runes',
  'inventory_empty',
] as const;
export type InvShotId = (typeof invShotIds)[number];

export const isInvShot = (id: string): id is InvShotId => (invShotIds as readonly string[]).includes(id);

/** Gives the hero a full bag, some worn gear, kept items, Fuse parts and currency, then opens the inventory. */
async function seedBag(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { rollGear, rollSpindle } = await import('/src/sim/items/drops.ts' as string);
    const { makeUnique } = await import('/src/sim/items/uniqueItems.ts' as string);
    const { makePart } = await import('/src/sim/items/items.ts' as string);
    const { refreshHero } = await import('/src/sim/hero/hero.ts' as string);
    const { sendHeroEdit } = await import('/src/app/hero.ts' as string);
    const { heroRev } = await import('/src/ui/heroAdapter.ts' as string);
    const w = window.__runeloom!;
    const s = w.session.state;
    const h = s.hero;
    h.level = 12;
    const weights = { normal: 3, magic: 5, rare: 2 };
    const add = (it: unknown) => {
      h.items.push(it as never);
      return it as { uid: number; base: string; rarity: string; fused: unknown[] };
    };
    const spindles = [5, 8, 12].map((lv) => add(rollSpindle(s, lv, weights)));
    const gear = Array.from({ length: 30 }, (_, i) => add(rollGear(s, 3 + (i % 10), weights)));
    gear.push(add(makeUnique(h, 'pyre_hood', 8)));
    gear.push(add(makeUnique(h, 'rimewalkers', 9)));
    // Wear one of each kind, a charm in both slots; keep two items; fuse a part.
    const slotOf = (base: string) =>
      base.includes('cloak')
        ? 'cloak'
        : base.includes('hood')
          ? 'hood'
          : base.includes('boots')
            ? 'boots'
            : 'charm1';
    const worn = new Set<string>();
    for (const it of gear) {
      let slot = slotOf(it.base);
      if (slot === 'charm1' && worn.has('charm1')) slot = 'charm2';
      if (worn.has(slot) || it.rarity === 'unique') continue;
      worn.add(slot);
      sendHeroEdit(w.session, { kind: 'equip', uid: it.uid, slot });
    }
    sendHeroEdit(w.session, { kind: 'equip', uid: spindles[0]!.uid, slot: 'spindle' });
    const unworn = h.items.filter((i: { uid: number }) => !Object.values(h.equipped).includes(i.uid));
    for (const it of [unworn[3], unworn[11]])
      if (it) sendHeroEdit(w.session, { kind: 'lock', uid: it.uid, locked: true });
    for (const [part, tier] of [
      ['ember_feather', 1],
      ['ember_feather', 1],
      ['kiln_chitin', 2],
      ['shield_plate', 1],
      ['tinder_tooth', 3],
    ] as const)
      h.parts.push(makePart(h, part, tier));
    const sp = h.items.find((i: { uid: number }) => i.uid === h.equipped.spindle);
    if (sp && sp.fused.length > 0)
      sendHeroEdit(w.session, { kind: 'fuse', partUid: h.parts[2]!.uid, spindleUid: sp.uid, socket: 0 });
    h.threadScrap = 148;
    h.currency = { weavers_knot: 4, spool_of_change: 7, loom_shuttle: 2, chaos_skein: 1, golden_needle: 1 };
    refreshHero(s);
    heroRev.value++;
    w.ui!.open('inventory');
  });
}

export async function runInvShot(page: Page, id: InvShotId): Promise<void> {
  if (id === 'inventory_empty') {
    await page.evaluate(() => window.__runeloom!.ui!.open('inventory'));
    await page.waitForTimeout(400);
    return;
  }
  await seedBag(page);
  await page.waitForTimeout(400);
  if (id === 'inventory_compare') {
    await page.hover('.inv-tile:has(.inv-arrow.up) >> nth=1');
  } else if (id === 'inventory_salvage') {
    await page.click('.inv-bulk');
  } else if (id === 'inventory_parts') {
    await page.click('.inv-tabs .mn-tab >> text=Fuse parts');
  } else if (id === 'inventory_runes') {
    await page.click('.inv-tabs .mn-tab >> text=Rune pouch');
  }
  await page.waitForTimeout(300);
}
