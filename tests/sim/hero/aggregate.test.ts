import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '../../../src/sim';
import { emptyHeroMods } from '../../../src/sim/hero/mods';
import { refreshHero } from '../../../src/sim/hero/hero';
import { fuseEffectLines } from '../../../data/fuseEffects';
import { loadRoomText } from '../../../tools/lib/rooms';
import { allocate, allocateExactly, fuse } from './helpers';

const game = (): GameState => createGame({ seed: 1, roomText: loadRoomText('test/m0_room') });

describe('aggregating passives into HeroMods', () => {
  it('no passives and no parts give the neutral mods', () => {
    const s = game();
    refreshHero(s);
    expect(s.heroMods).toEqual(emptyHeroMods());
  });

  it('notables add their numbers (Kindler, Deep Freeze, Conduit, Quick Hands, Second Wind, Spellwright)', () => {
    const s = game();
    allocateExactly(
      s,
      'kindler',
      'deep_freeze',
      'conduit',
      'quick_hands',
      'second_wind',
      'spellwright',
      'overcharge',
    );
    const m = s.heroMods;
    expect(m.fireSpreadInc).toBeCloseTo(0.3);
    expect(m.damageInc.fire).toBeCloseTo(0.1);
    expect(m.freezeDurationAdd).toBeCloseTo(0.4);
    expect(m.chillGainInc).toBeCloseTo(0.15);
    expect(m.conductionRangeAdd).toBe(15);
    expect(m.conductionCellsAdd).toBe(200);
    expect(m.castSpeedInc).toBeCloseTo(0.1);
    expect(m.dodgeRechargeInc).toBeCloseTo(0.15);
    expect(m.dodgeChargesAdd).toBe(1);
    expect(m.capacityAdd).toBe(1);
    expect(m.chargeDurationAdd).toBeCloseTo(0.5);
    expect(m.damageInc.storm).toBeCloseTo(0.1);
  });

  it('rule notables and keystones go into effects; keystones are listed sorted', () => {
    const s = game();
    allocateExactly(s, 'single_thread', 'oilcraft', 'wildheart', 'echoing_thread', 'brittle', 'rainshadow');
    const m = s.heroMods;
    expect(m.keystones).toEqual(['single_thread', 'wildheart']);
    expect(m.effects).toEqual({
      single_thread: 0.7,
      oilcraft: 0.25,
      wildheart: 0.3,
      echoing_thread: 1,
      brittle: 0.25,
      rainshadow: 0.15,
    });
    expect(m.capacityAdd).toBe(-3);
    expect(m.fireSpreadInc).toBeCloseTo(0.5);
  });

  it('small nodes: elemental damage feeds three types, ailment effect three effects, elemental resistance three resistances', () => {
    const s = game();
    allocateExactly(s, 'weaver_s2', 'ember_r2', 'warden_r150');
    const m = s.heroMods;
    for (const t of ['fire', 'frost', 'storm'] as const) {
      expect(m.damageInc[t]).toBeCloseTo(0.04);
      expect(m.resistAdd[t]).toBeCloseTo(0.04);
    }
    expect(m.damageInc.physical).toBe(0);
    expect(m.igniteEffectInc).toBeCloseTo(0.06);
    expect(m.chillEffectInc).toBeCloseTo(0.06);
    expect(m.shockEffectInc).toBeCloseTo(0.06);
  });

  it('a path of small nodes sums (every Ember fire node)', () => {
    const s = game();
    allocate(s, 'ember_s2', 'ember_l3', 'ember_m2', 'ember_r1');
    // weaver_n (cast speed) + 5 fire nodes.
    expect(s.heroMods.damageInc.fire).toBeCloseTo(0.4);
    expect(s.heroMods.castSpeedInc).toBeCloseTo(0.03);
  });
});

describe('aggregating fused Fuse parts (CONTENT §4)', () => {
  it('tiers multiply numbers by 1, 1.5 and 2', () => {
    for (const [tier, k] of [
      [1, 1],
      [2, 1.5],
      [3, 2],
    ] as const) {
      const s = game();
      fuse(s, ['rime_mote', tier], ['bog_gill', tier]);
      expect(s.heroMods.freezeDurationInc).toBeCloseTo(0.4 * k);
      expect(s.heroMods.effects.arc_range_inc).toBeCloseTo(0.5 * k);
      expect(s.heroMods.effects.arc_targets_add).toBeCloseTo(2 * k);
      expect(s.heroMods.parts).toEqual([
        { part: 'rime_mote', tier },
        { part: 'bog_gill', tier },
      ]);
    }
  });

  it('every numeric part lands in its field', () => {
    const s = game();
    fuse(
      s,
      ['shield_plate', 1],
      ['storm_antler', 1],
      ['ember_feather', 1],
      ['kiln_chitin', 1],
      ['matriarchs_sac', 1],
      ['tar_gland', 1],
    );
    const m = s.heroMods;
    expect(m.projectileDamageTakenLess).toBeCloseTo(0.2);
    expect(m.chargeDurationAdd).toBeCloseTo(0.5);
    expect(m.effects.projectile_speed_inc).toBeCloseTo(0.25);
    expect(m.dodgeRechargeInc).toBeCloseTo(0.15);
    expect(m.effects.oiled_on_hit).toBe(2);
    expect(m.effects.tar_gland).toBe(2);
  });

  it('parts without a number gain 10% / 20% increased damage of their element at tier II / III', () => {
    for (const [tier, inc] of [
      [1, 0],
      [2, 0.1],
      [3, 0.2],
    ] as const) {
      const s = game();
      fuse(s, ['tinder_tooth', tier], ['cinder_heart', tier]);
      expect(s.heroMods.damageInc.fire).toBeCloseTo(2 * inc);
      expect(s.heroMods.effects.tinder_tooth).toBe(1);
      expect(s.heroMods.extraWeaves).toEqual(['Harvest > Nova[Fire]']);
    }
  });

  it('only the equipped spindle counts; unknown parts are listed with no effect', () => {
    const s = game();
    fuse(s, ['rime_mote', 1], ['mystery_part', 2]);
    expect(s.heroMods.parts.map((p) => p.part)).toEqual(['rime_mote', 'mystery_part']);
    s.hero.equipped.spindle = null;
    refreshHero(s);
    expect(s.heroMods).toEqual(emptyHeroMods());
  });

  it('tooltip lines scale with the tier', () => {
    expect(fuseEffectLines('bog_gill', 3)).toEqual([
      'Storm arcs between Wet enemies reach 100% farther and hit 4 more targets',
    ]);
    expect(fuseEffectLines('rime_mote', 2)).toEqual(['Freeze lasts 60% longer']);
    expect(fuseEffectLines('cinder_heart', 3)).toEqual([
      'Grants Harvest > Nova[Fire] as an extra weave that uses no slot and no Capacity',
      '20% increased Fire damage',
    ]);
    expect(fuseEffectLines('nope', 1)).toEqual([]);
  });
});
