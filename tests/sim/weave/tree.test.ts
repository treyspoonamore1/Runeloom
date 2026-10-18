import { describe, expect, it } from 'vitest';
import { parseWeave, printWeave } from '../../../src/sim/weave/notation';
import {
  childPath,
  listSpells,
  parentBranch,
  pathDepth,
  runeAt,
  spellAt,
  updateSpell,
  type WeaveTree,
} from '../../../src/sim/weave/tree';

const t = (s: string): WeaveTree => {
  const r = parseWeave(s);
  if (!r.ok) throw new Error(r.error.message);
  return r.tree;
};

const twin = t(
  'Cast > Bolt[Storm] { OnHit > Nova[Storm] > OnKill > Lob[Fire]; OnExpire > Lob[Fire, Split] }',
);

describe('weave tree paths', () => {
  it('spellAt follows b<n> segments and ignores a node tail', () => {
    expect(spellAt(twin, ['root'])!.form).toBe('bolt');
    expect(spellAt(twin, ['root', 'b0'])!.form).toBe('nova');
    expect(spellAt(twin, ['root', 'b0', 'b0'])!.form).toBe('lob');
    expect(spellAt(twin, ['root', 'b1', 'i1'])!.form).toBe('lob');
    expect(spellAt(twin, ['root', 'b2'])).toBeUndefined();
    expect(spellAt(twin, ['trigger'])).toBeUndefined();
    expect(spellAt(twin, ['root', 'x'])).toBeUndefined();
  });

  it('runeAt resolves trigger, form, items and branch runes', () => {
    expect(runeAt(twin, ['trigger'])).toBe('cast');
    expect(runeAt(twin, ['root', 'form'])).toBe('bolt');
    expect(runeAt(twin, ['root', 'b1', 'i1'])).toBe('split');
    expect(runeAt(twin, ['root', 'b1', 'branch'])).toBe('on_expire');
    expect(runeAt(twin, ['root', 'b0', 'b0', 'branch'])).toBe('on_kill');
    expect(runeAt(twin, ['root', 'branch'])).toBeUndefined();
    expect(runeAt(twin, ['root', 'i9'])).toBeUndefined();
  });

  it('lists spells in tree order with depth and parent branch', () => {
    const list = listSpells(twin);
    expect(list.map((v) => v.path.join('/'))).toEqual(['root', 'root/b0', 'root/b0/b0', 'root/b1']);
    expect(list.map((v) => v.depth)).toEqual([0, 1, 2, 1]);
    expect(list.map((v) => v.via?.branch ?? null)).toEqual([null, 'on_hit', 'on_kill', 'on_expire']);
    expect(pathDepth(['root', 'b0', 'b0', 'form'])).toBe(2);
    expect(parentBranch(twin, ['root', 'b1'])!.branch).toBe('on_expire');
    expect(childPath(['root'], 3)).toEqual(['root', 'b3']);
  });

  it('updateSpell replaces one spell immutably, sharing untouched subtrees', () => {
    const next = updateSpell(twin, ['root', 'b0', 'b0'], (s) => ({ ...s, items: ['frost'] }));
    expect(printWeave(next)).toBe(
      'Cast > Bolt[Storm] { OnHit > Nova[Storm] > OnKill > Lob[Frost]; OnExpire > Lob[Fire, Split] }',
    );
    expect(printWeave(twin)).toContain('OnKill > Lob[Fire]');
    expect(next.root.branches[1]).toBe(twin.root.branches[1]);
    expect(updateSpell(twin, ['root', 'b7'], (s) => s)).toBe(twin);
  });
});
