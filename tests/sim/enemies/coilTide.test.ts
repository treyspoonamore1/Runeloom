import { describe, expect, it } from 'vitest';
import { Button, isBorrowed } from '../../../src/sim';
import { MAT } from '../../../data/materials';
import { weaves } from '../terrain/helpers';
import { eye, hit } from './coilHelpers';
import { groundAt, idx, ofType, place, run } from './helpers';

/**
 * DESIGN §10.5, CONTENT §13.3 "a typical Stranding", with Tide's real chemistry (rules 24, 27, 31):
 * the player paints Floodline (`Cast > Swath[Tide, Lingering]`) from the stone toward the Eye and
 * steps aside; the Coil follows the borrowed water (Exposed, normal damage); when the water returns
 * to stone it is Stranded for 5 s at 50% more.
 */

describe('Glasswater Coil: the Tide strand', () => {
  it('lured along a Floodline strip, Exposed in it, Stranded when it dries', () => {
    const { s, c } = eye(62, 84);
    weaves(s, ['Cast > Swath[Tide, Lingering]']);
    c.boss!.phase = 2;
    run(s, 30);
    // Paint the 14×3 strip north from the stone into the rim.
    run(s, 40, Button.Cast1, [62, 60]);
    expect(groundAt(s, 62, 75)).toBe(MAT.shallow_water);
    expect(isBorrowed(s, idx(s, 62, 75))).toBe(true);
    // Step aside onto dry stone, out of its lunge reach from the strip's end.
    place(s, 74, 86);
    let exposedOut = false;
    for (let i = 0; i < 8 * 60 && !exposedOut; i++) {
      run(s, 1);
      exposedOut = c.boss!.fen!.coil === 'exposed' && c.y > 72;
    }
    expect(exposedOut).toBe(true);
    expect(hit(s, c)).toBeCloseTo(100 * (1 + c.ailments.shock.effect), 3);
    // Lingering Tide lasts 15 s; then the strip is stone again and the Coil lies Stranded on it.
    let stranded = false;
    const ev = [];
    for (let i = 0; i < 16 * 60 && !stranded; i++) {
      ev.push(...run(s, 1));
      stranded = c.special.stranded;
    }
    expect(stranded).toBe(true);
    expect(ofType(ev, 'swimmerStranded')).toMatchObject([{ id: c.id, stranded: true }]);
    expect(groundAt(s, c.x, c.y)).toBe(MAT.stone);
    expect(c.boss!.fen!.coil).toBe('stranded');
    expect(hit(s, c)).toBeCloseTo(150 * (1 + c.ailments.shock.effect), 3);
    // After 5 s it crawls back to water (a spit puddle on the way may hold it a while).
    const t0 = s.tick;
    while (c.special.stranded && s.tick - t0 < 25 * 60) run(s, 1);
    expect(c.special.stranded).toBe(false);
    expect(s.tick - t0).toBeGreaterThanOrEqual(5 * 60 - 1);
  });

  it('without the lure it stays in the deep water, Submerged (90% less in phase 2)', () => {
    const { s, c } = eye(74, 86);
    c.boss!.phase = 2;
    run(s, 10 * 60);
    expect(groundAt(s, c.x, c.y)).toBe(MAT.deep_water);
    if (c.attack.phase === 'none') expect(hit(s, c)).toBeCloseTo(10 * (1 + c.ailments.shock.effect), 3);
  });
});
