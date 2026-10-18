import { describe, expect, it } from 'vitest';
import { parseWeave, printWeave, type WeaveTree } from '../../src/sim/weave';
import { referenceWeaves } from '../../src/sim/weave/referenceWeaves';
import type { RuneId } from '../../data/runes';
import {
  chipRune,
  draftNotation,
  emptyTree,
  firstEmpty,
  isBlank,
  placeRune,
  placements,
  removeAt,
  runesForSpot,
  spotKey,
  type Spot,
} from '../../src/ui/loom/model';
import { ALLOWED_SHIPS } from '../../src/app/loadout';
import { allRunes } from '../../src/ui/loom/model';

const pouchRunes = allRunes.filter((r) => ALLOWED_SHIPS.has(r.ships));

const tree = (n: string): WeaveTree => {
  const p = parseWeave(n);
  if (!p.ok) throw new Error(p.error.message);
  return p.tree;
};
const keys = (t: WeaveTree, rune: string) =>
  placements(t, rune)
    .filter((p) => p.ok)
    .map((p) => p.key);

/** Places `rune` at the spot with `key`, failing the test if it isn't offered. */
function put(t: WeaveTree, rune: string, key: string): WeaveTree {
  const p = placements(t, rune).find((x) => x.key === key && x.ok);
  if (!p) throw new Error(`${rune} not offered at ${key}; offered: ${keys(t, rune).join(', ')}`);
  return placeRune(t, p.spot, rune as RuneId).tree;
}

describe('building weaves spot by spot', () => {
  it('builds reference weave #3 from an empty slot', () => {
    let t = emptyTree();
    expect(isBlank(t)).toBe(true);
    t = put(t, 'cast', 'trigger');
    t = put(t, 'lob', 'root.form');
    t = put(t, 'fire', 'root.+');
    expect(printWeave(t)).toBe('Cast > Lob[Fire]');
    t = put(t, 'on_expire', 'root.+');
    expect(draftNotation(t)).toBe('Cast > Lob[Fire] > OnExpire > ?[]');
    expect(firstEmpty(t)).toEqual({ path: ['root', 'b0', 'form'], message: 'This spell needs a form' });
    t = put(t, 'nova', 'root.b0.form');
    t = put(t, 'fire', 'root.b0.+');
    t = put(t, 'wide', 'root.b0.+');
    expect(printWeave(t)).toBe(referenceWeaves[2]!.notation);
    expect(firstEmpty(t)).toBeNull();
  });

  it('builds #13 with two branches on one spell, in order', () => {
    let t = tree('Cast > Bolt[Storm]');
    t = put(t, 'on_hit', 'root.+');
    t = put(t, 'nova', 'root.b0.form');
    t = put(t, 'storm', 'root.b0.+');
    t = put(t, 'on_expire', 'root.+');
    t = put(t, 'lob', 'root.b1.form');
    t = put(t, 'fire', 'root.b1.+');
    expect(printWeave(t)).toBe(referenceWeaves[12]!.notation);
  });

  it('puts appended elements after the last element and modifiers at the end', () => {
    let t = tree('Cast > Bolt[Fire, Pierce]');
    t = put(t, 'storm', 'root.+');
    expect(printWeave(t)).toBe('Cast > Bolt[Fire, Storm, Pierce]');
    t = put(t, 'split', 'root.+');
    expect(printWeave(t)).toBe('Cast > Bolt[Fire, Storm, Pierce, Split]');
  });

  it('replaces the trigger, a form, an item and a branch rune in place', () => {
    let t = tree('Cast > Orb[Fire] > Emit > Bolt[Fire]');
    t = put(t, 'pulse', 'trigger');
    t = put(t, 'frost', 'root.i0');
    t = put(t, 'beam', 'root.b0.form');
    expect(printWeave(t)).toBe('Pulse > Orb[Frost] > Emit > Beam[Fire]');
    t = put(t, 'on_hit', 'root.b0.branch');
    expect(printWeave(t)).toBe('Pulse > Orb[Frost] > OnHit > Beam[Fire]');
  });

  it('selects the placed chip', () => {
    const t = tree('Cast > Bolt[Fire]');
    const p = placements(t, 'pierce').find((x) => x.key === 'root.+')!;
    expect(placeRune(t, p.spot, 'pierce').selected).toEqual(['root', 'i1']);
  });
});

