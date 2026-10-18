import { describe, expect, it } from 'vitest';
import { spindles } from '../../../data/spindles';
import { spindleContext } from '../../../src/sim';
import { compiled, expectClose, program, testCtx } from './helpers';

describe('costs worked by hand (DESIGN §5.4)', () => {
  it('#3 Wildfire Seed: Cast > Lob[Fire] > OnExpire > Nova[Fire, Wide]', () => {
    // cx: Cast 0 + Lob 1 + Fire 1 + On Expire 2 (depth 1) + Nova 2 + Fire 1 + Wide 1 = 8
    // mana: Nova = 10 × 1.10 × 1.20 = 13.2; Lob = 7 × 1.10 + 0.5 × 13.2 = 7.7 + 6.6 = 14.3; × Cast 1.0
    const { program: p, costs } = compiled('Cast > Lob[Fire] > OnExpire > Nova[Fire, Wide]');
    expect(costs.complexity).toBe(8);
    expectClose(p.root.children[0]!.spec.manaCost, 13.2);
    expectClose(p.root.manaCost, 14.3);
    expectClose(costs.mana, 14.3);
    expectClose(costs.castTime, 0.55);
    expect(p.root.complexity).toBe(2);
    expect(p.root.children[0]!.complexity).toBe(2);
    expect(p.root.children[0]!.spec.complexity).toBe(4);
  });

  it('#13 Twin Fates: Cast > Bolt[Storm] { OnHit > Nova[Storm]; OnExpire > Lob[Fire] }', () => {
    // cx: 0 + (1 + 1) + (2 + 2 + 1) + (2 + 1 + 1) = 11
    // mana: Bolt 6 × 1.15 = 6.9; Nova 10 × 1.15 = 11.5; Lob 7 × 1.10 = 7.7
    //       6.9 + 0.5 × (11.5 + 7.7) = 6.9 + 9.6 = 16.5
    const { program: p, costs } = compiled(
      'Cast > Bolt[Storm] { OnHit > Nova[Storm]; OnExpire > Lob[Fire] }',
    );
    expect(costs.complexity).toBe(11);
    expectClose(p.root.children[0]!.spec.manaCost, 11.5);
    expectClose(p.root.children[1]!.spec.manaCost, 7.7);
    expectClose(costs.mana, 16.5);
    expectClose(costs.castTime, 0.45);
  });

  it('#10 Ember Orbit: Pulse > Orb[Fire, Wide] > Emit > Bolt[Fire, Seeker]', () => {
    // cx: Pulse 2 + Orb 2 + Fire 1 + Wide 1 + Emit 2 + Bolt 1 + Fire 1 + Seeker 2 = 12
    // mana: Bolt 6 × 1.10 × 1.25 = 8.25; Orb 9 × 1.10 × 1.20 = 11.88; 11.88 + 0.5 × 8.25 = 16.005
    // Pulse ignores cast time.
    const { costs } = compiled('Pulse > Orb[Fire, Wide] > Emit > Bolt[Fire, Seeker]');
    expect(costs.complexity).toBe(12);
    expectClose(costs.mana, 16.005);
    expect(costs.castTime).toBe(0);
  });

  it('#14: branch runes cost +1 per depth beyond 1, and penalties of mana halve per level', () => {
    // 4 (Bolt, Storm, Split) + 2 + 3 (OnHit d1, Bolt[Split]) + 3 + 3 (d2) + 4 + 3 (d3) = 22
    const p = program(
      'Cast > Bolt[Storm, Split] > OnHit > Bolt[Split] > OnHit > Bolt[Split] > OnHit > Bolt[Split]',
    );
    expect(p.complexity).toBe(22);
    const d1 = p.root.children[0]!;
    const d2 = d1.spec.children[0]!;
    const d3 = d2.spec.children[0]!;
    expect([d1.complexity, d2.complexity, d3.complexity]).toEqual([2, 3, 4]);
    // Bolt[Split] = 6 × 1.4 = 8.4 each; root 6 × 1.15 × 1.4 = 9.66
    // 9.66 + 0.5 × (8.4 + 0.5 × (8.4 + 0.5 × 8.4)) = 9.66 + 0.5 × (8.4 + 6.3) = 9.66 + 7.35 = 17.01
    expectClose(d3.spec.manaCost, 8.4);
    expectClose(p.mana, 17.01);
  });

  it('trigger mana multipliers scale the whole weave', () => {
    expectClose(compiled('OnDodge > Nova[Frost, Saturate]').costs.mana, 10 * 1.1 * 1.3 * 0.7);
    expectClose(compiled('Harvest > Nova[Fire]').costs.mana, 10 * 1.1 * 0.5);
    expectClose(compiled('OnCrit > Bolt[Storm]').costs.mana, 6 * 1.15 * 0.6);
    expect(compiled('OnHurt > Nova[Fire, Saturate]').costs.mana).toBe(0);
    expectClose(compiled('Channel > Beam[Storm]').costs.mana, 8 * 1.15 * 0.3);
  });

  it('cast time = form cast time × Heavy ÷ cast speed, 0 for automatic triggers', () => {
    expectClose(compiled('Cast > Bolt[Fire, Heavy]').costs.castTime, 0.45 * 1.15);
    expectClose(compiled('Cast > Nova[Fire]', testCtx(99, { castSpeed: 1.25 })).costs.castTime, 0.6 / 1.25);
    const ironbark = spindleContext(spindles.ironbark, { allowShips: 'all' });
    expectClose(compiled('Cast > Strike[Heavy]', ironbark).costs.castTime, (0.4 * 1.15) / 0.92);
    // Heavy on a branch spell doesn't slow the cast.
    expectClose(compiled('Cast > Bolt[Fire] > OnHit > Nova[Heavy]').costs.castTime, 0.45);
    expect(compiled('Pulse > Bolt[Fire, Heavy]').costs.castTime).toBe(0);
    expect(compiled('Channel > Beam[Storm]').costs.castTime).toBe(0);
  });

  it('inherited and infused elements add no mana', () => {
    // Nova inherits Fire: 10 × 1 = 10 → 6.6 + 5
    expectClose(compiled('Cast > Bolt[Fire] > OnHit > Nova[]').costs.mana, 6.6 + 5);
    // Bolt[Fire, Infuse] = 6 × 1.1 × 1.15 = 7.59; Nova[Frost] (+ infused Fire) = 11 → 7.59 + 5.5
    expectClose(compiled('Cast > Bolt[Fire, Infuse] > OnHit > Nova[Frost]').costs.mana, 7.59 + 5.5);
  });
});
