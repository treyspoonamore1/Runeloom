import { describe, expect, it } from 'vitest';
import { canonicalWeave, parseWeave, printWeave } from '../../../src/sim/weave/notation';
import type { WeaveTree } from '../../../src/sim/weave/tree';

function tree(text: string): WeaveTree {
  const r = parseWeave(text);
  if (!r.ok) throw new Error(r.error.message);
  return r.tree;
}

function error(text: string) {
  const r = parseWeave(text);
  if (r.ok) throw new Error(`parsed: ${text}`);
  return r.error;
}

describe('parseWeave', () => {
  it('parses the DESIGN §5.2 examples into the AST', () => {
    expect(tree('Cast > Bolt[Fire]')).toEqual({
      trigger: 'cast',
      root: { form: 'bolt', items: ['fire'], branches: [] },
    });
    expect(tree('Cast > Strike[]').root).toEqual({ form: 'strike', items: [], branches: [] });
    expect(tree('Cast > Lob[Fire] > OnExpire > Nova[Fire, Wide]').root).toEqual({
      form: 'lob',
      items: ['fire'],
      branches: [{ branch: 'on_expire', spell: { form: 'nova', items: ['fire', 'wide'], branches: [] } }],
    });
    expect(tree('Cast > Bolt[Storm] { OnHit > Nova[Storm]; OnExpire > Lob[Fire] }').root.branches).toEqual([
      { branch: 'on_hit', spell: { form: 'nova', items: ['storm'], branches: [] } },
      { branch: 'on_expire', spell: { form: 'lob', items: ['fire'], branches: [] } },
    ]);
  });

  it('a chain of single branches nests each under the previous spell', () => {
    const t = tree('Cast > Bolt[Storm] > OnHit > Bolt[] > OnHit > Bolt[]');
    expect(t.root.branches).toHaveLength(1);
    expect(t.root.branches[0]!.spell.branches).toHaveLength(1);
    expect(t.root.branches[0]!.spell.branches[0]!.spell.branches).toHaveLength(0);
  });

  it('parses nested multi-branch blocks', () => {
    const s =
      'Cast > Bolt[Fire] { OnHit > Nova[] { OnKill > Lob[]; OnExpire > Bolt[] }; OnExpire > Lob[Frost] > OnHit > Strike[] }';
    const t = tree(s);
    expect(t.root.branches.map((b) => b.branch)).toEqual(['on_hit', 'on_expire']);
    expect(t.root.branches[0]!.spell.branches.map((b) => b.branch)).toEqual(['on_kill', 'on_expire']);
    expect(t.root.branches[1]!.spell.branches[0]!.spell.form).toBe('strike');
    expect(printWeave(t)).toBe(s);
  });

  it('is case-insensitive and tolerates extra or missing whitespace', () => {
    const canonical = 'Cast > Bolt[Storm] { OnHit > Nova[Storm]; OnExpire > Lob[Fire, Split] }';
    for (const s of [
      'cast>bolt[storm]{onhit>nova[storm];onexpire>lob[fire,split]}',
      '  CAST  >  BOLT [ STORM ]  {  ONHIT > NOVA[ STORM ] ;  ONEXPIRE>LOB[FIRE ,SPLIT]  }  ',
      'Cast >\n\tBolt[Storm]\n{ OnHit > Nova[Storm];\n  OnExpire > Lob[Fire, Split] }',
    ]) {
      expect(canonicalWeave(s)).toBe(canonical);
    }
  });

  it('accepts a single branch in braces and prints it with " > "', () => {
    expect(canonicalWeave('Cast > Bolt[Fire] { OnHit > Nova[] }')).toBe('Cast > Bolt[Fire] > OnHit > Nova[]');
  });

  it('leaves rune kinds to the compiler: a known rune anywhere parses', () => {
    expect(tree('Fire > Split[Bolt, OnHit] > Cast > Pulse[]')).toEqual({
      trigger: 'fire',
      root: {
        form: 'split',
        items: ['bolt', 'on_hit'],
        branches: [{ branch: 'cast', spell: { form: 'pulse', items: [], branches: [] } }],
      },
    });
  });
});

