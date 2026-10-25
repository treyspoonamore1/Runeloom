import type { VNode } from 'preact';
import { beforeEach, describe, expect, it } from 'vitest';
import { Session } from '../../../src/app/session';
import { findScene } from '../../../src/app/scenes';
import { heroOf } from '../../../src/ui/heroAdapter';
import { makeItem, makePart } from '../../../src/sim/items/items';
import { describeItem } from '../../../src/sim/items/describe';
import type { AffixRoll, Item, ItemRarity } from '../../../src/sim/hero/types';
import { Arrow, Padlock, Pips } from '../../../src/ui/inventory/badges';
import { stackParts } from '../../../src/ui/inventory/bagOther';
import { ItemLines } from '../../../src/ui/inventory/itemLines';
import { ItemTip } from '../../../src/ui/inventory/tips';

type N = VNode<Record<string, unknown>>;
/** Every vnode under `v`, components called so their output is walked too. */
function walk(v: unknown, out: N[] = []): N[] {
  if (Array.isArray(v)) v.forEach((x) => walk(x, out));
  else if (v && typeof v === 'object' && 'props' in v) {
    const n = v as N;
    out.push(n);
    if (typeof n.type === 'function') walk((n.type as (p: unknown) => unknown)(n.props), out);
    else walk(n.props.children, out);
  }
  return out;
}
const text = (v: unknown): string => {
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(text).join('');
  if (v && typeof v === 'object' && 'props' in v) {
    const n = v as N;
    return text(
      typeof n.type === 'function' ? (n.type as (p: unknown) => unknown)(n.props) : n.props.children,
    );
  }
  return '';
};
const classes = (tree: unknown) => walk(tree).map((n) => String(n.props.class ?? ''));

let session: Session;
const give = (base: string, rarity: ItemRarity, affixes: AffixRoll[] = []): Item => {
  const it = makeItem(heroOf(session) as never, base, rarity, 6, affixes);
  (heroOf(session) as { items: Item[] }).items.push(it);
  return it;
};

beforeEach(() => {
  const scene = findScene('adventure')!;
  session = new Session({ seed: 3, roomId: scene.roomId, sceneId: scene.id, mode: scene.mode });
});

describe('item lines', () => {
  it('put the tier and the range in small text after each affix', () => {
    const it = give('travelers_cloak', 'magic', [{ id: 'life_flat', tier: 6, value: 8 }]);
    const tree = ItemLines({ item: it, lines: describeItem(it).lines });
    const li = walk(tree).filter((n) => n.type === 'li');
    expect(li).toHaveLength(1);
    expect(text(li[0])).toMatch(/^\+8 to maximum life\s?T6: \d+–\d+$/);
    expect(classes(tree)).toContain('tl-tier');
  });

  it('say there are no modifiers on a plain item', () => {
    const it = give('wool_hood', 'normal');
    expect(text(ItemLines({ item: it, lines: [] }))).toBe('No modifiers.');
  });
});

describe('badges', () => {
  it('draw an arrow only when there is something to say', () => {
    expect(Arrow({ verdict: 'same' })).toBeNull();
    expect(classes(Arrow({ verdict: 'up' }))).toContain('inv-arrow up');
    expect(classes(Arrow({ verdict: 'down' }))).toContain('inv-arrow down');
  });

  it('show one pip per Fuse socket, filled when a part is in it', () => {
    expect(Pips({ sockets: [] })).toBeNull();
    const tree = Pips({ sockets: [true, false] });
    expect(
      walk(tree)
        .filter((n) => n.type === 'i')
        .map((n) => n.props.class),
    ).toEqual(['on', '']);
    expect(Padlock({ locked: true })).not.toEqual(Padlock({ locked: false }));
  });
});

describe('compare tooltip', () => {
  it('shows the bag item and the worn one side by side with a change table and the verdict', () => {
    const worn = give('travelers_cloak', 'magic', [{ id: 'life_flat', tier: 6, value: 6 }]);
    session.state.hero.equipped.cloak = worn.uid;
    const better = give('travelers_cloak', 'magic', [{ id: 'life_flat', tier: 6, value: 10 }]);
    const withLife = give('travelers_cloak', 'rare', [
      { id: 'life_flat', tier: 4, value: 60 },
      { id: 'fire_resist', tier: 6, value: 9 },
    ]);
    void better;
    const tree = ItemTip({ session, item: withLife, equipped: false });
    const cl = classes(tree);
    expect(cl.filter((c) => c.startsWith('tc-card'))).toHaveLength(2);
    const t = text(tree);
    expect(t).toContain('In bag');
    expect(t).toContain('Equipped · Cloak');
    expect(t).toContain('Upgrade');
    // Rows read "now → after" and the change.
    expect(t).toMatch(/Maximum life.*→.*\+54/);
    expect(t).toMatch(/Fire resistance.*0% → 9%.*\+9%/);
  });

  it('says the slot is empty when nothing is worn there', () => {
    const hood = give('wool_hood', 'magic', [{ id: 'life_flat', tier: 6, value: 10 }]);
    expect(text(ItemTip({ session, item: hood, equipped: false }))).toContain('Nothing in your Hood slot.');
  });

  it('an equipped item gets one card, no compare', () => {
    const it = give('travelers_cloak', 'magic', [{ id: 'life_flat', tier: 6, value: 10 }]);
    const tree = ItemTip({ session, item: it, equipped: true });
    expect(classes(tree).some((c) => c.startsWith('tc-'))).toBe(false);
    expect(text(tree)).toContain('unequip');
  });
});

describe('fuse part stacks', () => {
  it('stack by kind and tier, highest tier first', () => {
    const h = heroOf(session) as never;
    const parts = [
      makePart(h, 'ember_feather', 1),
      makePart(h, 'kiln_chitin', 2),
      makePart(h, 'ember_feather', 1),
      makePart(h, 'ember_feather', 3),
    ];
    const stacks = stackParts(parts);
    expect(stacks.map((s) => [s.parts[0]!.part, s.parts[0]!.tier, s.parts.length])).toEqual([
      ['ember_feather', 3, 1],
      ['kiln_chitin', 2, 1],
      ['ember_feather', 1, 2],
    ]);
  });
});
