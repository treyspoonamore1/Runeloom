/**
 * Cross-reference checks for the M4 item, loot and progression data (npm run validate). Enemy
 * kinds that don't exist yet are warnings, so data can name M4 enemies before they land.
 */
import { affixes, statDefs, type AffixDef } from '../../data/affixes';
import { gearBases, itemKinds } from '../../data/items';
import { fuseParts, type FusePartDef } from '../../data/fuseParts';
import { dropRates, killXp } from '../../data/loot';
import { guaranteedRunes, newGame, spindleDropFrom } from '../../data/progression';
import { isRuneId, runes } from '../../data/runes';
import { isSpindleId } from '../../data/spindles';
import { isEnemyKind } from '../../data/enemies';
import { newGameHero, parseWeave } from '../../src/sim';

export function checkItemData(): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allAffixes: Record<string, AffixDef> = affixes;
  for (const [key, a] of Object.entries(allAffixes)) {
    const at = `data/affixes.ts ${key}`;
    if (a.id !== key) errors.push(`${at}: id is "${a.id}"`);
    if (!(a.stat in statDefs)) errors.push(`${at}: unknown stat "${a.stat}"`);
    for (const k of a.kinds) if (!itemKinds.includes(k)) errors.push(`${at}: unknown item kind "${k}"`);
    a.tiers.forEach((t, i) => {
      if (t.tier !== i + 1) errors.push(`${at}: tiers must be listed best first, numbered from 1`);
      if (t.min > t.max) errors.push(`${at}: tier ${t.tier} min > max`);
      const next = a.tiers[i + 1];
      if (next && next.itemLevel > t.itemLevel)
        errors.push(`${at}: tier ${next.tier} needs a higher item level than tier ${t.tier}`);
    });
  }
  for (const kind of itemKinds)
    for (const which of ['prefix', 'suffix'] as const)
      if (!Object.values(allAffixes).some((a) => a.kind === which && a.kinds.includes(kind)))
        errors.push(`data/affixes.ts: no ${which} rolls on ${kind}`);
  for (const [key, b] of Object.entries(gearBases))
    if (b.id !== key) errors.push(`data/items.ts ${key}: id is "${b.id}"`);

  const parts: Record<string, FusePartDef> = fuseParts;
  for (const [key, p] of Object.entries(parts)) {
    const at = `data/fuseParts.ts ${key}`;
    if (p.id !== key) errors.push(`${at}: id is "${p.id}"`);
    if (!isEnemyKind(p.dropsFrom))
      warnings.push(`${at}: dropsFrom "${p.dropsFrom}" is not an enemy kind yet`);
    for (const m of p.text.matchAll(/\{(\w+)\}/g))
      if (!(m[1]! in p.values)) errors.push(`${at}: text names {${m[1]}} with no value`);
  }
  for (const k of [...Object.keys(dropRates.kindMult), ...Object.keys(killXp.baseOverride)])
    if (!isEnemyKind(k)) warnings.push(`data/loot.ts: "${k}" is not an enemy kind yet`);

  for (const id of Object.keys(spindleDropFrom))
    if (!isSpindleId(id)) errors.push(`data/progression.ts spindleDropFrom: "${id}" is not a spindle`);
  if (!isSpindleId(newGame.spindle))
    errors.push(`data/progression.ts newGame.spindle "${newGame.spindle}" is not a spindle`);
  for (const r of newGame.runes)
    if (!isRuneId(r)) errors.push(`data/progression.ts newGame.runes: "${r}" is not a rune`);
  for (const n of newGame.weaves)
    if (n !== null && !parseWeave(n).ok)
      errors.push(`data/progression.ts newGame weave "${n}" doesn't parse`);
  for (const [room, list] of Object.entries(guaranteedRunes))
    for (const r of list ?? [])
      if (!isRuneId(r)) errors.push(`data/progression.ts guaranteedRunes ${room}: "${r}" is not a rune`);
      else if (runes[r].ships !== 'M2')
        errors.push(`data/progression.ts guaranteedRunes ${room}: ${r} ships in ${runes[r].ships}`);
  try {
    newGameHero();
  } catch (e) {
    errors.push(`new-game hero: ${(e as Error).message}`);
  }
  return { errors, warnings };
}
