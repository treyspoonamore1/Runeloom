/**
 * The Pattern's edges (data/passives.ts has the nodes and the layout): every edge once,
 * undirected. A sector is a spine, three branches joined by short arcs, the keystone paths and
 * two links out to the Warden ring.
 */
import type { PassiveId } from './passives';

type Edge = readonly [PassiveId, PassiveId];

/** A sector's internal edges (spine, three branches with arc links, keystone paths, Warden links). */
function sector(
  a: 'ember' | 'tempest' | 'rime',
  fromRing: PassiveId,
  nl: PassiveId,
  nm: PassiveId,
  nr: PassiveId,
): Edge[] {
  const id = (k: string) => `${a}_${k}` as PassiveId;
  return [
    [fromRing, id('s1')],
    [id('s1'), id('s2')],
    [id('s2'), id('l1')],
    [id('s2'), id('m1')],
    [id('s2'), id('r1')],
    [id('l1'), id('m1')],
    [id('m1'), id('r1')],
    [id('l1'), id('l2')],
    [id('l2'), id('l3')],
    [id('l3'), nl],
    [id('m1'), id('m2')],
    [id('m2'), id('m3')],
    [id('m3'), nm],
    [id('r1'), id('r2')],
    [id('r2'), id('r3')],
    [id('r3'), nr],
    [nl, id('wl')],
    [nr, id('wr')],
  ];
}

/** Every edge once (undirected). */
export const passiveEdges: readonly Edge[] = [
  // Weaver.
  ['start', 'weaver_n'],
  ['start', 'weaver_se'],
  ['start', 'weaver_sw'],
  ['weaver_n', 'weaver_ne'],
  ['weaver_ne', 'weaver_se'],
  ['weaver_se', 'weaver_s'],
  ['weaver_s', 'weaver_sw'],
  ['weaver_sw', 'weaver_nw'],
  ['weaver_nw', 'weaver_n'],
  ['weaver_ne', 'weaver_ne1'],
  ['weaver_ne1', 'spellwright'],
  ['weaver_nw', 'weaver_nw1'],
  ['weaver_nw1', 'echoing_thread'],
  ['weaver_s', 'weaver_s1'],
  ['weaver_s1', 'weaver_s2'],
  ['weaver_s2', 'living_loom'],
  ['weaver_s2', 'single_thread'],
  ['weaver_s2', 'weaver_s3'],
  ['weaver_s3', 'warden_b3'],
  // Elements.
  ...sector('ember', 'weaver_n', 'slow_burn', 'kindler', 'oilcraft'),
  ['kindler', 'ember_k1'],
  ['ember_k1', 'wildheart'],
  ['kindler', 'ember_k2'],
  ['ember_k2', 'pyre_walker'],
  ['ember_wl', 'warden_r240'],
  ['ember_wr', 'warden_r300'],
  ...sector('tempest', 'weaver_se', 'rainshadow', 'overcharge', 'conduit'),
  ['overcharge', 'tempest_k1'],
  ['tempest_k1', 'stormglass'],
  ['tempest_wl', 'warden_r0'],
  ['tempest_wr', 'warden_r60'],
  ...sector('rime', 'weaver_sw', 'brittle', 'deep_freeze', 'long_winter'),
  ['deep_freeze', 'rime_k1'],
  ['rime_k1', 'hydromancer'],
  ['rime_wl', 'warden_r120'],
  ['rime_wr', 'warden_r180'],
  // Warden ring and spurs.
  ['warden_r0', 'warden_r30'],
  ['warden_r30', 'warden_r60'],
  ['warden_r60', 'warden_r90'],
  ['warden_r90', 'warden_r120'],
  ['warden_r120', 'warden_r150'],
  ['warden_r150', 'warden_r180'],
  ['warden_r180', 'warden_r210'],
  ['warden_r210', 'warden_r240'],
  ['warden_r240', 'warden_r270'],
  ['warden_r270', 'warden_r300'],
  ['warden_r300', 'warden_r330'],
  ['warden_r330', 'warden_r0'],
  ['warden_r330', 'warden_qh1'],
  ['warden_qh1', 'quick_hands'],
  ['warden_r210', 'warden_sw1'],
  ['warden_sw1', 'second_wind'],
  ['warden_r90', 'warden_b1'],
  ['warden_b1', 'warden_b2'],
  ['warden_b2', 'warden_b3'],
];
