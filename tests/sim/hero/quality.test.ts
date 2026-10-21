import { describe, expect, it } from 'vitest';
import { applyHeroEdit } from '../../../src/sim';
import { grantRuneXp } from '../../../src/sim/hero/runes';
import { describeRune } from '../../../src/sim/items/describe';
import { adventure } from './helpers';

/** Rune quality (DESIGN §5.1, M5): Rune Polish, damage on form runes, XP on every rune. */

function polishSlot0Form(times: number) {
  const s = adventure();
  const slot = s.weaves.slots[0]!; // Cast > Bolt[Fire]
  const boltUid = slot.runes![1]!;
  s.hero.currency.rune_polish = times;
  for (let i = 0; i < times; i++)
    expect(applyHeroEdit(s, { kind: 'craft', currency: 'rune_polish', uid: boltUid })).toBeNull();
  return { s, boltUid };
}

describe('rune quality', () => {
  it('Rune Polish spends one and raises quality by 1%', () => {
    const { s, boltUid } = polishSlot0Form(3);
    expect(s.hero.runes.find((r) => r.uid === boltUid)!.quality).toBe(3);
    expect(s.hero.currency.rune_polish ?? 0).toBe(0);
    expect(applyHeroEdit(s, { kind: 'craft', currency: 'rune_polish', uid: boltUid })).toMatch(
      /no Rune Polish/,
    );
  });

  it("a socketed form rune's quality is increased damage for its spell, recompiled at once", () => {
    const plain = adventure();
    expect(plain.weaves.slots[0]!.program!.root.increased).toBe(0);
    const { s } = polishSlot0Form(10);
    expect(s.weaves.slots[0]!.program!.root.increased).toBeCloseTo(0.1);
  });

  it("other runes' quality doesn't change damage", () => {
    const s = adventure();
    const fireUid = s.weaves.slots[0]!.runes![2]!;
    s.hero.currency.rune_polish = 5;
    for (let i = 0; i < 5; i++) applyHeroEdit(s, { kind: 'craft', currency: 'rune_polish', uid: fireUid });
    expect(s.weaves.slots[0]!.program!.root.increased).toBe(0);
  });

  it('every socketed rune with quality gains that much more XP', () => {
    const { s, boltUid } = polishSlot0Form(20);
    const cast = s.weaves.slots[0]!.runes![0]!;
    grantRuneXp(s, 50);
    expect(s.hero.runes.find((r) => r.uid === boltUid)!.xp).toBeCloseTo(60);
    expect(s.hero.runes.find((r) => r.uid === cast)!.xp).toBeCloseTo(50);
  });

  it('tooltips say what the quality does', () => {
    const { s, boltUid } = polishSlot0Form(4);
    const d = describeRune(s.hero.runes.find((r) => r.uid === boltUid)!);
    expect(d.properties).toContain('Quality: 4%');
    expect(d.lines).toContain('4% increased damage (quality)');
    expect(d.lines).toContain('4% increased rune XP (quality)');
  });
});
