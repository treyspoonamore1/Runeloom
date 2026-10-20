/**
 * The dungeon-item moment (DESIGN §10.2, CONTENT §9.1): what the item-get panel says when the hero
 * unlocks an element rune for the first time. One line of flavor, then what the element does in
 * this world (DESIGN §6, the chemistry rules), short enough to read at a glance.
 */
import type { RuneId } from './runes';

export interface ElementMomentText {
  flavor: string;
  /** 2–3 short lines on what it does in the world. */
  does: readonly string[];
}

export const elementMoments = {
  frost: {
    flavor: 'Winter sleeps in this rune. Water will bear your weight now.',
    does: [
      'Freezes shallow water into walkable ice, and deep water into a short-lived ice bridge.',
      'Puts out fire.',
      'Chills enemies, then freezes them solid.',
    ],
  },
  storm: {
    flavor: "The Warden's caged thunder, yours to weave.",
    does: [
      'Electrifies water and metal: the charge runs through everything they touch.',
      'Shocks enemies.',
      'Arcs between wet enemies.',
    ],
  },
} as const satisfies Partial<Record<RuneId, ElementMomentText>>;

/**
 * Forms the panel suggests a first weave with, in order of preference: the first one the hero
 * has a free rune for ("try Cast > Bolt[Frost]").
 */
export const suggestedForms: readonly RuneId[] = [
  'bolt',
  'lob',
  'nova',
  'swath',
  'strike',
  'beam',
  'orb',
  'sigil',
];
