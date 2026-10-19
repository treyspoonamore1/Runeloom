/**
 * Inventory, character sheet and Fuse adapter: what these screens need from the hero/items agent
 * beyond src/ui/heroAdapter.ts.
 *
 * EXPECTED (hero/items agent):
 *   - src/app/hero.ts describeItem(item) / describeRune(rune) / describePart(part) → Description
 *     { name, rarity, base, lines } (already in the contract).
 *   - The equipment slots an item base fits: spindles (data/spindles.ts) → 'spindle'; data/items.ts
 *     bases with a `slot` of 'cloak' | 'hood' | 'boots' | 'charm' (a charm fits charm1 and charm2).
 *   - Fuse sockets of a spindle = spindles[base].fuseSockets = item.fused.length.
 *   - Thread Scrap a salvage pays, per item and per part (shown in the confirm dialog), e.g.
 *     `salvageValue(item | part): number`.
 *   - The unfuse "keep" cost: 5 Thread Scrap (DESIGN §8.4; data/ui.ts uiTuning.unfuseKeepCost).
 *   - Edits: 'equip' { uid, slot }, 'unequip' { slot }, 'salvage' { uid } (items and parts),
 *     'fuse' { partUid, spindleUid, socket }, 'unfuse' { spindleUid, socket, keep }.
 */
import { describeItem, describePart, describeRune, type Description } from '../../app/hero';
import { isSpindleId, spindles } from '../../../data/spindles';
import type { EquipSlot, FusePart, Item, RuneItem } from '../../sim/hero/types';
import { getRune } from '../../../data/runes';
import { fixturesOn } from '../fixtures/mode';
import { fixtureAffixes, fixtureBases, fixtureParts } from '../fixtures/content';
import { fixtureItemSlots, fixtureSalvageValue, fixtureSockets } from '../fixtures/store';

export type { Description };

const ROMAN = ['', 'I', 'II', 'III'] as const;

export function baseName(base: string): string {
  if (isSpindleId(base)) return spindles[base].name;
  return fixtureBases[base]?.name ?? base;
}

export function itemDescription(it: Item): Description {
  if (!fixturesOn.peek()) return describeItem(it);
  const lines: string[] = [];
  if (isSpindleId(it.base)) {
    const s = spindles[it.base];
    lines.push(`Capacity ${s.capacity}`, `Cast speed ×${s.castSpeed.toFixed(2)}`);
    if (s.implicitText) lines.push(s.implicitText);
  }
  for (const af of it.affixes) lines.push(fixtureAffixes[af.id]?.text(af.value) ?? af.id);
  for (const f of it.fused) if (f) lines.push(`Fused: ${partName(f)}`);
  const named = it.rarity === 'magic' && it.affixes.length > 0 ? magicName(it) : baseName(it.base);
  return { name: named, rarity: it.rarity, base: baseName(it.base), lines };
}

/** Magic items read "<base> of <suffix>" from their first affix, like the hero agent's names will. */
function magicName(it: Item): string {
  const tag: Record<string, string> = {
    fire_dmg: 'Kindling',
    cast_speed: 'Haste',
    life: 'Vigor',
    move_speed: 'the Hare',
    strike_flat: 'Force',
    elemental_dmg: 'Embers',
    mana: 'Wells',
    storm_res: 'Grounding',
    frost_res: 'Thawing',
    fire_res: 'Ash',
  };
  const t = tag[it.affixes[0]!.id];
  return t ? `${baseName(it.base)} of ${t}` : baseName(it.base);
}

export function partName(p: FusePart): string {
  return `${fixtureParts[p.part]?.name ?? p.part} ${ROMAN[p.tier]}`;
}

export function partDescription(p: FusePart): Description {
  if (!fixturesOn.peek()) return describePart(p);
  const d = fixtureParts[p.part];
  return {
    name: partName(p),
    rarity: 'magic',
    base: `Fuse part · tier ${ROMAN[p.tier]}${d ? ` · from ${d.from}` : ''}`,
    lines: d ? [d.text(p.tier)] : [],
  };
}

export function runeDescription(r: RuneItem): Description {
  if (!fixturesOn.peek()) return describeRune(r);
  const d = getRune(r.rune);
  return {
    name: d?.name ?? r.rune,
    rarity: 'normal',
    base: `${d?.kind ?? 'rune'} · level ${r.level}`,
    lines: d ? [d.description] : [],
  };
}

export function slotsFor(it: Item): EquipSlot[] {
  return fixtureItemSlots(it);
}

export function socketsOf(it: Item): number {
  return fixturesOn.peek() ? fixtureSockets(it) : it.fused.length;
}

export function salvageValue(x: Item | FusePart): number {
  return fixtureSalvageValue('tier' in x ? { tier: x.tier } : x);
}
