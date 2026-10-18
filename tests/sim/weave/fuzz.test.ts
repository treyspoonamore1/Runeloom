import { describe, expect, it } from 'vitest';
import { runeIds, runes } from '../../../data/runes';
import { compileWeave, parseWeave, printWeave, Rng, type SpellNode, type WeaveTree } from '../../../src/sim';

const pick = <T>(rng: Rng, list: readonly T[]): T => list[rng.int(list.length)]!;

function randomSpell(rng: Rng, depth: number): SpellNode {
  const items = Array.from({ length: rng.int(5) }, () => pick(rng, runeIds));
  const nBranches = depth >= 4 ? 0 : pick(rng, [0, 0, 1, 1, 2, 3]);
  return {
    form: pick(rng, runeIds),
    items,
    branches: Array.from({ length: nBranches }, () => ({
      branch: pick(rng, runeIds),
      spell: randomSpell(rng, depth + 1),
    })),
  };
}

function randomCase(rng: Rng, s: string): string {
  return [...s].map((c) => (rng.chance(0.5) ? c.toUpperCase() : c.toLowerCase())).join('');
}

const notations = runeIds.map((id) => runes[id].notation);
const pieces = [
  ...notations,
  '>',
  '[',
  ']',
  ',',
  '{',
  '}',
  ';',
  ' ',
  ' > ',
  '  ',
  '\n',
  'Fireball',
  '@',
  'é',
  '9',
  '_',
];

describe('notation fuzz (seeded)', () => {
  it('2,000 random valid trees round-trip print → parse', () => {
    const rng = new Rng(1234);
    for (let i = 0; i < 2000; i++) {
      const tree: WeaveTree = { trigger: pick(rng, runeIds), root: randomSpell(rng, 0) };
      const text = printWeave(tree);
      const r = parseWeave(text);
      expect(r.ok, text).toBe(true);
      if (r.ok) expect(r.tree).toEqual(tree);
      // Random case and spacing parse to the same tree.
      const messy = randomCase(rng, text).replace(/ /g, () => pick(rng, ['', ' ', '   ', '\t']));
      const m = parseWeave(messy);
      expect(m.ok && printWeave(m.tree), messy).toBe(text);
      // The compiler never throws on whatever the parser accepts.
      expect(() => compileWeave(tree, { capacity: 30, allowShips: 'all' })).not.toThrow();
    }
  });

  it('2,000 random strings never throw; errors point inside the input; successes are canonical-stable', () => {
    const rng = new Rng(99);
    let parsed = 0;
    for (let i = 0; i < 2000; i++) {
      let s = '';
      if (i % 2 === 0) {
        // Pure noise from notation pieces.
        const n = 1 + rng.int(14);
        for (let k = 0; k < n; k++) s += pick(rng, pieces);
        if (rng.chance(0.3)) s = 'Cast > ' + s;
      } else {
        // A valid weave with 1–3 random edits.
        s = printWeave({ trigger: pick(rng, runeIds), root: randomSpell(rng, 2) });
        for (let k = 1 + rng.int(3); k > 0; k--) {
          const at = rng.int(s.length + 1);
          const op = rng.int(3);
          if (op === 0) s = s.slice(0, at) + s.slice(at + 1);
          else if (op === 1) s = s.slice(0, at) + pick(rng, pieces) + s.slice(at);
          else s = s.slice(0, at) + ' ' + s.slice(at);
        }
      }
      const r = parseWeave(s); // a throw fails the test
      if (r.ok) {
        parsed++;
        const printed = printWeave(r.tree);
        const again = parseWeave(printed);
        expect(again.ok && printWeave(again.tree)).toBe(printed);
        expect(() => compileWeave(r.tree, { capacity: 30, allowShips: 'all' })).not.toThrow();
      } else {
        expect(r.error.index).toBeGreaterThanOrEqual(0);
        expect(r.error.index).toBeLessThanOrEqual(s.length);
        expect(r.error.message.endsWith(` at ${r.error.index}`)).toBe(true);
      }
    }
    expect(parsed).toBeGreaterThan(30);
    expect(parsed).toBeLessThan(1900);
  });
});
