/**
 * The Pattern, the passive tree (DESIGN §9, CONTENT §7): 91 nodes in five areas.
 *
 * Layout (for the SVG): a fixed coordinate space of [-1000, 1000] on both axes, the start node at
 * (0, 0), +y down. Weaver fills the center (radius ≤ 520). Ember (top, −90°), Tempest (lower
 * right, 30°) and Rime (lower left, 150°) are 60° sectors from radius 240 to 770: a spine, then
 * three branches that each end in a notable, the middle one leading on to the area's keystones.
 * Warden is the outer ring (radius 900, every 30°) with spurs inward between the sectors; each
 * sector's outer notables link out to it. Positions are rounded to whole units.
 *
 * Stat lines (`stats`, `effects`) are what the aggregation (src/sim/hero/passives.ts) reads;
 * `text` is what the UI shows. Edges are listed once, undirected (`passiveEdges`).
 */
import { statInfo, type EffectKey, type StatKey, type StatLine } from './passiveStats';

export type PassiveArea = 'weaver' | 'ember' | 'rime' | 'tempest' | 'warden';
export type PassiveType = 'start' | 'small' | 'notable' | 'keystone';

export interface PassiveNode<I extends string = string> {
  id: I;
  name: string;
  area: PassiveArea;
  type: PassiveType;
  /** Position in the tree's coordinate space (passiveView). */
  x: number;
  y: number;
  /** Numeric HeroMods fields this node adds to. */
  stats: readonly StatLine[];
  /** Rules this node adds to HeroMods.effects (keystones and rule notables). */
  effects: Readonly<Partial<Record<EffectKey, number>>>;
  /** Tooltip lines, one per effect. */
  text: readonly string[];
}

/** The SVG coordinate space every node position lies in. */
export const passiveView = { minX: -1000, minY: -1000, width: 2000, height: 2000 } as const;

/** Rule numbers of the keystones and rule notables (CONTENT §7). Feel guesses marked in comments. */
export const passiveRules = {
  wildheart: { fireHitLess: 0.3, spreadInc: 0.5 },
  pyreWalker: { moreOnBurning: 0.2 },
  /** trailRadius: cells of shallow water painted around the player each dodge tick (feel guess). */
  hydromancer: { waterSeconds: 6, trailRadius: 1.5 },
  stormglass: { stormMore: 0.4 },
  livingLoom: { globalCooldown: 0.4 },
  singleThread: { more: 0.7, capacity: -3 },
  oilcraft: 0.25,
  brittle: 0.25,
  rainshadow: 0.15,
} as const;

/** Grounds Hydromancer's dodge water may cover (it reverts to them). */
export const hydromancerGrounds = ['stone', 'dirt', 'grass', 'ash', 'mud'] as const;

const s = (stat: StatKey, value: number): StatLine => ({ stat, value });

/** Polar position: radius r, angle in degrees (0 = +x, 90 = +y, i.e. down). */
function at(r: number, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: Math.round(r * Math.cos(a)) + 0, y: Math.round(r * Math.sin(a)) + 0 };
}

function small<I extends string>(
  id: I,
  area: PassiveArea,
  r: number,
  deg: number,
  stats: StatLine[],
): PassiveNode<I> {
  const name = statInfo[stats[0]!.stat].name;
  return { id, name, area, type: 'small', ...at(r, deg), stats, effects: {}, text: stats.map(statText) };
}

function named<I extends string>(
  type: 'notable' | 'keystone',
  id: I,
  name: string,
  area: PassiveArea,
  r: number,
  deg: number,
  stats: StatLine[],
  effects: Partial<Record<EffectKey, number>> = {},
  text: string[] = stats.map(statText),
): PassiveNode<I> {
  return { id, name, area, type, ...at(r, deg), stats, effects, text };
}

function statText(l: StatLine): string {
  return statInfo[l.stat].text(l.value);
}

const R = passiveRules;
const pct = (v: number) => Math.round(v * 100);
const fire = (v: number) => s('damageInc.fire', v);
const frost = (v: number) => s('damageInc.frost', v);
const storm = (v: number) => s('damageInc.storm', v);
const terrain = s('terrainDurationInc', 0.04);
const life = s('maxLifeAdd', 5);

// Sector angles and radii (see the header).
const EMBER = -90;
const TEMPEST = 30;
const RIME = 150;
const SPINE = [240, 320] as const;
const BRANCH = [400, 470, 540] as const;
const NOTABLE_R = 615;
const KEY_PATH_R = 690;
const KEYSTONE_R = 770;
const LINK_R = 700;
const RING_R = 900;

