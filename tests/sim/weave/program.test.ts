import { describe, expect, it } from 'vitest';
import { shipsThrough } from '../../../data/runes';
import { spindles } from '../../../data/spindles';
import { fanRotations, rotationDeg, specPacket, spindleContext, type Rotation } from '../../../src/sim';
import { compileError, expectClose, program, testCtx } from './helpers';

const COS15 = (Math.sqrt(6) + Math.sqrt(2)) / 4;
const SIN15 = (Math.sqrt(6) - Math.sqrt(2)) / 4;

function expectRotation(r: Rotation, deg: number): void {
  const rad = (deg * Math.PI) / 180;
  expect(r.cos).toBeCloseTo(Math.cos(rad), 14);
  expect(r.sin).toBeCloseTo(Math.sin(rad), 14);
  expect(r.cos * r.cos + r.sin * r.sin).toBeCloseTo(1, 15);
}

describe('rotations (compile-time, arithmetic only)', () => {
  it('Split gives 3 unit vectors at −15°, 0°, +15°', () => {
    const { instances } = program('Cast > Bolt[Fire, Split]').root;
    expect(instances.count).toBe(3);
    expect(instances.fanDeg).toBe(30);
    const [a, b, c] = instances.rotations;
    expect(b).toEqual({ cos: 1, sin: 0 });
    expect(a!.cos).toBeCloseTo(COS15, 15);
    expect(a!.sin).toBeCloseTo(-SIN15, 15);
    expect(c!.cos).toBeCloseTo(COS15, 15);
    expect(c!.sin).toBeCloseTo(SIN15, 15);
    for (const r of instances.rotations) expect(Math.hypot(r.cos, r.sin)).toBeCloseTo(1, 15);
  });

  it('matches Math.cos/sin across the circle, exact at quarter turns', () => {
    for (let deg = -720; deg <= 720; deg += 7.5) expectRotation(rotationDeg(deg), deg);
    expect(rotationDeg(90)).toEqual({ cos: 0, sin: 1 });
    expect(rotationDeg(180)).toEqual({ cos: -1, sin: 0 });
    expect(rotationDeg(-90)).toEqual({ cos: 0, sin: -1 });
    expect(fanRotations(1, 30)).toEqual([{ cos: 1, sin: 0 }]);
  });

  it('Orb, Seeker and Fork precompute their per-tick and fork rotations', () => {
    expectRotation(tickOf('Cast > Orb[Fire]'), 6);
    const bolt = program('Cast > Bolt[Fire, Seeker, Fork]').root;
    expect(bolt.seeker!.turnRateDeg).toBe(180);
    expectRotation(bolt.seeker!.tickRotation, 3);
    expect(bolt.fork!.count).toBe(2);
    expect(bolt.fork!.life).toBe(0.5);
    expectRotation(bolt.fork!.rotations[0]!, -40);
    expectRotation(bolt.fork!.rotations[1]!, 40);
  });
});

function tickOf(notation: string): Rotation {
  const p = program(notation).root.params;
  if (p.form !== 'orb') throw new Error('not an orb');
  return p.tickRotation;
}

describe('elements: shares, inheritance and Infuse', () => {
  it('several elements split base damage evenly, in slot order', () => {
    const s = program('Cast > Bolt[Frost, Fire, Storm]').root;
    expect(s.elements.map((e) => e.element)).toEqual(['frost', 'fire', 'storm']);
    for (const e of s.elements) expect(e.share).toBeCloseTo(1 / 3, 15);
    expect(s.shares.physical).toBe(0);
    expect(s.shares.fire + s.shares.frost + s.shares.storm).toBeCloseTo(1, 15);
  });

  it('a branch spell with no element inherits its parent’s, down several levels (#11, #14)', () => {
    const beam = program('Cast > Sigil[Storm] > Emit > Beam[Chain]').root.children[0]!.spec;
    expect(beam.elements).toEqual([
      {
        element: 'storm',
        damageType: 'storm',
        share: 1,
        ailment: 'shock',
        wetDuration: 0,
        source: 'inherited',
      },
    ]);
    let s = program(
      'Cast > Bolt[Storm, Split] > OnHit > Bolt[Split] > OnHit > Bolt[Split] > OnHit > Bolt[Split]',
    ).root;
    while (s.children.length) {
      s = s.children[0]!.spec;
      expect(s.shares.storm).toBe(1);
      expect(s.elements[0]!.source).toBe('inherited');
    }
    expect(s.depth).toBe(3);
  });

  it('a branch spell with its own element does not inherit', () => {
    const nova = program('Cast > Bolt[Fire] > OnHit > Nova[Frost]').root.children[0]!.spec;
    expect(nova.elements.map((e) => e.element)).toEqual(['frost']);
  });

  it('Infuse adds the spell’s elements to every branch spell below it', () => {
    const root = program('Cast > Bolt[Fire, Infuse] > OnHit > Nova[Frost] > OnHit > Lob[Storm]').root;
    const nova = root.children[0]!.spec;
    const lob = nova.children[0]!.spec;
    expect(nova.elements.map((e) => [e.element, e.source])).toEqual([
      ['frost', 'own'],
      ['fire', 'infused'],
    ]);
    expect(nova.shares).toEqual({ physical: 0, fire: 0.5, frost: 0.5, storm: 0 });
    expect(lob.elements.map((e) => [e.element, e.source])).toEqual([
      ['storm', 'own'],
      ['fire', 'infused'],
    ]);
    // Infuse on a child carries that child's (inherited) elements further down.
    const deep = program('Cast > Bolt[Fire] > OnHit > Bolt[Infuse] > OnHit > Nova[Frost]').root;
    expect(deep.children[0]!.spec.children[0]!.spec.elements.map((e) => e.element)).toEqual([
      'frost',
      'fire',
    ]);
  });

  it('Strike without an element deals physical damage', () => {
    expect(program('Cast > Strike[]').root.shares).toEqual({ physical: 1, fire: 0, frost: 0, storm: 0 });
  });
});

