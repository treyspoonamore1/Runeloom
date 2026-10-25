import { beforeEach, describe, expect, it } from 'vitest';
import { Session } from '../../../src/app/session';
import { findScene } from '../../../src/app/scenes';
import { craftTarget } from '../../../src/ui/craft/craftScreen';
import { heroOf } from '../../../src/ui/heroAdapter';
import { menuNote, menuTip } from '../../../src/ui/menus/frame';
import { makeItem, makePart } from '../../../src/sim/items/items';
import type { AffixRoll, Item, ItemRarity } from '../../../src/sim/hero/types';
import { sendToBench } from '../../../src/ui/inventory/bagItems';
import {
  askBulkSalvage,
  bulkSalvage,
  equip,
  invDialog,
  previewUid,
  quickSalvage,
  salvage,
  toggleLock,
} from '../../../src/ui/inventory/slots';
import { scrapValues } from '../../../data/loot';

let session: Session;
const hero = () => heroOf(session) as ReturnType<typeof heroOf> & { items: Item[] };

function give(base: string, rarity: ItemRarity, affixes: AffixRoll[] = []): Item {
  const it = makeItem(hero(), base, rarity, 6, affixes);
  hero().items.push(it);
  return it;
}
const has = (it: Item) => hero().items.some((i) => i.uid === it.uid);
const note = () => menuNote.value?.text ?? '';

beforeEach(() => {
  const scene = findScene('adventure')!;
  session = new Session({ seed: 3, roomId: scene.roomId, sceneId: scene.id, mode: scene.mode });
  invDialog.value = null;
  menuNote.value = null;
});

describe('shift-click salvage', () => {
  it('salvages Normal and Magic items at once and shows the Scrap in a toast', () => {
    const before = hero().threadScrap;
    const a = give('wool_hood', 'normal');
    const b = give('wool_hood', 'magic', [{ id: 'life_flat', tier: 6, value: 8 }]);
    quickSalvage(session, a);
    expect(has(a)).toBe(false);
    expect(note()).toContain(`+${scrapValues.item.normal} Thread Scrap`);
    quickSalvage(session, b);
    expect(has(b)).toBe(false);
    expect(note()).toContain(`+${scrapValues.item.magic} Thread Scrap`);
    expect(hero().threadScrap).toBe(before + scrapValues.item.normal + scrapValues.item.magic);
    expect(invDialog.value).toBeNull();
  });

  it('asks first for Rare and Unique items', () => {
    const rare = give('wool_hood', 'rare');
    quickSalvage(session, rare);
    expect(has(rare)).toBe(true);
    expect(invDialog.value).toMatchObject({ kind: 'salvage', uid: rare.uid, value: scrapValues.item.rare });
    const unique = give('wool_hood', 'unique');
    quickSalvage(session, unique);
    expect(invDialog.value).toMatchObject({ kind: 'salvage', uid: unique.uid });
    // Confirming salvages and says how much Scrap it gave.
    salvage(session, rare.uid);
    expect(has(rare)).toBe(false);
    expect(note()).toContain(`+${scrapValues.item.rare} Thread Scrap`);
    expect(invDialog.value).toBeNull();
  });

  it('leaves a kept item alone and says why', () => {
    const it = give('wool_hood', 'normal');
    toggleLock(session, it);
    quickSalvage(session, it);
    expect(has(it)).toBe(true);
    expect(note()).toMatch(/unlock/i);
  });

  it('leaves a spindle with fused parts alone', () => {
    const sp = give('ashwood', 'normal');
    sp.fused[0] = makePart(hero(), 'ember_feather', 1);
    quickSalvage(session, sp);
    expect(has(sp)).toBe(true);
    expect(note()).toMatch(/unfuse/i);
  });

  it('salvages a Fuse part at once', () => {
    const p = makePart(hero(), 'ember_feather', 2);
    hero().parts.push(p);
    quickSalvage(session, p);
    expect(hero().parts.some((x) => x.uid === p.uid)).toBe(false);
    expect(note()).toContain(`+${scrapValues.part[1]} Thread Scrap`);
  });
});

