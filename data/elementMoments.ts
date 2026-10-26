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
  tide: {
    flavor: 'The Foundry kept its sea in a rune. Lend the world water; it gives it back.',
    does: [
      'Floods stone with water for 10 s, fills pits, and turns dirt to mud.',
      'Douses fire and furnace vents, and washes blocks along.',
      'Soaks enemies: Wet, and swimmers strand when the water goes.',
    ],
  },
  gale: {
    flavor: "The Coil's last breath, caught in a rune. The air answers you now.",
    does: [
      'Each spell blows a 2 s gust: fire runs downwind, smoke and steam drift.',
      'Clears fog and spins wind vanes.',
      'Knocks enemies back twice as far.',
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
