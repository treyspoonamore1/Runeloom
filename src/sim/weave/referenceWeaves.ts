/**
 * CONTENT §2 reference weaves and must-fail cases, as shared fixtures for tests and
 * tools/validate.ts. Keep in sync with the doc.
 */

export interface ReferenceWeave {
  n: number;
  name: string;
  notation: string;
  /** Complexity it must compile to. */
  cx: number;
  /** Spindle bases (data/spindles.ts ids) whose base Capacity fits it ("Fits" column). */
  fits: readonly string[];
}

const ALL = ['twig', 'ashwood', 'ironbark', 'rimeglass', 'heartwood', 'loomsteel'] as const;

export const referenceWeaves: readonly ReferenceWeave[] = [
  { n: 1, name: 'Starter Spark', notation: 'Cast > Bolt[Fire]', cx: 2, fits: ALL },
  { n: 2, name: 'Fireline', notation: 'Cast > Swath[Fire, Lingering]', cx: 3, fits: ALL },
  {
    n: 3,
    name: 'Wildfire Seed',
    notation: 'Cast > Lob[Fire] > OnExpire > Nova[Fire, Wide]',
    cx: 8,
    fits: ALL,
  },
  { n: 4, name: 'Scatter Spark', notation: 'Cast > Bolt[Fire, Split, Pierce]', cx: 5, fits: ALL },
  { n: 5, name: 'Glacier Step', notation: 'OnDodge > Nova[Frost, Saturate]', cx: 7, fits: ALL },
  {
    n: 6,
    name: 'Shatter Lance',
    notation: 'Cast > Beam[Frost, Pierce] > OnKill > Nova[Frost, Wide]',
    cx: 10,
    fits: ['ashwood', 'ironbark', 'heartwood', 'loomsteel'],
  },
  { n: 7, name: 'Conductor', notation: 'Cast > Bolt[Storm, Chain]', cx: 4, fits: ALL },
  { n: 8, name: 'Stormfront', notation: 'Pulse > Lob[Storm, Saturate]', cx: 6, fits: ALL },
  { n: 9, name: 'Steam Veil', notation: 'OnHurt > Nova[Fire, Saturate]', cx: 7, fits: ALL },
  {
    n: 10,
    name: 'Ember Orbit',
    notation: 'Pulse > Orb[Fire, Wide] > Emit > Bolt[Fire, Seeker]',
    cx: 12,
    fits: ['heartwood', 'loomsteel'],
  },
  {
    n: 11,
    name: 'Thunder Sigil',
    notation: 'Cast > Sigil[Storm] > Emit > Beam[Chain]',
    cx: 9,
    fits: ['rimeglass', 'ashwood', 'ironbark', 'heartwood', 'loomsteel'],
  },
  { n: 12, name: 'Echo Strike', notation: 'Cast > Strike[Storm, Echo, Keen]', cx: 6, fits: ALL },
  {
    n: 13,
    name: 'Twin Fates',
    notation: 'Cast > Bolt[Storm] { OnHit > Nova[Storm]; OnExpire > Lob[Fire] }',
    cx: 11,
    fits: ['heartwood', 'loomsteel'],
  },
  {
    n: 14,
    name: 'Recursion Stress',
    notation: 'Cast > Bolt[Storm, Split] > OnHit > Bolt[Split] > OnHit > Bolt[Split] > OnHit > Bolt[Split]',
    cx: 22,
    fits: [],
  },
  // M8 phase 1: Tide and Gale (terrain assertions: tests/sim/terrain/referenceTerrainM8.test.ts).
  { n: 15, name: 'Floodline', notation: 'Cast > Swath[Tide, Lingering]', cx: 3, fits: ALL },
  { n: 16, name: 'Glaze', notation: 'Cast > Swath[Tide, Frost]', cx: 3, fits: ALL },
  { n: 17, name: 'Fan the Flames', notation: 'Cast > Strike[Fire, Gale]', cx: 3, fits: ALL },
  { n: 18, name: 'Downpour', notation: 'Pulse > Lob[Tide, Saturate]', cx: 6, fits: ALL },
];

export interface MustFailWeave {
  notation: string;
  /** Exact compiler message, with a Capacity big enough that Capacity is never the problem. */
  message: string;
}

export const mustFailWeaves: readonly MustFailWeave[] = [
  { notation: 'Cast > Nova[Fire, Pierce]', message: "Nova can't take Pierce" },
  { notation: 'Cast > Sigil[Fire]', message: 'Sigil needs an Emit branch' },
  { notation: 'Cast > Bolt[]', message: 'Bolt needs an element' },
  { notation: 'Cast > Bolt[Fire, Split, Split]', message: 'Split can only be used once per spell' },
  {
    notation: `${referenceWeaves[13]!.notation} > OnHit > Bolt[Split]`,
    message: 'Branches can nest at most 3 deep',
  },
];

/** CONTENT §2's message for #14 on a spindle that is too small. */
export function capacityMessage(cx: number, capacity: number): string {
  return `Needs ${cx} Capacity; this spindle has ${capacity}`;
}