describe('keep (lock)', () => {
  it('toggles through a recorded hero edit and the sim refuses to salvage it', () => {
    const it = give('wool_hood', 'normal');
    const edits = session.heroEdits.length;
    toggleLock(session, it);
    expect(it.locked).toBe(true);
    expect(session.heroEdits).toHaveLength(edits + 1);
    expect(session.heroEdits.at(-1)!.edit).toEqual({ kind: 'lock', uid: it.uid, locked: true });
    expect(note()).toMatch(/kept/i);
    toggleLock(session, it);
    expect(it.locked).toBeUndefined();
    expect(session.heroEdits.at(-1)!.edit).toEqual({ kind: 'lock', uid: it.uid, locked: false });
  });
});

describe('bulk salvage', () => {
  function bag() {
    const n1 = give('wool_hood', 'normal');
    const n2 = give('bone_charm', 'normal');
    const m1 = give('travelers_cloak', 'magic', [{ id: 'life_flat', tier: 6, value: 8 }]);
    const kept = give('wool_hood', 'normal');
    toggleLock(session, kept);
    const rare = give('leather_boots', 'rare');
    const uniq = give('wool_hood', 'unique');
    const worn = give('wool_hood', 'normal');
    equip(session, worn);
    return { n1, n2, m1, kept, rare, uniq, worn };
  }

  it('opens on the first preset that takes something, and lists what each takes', () => {
    bag();
    askBulkSalvage(hero());
    expect(invDialog.value).toEqual({ kind: 'bulk', preset: 'normal' });
  });

  it('says so when there is nothing to salvage', () => {
    askBulkSalvage(hero());
    expect(invDialog.value).toBeNull();
    expect(note()).toMatch(/nothing to salvage/i);
  });

  it('salvages the listed items, never worn, kept, unique or rare ones, and shows the total', () => {
    const b = bag();
    const before = hero().threadScrap;
    bulkSalvage(session, [b.n1.uid, b.n2.uid, b.m1.uid]);
    expect([b.n1, b.n2, b.m1].some(has)).toBe(false);
    expect([b.kept, b.rare, b.uniq, b.worn].every(has)).toBe(true);
    const gained = 2 * scrapValues.item.normal + scrapValues.item.magic;
    expect(hero().threadScrap).toBe(before + gained);
    expect(note()).toContain(`Salvaged 3 items: +${gained} Thread Scrap`);
    expect(invDialog.value).toBeNull();
  });

  it('the sim refuses a locked item even if the list names it', () => {
    const b = bag();
    bulkSalvage(session, [b.kept.uid]);
    expect(has(b.kept)).toBe(true);
    expect(note()).toContain('Salvaged 0 items');
  });
});

describe('equip and the bench', () => {
  it('right-click and click equip through the same function: a charm takes the empty slot, then the weaker', () => {
    const weak = give('bone_charm', 'magic', [{ id: 'life_flat', tier: 6, value: 5 }]);
    const strong = give('bone_charm', 'magic', [{ id: 'life_flat', tier: 6, value: 30 }]);
    const third = give('bone_charm', 'magic', [{ id: 'life_flat', tier: 6, value: 12 }]);
    equip(session, weak);
    expect(hero().equipped.charm1).toBe(weak.uid);
    equip(session, strong);
    expect(hero().equipped.charm2).toBe(strong.uid);
    equip(session, third);
    // Both slots full: the new charm replaces the weaker one.
    expect(hero().equipped.charm1).toBe(third.uid);
    expect(hero().equipped.charm2).toBe(strong.uid);
  });

  it('clears the tooltip and the sheet preview once an item leaves the bag', () => {
    const it = give('wool_hood', 'normal');
    previewUid.value = it.uid;
    menuTip.value = { at: { x: 0, y: 0, w: 1, h: 1 }, body: () => null as never };
    equip(session, it);
    expect(previewUid.value).toBeNull();
    expect(menuTip.value).toBeNull();
  });

  it('Ctrl-click sets the craft target and switches to the craft tab', () => {
    const it = give('wool_hood', 'normal');
    let tab = '';
    sendToBench(it, (id) => (tab = id));
    expect(craftTarget.value).toBe(it.uid);
    expect(tab).toBe('craft');
  });
});
