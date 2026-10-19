/**
 * Loot exhibits: every drop type (runes by kind, items by rarity, a Fuse part, Thread Scrap) on the
 * floor of the loot section, plus one drop that lands and one that is picked up on cue.
 */
import type { Container } from 'pixi.js';
import type { GameState } from '../../sim';
import type { LootContent, LootDrop } from '../../sim/items/loot';
import type { RuneId } from '../../../data/runes';
import type { ItemRarity } from '../../sim/hero/types';
import { label } from './galleryLabel';
import { sectionOrigin, type SectionId } from './galleryRoom';

export interface LootExhibit {
  reset(): void;
  update(t: number, section: SectionId): void;
}

const rune = (id: RuneId): LootContent => ({
  kind: 'rune',
  rune: { uid: 0, rune: id, level: 1, xp: 0, quality: 0 },
});
const item = (rarity: ItemRarity): LootContent => ({
  kind: 'item',
  item: { uid: 0, base: 'cloak', rarity, itemLevel: 5, affixes: [], fused: [] },
});

interface Spec {
  at: [number, number];
  label: string;
  content: LootContent;
  /** Drops (age 0) at this time; picked up (removed) at `pick`. */
  drop?: number;
  pick?: number;
}

const SPECS: Spec[] = [
  { at: [8, 9], label: 'trigger rune', content: rune('pulse') },
  { at: [20, 9], label: 'form rune', content: rune('nova') },
  { at: [32, 9], label: 'element: Fire', content: rune('fire') },
  { at: [44, 9], label: 'element: Frost', content: rune('frost') },
  { at: [56, 9], label: 'modifier rune', content: rune('chain') },
  { at: [68, 9], label: 'branch rune', content: rune('on_hit') },
  { at: [10, 25], label: 'item: normal', content: item('normal') },
  { at: [26, 25], label: 'magic', content: item('magic') },
  { at: [42, 25], label: 'rare (beam)', content: item('rare') },
  { at: [58, 25], label: 'unique (beam)', content: item('unique') },
  { at: [70, 25], label: 'element: Storm', content: rune('storm') },
  {
    at: [10, 40],
    label: 'Fuse part',
    content: { kind: 'part', part: { uid: 0, part: 'cinder_heart', tier: 1 } },
  },
  { at: [24, 40], label: 'Thread Scrap', content: { kind: 'scrap', amount: 12 } },
  { at: [40, 40], label: 'dropping', content: item('rare'), drop: 2.0 },
  { at: [56, 40], label: 'picked up', content: rune('storm'), pick: 2.0 },
];

export function lootSpecs(state: GameState, labels: Container): LootExhibit[] {
  const o = sectionOrigin('loot');
  return SPECS.map((spec, i) => {
    const d: LootDrop = {
      id: 900000 + i,
      x: o.x + spec.at[0],
      y: o.y + spec.at[1],
      content: spec.content,
      age: 5,
    };
    labels.addChild(label(spec.label, d.x, d.y + 2));
    const present = (): boolean => state.loot.includes(d);
    const add = (): void => {
      if (!present()) state.loot.push(d);
    };
    const remove = (): void => {
      const k = state.loot.indexOf(d);
      if (k >= 0) state.loot.splice(k, 1);
    };
    add();
    return {
      reset() {
        d.age = spec.drop !== undefined ? 0 : 5;
        if (spec.drop !== undefined) remove();
        else add();
      },
      update(t, section) {
        if (section !== 'loot') return;
        if (spec.drop !== undefined) {
          if (t >= spec.drop) {
            add();
            d.age = t - spec.drop;
          }
        } else if (spec.pick !== undefined && t >= spec.pick) remove();
        else d.age = 5 + t;
      },
    };
  });
}
