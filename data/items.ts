/**
 * Equipment bases that aren't spindles (DESIGN §8.1, CONTENT §3): cloak, hood, boots and charm.
 * Spindle bases live in data/spindles.ts. Affix pools per kind are in data/affixes.ts.
 *
 * M4 ships one plain base per kind, without implicits; M5 adds more bases and Rares.
 */
import type { StatId } from './affixes';

/** What kind of item a base is; decides which equipment slots take it and which affixes roll. */
export const itemKinds = ['spindle', 'cloak', 'hood', 'boots', 'charm'] as const;
export type ItemKind = (typeof itemKinds)[number];

export interface GearBaseDef {
  id: string;
  name: string;
  kind: Exclude<ItemKind, 'spindle'>;
  /** Lowest item level (area level) it drops at. */
  itemLevel: number;
  /** Fixed stats every copy has, in display units (see data/affixes.ts statDefs). */
  implicit: { stat: StatId; value: number }[];
}

export const gearBases = {
  travelers_cloak: {
    id: 'travelers_cloak',
    name: "Traveler's Cloak",
    kind: 'cloak',
    itemLevel: 1,
    implicit: [],
  },
  wool_hood: { id: 'wool_hood', name: 'Wool Hood', kind: 'hood', itemLevel: 1, implicit: [] },
  leather_boots: {
    id: 'leather_boots',
    name: 'Leather Boots',
    kind: 'boots',
    itemLevel: 1,
    implicit: [],
  },
  bone_charm: { id: 'bone_charm', name: 'Bone Charm', kind: 'charm', itemLevel: 1, implicit: [] },
} satisfies Record<string, GearBaseDef>;

export type GearBaseId = keyof typeof gearBases;

export function isGearBaseId(id: string): id is GearBaseId {
  return Object.prototype.hasOwnProperty.call(gearBases, id);
}

/** Display name of each kind, for tooltips ("Cloak"). */
export const itemKindNames: Record<ItemKind, string> = {
  spindle: 'Spindle',
  cloak: 'Cloak',
  hood: 'Hood',
  boots: 'Boots',
  charm: 'Charm',
};
