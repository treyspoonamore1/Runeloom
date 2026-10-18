/**
 * Spindle bases (CONTENT §3): the weapon. Capacity is the complexity budget per weave; each Loom
 * Shard adds +1 to every spindle (DESIGN §8.3). Affix pools arrive in M4.
 */
import type { DamageType } from './combatTypes';

/** Structured implicit modifier. All fields optional; `{}` is no implicit. */
export interface SpindleImplicit {
  /** Increased damage of a type, as fractions (0.1 = 10% increased Fire damage). Applied by the runtime. */
  increased?: Partial<Record<DamageType, number>>;
  /** Increased chill build-up (0.2 = 20%). Applied by the ailment system. */
  chillGain?: number;
  /** Flat Strike base damage, added after rune-level scaling. */
  strikeFlat?: number;
  /** Added to every rune's level. */
  runeLevels?: number;
}

export type SpindleShip = 'M2' | 'M4' | 'M5' | 'dev';

export interface SpindleDef {
  id: string;
  name: string;
  itemLevel: number;
  /** Base Capacity, before Loom Shards and affixes. */
  capacity: number;
  /** Cast time divisor. */
  castSpeed: number;
  implicit: SpindleImplicit;
  /** Player-facing implicit text, '' for none. */
  implicitText: string;
  fuseSockets: number;
  ships: SpindleShip;
  /** Dev-only: never drops, not in the sandbox picker. */
  devOnly: boolean;
}

export const spindles = {
  twig: {
    id: 'twig',
    name: 'Twig Spindle',
    itemLevel: 1,
    capacity: 8,
    castSpeed: 1,
    implicit: {},
    implicitText: '',
    fuseSockets: 1,
    ships: 'M2',
    devOnly: false,
  },
  ashwood: {
    id: 'ashwood',
    name: 'Ashwood Spindle',
    itemLevel: 4,
    capacity: 10,
    castSpeed: 1,
    implicit: { increased: { fire: 0.1 } },
    implicitText: '10% increased Fire damage',
    fuseSockets: 1,
    ships: 'M4',
    devOnly: false,
  },
  ironbark: {
    id: 'ironbark',
    name: 'Ironbark Spindle',
    itemLevel: 6,
    capacity: 10,
    castSpeed: 0.92,
    implicit: { strikeFlat: 12 },
    implicitText: 'Strike base damage +12',
    fuseSockets: 1,
    ships: 'M4',
    devOnly: false,
  },
  rimeglass: {
    id: 'rimeglass',
    name: 'Rimeglass Spindle',
    itemLevel: 8,
    capacity: 9,
    castSpeed: 1.05,
    implicit: { chillGain: 0.2 },
    implicitText: '20% increased chill build-up',
    fuseSockets: 1,
    ships: 'M4',
    devOnly: false,
  },
  heartwood: {
    id: 'heartwood',
    name: 'Heartwood Spindle',
    itemLevel: 18,
    capacity: 13,
    castSpeed: 1,
    implicit: {},
    implicitText: '',
    fuseSockets: 2,
    ships: 'M5',
    devOnly: false,
  },
  loomsteel: {
    id: 'loomsteel',
    name: 'Loomsteel Spindle',
    itemLevel: 30,
    capacity: 15,
    castSpeed: 1,
    implicit: { runeLevels: 1 },
    implicitText: '+1 to all rune levels',
    fuseSockets: 2,
    ships: 'M5',
    devOnly: false,
  },
  /** Dev-only (CONTENT §2): tests set its Capacity with testSpindle(capacity). Never drops. */
  test_spindle: {
    id: 'test_spindle',
    name: 'Test Spindle',
    itemLevel: 1,
    capacity: 99,
    castSpeed: 1,
    implicit: {},
    implicitText: '',
    fuseSockets: 2,
    ships: 'dev',
    devOnly: true,
  },
} satisfies Record<string, SpindleDef>;

export type SpindleId = keyof typeof spindles;

export function isSpindleId(id: string): id is SpindleId {
  return Object.prototype.hasOwnProperty.call(spindles, id);
}

/** The dev-only test spindle with the given Capacity. */
export function testSpindle(capacity: number): SpindleDef {
  return { ...spindles.test_spindle, capacity };
}
