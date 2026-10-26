/**
 * Rift Sigils (DESIGN §10.4, M6): items with a tier 1–16 and 0–4 modifiers, at most two prefixes
 * and two suffixes (data/rift.ts sigilRolls). Each modifier adds item quantity and rarity
 * (CONTENT §10). Rolled with the loot RNG.
 */
import { RIFT_TIERS, riftMods, sigilRolls, type RiftModDef, type RiftModId } from '../../../data/rift';
import type { Rng } from '../core/rng';
import type { HeroState, RiftSigil } from '../hero/types';
import { nextUid } from './items';

const PREFIXES = (Object.keys(riftMods) as RiftModId[]).filter((id) => riftMods[id].kind === 'prefix');
const SUFFIXES = (Object.keys(riftMods) as RiftModId[]).filter((id) => riftMods[id].kind === 'suffix');

/** Clamps a tier to 1–16. */
export function clampTier(tier: number): number {
  return Math.min(RIFT_TIERS, Math.max(1, Math.round(tier)));
}

/** Modifier count weights for a tier: low (1–5), mid (6–10), high (11–16). */
function countWeights(tier: number): readonly number[] {
  const w = sigilRolls.modCountWeights;
  return tier <= 5 ? w[0]! : tier <= 10 ? w[1]! : w[2]!;
}

/** 0–4 modifiers for a tier: the count by weight, then each one a prefix or suffix evenly among those with room. */
export function rollSigilMods(rng: Rng, tier: number): RiftModId[] {
  const weights = countWeights(tier);
  let total = 0;
  for (const w of weights) total += w;
  let r = rng.float() * total;
  let count = 0;
  for (; count < weights.length - 1; count++) {
    r -= weights[count]!;
    if (r < 0) break;
  }
  const pre: RiftModId[] = [];
  const suf: RiftModId[] = [];
  for (let k = 0; k < count; k++) {
    const pools: { list: RiftModId[]; from: RiftModId[] }[] = [];
    if (pre.length < sigilRolls.maxPrefixes) pools.push({ list: pre, from: PREFIXES });
    if (suf.length < sigilRolls.maxSuffixes) pools.push({ list: suf, from: SUFFIXES });
    if (pools.length === 0) break;
    const pool = pools[rng.int(pools.length)]!;
    // M8: a modifier with `fromTier` (of the Gale: 9) rolls only from that tier.
    const free = pool.from.filter((id) => !pool.list.includes(id) && (riftModFromTier(id) ?? 1) <= tier);
    pool.list.push(free[rng.int(free.length)]!);
  }
  return [...sortMods(pre), ...sortMods(suf)];
}

/** Modifiers in data order (stable names and tooltips). */
function sortMods(list: RiftModId[]): RiftModId[] {
  const order = Object.keys(riftMods);
  return [...list].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export function makeSigil(hero: HeroState, tier: number, mods: RiftModId[]): RiftSigil {
  return { uid: nextUid(hero), tier: clampTier(tier), mods };
}

/** A sigil of `tier` with rolled modifiers. */
export function rollSigil(hero: HeroState, rng: Rng, tier: number): RiftSigil {
  const t = clampTier(tier);
  return makeSigil(hero, t, rollSigilMods(rng, t));
}

/** Total item quantity and rarity bonus of a set of modifiers, as fractions. */
export function sigilBonus(mods: readonly RiftModId[]): { quantity: number; rarity: number } {
  let quantity = 0;
  let rarity = 0;
  for (const id of mods) {
    quantity += riftMods[id].quantity;
    rarity += riftMods[id].rarity;
  }
  return { quantity, rarity };
}

/** "Brutal Rift Sigil of Drought (Tier 3)": the first prefix and first suffix name it. */
export function sigilName(g: Pick<RiftSigil, 'tier' | 'mods'>): string {
  const pre = g.mods.find((m) => riftMods[m].kind === 'prefix');
  const suf = g.mods.find((m) => riftMods[m].kind === 'suffix');
  const name = [pre ? riftMods[pre].name : null, 'Rift Sigil', suf ? riftMods[suf].name : null]
    .filter((x) => x !== null)
    .join(' ');
  return `${name} (Tier ${g.tier})`;
}

/** The modifiers' names in one line ("Brutal · of Drought"), or "No modifiers". */
export function sigilModLine(mods: readonly RiftModId[]): string {
  return mods.length === 0 ? 'No modifiers' : mods.map((m) => riftMods[m].name).join(' · ');
}

export function findSigil(hero: HeroState, uid: number): RiftSigil | undefined {
  return hero.sigils.find((g) => g.uid === uid);
}

function riftModFromTier(id: RiftModId): number | undefined {
  const m: RiftModDef = riftMods[id];
  return m.fromTier;
}
