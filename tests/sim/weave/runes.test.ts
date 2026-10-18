/**
 * One compile-level test per rune (CLAUDE.md: every rune gets a unit test): a minimal weave using
 * it compiles, and its numbers reach the SpellProgram. Behavior at runtime is tested with the
 * runtime. Keyed by RuneId, so adding a rune without a test fails the typecheck.
 */
import { describe, expect, it } from 'vitest';
import { runeByNotation, runeIds, runes, type RuneId } from '../../../data/runes';
import type { SpellProgram, SpellSpec } from '../../../src/sim';
import { expectClose, program } from './helpers';

type Check = [notation: string, check: (p: SpellProgram, root: SpellSpec) => void];

const child = (s: SpellSpec, i = 0): SpellSpec => s.children[i]!.spec;

const cases: Record<RuneId, Check> = {
  // Triggers
  cast: [
    'Cast > Bolt[Fire]',
    (p) => {
      expect(p.trigger).toMatchObject({
        event: 'press',
        automatic: false,
        usesCastTime: true,
        manaMult: 1,
        icd: 0,
      });
      expect(p.castTime).toBe(0.45);
    },
  ],
  pulse: [
    'Pulse > Bolt[Fire]',
    (p) => {
      expect(p.trigger).toMatchObject({
        event: 'interval',
        period: 2,
        aim: 'nearest_enemy',
        aimRange: 40,
        automatic: true,
      });
      expect(p.castTime).toBe(0);
      expect(
        program('Pulse > Bolt[Fire]', { capacity: 9, allowShips: 'all', runeLevel: 11 }).trigger.period,
      ).toBeCloseTo(1.5, 12);
      expect(
        program('Pulse > Bolt[Fire]', { capacity: 9, allowShips: 'all', runeLevel: 30 }).trigger.period,
      ).toBe(1);
    },
  ],
  on_dodge: [
    'OnDodge > Nova[Frost]',
    (p) =>
      expect(p.trigger).toMatchObject({
        event: 'dodge_start',
        manaMult: 0.7,
        icd: 0.5,
        aim: 'dodge_direction',
      }),
  ],
  harvest: [
    'Harvest > Nova[Fire]',
    (p) =>
      expect(p.trigger).toMatchObject({
        event: 'kill',
        manaMult: 0.5,
        icd: 0.25,
        origin: 'killed_enemy',
        aim: 'away_from_caster',
      }),
  ],
  on_crit: [
    'OnCrit > Bolt[Storm]',
    (p) =>
      expect(p.trigger).toMatchObject({
        event: 'crit',
        manaMult: 0.6,
        icd: 0.3,
        origin: 'crit_target',
        aim: 'hit_direction',
      }),
  ],
  on_hurt: [
    'OnHurt > Nova[Fire]',
    (p) => {
      expect(p.trigger).toMatchObject({
        event: 'hurt',
        manaMult: 0,
        icd: 1,
        hurtThreshold: 0.05,
        origin: 'caster',
      });
      expect(p.mana).toBe(0);
    },
  ],
  channel: [
    'Channel > Beam[Storm]',
    (p) =>
      expect(p.trigger).toMatchObject({
        event: 'held',
        period: 0.2,
        manaMult: 0.3,
        moveSlow: 0.4,
        usesCastTime: false,
        automatic: false,
      }),
  ],
  shatter: [
    'Shatter > Nova[Frost]',
    (p) =>
      expect(p.trigger).toMatchObject({
        event: 'shatter',
        manaMult: 0.6,
        icd: 0.3,
        origin: 'shattered_enemy',
      }),
  ],
  // Forms
  bolt: [
    'Cast > Bolt[Fire]',
    (_, s) => {
      expect(s.params).toEqual({ form: 'bolt', speed: 70, life: 0.9, radius: 1 });
      expect(s).toMatchObject({
        baseDamage: 12,
        critChance: 0.06,
        knockback: 1,
        canHitSource: false,
        manaCost: 6.6000000000000005,
      });
      expect(s.terrain.footprint).toEqual({ kind: 'impact', radius: 2 });
    },
  ],
  nova: [
    'Cast > Nova[Fire]',
    (_, s) => {
      expect(s.params).toEqual({ form: 'nova', radius: 10, expandTime: 0.2 });
      expect(s).toMatchObject({ baseDamage: 14, critChance: 0.05, knockback: 2, canHitSource: true });
    },
  ],
  beam: [
    'Cast > Beam[Fire]',
    (p, s) => {
      expect(s.params).toEqual({ form: 'beam', length: 45, width: 1.5 });
      expect(s).toMatchObject({ baseDamage: 9, critChance: 0.05, canHitSource: false });
      expect(p.castTime).toBe(0.35);
    },
  ],
  lob: [
    'Cast > Lob[Fire]',
    (_, s) => {
      expect(s.params).toEqual({
        form: 'lob',
        range: 40,
        flightTime: 0.5,
        burstRadius: 5,
        randomLandRadius: null,
      });
      expect(s).toMatchObject({ baseDamage: 15, canHitSource: true });
    },
  ],
  orb: [
    'Cast > Orb[Fire]',
    (_, s) => {
      expect(s.params).toMatchObject({
        form: 'orb',
        orbitRadius: 6,
        revolutionsPerSecond: 1,
        duration: 3,
        radius: 1.5,
        hitInterval: 0.5,
      });
      expect(s).toMatchObject({ baseDamage: 6, canHitSource: false });
      expect(s.terrain.footprint).toEqual({ kind: 'trail', radius: 1, interval: 0.25 });
    },
  ],
  strike: [
    'Cast > Strike[]',
    (p, s) => {
      expect(s.params).toMatchObject({ form: 'strike', arcDeg: 120, reach: 5 });
      if (s.params.form === 'strike') expectClose(s.params.halfAngleCos, 0.5, 15);
      expect(s).toMatchObject({ baseDamage: 16, critChance: 0.07, knockback: 3, elements: [] });
      expect(s.shares.physical).toBe(1);
      expect(p.mana).toBe(4);
    },
  ],
  swath: [
    'Cast > Swath[Fire]',
    (_, s) => {
      expect(s.params).toEqual({ form: 'swath', length: 14, width: 3 });
      expect(s).toMatchObject({ baseDamage: 4, critChance: 0 });
    },
  ],
  sigil: [
    'Cast > Sigil[Fire] > Emit > Bolt[]',
    (p, s) => {
      expect(s.params).toEqual({ form: 'sigil', range: 30, duration: 4 });
      expect(s).toMatchObject({ baseDamage: 0, critChance: 0 });
      expect(s.terrain.footprint).toEqual({ kind: 'none' });
      expect(p.castTime).toBe(0.5);
    },
  ],
  // Elements
  fire: [
    'Cast > Bolt[Fire]',
    (_, s) => expect(s.elements[0]).toMatchObject({ damageType: 'fire', ailment: 'ignite' }),
  ],
  frost: [
    'Cast > Bolt[Frost]',
    (_, s) => expect(s.elements[0]).toMatchObject({ damageType: 'frost', ailment: 'chill' }),
  ],
  storm: [
    'Cast > Bolt[Storm]',
    (_, s) => {
      expect(s.elements[0]).toMatchObject({ damageType: 'storm', ailment: 'shock' });
      expectClose(s.critChance, 0.08);
    },
  ],
  tide: [
    'Cast > Bolt[Tide]',
    (_, s) => {
      expect(s.elements[0]).toMatchObject({ damageType: 'physical', ailment: 'wet', wetDuration: 3 });
      expect(s.shares.physical).toBe(1);
    },
  ],
  gale: ['Cast > Bolt[Gale]', (_, s) => expect(s).toMatchObject({ knockback: 2, shares: { physical: 1 } })],
  // Modifiers
  split: ['Cast > Lob[Fire, Split]', (_, s) => expect(s.instances.count).toBe(3)],
  chain: [
    'Cast > Beam[Storm, Chain]',
    (_, s) => expect(s.chain).toEqual({ count: 2, range: 12, lessPerChain: 0.15 }),
  ],
  pierce: ['Cast > Beam[Frost, Pierce]', (_, s) => expect(s.pierce).toBe(3)],
  wide: [
    'Cast > Strike[Wide]',
    (_, s) => s.params.form === 'strike' && expectClose(s.params.reach, 5 * Math.sqrt(1.4)),
  ],
  echo: ['Cast > Swath[Fire, Echo]', (_, s) => expect(s.echo).toEqual({ delay: 0.35, damageMult: 0.8 })],
  seeker: ['Cast > Bolt[Fire, Seeker]', (_, s) => expect(s.seeker?.turnRateDeg).toBe(180)],
  heavy: [
    'Cast > Beam[Fire, Heavy]',
    (p, s) => {
      expect(s.more).toEqual([{ source: 'heavy', label: 'Heavy', mult: 1.3 }]);
      expectClose(p.castTime, 0.35 * 1.15);
    },
  ],
  keen: [
    'Cast > Nova[Fire, Keen]',
    (_, s) => {
      expectClose(s.critChance, 0.1);
      expectClose(s.critMultiplier, 1.8);
    },
  ],
  lingering: [
    'Cast > Swath[Fire, Lingering]',
    (_, s) => expect(s).toMatchObject({ ailmentDurationMult: 1.3, terrain: { durationMult: 1.5 } }),
  ],
  saturate: [
    'Cast > Lob[Storm, Saturate]',
    (_, s) => {
      expect(s.terrain).toMatchObject({ areaMult: 2, footprint: { kind: 'hit_shape', scale: Math.SQRT2 } });
      expect(s.moreProduct).toBe(0.8);
    },
  ],
  fork: ['Cast > Bolt[Fire, Fork]', (_, s) => expect(s.fork).toMatchObject({ count: 2, life: 0.5 })],
  return: ['Cast > Bolt[Fire, Return]', (_, s) => expect(s.returns).toBe(true)],
  infuse: [
    'Cast > Nova[Frost, Infuse] > OnHit > Bolt[Fire]',
    (_, s) => expect(child(s).elements.map((e) => e.source)).toEqual(['own', 'infused']),
  ],
  focus: [
    'Cast > Lob[Fire, Focus]',
    (_, s) => {
      expect(s.areaMult).toBe(0.7);
      expect(s.moreProduct).toBe(1.4);
      if (s.params.form === 'lob') expectClose(s.params.burstRadius, 5 * Math.sqrt(0.7));
    },
  ],
  swift: ['Cast > Bolt[Fire, Swift]', (_, s) => expect(s.params).toMatchObject({ speed: 105 })],
  // Branches
  on_hit: [
    'Cast > Strike[] > OnHit > Strike[]',
    (_, s) => {
      expect(s.children[0]).toMatchObject({
        branch: 'on_hit',
        damageMult: 0.65,
        origin: 'hit_target',
        aim: 'parent_direction',
        complexity: 2,
      });
      expect(s.children[0]!.proc).toEqual({ kind: 'on_hit', maxProcsPerInstance: 1, firstTargetOnly: true });
    },
  ],
  on_expire: [
    'Cast > Orb[Fire] > OnExpire > Nova[]',
    (_, s) =>
      expect(s.children[0]).toMatchObject({
        branch: 'on_expire',
        damageMult: 1,
        origin: 'end_point',
        aim: 'last_direction',
      }),
  ],
  on_kill: [
    'Cast > Swath[Fire] > OnKill > Nova[]',
    (_, s) =>
      expect(s.children[0]).toMatchObject({
        branch: 'on_kill',
        damageMult: 1,
        origin: 'killed_target',
        proc: { kind: 'on_kill' },
      }),
  ],
  emit: [
    'Cast > Orb[Frost] > Emit > Bolt[]',
    (_, s) => {
      expect(s.children[0]).toMatchObject({
        branch: 'emit',
        damageMult: 0.5,
        origin: 'instance',
        aim: 'nearest_enemy',
      });
      expect(s.children[0]!.proc).toEqual({ kind: 'emit', interval: 0.5, aimRange: 30 });
    },
  ],
};

describe('every rune compiles and reaches the program', () => {
  for (const id of runeIds) {
    const [notation, check] = cases[id];
    it(`${id}: ${notation}`, () => {
      expect(runeByNotation(runes[id].notation)?.id).toBe(id);
      expect(notation.toLowerCase()).toContain(runes[id].notation.toLowerCase());
      const p = program(notation);
      check(p, p.root);
    });
  }
});