describe('damage numbers', () => {
  it('lists "more" multipliers with labels: own modifiers, then branch penalties top-down', () => {
    const nova = program('Cast > Nova[Fire, Heavy, Saturate]').root;
    expect(nova.more).toEqual([
      { source: 'heavy', label: 'Heavy', mult: 1.3 },
      { source: 'saturate', label: 'Saturate', mult: 0.8 },
    ]);
    expectClose(nova.moreProduct, 1.04);

    let s = program(
      'Cast > Bolt[Storm, Split] > OnHit > Bolt[Split] > OnHit > Bolt[Split] > OnHit > Bolt[Split]',
    ).root;
    s = s.children[0]!.spec.children[0]!.spec.children[0]!.spec;
    expect(s.more).toEqual([
      { source: 'split', label: 'Split', mult: 0.75 },
      { source: 'on_hit', label: 'On Hit branch (depth 1)', mult: 0.65 },
      { source: 'on_hit', label: 'On Hit branch (depth 2)', mult: 0.65 },
      { source: 'on_hit', label: 'On Hit branch (depth 3)', mult: 0.65 },
    ]);
    expectClose(s.moreProduct, 0.75 * 0.65 * 0.65 * 0.65);

    const emitted = program('Pulse > Orb[Fire, Wide] > Emit > Bolt[Fire, Seeker]').root.children[0]!;
    expect(emitted.damageMult).toBe(0.5);
    expect(emitted.spec.more).toEqual([{ source: 'emit', label: 'Emit branch (depth 1)', mult: 0.5 }]);
    // No-penalty branches add nothing.
    expect(program('Cast > Lob[Fire] > OnExpire > Nova[Fire, Focus]').root.children[0]!.spec.more).toEqual([
      { source: 'focus', label: 'Focus', mult: 1.4 },
    ]);
  });

  it('base damage scales 1.11 per rune level; Ironbark adds 12 to Strike; Loomsteel adds a level', () => {
    expectClose(
      program('Cast > Bolt[Fire]', testCtx(99, { runeLevel: 5 })).root.baseDamage,
      12 * 1.11 ** 4,
      10,
    );
    const ironbark = spindleContext(spindles.ironbark, { allowShips: 'all' });
    expect(program('Cast > Strike[]', ironbark).root.baseDamage).toBe(28);
    expect(program('Cast > Bolt[Fire]', ironbark).root.baseDamage).toBe(12);
    const loomsteel = program('Cast > Bolt[Fire]', spindleContext(spindles.loomsteel, { allowShips: 'all' }));
    expect(loomsteel.runeLevel).toBe(2);
    expectClose(loomsteel.root.baseDamage, 13.32);
    expect(program('Cast > Sigil[Fire] > Emit > Bolt[]').root.baseDamage).toBe(0);
  });

  it('crit: form base + Keen + Storm; multiplier 1.5 + Keen', () => {
    const s = program('Cast > Strike[Storm, Echo, Keen]').root;
    expectClose(s.critChance, 0.07 + 0.05 + 0.02);
    expectClose(s.critMultiplier, 1.8);
    expect(program('Cast > Bolt[Fire]').root.critMultiplier).toBe(1.5);
  });

  it('specPacket feeds the combat formula', () => {
    const s = program('Cast > Bolt[Fire, Frost, Heavy]').root;
    const p = specPacket(s, [0.8]);
    expect(p.base).toEqual({ physical: 0, fire: 6, frost: 6, storm: 0 });
    expect(p.more[0]).toBeCloseTo(0.3, 15);
    expect(p.more[1]).toBeCloseTo(-0.2, 15);
    expect(p.critChance).toBe(0.06);
  });
});