const nodeList = [
  {
    id: 'start',
    name: 'Heart of the Pattern',
    area: 'weaver',
    type: 'start',
    x: 0,
    y: 0,
    stats: [],
    effects: {},
    text: ['Where every Pattern begins'],
  } as PassiveNode<'start'>,

  // ---- Weaver (center): capacity, branches, triggers, mana ----
  small('weaver_n', 'weaver', 140, -90, [s('castSpeedInc', 0.03)]),
  small('weaver_ne', 'weaver', 140, -30, [s('maxManaAdd', 5)]),
  small('weaver_se', 'weaver', 140, 30, [s('castSpeedInc', 0.03)]),
  small('weaver_s', 'weaver', 140, 90, [s('manaCostReduced', 0.03)]),
  small('weaver_sw', 'weaver', 140, 150, [s('castSpeedInc', 0.03)]),
  small('weaver_nw', 'weaver', 140, 210, [s('maxManaAdd', 5)]),
  small('weaver_ne1', 'weaver', 230, -30, [s('branchDamageInc', 0.06)]),
  named('notable', 'spellwright', 'Spellwright', 'weaver', 320, -30, [s('capacityAdd', 1)]),
  small('weaver_nw1', 'weaver', 230, 210, [s('ailmentDurationInc', 0.06)]),
  named('notable', 'echoing_thread', 'Echoing Thread', 'weaver', 320, 210, [], { echoing_thread: 1 }, [
    "Echo's repeat deals full damage",
  ]),
  small('weaver_s1', 'weaver', 230, 90, [s('manaCostReduced', 0.03)]),
  small('weaver_s2', 'weaver', 310, 90, [s('damageInc.elemental', 0.04)]),
  named(
    'keystone',
    'living_loom',
    'Living Loom',
    'weaver',
    410,
    80,
    [],
    { living_loom: R.livingLoom.globalCooldown },
    [
      'Weaves with automatic triggers cost no mana',
      `All automatic triggers share a ${R.livingLoom.globalCooldown} s global cooldown`,
    ],
  ),
  named(
    'keystone',
    'single_thread',
    'Single Thread',
    'weaver',
    410,
    100,
    [s('capacityAdd', R.singleThread.capacity)],
    { single_thread: R.singleThread.more },
    [
      `Weaves with no modifiers deal ${pct(R.singleThread.more)}% more damage`,
      `${R.singleThread.capacity} Capacity`,
    ],
  ),
  small('weaver_s3', 'weaver', 520, 90, [s('branchDamageInc', 0.06)]),

  // ---- Ember (top): fire, ignite, terrain fire ----
  small('ember_s1', 'ember', SPINE[0], EMBER, [fire(0.08)]),
  small('ember_s2', 'ember', SPINE[1], EMBER, [fire(0.08)]),
  small('ember_l1', 'ember', BRANCH[0], EMBER - 12, [s('igniteEffectInc', 0.06)]),
  small('ember_l2', 'ember', BRANCH[1], EMBER - 17, [s('igniteDurationInc', 0.1)]),
  small('ember_l3', 'ember', BRANCH[2], EMBER - 21, [fire(0.08)]),
  named('notable', 'slow_burn', 'Slow Burn', 'ember', NOTABLE_R, EMBER - 24, [s('igniteDurationInc', 0.5)]),
  small('ember_m1', 'ember', BRANCH[0], EMBER, [s('fireSpreadInc', 0.06)]),
  small('ember_m2', 'ember', BRANCH[1], EMBER, [fire(0.08)]),
  small('ember_m3', 'ember', BRANCH[2], EMBER, [terrain]),
  named('notable', 'kindler', 'Kindler', 'ember', NOTABLE_R, EMBER, [s('fireSpreadInc', 0.3), fire(0.1)]),
  small('ember_r1', 'ember', BRANCH[0], EMBER + 12, [fire(0.08)]),
  small('ember_r2', 'ember', BRANCH[1], EMBER + 17, [s('ailmentEffectInc', 0.06)]),
  small('ember_r3', 'ember', BRANCH[2], EMBER + 21, [terrain]),
  named('notable', 'oilcraft', 'Oilcraft', 'ember', NOTABLE_R, EMBER + 24, [], { oilcraft: R.oilcraft }, [
    `Oiled enemies take ${pct(R.oilcraft)}% more Fire damage from you`,
  ]),
  small('ember_k1', 'ember', KEY_PATH_R, EMBER - 7, [s('fireSpreadInc', 0.06)]),
  named(
    'keystone',
    'wildheart',
    'Wildheart',
    'ember',
    KEYSTONE_R,
    EMBER - 9,
    [s('fireSpreadInc', R.wildheart.spreadInc)],
    { wildheart: R.wildheart.fireHitLess },
    [
      `Terrain fire you create scales with your Fire damage modifiers and spreads ${pct(R.wildheart.spreadInc)}% faster`,
      `Your Fire hits deal ${pct(R.wildheart.fireHitLess)}% less damage`,
    ],
  ),
  small('ember_k2', 'ember', KEY_PATH_R, EMBER + 7, [s('resistAdd.fire', 0.05)]),
  named(
    'keystone',
    'pyre_walker',
    'Pyre Walker',
    'ember',
    KEYSTONE_R,
    EMBER + 9,
    [],
    { pyre_walker: R.pyreWalker.moreOnBurning },
    [
      "You're immune to all terrain fire, whoever owns it",
      `While standing on burning ground, you deal ${pct(R.pyreWalker.moreOnBurning)}% more damage`,
    ],
  ),
  small('ember_wl', 'ember', LINK_R, EMBER - 27, [fire(0.08)]),
  small('ember_wr', 'ember', LINK_R, EMBER + 27, [terrain]),

  // ---- Tempest (lower right): storm, shock, conduction ----
  small('tempest_s1', 'tempest', SPINE[0], TEMPEST, [storm(0.08)]),
  small('tempest_s2', 'tempest', SPINE[1], TEMPEST, [storm(0.08)]),
  small('tempest_l1', 'tempest', BRANCH[0], TEMPEST - 12, [s('shockEffectInc', 0.06)]),
  small('tempest_l2', 'tempest', BRANCH[1], TEMPEST - 17, [storm(0.08)]),
  small('tempest_l3', 'tempest', BRANCH[2], TEMPEST - 21, [s('critChanceAdd', 0.01)]),
  named(
    'notable',
    'rainshadow',
    'Rainshadow',
    'tempest',
    NOTABLE_R,
    TEMPEST - 24,
    [],
    { rainshadow: R.rainshadow },
    [`Wet enemies take ${pct(R.rainshadow)}% more Storm damage from you`],
  ),
  small('tempest_m1', 'tempest', BRANCH[0], TEMPEST, [storm(0.08)]),
  small('tempest_m2', 'tempest', BRANCH[1], TEMPEST, [terrain]),
  small('tempest_m3', 'tempest', BRANCH[2], TEMPEST, [s('shockEffectInc', 0.06)]),
  named('notable', 'overcharge', 'Overcharge', 'tempest', NOTABLE_R, TEMPEST, [
    s('chargeDurationAdd', 0.5),
    storm(0.1),
  ]),
  small('tempest_r1', 'tempest', BRANCH[0], TEMPEST + 12, [s('conductionRangeInc', 0.08)]),
  small('tempest_r2', 'tempest', BRANCH[1], TEMPEST + 17, [storm(0.08)]),
  small('tempest_r3', 'tempest', BRANCH[2], TEMPEST + 21, [s('conductionRangeInc', 0.08)]),
  named(
    'notable',
    'conduit',
    'Conduit',
    'tempest',
    NOTABLE_R,
    TEMPEST + 24,
    [s('conductionRangeAdd', 15), s('conductionCellsAdd', 200)],
    {},
    ['Water you electrify conducts 15 cells farther, with a cell cap 200 higher'],
  ),
  small('tempest_k1', 'tempest', KEY_PATH_R, TEMPEST, [storm(0.08)]),
  named(
    'keystone',
    'stormglass',
    'Stormglass',
    'tempest',
    KEYSTONE_R,
    TEMPEST,
    [],
    { stormglass: R.stormglass.stormMore },
    [
      'Ice and ice bridges conduct your Storm like water',
      `Enemies that are Shocked and Frozen take ${pct(R.stormglass.stormMore)}% more Storm damage`,
    ],
  ),
  small('tempest_wl', 'tempest', LINK_R, TEMPEST - 27, [s('critChanceAdd', 0.01)]),
  small('tempest_wr', 'tempest', LINK_R, TEMPEST + 27, [storm(0.08)]),

  // ---- Rime (lower left): frost, freeze, ice ----
  small('rime_s1', 'rime', SPINE[0], RIME, [frost(0.08)]),
  small('rime_s2', 'rime', SPINE[1], RIME, [frost(0.08)]),
  small('rime_l1', 'rime', BRANCH[0], RIME - 12, [s('damageInc.physical', 0.08)]),
  small('rime_l2', 'rime', BRANCH[1], RIME - 17, [frost(0.08)]),
  small('rime_l3', 'rime', BRANCH[2], RIME - 21, [s('chillGainInc', 0.08)]),
  named('notable', 'brittle', 'Brittle', 'rime', NOTABLE_R, RIME - 24, [], { brittle: R.brittle }, [
    `Chilled and Frozen enemies take ${pct(R.brittle)}% more Strike damage`,
  ]),
  small('rime_m1', 'rime', BRANCH[0], RIME, [s('chillGainInc', 0.08)]),
  small('rime_m2', 'rime', BRANCH[1], RIME, [s('freezeDurationInc', 0.08)]),
  small('rime_m3', 'rime', BRANCH[2], RIME, [s('chillEffectInc', 0.06)]),
  named('notable', 'deep_freeze', 'Deep Freeze', 'rime', NOTABLE_R, RIME, [
    s('freezeDurationAdd', 0.4),
    s('chillGainInc', 0.15),
  ]),
  small('rime_r1', 'rime', BRANCH[0], RIME + 12, [s('iceDurationInc', 0.1)]),
  small('rime_r2', 'rime', BRANCH[1], RIME + 17, [terrain]),
  small('rime_r3', 'rime', BRANCH[2], RIME + 21, [frost(0.08)]),
  named(
    'notable',
    'long_winter',
    'Long Winter',
    'rime',
    NOTABLE_R,
    RIME + 24,
    [s('iceDurationInc', 0.5)],
    {},
    ['Ice and ice bridges you create last 50% longer'],
  ),
  small('rime_k1', 'rime', KEY_PATH_R, RIME, [s('ailmentEffectInc', 0.06)]),
  named(
    'keystone',
    'hydromancer',
    'Hydromancer',
    'rime',
    KEYSTONE_R,
    RIME,
    [],
    { hydromancer: R.hydromancer.waterSeconds },
    ["You're always Wet", `Dodging leaves shallow water along your path for ${R.hydromancer.waterSeconds} s`],
  ),
  small('rime_wl', 'rime', LINK_R, RIME - 27, [frost(0.08)]),
  small('rime_wr', 'rime', LINK_R, RIME + 27, [terrain]),

  // ---- Warden (outer ring every 30°, spurs inward between the sectors): life, dodge, defense ----
  small('warden_r0', 'warden', RING_R, 0, [life]),
  small('warden_r30', 'warden', RING_R, 30, [s('damageInc.physical', 0.08)]),
  small('warden_r60', 'warden', RING_R, 60, [s('dodgeRechargeInc', 0.04)]),
  small('warden_r90', 'warden', RING_R, 90, [life]),
  small('warden_r120', 'warden', RING_R, 120, [s('moveSpeedInc', 0.03)]),
  small('warden_r150', 'warden', RING_R, 150, [s('resistAdd.elemental', 0.04)]),
  small('warden_r180', 'warden', RING_R, 180, [life]),
  small('warden_r210', 'warden', RING_R, 210, [s('damageInc.physical', 0.08)]),
  small('warden_r240', 'warden', RING_R, 240, [s('dodgeRechargeInc', 0.04)]),
  small('warden_r270', 'warden', RING_R, 270, [life]),
  small('warden_r300', 'warden', RING_R, 300, [s('moveSpeedInc', 0.03)]),
  small('warden_r330', 'warden', RING_R, 330, [s('resistAdd.elemental', 0.04)]),
  small('warden_qh1', 'warden', 810, -30, [s('dodgeRechargeInc', 0.04)]),
  named('notable', 'quick_hands', 'Quick Hands', 'warden', 720, -30, [
    s('castSpeedInc', 0.1),
    s('dodgeRechargeInc', 0.15),
  ]),
  small('warden_sw1', 'warden', 810, 210, [life]),
  named('notable', 'second_wind', 'Second Wind', 'warden', 720, 210, [s('dodgeChargesAdd', 1)]),
  small('warden_b1', 'warden', 810, 90, [life]),
  small('warden_b2', 'warden', 720, 90, [s('resistAdd.elemental', 0.04)]),
  small('warden_b3', 'warden', 630, 90, [life]),
] as const;

export type PassiveId = (typeof nodeList)[number]['id'];

/** Every node by id. */
export const passiveNodes: Readonly<Record<PassiveId, PassiveNode<PassiveId>>> = Object.fromEntries(
  nodeList.map((n) => [n.id, n]),
) as Record<PassiveId, PassiveNode<PassiveId>>;

export const passiveIds: readonly PassiveId[] = nodeList.map((n) => n.id);

/** The node every Pattern starts from: always allocated, costs nothing, never refunded. */
export const PASSIVE_START: PassiveId = 'start';

/** Every edge once (undirected), in data/passiveEdges.ts. */
export { passiveEdges } from './passiveEdges';

export function isPassiveId(id: string): id is PassiveId {
  return Object.prototype.hasOwnProperty.call(passiveNodes, id);
}
