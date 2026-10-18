import { describe, expect, it } from 'vitest';
import { compileWeave, parseWeave, spindleContext } from '../../src/sim/weave';
import { ALLOWED_SHIPS } from '../../src/app/loadout';
import { spindles } from '../../data/spindles';
import { runes } from '../../data/runes';
import {
  damageBreakdown,
  fmtNum,
  moreLess,
  parseSlot,
  runeFacts,
  timingText,
  weaveGlyph,
  weaveShortName,
  weaveStory,
  weaveSummary,
} from '../../src/ui/loom/describe';

function program(notation: string, spindle: keyof typeof spindles = 'heartwood') {
  const p = parseWeave(notation);
  if (!p.ok) throw new Error(p.error.message);
  const c = compileWeave(p.tree, spindleContext(spindles[spindle], { allowShips: ALLOWED_SHIPS }));
  if (!c.ok) throw new Error(c.error.message);
  return c.program;
}

describe('parseSlot', () => {
  it('reads 1-4 and LMB/RMB/Q/E in any case', () => {
    expect(['1', '2', '3', '4'].map(parseSlot)).toEqual([0, 1, 2, 3]);
    expect(['lmb', 'RMB', 'q', 'E'].map(parseSlot)).toEqual([0, 1, 2, 3]);
    expect(['0', '5', 'x', '', undefined].map(parseSlot)).toEqual([null, null, null, null, null]);
  });
});

describe('formatting', () => {
  it('formats numbers and more/less', () => {
    expect(fmtNum(6.6000001)).toBe('6.6');
    expect(fmtNum(4)).toBe('4');
    expect(fmtNum(0.45, 2)).toBe('0.45');
    expect(moreLess(1.3)).toBe('30% more');
    expect(moreLess(0.65)).toBe('35% less');
    expect(moreLess(1)).toBe('no change');
  });

  it('summarises and names slots', () => {
    expect(weaveSummary('OnDodge > Nova[Frost, Saturate]')).toBe('On Dodge · Nova');
    expect(weaveSummary(null)).toBe('Empty');
    expect(weaveShortName('Cast > Bolt[Fire]')).toBe('Fire Bolt');
    expect(weaveShortName('Cast > Strike[]')).toBe('Strike');
    expect(weaveShortName('Cast > Bolt[Split, Storm]')).toBe('Storm Bolt');
    expect(weaveShortName(null)).toBe('Empty');
    expect(weaveGlyph('Pulse > Orb[Fire, Wide] > Emit > Bolt[Fire, Seeker]')).toEqual({
      form: 'orb',
      element: 'fire',
    });
  });

  it('lists tooltip facts for every rune', () => {
    for (const r of Object.values(runes)) expect(runeFacts(r).length).toBeGreaterThanOrEqual(2);
    expect(runeFacts(runes.pierce)).toContainEqual(['Applies to', 'Bolt, Beam']);
    expect(runeFacts(runes.saturate)).toContainEqual(['Applies to', 'Any spell with an element']);
    expect(runeFacts(runes.on_hit)).toContainEqual(['Damage', '35% less']);
    expect(runeFacts(runes.on_dodge)).toContainEqual(['Cooldown', '0.5 s (internal)']);
  });
});

describe('damageBreakdown', () => {
  it('lists every spell in tree order with shares and labeled multipliers', () => {
    const rows = damageBreakdown(program('Cast > Bolt[Storm] { OnHit > Nova[Storm]; OnExpire > Lob[Fire] }'));
    expect(rows.map((r) => r.title)).toEqual(['Bolt', 'On Hit → Nova', 'On Expire → Lob']);
    expect(rows[0]!.shares).toEqual([{ label: 'Storm', share: 1, inherited: false }]);
    expect(rows[1]!.more.map((m) => m.text)).toEqual(['35% less']);
    expect(rows[1]!.perHit).toBeCloseTo(14 * 0.65);
    expect(rows[2]!.more).toEqual([]);
  });

  it('shows Strike as physical, split elements evenly, and marks inherited ones', () => {
    expect(damageBreakdown(program('Cast > Strike[]'))[0]!.shares).toEqual([
      { label: 'Physical', share: 1, inherited: false },
    ]);
    expect(damageBreakdown(program('Cast > Bolt[Fire, Frost]'))[0]!.shares.map((s) => s.share)).toEqual([
      0.5, 0.5,
    ]);
    const sig = damageBreakdown(program('Cast > Sigil[Storm] > Emit > Beam[Chain]'));
    expect(sig[0]!.damaging).toBe(false);
    expect(sig[1]!.shares[0]).toEqual({ label: 'Storm', share: 1, inherited: true });
  });
});

describe('timingText', () => {
  it('shows cast time or automatic timing', () => {
    expect(timingText(program('Cast > Bolt[Fire]'))).toEqual({ label: 'Cast time', value: '0.45 s' });
    expect(timingText(program('Pulse > Lob[Storm, Saturate]')).value).toBe('Fires automatically · every 2 s');
    expect(timingText(program('OnDodge > Nova[Frost, Saturate]')).value).toBe(
      'Fires automatically · at most every 0.5 s',
    );
  });
});

describe('weaveStory', () => {
  const story = (n: string, slot = 'LMB') => {
    const p = parseWeave(n);
    if (!p.ok) throw new Error(n);
    return weaveStory(p.tree, slot).map((l) => `${'  '.repeat(l.depth)}${l.text}`);
  };

  it('reads weaves in plain words, one line per spell', () => {
    expect(story('Cast > Lob[Fire] > OnExpire > Nova[Fire, Wide]', 'Q')).toEqual([
      'Press Q → a Fire Lob',
      '  When it ends → a Fire Nova (Wide)',
    ]);
    expect(story('Cast > Bolt[Storm] { OnHit > Nova[Storm]; OnExpire > Lob[Fire] }')).toEqual([
      'Press LMB → a Storm Bolt',
      '  On hit → a Storm Nova',
      '  When it ends → a Fire Lob',
    ]);
    expect(story('Cast > Sigil[Storm] > Emit > Beam[Chain]')).toEqual([
      'Press LMB → a Storm Sigil',
      '  Every 0.5 s while it lives → a Storm Beam (Chain) (inherited element)',
    ]);
    expect(story('OnDodge > Bolt[Fire, Split, Pierce]')).toEqual([
      'When you dodge → 3 × Fire Bolt (Split, Pierce)',
    ]);
  });
});
