/**
 * Fixture HeroMods aggregation (stand-in for the hero/items and passive agents' refreshHero):
 * spindle implicits, fixture affixes, Heart Seeds, Loom Shards, Fuse parts and fixture passives.
 */
import { isSpindleId, spindles, type SpindleImplicit } from '../../../data/spindles';
import { emptyHeroMods, type HeroMods } from '../../sim/hero/mods';
import { EQUIP_SLOTS, type HeroState } from '../../sim/hero/types';
import { fixtureAffixes } from './content';
import type { PassiveTreeView } from '../tree/adapter';

/** DESIGN §10.1: +8 max life per Heart Seed, +1 Capacity per Loom Shard. */
const HEART_SEED_LIFE = 8;
const LOOM_SHARD_CAPACITY = 1;

const PASSIVE_PATTERNS: Array<[RegExp, (m: HeroMods, v: number) => void]> = [
  [/^\+(\d+)% Fire damage$/, (m, v) => (m.damageInc.fire += v / 100)],
  [/^\+(\d+)% Frost damage$/, (m, v) => (m.damageInc.frost += v / 100)],
  [/^\+(\d+)% Storm damage$/, (m, v) => (m.damageInc.storm += v / 100)],
  [/^\+(\d+)% cast speed$/, (m, v) => (m.castSpeedInc += v / 100)],
  [/^\+(\d+) maximum life$/, (m, v) => (m.maxLifeAdd += v)],
  [/^\+(\d+)% Fire resistance$/, (m, v) => (m.resistAdd.fire += v / 100)],
  [/^\+(\d+)% dodge recharge$/, (m, v) => (m.dodgeRechargeInc += v / 100)],
  [/^\+(\d+) Capacity$/, (m, v) => (m.capacityAdd += v)],
  [/^\+(\d+) dodge charge$/, (m, v) => (m.dodgeChargesAdd += v)],
  [/^\+(\d+)% Ignite effect$/, (m, v) => (m.igniteEffectInc += v / 100)],
];

export function fixtureMods(hero: Readonly<HeroState>, tree: PassiveTreeView): HeroMods {
  const m = emptyHeroMods();
  const byUid = new Map(hero.items.map((it) => [it.uid, it]));
  for (const slot of EQUIP_SLOTS) {
    const uid = hero.equipped[slot];
    const it = uid === null ? undefined : byUid.get(uid);
    if (!it) continue;
    if (isSpindleId(it.base)) {
      const imp: SpindleImplicit = spindles[it.base].implicit;
      for (const [t, v] of Object.entries(imp.increased ?? {}))
        m.damageInc[t as keyof HeroMods['damageInc']] += v ?? 0;
      m.chillGainInc += imp.chillGain ?? 0;
      m.strikeFlatAdd += imp.strikeFlat ?? 0;
      m.runeLevelAdd.all += imp.runeLevels ?? 0;
      for (const f of it.fused) if (f) m.parts.push({ part: f.part, tier: f.tier });
    }
    for (const af of it.affixes) fixtureAffixes[af.id]?.apply(m, af.value);
  }
  m.maxLifeAdd += hero.heartSeeds * HEART_SEED_LIFE;
  m.capacityAdd += hero.loomShards * LOOM_SHARD_CAPACITY;
  const nodes = new Map(tree.nodes.map((n) => [n.id, n]));
  for (const id of hero.passives) {
    const n = nodes.get(id);
    if (!n) continue;
    if (n.type === 'keystone') m.keystones.push(n.name);
    for (const line of n.text)
      for (const [re, fn] of PASSIVE_PATTERNS) {
        const hit = re.exec(line);
        if (hit) fn(m, Number(hit[1]));
      }
  }
  m.keystones.sort();
  return m;
}
