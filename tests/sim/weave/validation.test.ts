import { describe, expect, it } from 'vitest';
import { shipsThrough } from '../../../data/runes';
import { compileWeave, type WeaveTree } from '../../../src/sim';
import { compileError, compiled, testCtx } from './helpers';

const m2 = (capacity = 99) => testCtx(capacity, { allowShips: shipsThrough('M2') });

describe('pass 1: unknown runes, wrong kinds, milestones', () => {
  it('names the kind that was found and the one expected', () => {
    expect(compileError('Bolt > Bolt[Fire]').message).toBe('Bolt is a form, not a trigger');
    expect(compileError('Cast > Fire[]').message).toBe('Fire is an element, not a form');
    expect(compileError('Cast > Split[Fire]').message).toBe('Split is a modifier, not a form');
    expect(compileError('Cast > Bolt[Fire] > Nova > Bolt[]')).toEqual({
      message: 'Nova is a form, not a branch',
      path: ['root', 'b0', 'branch'],
    });
    expect(compileError('Cast > Bolt[Fire, OnHit]')).toEqual({
      message: 'On Hit is a branch, not an element or modifier',
      path: ['root', 'i1'],
    });
    expect(compileError('Cast > Bolt[Pulse]').message).toBe('Pulse is a trigger, not an element or modifier');
  });

  it('reports ids that are not runes in a hand-built tree', () => {
    const tree = { trigger: 'cast', root: { form: 'zap', items: [], branches: [] } } as unknown as WeaveTree;
    const r = compileWeave(tree, testCtx());
    expect(!r.ok && r.error).toEqual({ message: "Unknown rune 'zap'", path: ['root', 'form'] });
  });

  it('gates runes by milestone', () => {
    expect(compileError('Cast > Bolt[Fire, Fork]', m2())).toEqual({
      message: 'Fork arrives in M5',
      path: ['root', 'i1'],
    });
    expect(compileError('Cast > Bolt[Tide]', m2()).message).toBe('Tide arrives in M8');
    expect(compileError('Shatter > Nova[Frost]', m2()).message).toBe('Shatter arrives in M7');
    expect(compileError('Channel > Beam[Storm]', m2()).message).toBe('Channel arrives in M5');
    const m5 = testCtx(99, { allowShips: shipsThrough('M5') });
    expect(
      compileWeave({ trigger: 'cast', root: { form: 'bolt', items: ['fire', 'fork'], branches: [] } }, m5).ok,
    ).toBe(true);
    expect(compileError('Cast > Bolt[Gale]', m5).message).toBe('Gale arrives in M8');
  });
});

describe('pass 2: structure', () => {
  it('reports empty slots in an editor-built tree', () => {
    const empty = (t: unknown) => {
      const r = compileWeave(t as WeaveTree, testCtx());
      return !r.ok && r.error;
    };
    expect(empty({ trigger: '', root: { form: 'bolt', items: ['fire'], branches: [] } })).toEqual({
      message: 'The weave needs a trigger',
      path: ['trigger'],
    });
    expect(empty({ trigger: 'cast', root: { form: '', items: ['fire'], branches: [] } })).toEqual({
      message: 'This spell needs a form',
      path: ['root', 'form'],
    });
    expect(
      empty({
        trigger: 'cast',
        root: {
          form: 'bolt',
          items: ['fire'],
          branches: [{ branch: '', spell: { form: 'nova', items: [], branches: [] } }],
        },
      }),
    ).toEqual({ message: 'This branch needs a branch rune', path: ['root', 'b0', 'branch'] });
    expect(empty({ trigger: 'cast', root: { form: 'bolt', items: [''], branches: [] } })).toEqual({
      message: 'Empty rune slot',
      path: ['root', 'i0'],
    });
  });

  it('Strike needs no element; other forms do, unless they inherit one', () => {
    expect(
      compileWeave({ trigger: 'cast', root: { form: 'strike', items: [], branches: [] } }, testCtx()).ok,
    ).toBe(true);
    for (const f of ['Nova', 'Beam', 'Lob', 'Orb', 'Swath', 'Sigil'])
      expect(compileError(`Cast > ${f}[]`).message).toBe(`${f} needs an element`);
    expect(
      compiled('Cast > Bolt[Fire] > OnHit > Nova[]').program.root.children[0]!.spec.elements,
    ).toHaveLength(1);
  });

  it('a branch under an element-less Strike has nothing to inherit', () => {
    expect(compileError('Cast > Strike[] > OnHit > Nova[]')).toEqual({
      message: 'Nova needs an element',
      path: ['root', 'b0', 'form'],
    });
    expect(compileError('Cast > Strike[] > OnHit > Strike[] > OnKill > Bolt[]').path).toEqual([
      'root',
      'b0',
      'b0',
      'form',
    ]);
  });

  it('honours a custom maxDepth', () => {
    expect(
      compileError('Cast > Bolt[Fire] > OnHit > Bolt[] > OnHit > Bolt[]', testCtx(99, { maxDepth: 1 })),
    ).toEqual({
      message: 'Branches can nest at most 1 deep',
      path: ['root', 'b0', 'b0', 'branch'],
    });
  });
});

