/**
 * Crafting bench screenshots for `npm run shots -- --set ui`: a real hero with gear of every
 * rarity and slot, a wallet, then the bench in three states: a Loom Shuttle used on a Normal hood
 * (craft), a Chaos Skein picked with the unusable items dimmed (craft_select), and a Chaos Skein
 * used on a Rare through its confirmation, with the before and after (craft_result), the Runes
 * tab with Rune Polish used once (craft_runes) and the confirmation itself (craft_confirm) and an empty stack at the lit Hearth with the way to the
 * Spindlewright (craft_hearth).
 */
import type { Page } from '@playwright/test';

export const craftShotIds = ['craft', 'craft_select', 'craft_result', 'craft_runes', 'craft_confirm', 'craft_hearth'] as const;
export type CraftShotId = (typeof craftShotIds)[number];

const settle = (page: Page) =>
  page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

export async function runCraftShot(page: Page, id: CraftShotId): Promise<void> {
  await page.evaluate(async (shot) => {
    const w = window.__runeloom!;
    const h = w.session.state.hero;
    const add = (it: Record<string, unknown>) => {
      const uid = h.nextUid++;
      h.items.push({ uid, fused: [], ...it } as never);
      return uid;
    };
    add({ base: 'wool_hood', rarity: 'normal', itemLevel: 9, affixes: [] });
    const cloak = add({
      base: 'travelers_cloak',
      rarity: 'rare',
      name: 'Cinder Shroud',
      itemLevel: 12,
      affixes: [
        { id: 'life_flat', tier: 5, value: 27 },
        { id: 'fire_resist', tier: 5, value: 14 },
        { id: 'mana_regen', tier: 6, value: 1 },
        { id: 'chill_effect', tier: 6, value: 11 },
      ],
    });
    add({
      base: 'bone_charm',
      rarity: 'magic',
      itemLevel: 6,
      affixes: [{ id: 'elemental_damage', tier: 5, value: 9 }],
    });
    add({ base: 'wool_hood', rarity: 'unique', unique: 'pyre_hood', itemLevel: 6, affixes: [] });
    add({
      base: 'leather_boots',
      rarity: 'rare',
      name: 'Gloam Tread',
      itemLevel: 9,
      affixes: [
        { id: 'move_speed', tier: 5, value: 8 },
        { id: 'frost_resist', tier: 6, value: 9 },
        { id: 'storm_resist', tier: 6, value: 7 },
        { id: 'life_inc', tier: 6, value: 5 },
      ],
    });
    add({ base: 'bone_charm', rarity: 'normal', itemLevel: 4, affixes: [] });
    add({ base: 'travelers_cloak', rarity: 'magic', itemLevel: 8, affixes: [{ id: 'fire_resist', tier: 5, value: 12 }] });
    h.equipped.cloak = cloak;
    h.currency = { weavers_knot: 4, spool_of_change: 7, loom_shuttle: 2, chaos_skein: 3, unpick: 1, rune_polish: 3 };
    h.threadScrap = 38;
    if (shot === 'craft_hearth') {
      // Standing in the lit Hearth's hub: the bench offers the Spindlewright for a stack that ran out.
      const { hearthRoom } = await import('/data/hearth.ts' as string);
      const { hearthUnlocked } = await import('/src/ui/hearth/hearthSignals.ts' as string);
      const s = w.session.state;
      h.hearth.lit = true;
      h.threadScrap = 60;
      hearthUnlocked.value = true;
      s.world.pending = { roomId: hearthRoom, arrival: { kind: 'default' }, reason: 'exit' } as never;
      w.session.step({ moveX: 0, moveY: 0, aimX: s.player.x + 1, aimY: s.player.y, buttons: 0 });
    }
    w.ui!.open('craft');
  }, id);
  await settle(page);
  const cur = (name: string) => page.click(`.cr-cur >> text=${name}`);
  const item = (name: string) => page.click(`.cr-item >> text=${name}`);
  if (id === 'craft') {
    await cur('Loom Shuttle');
    await item('Wool Hood');
  } else if (id === 'craft_select') {
    await cur('Chaos Skein');
  } else if (id === 'craft_runes') {
    await cur('Rune Polish');
    await page.click('.cr-item >> nth=1');
  } else if (id === 'craft_hearth') {
    await cur('Golden Needle');
  } else if (id === 'craft_confirm') {
    await cur('Chaos Skein');
    await item('Cinder Shroud');
  } else {
    await cur('Chaos Skein');
    await item('Cinder Shroud');
    await page.click('.mn-dialog .mn-btn.gold'); // the Rare asks first
  }
  await page.mouse.move(2, 2); // no tooltip over the picture
  await page.waitForTimeout(350);
}