describe('parse errors point at the offending token', () => {
  const cases: [string, string, number][] = [
    ['Cast > Bolt[Fireball]', "Unknown rune 'Fireball' at 12", 12],
    ['Cast > Fireball[]', "Unknown rune 'Fireball' at 7", 7],
    ['Cast > Bolt[Fire, Spilt]', "Unknown rune 'Spilt' at 18", 18],
    ['Cast > Bolt[Fire] > OnHot > Nova[]', "Unknown rune 'OnHot' at 20", 20],
    ['', 'Expected a trigger rune, found the end at 0', 0],
    ['Bolt[Fire]', "Missing trigger: start with one, like 'Cast > Bolt[...]' at 0", 0],
    ['Cast Bolt[Fire]', "Expected '>' after 'Cast', found 'Bolt' at 5", 5],
    ['Cast > Bolt', "Expected '[' after 'Bolt', found the end at 11", 11],
    ['Cast > Bolt[Fire', "Expected ',' or ']', found the end at 16", 16],
    ['Cast > Bolt[Fire Split]', "Expected ',' or ']', found 'Split' at 17", 17],
    ['Cast > Bolt[Fire,]', "Expected a rune after ',', found ']' at 17", 17],
    ['Cast > Bolt[,]', "Expected a rune or ']', found ',' at 12", 12],
    ['Cast > Bolt[Fire] > OnHit', "Expected '>' after 'OnHit', found the end at 25", 25],
    ['Cast > Bolt[Fire] > > Nova[]', "Expected a branch rune, found '>' at 20", 20],
    ['Cast > Bolt[Fire] { OnHit > Nova[] ', "Expected ';' or '}', found the end at 35", 35],
    ['Cast > Bolt[Fire] { }', "Expected a branch rune, found '}' at 20", 20],
    ['Cast > Bolt[Fire] { OnHit > Nova[]; }', "Expected a branch rune, found '}' at 36", 36],
    ['Cast > Bolt[Fire] ]', "Expected the end of the weave, found ']' at 18", 18],
    ['Cast > Bolt[Fire] Cast', "Expected the end of the weave, found 'Cast' at 18", 18],
    ['Cast > Bolt[Fire @]', "Unexpected character '@' at 17", 17],
    ['Cast > Bolt[Fire]; ', "Expected the end of the weave, found ';' at 17", 17],
  ];
  for (const [text, message, index] of cases) {
    it(JSON.stringify(text), () => {
      const e = error(text);
      expect(e.message).toBe(message);
      expect(e.index).toBe(index);
    });
  }

  it('reports the token length for highlighting', () => {
    expect(error('Cast > Bolt[Fireball]').length).toBe(8);
    expect(error('Cast > Bolt[Fire').length).toBe(0);
  });

  it('rejects absurd nesting instead of overflowing the stack', () => {
    const deep = 'Cast > Bolt[Fire]' + ' > OnHit > Bolt[]'.repeat(5000);
    const e = error(deep);
    expect(e.message).toMatch(/^Too many nested branches at \d+$/);
  });
});

describe('printWeave', () => {
  it('prints canonical spacing and notation names', () => {
    expect(
      printWeave({
        trigger: 'on_dodge',
        root: {
          form: 'nova',
          items: ['frost', 'saturate'],
          branches: [
            { branch: 'on_kill', spell: { form: 'lob', items: [], branches: [] } },
            { branch: 'on_expire', spell: { form: 'strike', items: ['heavy'], branches: [] } },
          ],
        },
      }),
    ).toBe('OnDodge > Nova[Frost, Saturate] { OnKill > Lob[]; OnExpire > Strike[Heavy] }');
  });
});
