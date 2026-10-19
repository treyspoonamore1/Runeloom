/**
 * Fixture content standing in for the hero/items agent's data/items.ts, data/affixes.ts and
 * data/fuseParts.ts until they are merged. Only the screens' adapters import this.
 */
import type { HeroMods } from '../../sim/hero/mods';
import type { EquipSlot } from '../../sim/hero/types';

export type BaseSlot = 'cloak' | 'hood' | 'boots' | 'charm';

/** Non-spindle item bases (spindles come from data/spindles.ts). */
export const fixtureBases: Record<string, { name: string; slot: BaseSlot; implicit?: string }> = {
  travelers_cloak: { name: "Traveler's Cloak", slot: 'cloak' },
  wool_cloak: { name: 'Wool Cloak', slot: 'cloak' },
  linen_hood: { name: 'Linen Hood', slot: 'hood' },
  leather_boots: { name: 'Leather Boots', slot: 'boots' },
  reed_boots: { name: 'Reed Boots', slot: 'boots' },
  ember_charm: { name: 'Ember Charm', slot: 'charm' },
  river_charm: { name: 'River Charm', slot: 'charm' },
};

/** The equipment slots a base can go in. */
export function fixtureSlotsFor(base: BaseSlot | 'spindle'): EquipSlot[] {
  return base === 'charm' ? ['charm1', 'charm2'] : [base];
}

interface AffixDef {
  text: (v: number) => string;
  apply: (m: HeroMods, v: number) => void;
}

const pct = (v: number) => v / 100;

export const fixtureAffixes: Record<string, AffixDef> = {
  fire_dmg: { text: (v) => `${v}% increased Fire damage`, apply: (m, v) => (m.damageInc.fire += pct(v)) },
  frost_dmg: { text: (v) => `${v}% increased Frost damage`, apply: (m, v) => (m.damageInc.frost += pct(v)) },
  storm_dmg: { text: (v) => `${v}% increased Storm damage`, apply: (m, v) => (m.damageInc.storm += pct(v)) },
  elemental_dmg: {
    text: (v) => `${v}% increased elemental damage`,
    apply: (m, v) => {
      m.damageInc.fire += pct(v);
      m.damageInc.frost += pct(v);
      m.damageInc.storm += pct(v);
    },
  },
  branch_dmg: {
    text: (v) => `${v}% increased damage with branch spells`,
    apply: (m, v) => (m.branchDamageInc += pct(v)),
  },
  strike_flat: { text: (v) => `+${v} Strike base damage`, apply: (m, v) => (m.strikeFlatAdd += v) },
  cast_speed: { text: (v) => `${v}% increased cast speed`, apply: (m, v) => (m.castSpeedInc += pct(v)) },
  crit: { text: (v) => `+${v}% crit chance`, apply: (m, v) => (m.critChanceAdd += pct(v)) },
  mana_cost: { text: (v) => `${v}% reduced mana cost`, apply: (m, v) => (m.manaCostReduced += pct(v)) },
  life: { text: (v) => `+${v} to maximum life`, apply: (m, v) => (m.maxLifeAdd += v) },
  life_inc: { text: (v) => `${v}% increased maximum life`, apply: (m, v) => (m.maxLifeInc += pct(v)) },
  mana: { text: (v) => `+${v} to maximum mana`, apply: (m, v) => (m.maxManaAdd += v) },
  mana_regen: { text: (v) => `+${v} mana regenerated per second`, apply: (m, v) => (m.manaRegenAdd += v) },
  fire_res: { text: (v) => `+${v}% Fire resistance`, apply: (m, v) => (m.resistAdd.fire += pct(v)) },
  frost_res: { text: (v) => `+${v}% Frost resistance`, apply: (m, v) => (m.resistAdd.frost += pct(v)) },
  storm_res: { text: (v) => `+${v}% Storm resistance`, apply: (m, v) => (m.resistAdd.storm += pct(v)) },
  move_speed: { text: (v) => `${v}% increased move speed`, apply: (m, v) => (m.moveSpeedInc += pct(v)) },
  dodge_recharge: {
    text: (v) => `${v}% faster dodge recharge`,
    apply: (m, v) => (m.dodgeRechargeInc += pct(v)),
  },
  ailment_duration: {
    text: (v) => `${v}% increased ailment duration`,
    apply: (m, v) => (m.ailmentDurationInc += pct(v)),
  },
  fire_spread: {
    text: (v) => `${v}% increased spread chance for fire you create`,
    apply: (m, v) => (m.fireSpreadInc += pct(v)),
  },
};

/** CONTENT §4. `value` is the tier I number the text scales (×1.5 at II, ×2 at III), when it has one. */
export const fixtureParts: Record<string, { name: string; from: string; text: (tier: 1 | 2 | 3) => string }> =
  {
    tinder_tooth: {
      name: 'Tinder Tooth',
      from: 'Tinderling',
      text: (t) => `The first Fire rune in each weave costs 0 complexity${bonus(t, 'Fire')}`,
    },
    bog_gill: {
      name: 'Bog Gill',
      from: 'Bog Lurker',
      text: (t) =>
        `Storm arcs between Wet enemies reach ${50 * mult(t)}% farther and hit ${2 * mult(t)} more targets`,
    },
    tar_gland: {
      name: 'Tar Gland',
      from: 'Tar Hulk',
      text: (t) => `Your Fire hits leave a ${2 * mult(t)}-cell oil patch, which they then ignite`,
    },
    rime_mote: { name: 'Rime Mote', from: 'Frost Wisp', text: (t) => `Freeze lasts ${40 * mult(t)}% longer` },
    shield_plate: {
      name: 'Shield Plate',
      from: 'Shieldbearer',
      text: (t) => `Take ${20 * mult(t)}% less damage from projectiles`,
    },
    storm_antler: {
      name: 'Storm Antler',
      from: 'Stormcaller',
      text: (t) => `Charge you create on water and metal lasts ${0.5 * mult(t)} s longer`,
    },
    ember_feather: {
      name: 'Ember Feather',
      from: 'Ember Archer',
      text: (t) => `Bolt and Lob projectiles are ${25 * mult(t)}% faster`,
    },
    kiln_chitin: {
      name: 'Kiln Chitin',
      from: 'Kiln Mite',
      text: (t) => `Dodge recharges ${15 * mult(t)}% faster`,
    },
    matriarchs_sac: {
      name: "Matriarch's Sac",
      from: 'Tar Matriarch',
      text: (t) => `Your hits apply Oiled for ${2 * mult(t)} s`,
    },
    cinder_heart: {
      name: 'Cinder Heart',
      from: 'Cinder Warden',
      text: (t) => `Grants Harvest > Nova[Fire] as an extra weave${bonus(t, 'Fire')}`,
    },
  };

function mult(t: 1 | 2 | 3): number {
  return t === 1 ? 1 : t === 2 ? 1.5 : 2;
}

function bonus(t: 1 | 2 | 3, el: string): string {
  return t === 1 ? '' : `. ${t === 2 ? 10 : 20}% increased ${el} damage`;
}