describe('placements follow appliesTo, parents, duplicates and depth', () => {
  it('offers a trigger only the trigger spot, and not the trigger already there', () => {
    const t = tree('Cast > Bolt[Fire]');
    expect(keys(t, 'pulse')).toEqual(['trigger']);
    expect(keys(t, 'cast')).toEqual([]);
  });

  it('never offers Pierce to a Nova, but offers Wide', () => {
    const t = tree('Cast > Nova[Fire]');
    expect(keys(t, 'pierce')).toEqual([]);
    expect(keys(t, 'wide')).toEqual(['root.+']);
  });

  it("doesn't offer replacing the only element with a modifier that needs one", () => {
    const t = tree('Cast > Lob[Fire]');
    expect(keys(t, 'saturate')).toEqual(['root.+']);
    const t2 = tree('Cast > Lob[Fire, Storm]');
    expect(keys(t2, 'saturate').sort()).toEqual(['root.+', 'root.i0', 'root.i1']);
  });

  it('offers no duplicate modifiers or elements on one spell, but does on another spell', () => {
    const t = tree('Cast > Bolt[Fire, Pierce] > OnHit > Bolt[]');
    expect(keys(t, 'pierce')).toEqual(['root.b0.+']);
    expect(keys(t, 'fire')).toEqual(['root.b0.+']);
  });

  it('offers Emit only under Orb and Sigil, and branches only up to depth 3', () => {
    expect(keys(tree('Cast > Bolt[Fire]'), 'emit')).toEqual([]);
    expect(keys(tree('Cast > Sigil[Storm]'), 'emit')).toEqual(['root.+']);
    const deep = tree('Cast > Bolt[Storm] > OnHit > Bolt[] > OnHit > Bolt[] > OnHit > Bolt[]');
    expect(keys(deep, 'on_hit')).toEqual(['root.+', 'root.b0.+', 'root.b0.b0.+']);
  });

  it('offers no item or branch to a spell without a form, except elements and Any modifiers', () => {
    let t = tree('Cast > Bolt[Fire]');
    t = put(t, 'on_expire', 'root.+');
    expect(keys(t, 'pierce')).toEqual(['root.+']);
    expect(keys(t, 'on_hit')).toEqual(['root.+', 'root.b0.branch']);
    expect(keys(t, 'frost')).toContain('root.b0.+');
    expect(keys(t, 'lingering')).toContain('root.b0.+');
  });

  it('shows a form swap that would break the spell as blocked, with the reason', () => {
    const t = tree('Cast > Bolt[Fire, Pierce] > OnHit > Nova[]');
    const p = placements(t, 'nova').find((x) => x.key === 'root.form')!;
    expect(p.ok).toBe(false);
    expect(p.reason).toBe("Nova can't take Pierce");
    const s = placements(tree('Cast > Orb[Fire] > Emit > Bolt[]'), 'bolt').find(
      (x) => x.key === 'root.form',
    )!;
    expect(s.reason).toBe("Bolt can't take an Emit branch");
    expect(placements(t, 'beam').find((x) => x.key === 'root.form')!.ok).toBe(true);
  });

  it('lists what fits a spot for the spot-first picker', () => {
    const t = tree('Cast > Nova[Fire]');
    const names = runesForSpot(t, 'root.+', pouchRunes).map((r) => r.id);
    expect(names).toContain('wide');
    expect(names).toContain('on_hit');
    expect(names).not.toContain('pierce');
    expect(names).not.toContain('emit');
    expect(names).not.toContain('fire');
    expect(runesForSpot(t, 'trigger', pouchRunes).every((r) => r.kind === 'trigger')).toBe(true);
  });

  it('keys spots stably', () => {
    const spots: Spot[] = [
      { kind: 'trigger' },
      { kind: 'form', spell: ['root', 'b1'] },
      { kind: 'item', spell: ['root'], index: 2 },
      { kind: 'append', spell: ['root'] },
      { kind: 'addBranch', spell: ['root'] },
      { kind: 'branchRune', spell: ['root', 'b0'] },
    ];
    expect(spots.map(spotKey)).toEqual([
      'trigger',
      'root.b1.form',
      'root.i2',
      'root.+',
      'root.+',
      'root.b0.branch',
    ]);
  });
});

describe('removing', () => {
  it('leaves an empty spot for the trigger and forms, and takes items out', () => {
    const t = tree('Cast > Bolt[Fire, Pierce]');
    expect(draftNotation(removeAt(t, ['trigger']).tree)).toBe('? > Bolt[Fire, Pierce]');
    expect(draftNotation(removeAt(t, ['root', 'form']).tree)).toBe('Cast > ?[Fire, Pierce]');
    expect(printWeave(removeAt(t, ['root', 'i0']).tree)).toBe('Cast > Bolt[Pierce]');
  });

  it('removes a branch with its whole subtree and keeps its siblings', () => {
    const t = tree(referenceWeaves[12]!.notation);
    expect(printWeave(removeAt(t, ['root', 'b0', 'branch']).tree)).toBe(
      'Cast > Bolt[Storm] > OnExpire > Lob[Fire]',
    );
    const deep = tree('Cast > Lob[Fire] > OnExpire > Nova[Fire] > OnHit > Bolt[]');
    expect(printWeave(removeAt(deep, ['root', 'b0', 'branch']).tree)).toBe('Cast > Lob[Fire]');
  });

  it('reads the rune at a chip path', () => {
    const t = tree(referenceWeaves[12]!.notation);
    expect(chipRune(t, ['trigger'])?.id).toBe('cast');
    expect(chipRune(t, ['root', 'b1', 'branch'])?.id).toBe('on_expire');
    expect(chipRune(t, ['root', 'b0', 'i0'])?.id).toBe('storm');
    expect(chipRune(t, ['root', 'b1', 'form'])?.id).toBe('lob');
    expect(chipRune(emptyTree(), ['root', 'form'])).toBeUndefined();
  });
});

describe('every reference weave can be built from the pouch', () => {
  it('rebuilds each CONTENT §2 weave using only offered spots', () => {
    for (const w of referenceWeaves) {
      const target = tree(w.notation);
      let t = put(emptyTree(), target.trigger, 'trigger');
      const go = (spell: WeaveTree['root'], path: string[]) => {
        t = put(t, spell.form, [...path, 'form'].join('.'));
        for (const id of spell.items) t = put(t, id, [...path, '+'].join('.'));
        spell.branches.forEach((b, i) => {
          t = put(t, b.branch, [...path, '+'].join('.'));
          go(b.spell, [...path, `b${i}`]);
        });
      };
      go(target.root, ['root']);
      expect(printWeave(t), w.name).toBe(w.notation);
      expect(pouchRunes.some((r) => r.id === target.trigger)).toBe(true);
    }
  });
});