describe('resolved behavior', () => {
  it('Wide and Focus scale area; lengths scale by its square root', () => {
    const nova = program('Cast > Nova[Fire, Wide]').root;
    expect(nova.areaMult).toBe(1.4);
    if (nova.params.form !== 'nova') throw new Error();
    expectClose(nova.params.radius, 10 * Math.sqrt(1.4));
    const both = program('Cast > Swath[Fire, Wide, Focus]').root;
    expectClose(both.areaMult, 0.98);
    if (both.params.form !== 'swath') throw new Error();
    expectClose(both.params.length * both.params.width, 42 * 0.98);
  });

  it('Lingering lengthens Orb, Sigil, ailments and terrain; Saturate grows the footprint', () => {
    const orb = program('Cast > Orb[Fire, Lingering, Saturate]').root;
    if (orb.params.form !== 'orb') throw new Error();
    expect(orb.params.duration).toBe(4.5);
    expect(orb.ailmentDurationMult).toBe(1.3);
    expect(orb.terrain).toEqual({
      footprint: { kind: 'trail', radius: Math.SQRT2, interval: 0.25 },
      areaMult: 2,
      durationMult: 1.5,
    });
    const sigil = program('Cast > Sigil[Storm, Lingering] > Emit > Beam[]').root;
    expect(sigil.params).toEqual({ form: 'sigil', range: 30, duration: 6 });
    expectClose(
      (program('Cast > Bolt[Fire, Saturate]').root.terrain.footprint as { radius: number }).radius,
      2 * Math.SQRT2,
    );
    expect(program('Cast > Beam[Fire, Saturate]').root.terrain.footprint).toEqual({ kind: 'line', width: 2 });
    expect(program('Cast > Nova[Fire, Saturate]').root.terrain.footprint).toEqual({
      kind: 'hit_shape',
      scale: Math.SQRT2,
    });
  });

  it('Swift speeds bolts and shortens lob flights', () => {
    expect(program('Cast > Bolt[Fire, Swift]').root.params).toEqual({
      form: 'bolt',
      speed: 105,
      life: 0.9,
      radius: 1,
    });
    const lob = program('Cast > Lob[Fire, Swift]').root.params;
    expect(lob.form === 'lob' && lob.flightTime).toBeCloseTo(0.35, 15);
  });

  it('proc rules: On Hit fires up to 3 times with Pierce or Chain; area forms on the first target only', () => {
    const pierce = program('Cast > Bolt[Fire, Pierce] > OnHit > Nova[]').root.children[0]!;
    expect(pierce.proc).toEqual({ kind: 'on_hit', maxProcsPerInstance: 3, firstTargetOnly: false });
    expect(program('Cast > Beam[Storm, Chain] > OnHit > Nova[]').root.children[0]!.proc).toEqual({
      kind: 'on_hit',
      maxProcsPerInstance: 3,
      firstTargetOnly: false,
    });
    expect(program('Cast > Nova[Fire] > OnHit > Bolt[]').root.children[0]!.proc).toEqual({
      kind: 'on_hit',
      maxProcsPerInstance: 1,
      firstTargetOnly: true,
    });
    const twin = program('Cast > Bolt[Storm] { OnHit > Nova[Storm]; OnExpire > Lob[Fire] }').root;
    expect(twin.children.map((c) => c.branch)).toEqual(['on_hit', 'on_expire']);
    expect(twin.children[1]!.proc).toEqual({ kind: 'on_expire', maxProcsPerInstance: 1 });
    expect(twin.children[1]!.origin).toBe('end_point');
    expect(program('Cast > Beam[Frost, Pierce] > OnKill > Nova[Frost, Wide]').root.children[0]!.proc).toEqual(
      {
        kind: 'on_kill',
      },
    );
  });

  it('branch spells: who can hit their source, and where a Lob child lands', () => {
    const twin = program('Cast > Bolt[Storm] { OnHit > Nova[Storm]; OnExpire > Lob[Fire] }').root;
    expect(twin.canHitSource).toBe(false);
    expect(twin.children[0]!.spec.canHitSource).toBe(true);
    const lob = twin.children[1]!.spec;
    expect(lob.depth).toBe(1);
    expect(lob.params.form === 'lob' && lob.params.randomLandRadius).toBe(10);
    const rootLob = program('Cast > Lob[Fire]').root.params;
    expect(rootLob.form === 'lob' && rootLob.randomLandRadius).toBeNull();
    expect(program('Pulse > Orb[Fire] > Emit > Beam[]').root.children[0]!.spec.canHitSource).toBe(false);
  });

  it('Echo repeats with 20% less damage', () => {
    expect(program('Cast > Strike[Storm, Echo, Keen]').root.echo).toEqual({ delay: 0.35, damageMult: 0.8 });
  });

  it('Gale doubles knockback (M8 data)', () => {
    expect(program('Cast > Strike[Gale]').root.knockback).toBe(6);
  });

  it('ships gating: excluding M5 makes Fork an error', () => {
    expect(
      compileError('Cast > Bolt[Fire, Fork]', testCtx(99, { allowShips: shipsThrough('M2') })).message,
    ).toBe('Fork arrives in M5');
  });
});