describe('pass 3: runes allowed on their form or parent', () => {
  it('modifiers check their form list', () => {
    expect(compileError('Cast > Beam[Fire, Split]').message).toBe("Beam can't take Split");
    expect(compileError('Cast > Bolt[Fire, Wide]').message).toBe("Bolt can't take Wide");
    expect(compileError('Cast > Orb[Fire, Echo]').message).toBe("Orb can't take Echo");
    expect(compileError('Cast > Sigil[Fire, Heavy] > Emit > Bolt[]').message).toBe("Sigil can't take Heavy");
    expect(compileError('Cast > Sigil[Fire, Keen] > Emit > Bolt[]').message).toBe("Sigil can't take Keen");
    expect(compileError('Cast > Strike[Saturate]')).toEqual({
      message: "Strike can't take Saturate without an element",
      path: ['root', 'i0'],
    });
  });

  it('branches check their parent form', () => {
    expect(compileError('Cast > Swath[Fire] > OnHit > Nova[]')).toEqual({
      message: "Swath can't take an On Hit branch",
      path: ['root', 'b0', 'branch'],
    });
    expect(compileError('Cast > Strike[] > OnExpire > Nova[Fire]').message).toBe(
      "Strike can't take an On Expire branch",
    );
    expect(compileError('Cast > Bolt[Fire] > Emit > Nova[]').message).toBe("Bolt can't take an Emit branch");
    expect(compileError('Cast > Sigil[Fire] { Emit > Bolt[]; OnKill > Nova[] }')).toEqual({
      message: "Sigil can't take an On Kill branch",
      path: ['root', 'b1', 'branch'],
    });
  });

  it('modifiers apply only to their own spell, so a child is checked against its own form', () => {
    expect(compileError('Cast > Bolt[Fire, Pierce] > OnHit > Nova[Pierce]').path).toEqual([
      'root',
      'b0',
      'i0',
    ]);
  });
});

describe('pass 4: duplicates', () => {
  it('modifiers and elements can appear once per spell, but again in another spell', () => {
    expect(compileError('Cast > Nova[Fire, Wide, Wide]').message).toBe(
      'Wide can only be used once per spell',
    );
    expect(compileError('Cast > Bolt[Fire, Fire]').message).toBe('Fire can only be used once per spell');
    expect(
      compileWeave(
        {
          trigger: 'cast',
          root: {
            form: 'bolt',
            items: ['fire', 'split'],
            branches: [{ branch: 'on_hit', spell: { form: 'bolt', items: ['split'], branches: [] } }],
          },
        },
        testCtx(),
      ).ok,
    ).toBe(true);
  });
});

describe('validation order (DESIGN §5.3): the earliest category wins', () => {
  const cases: [string, string, string][] = [
    ['kind beats structure', 'Cast > Sigil[Fire, Bolt]', 'Bolt is a form, not an element or modifier'],
    ['milestone beats structure', 'Cast > Bolt[] > OnHit > Bolt[Fork]', 'Fork arrives in M5'],
    ['missing element beats not-allowed', 'Cast > Nova[Pierce]', 'Nova needs an element'],
    ['missing element beats missing Emit', 'Cast > Sigil[]', 'Sigil needs an element'],
    [
      'missing Emit beats depth',
      'Cast > Sigil[Fire] > OnExpire > Bolt[] > OnHit > Bolt[] > OnHit > Bolt[] > OnHit > Bolt[]',
      'Sigil needs an Emit branch',
    ],
    [
      'depth beats not-allowed',
      'Cast > Nova[Fire, Pierce] > OnHit > Bolt[] > OnHit > Bolt[] > OnHit > Bolt[] > OnHit > Bolt[]',
      'Branches can nest at most 3 deep',
    ],
    [
      'not-allowed beats duplicate (even when later in the slots)',
      'Cast > Nova[Fire, Wide, Wide, Pierce]',
      "Nova can't take Pierce",
    ],
    ['duplicate beats Capacity', 'Cast > Bolt[Fire, Split, Split]', 'Split can only be used once per spell'],
    [
      'within a category, tree order',
      'Cast > Bolt[Fire, Wide] > OnHit > Nova[Fire, Pierce]',
      "Bolt can't take Wide",
    ],
  ];
  for (const [label, notation, message] of cases) {
    it(`${label}: ${notation}`, () => {
      expect(compileError(notation, m2(2)).message).toBe(message);
    });
  }

  it('failures past pass 1 still carry costs for the Loom', () => {
    const r = compileWeave(
      { trigger: 'cast', root: { form: 'nova', items: ['fire', 'pierce'], branches: [] } },
      testCtx(),
    );
    expect(!r.ok && r.costs).toEqual({ complexity: 4, capacity: 99, mana: 10 * 1.1 * 1.15, castTime: 0.6 });
    const unknown = compileWeave(
      { trigger: 'cast', root: { form: 'fire', items: [], branches: [] } } as WeaveTree,
      testCtx(),
    );
    expect(!unknown.ok && unknown.costs).toBeUndefined();
  });
});
