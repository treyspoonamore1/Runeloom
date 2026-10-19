/**
 * Tooltip text for items, rune items and Fuse parts (src/app/hero.ts wraps these for the UI).
 * Pure; reads only data tables.
 */
import { affixes, affixNames, isAffixId } from '../../../data/affixes';
import { enemies, isEnemyKind } from '../../../data/enemies';
import { fuseParts, isFusePartId, partElementInc, partTierMult } from '../../../data/fuseParts';
import { maxRuneLevel, runeXpToNext } from '../../../data/progression';
import { getRune } from '../../../data/runes';
import { isSpindleId, spindles } from '../../../data/spindles';
import type { FusePart, Item, ItemRarity, RuneItem } from '../hero/types';
import { baseImplicits } from '../hero/aggregate';
import { statLine } from '../hero/stats';
import { baseName, kindName } from './items';

/** Display text for tooltips: a name, its rarity color class, and one line per stat. */
export interface Description {
  name: string;
  rarity: ItemRarity;
  /** Base type line, e.g. "Ashwood Spindle", "Cloak". */
  base: string;
  /** Implicit, then affix lines, then fused parts. */
  lines: string[];
  /** Base properties shown above the stat lines: Capacity, cast speed, item level, sockets, rune XP. */
  properties: string[];
}

const ROMAN = ['I', 'II', 'III'] as const;

function pct(v: number): string {
  return `${Math.round(v * 1000) / 10}%`;
}

/** A Magic item's name from its affixes; other rarities use the base name. */
export function itemName(item: Item): string {
  const base = baseName(item.base);
  if (item.rarity !== 'magic') return base;
  let pre = '';
  let suf = '';
  for (const a of item.affixes) {
    if (!isAffixId(a.id)) continue;
    if (affixes[a.id].kind === 'prefix') pre = affixNames[a.id];
    else suf = affixNames[a.id];
  }
  return [pre, base, suf].filter((s) => s !== '').join(' ');
}

export function describeItem(item: Item): Description {
  const lines: string[] = [];
  for (const s of baseImplicits(item.base)) lines.push(statLine(s.stat, s.value));
  for (const a of item.affixes) if (isAffixId(a.id)) lines.push(statLine(affixes[a.id].stat, a.value));
  item.fused.forEach((p, i) => {
    lines.push(p ? `Fused: ${partName(p)}` : `Socket ${i + 1}: empty`);
  });
  const properties: string[] = [];
  if (isSpindleId(item.base)) {
    const sp = spindles[item.base];
    properties.push(
      `Capacity: ${sp.capacity}`,
      `Cast speed: ${sp.castSpeed.toFixed(2)}`,
      `Fuse sockets: ${sp.fuseSockets}`,
    );
  }
  properties.push(`Item level: ${item.itemLevel}`);
  return {
    name: itemName(item),
    rarity: item.rarity,
    base: `${baseName(item.base)} (${kindName(item.base)})`,
    lines,
    properties,
  };
}

export function describeRune(rune: RuneItem): Description {
  const def = getRune(rune.rune);
  const lines: string[] = def ? [def.description] : [];
  const properties: string[] = [`Level: ${rune.level}`];
  if (def) {
    properties.push(`Complexity: ${def.cx}`);
    if (def.kind === 'trigger' || def.kind === 'element' || def.kind === 'modifier')
      properties.push(`Mana: ×${def.manaMult.toFixed(2)}`);
    if (def.kind === 'form') properties.push(`Base damage: ${def.baseDamage}`, `Base mana: ${def.baseMana}`);
  }
  properties.push(
    rune.level >= maxRuneLevel ? 'XP: max level' : `XP: ${Math.floor(rune.xp)} / ${runeXpToNext(rune.level)}`,
  );
  if (rune.quality > 0) properties.push(`Quality: ${rune.quality}%`);
  const kind = def ? def.kind[0]!.toUpperCase() + def.kind.slice(1) : 'Rune';
  return { name: def?.name ?? rune.rune, rarity: 'normal', base: `${kind} rune`, lines, properties };
}

function partName(p: FusePart): string {
  const name = isFusePartId(p.part) ? fuseParts[p.part].name : p.part;
  return `${name} (${ROMAN[p.tier - 1]})`;
}

export function describePart(part: FusePart): Description {
  if (!isFusePartId(part.part))
    return {
      name: part.part,
      rarity: 'magic',
      base: `Tier ${ROMAN[part.tier - 1]} Fuse part`,
      lines: [],
      properties: [],
    };
  const def = fuseParts[part.part];
  const mult = partTierMult[part.tier - 1]!;
  let text: string = def.text;
  for (const [key, v] of Object.entries(def.values)) {
    const value = v.base * mult;
    const shown = v.format === 'pct' ? pct(value) : v.format === 'sec' ? `${value} s` : String(value);
    text = text.replace(`{${key}}`, shown);
  }
  const lines = [text];
  const inc = partElementInc[part.tier - 1]!;
  if ('element' in def && def.element && inc > 0) {
    const el = def.element[0]!.toUpperCase() + def.element.slice(1);
    lines.push(`${pct(inc)} increased ${el} damage`);
  }
  const from = isEnemyKind(def.dropsFrom) ? enemies[def.dropsFrom].name : def.dropsFrom;
  return {
    name: def.name,
    rarity: 'magic',
    base: `Tier ${ROMAN[part.tier - 1]} Fuse part`,
    lines,
    properties: [`Drops from: ${from}`],
  };
}
