import { describe, expect, it } from 'vitest';
import { Button, previewWeave, type GameState } from '../../../src/sim';
import { gridTicks } from '../../../src/sim/grid/cells';
import { refreshHero } from '../../../src/sim/hero/hero';
import { makeUnique } from '../../../src/sim/items/uniqueItems';
import type { EquipSlot } from '../../../src/sim/hero/types';
import type { UniqueId } from '../../../data/uniques';
import { weaveLimits } from '../../../data/runes';
import { apply, idx, MAT, OWNER, paintRect, room, run } from '../terrain/helpers';
import { arena, hitWith } from '../combat/helpers';
import { allocateExactly } from '../hero/helpers';

/** CONTENT §8: every unique's rule change (M5 acceptance). */

const SLOT: Record<UniqueId, EquipSlot> = {
  the_first_thread: 'spindle',
  kiln_heart_cloak: 'cloak',
  rimewalkers: 'boots',
  stormglass_charm: 'charm1',
  pyre_hood: 'hood',
  the_unraveling: 'charm2',
};

function wear(s: GameState, ...ids: UniqueId[]): void {
  for (const id of ids) {
    const it = makeUnique(s.hero, id, 10);
    s.hero.items.push(it);
    s.hero.equipped[SLOT[id]] = it.uid;
  }
  refreshHero(s);
}

const circle = (x: number, y: number, r: number) => ({ kind: 'circle' as const, x, y, r });

function compiled(s: GameState, notation: string) {
  const p = previewWeave(s, notation);
  if (!p.compiled) throw new Error(`parse: ${notation}`);
  return p.compiled;
}

/** Depth-3 weave: three branches. */
const DEPTH3 = 'Cast > Bolt[Fire] > OnHit > Bolt[] > OnHit > Bolt[] > OnHit > Bolt[]';
const DEPTH4 = `${DEPTH3.replace(/ > OnHit > Bolt\[\]$/, '')} > OnHit > Bolt[] > OnHit > Bolt[]`;

describe('The First Thread', () => {
  it('Capacity 6 and branch runes cost 0 complexity, depth surcharge included', () => {
    const s = arena();
    wear(s, 'the_first_thread');
    const c = compiled(s, 'Cast > Bolt[Fire] > OnHit > Bolt[] > OnHit > Nova[]');
    // Cast 0 + Bolt 1 + Fire 1 + Bolt 1 + Nova 2 = 5; the two branches (2 and 3) are free.
    expect(c.ok).toBe(true);
    expect(c.costs!.complexity).toBe(5);
    expect(c.costs!.capacity).toBe(6);
    const plain = compiled(arena(), 'Cast > Bolt[Fire] > OnHit > Bolt[] > OnHit > Nova[]');
    expect(plain.costs!.complexity).toBe(10);
  });

  it('branches nest at most 2 deep', () => {
    const s = arena();
    wear(s, 'the_first_thread');
    const c = compiled(s, DEPTH3);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.error.message).toBe('Branches can nest at most 2 deep');
  });
});

describe('Kiln-Heart Cloak', () => {
  it('+30 life and immune to Ignite', () => {
    const s = arena();
    const life = s.player.maxLife;
    wear(s, 'kiln_heart_cloak');
    expect(s.player.maxLife).toBe(life + 30);
    hitWith(s, s.player, 10, 'fire', { sourceId: 9 });
    expect(s.player.ailments.ignite.timeLeft).toBe(0);
    const bare = arena();
    hitWith(bare, bare.player, 10, 'fire', { sourceId: 9 });
    expect(bare.player.ailments.ignite.timeLeft).toBeGreaterThan(0);
  });

  it('standing on burning ground heals 2% of life per second', () => {
    const s = room('.', 30, 20, 40.5, 40.5);
    wear(s, 'kiln_heart_cloak');
    s.player.life = 40;
    apply(s, 'fire', circle(40.5, 40.5, 3), { owner: OWNER.world, sourceId: -1 });
    run(s, 60);
    expect(s.player.life).toBeCloseTo(40 + s.player.maxLife * 0.02, 1);
    const bare = room('.', 30, 20, 40.5, 40.5);
    bare.player.life = 40;
    run(bare, 60);
    expect(bare.player.life).toBe(40);
  });
});

describe('Rimewalkers', () => {
  it('dodging leaves a 3-cell-wide rime trail on dry ground for 4 s', () => {
    const s = room('.', 30, 20, 30.5, 40.5);
    wear(s, 'rimewalkers');
    run(s, 1, Button.Dodge, undefined, [1, 0]);
    run(s, 15);
    for (const x of [33, 36, 40]) {
      expect(s.grid.ground[idx(s, x, 40)], `x ${x}`).toBe(MAT.rime);
      expect(s.grid.ground[idx(s, x, 41)], `x ${x} beside`).toBe(MAT.rime);
    }
    expect(s.grid.ground[idx(s, 35, 43)]).toBe(MAT.stone);
    run(s, 4 * 60 - 40);
    expect(s.grid.ground[idx(s, 35, 40)]).toBe(MAT.rime);
    run(s, 60);
    expect(s.grid.ground[idx(s, 35, 40)]).toBe(MAT.stone);
  });

  it('over deep water it makes ice bridge (and freezes shallow water)', () => {
    const s = room('.', 30, 20, 30.5, 40.5);
    wear(s, 'rimewalkers');
    paintRect(s, 32, 30, 34, 50, 'shallow_water');
    paintRect(s, 35, 30, 60, 50, 'deep_water');
    run(s, 1, Button.Dodge, undefined, [1, 0]);
    run(s, 15);
    expect(s.grid.ground[idx(s, 33, 40)]).toBe(MAT.ice);
    expect(s.grid.ground[idx(s, 37, 40)]).toBe(MAT.ice_bridge);
    expect(s.player.x).toBeGreaterThan(38);
    expect(s.player.dead).toBe(false);
  });

  it('without them a dodge leaves the ground alone', () => {
    const s = room('.', 30, 20, 30.5, 40.5);
    run(s, 1, Button.Dodge, undefined, [1, 0]);
    run(s, 15);
    expect(s.grid.ground[idx(s, 35, 40)]).toBe(MAT.stone);
  });
});

describe('Stormglass Charm', () => {
  it('grants the Stormglass keystone: ice conducts your Storm', () => {
    const s = room('.');
    wear(s, 'stormglass_charm');
    expect(s.heroMods.keystones).toContain('stormglass');
    paintRect(s, 30, 30, 45, 50, 'ice');
    apply(s, 'storm', circle(31.5, 40.5, 0.4), { hitDamage: 20 });
    expect(s.grid.charge[idx(s, 40, 40)]).toBeGreaterThan(0);
  });

  it("doesn't stack with the allocated keystone", () => {
    const tree = arena();
    allocateExactly(tree, 'stormglass');
    const both = arena();
    allocateExactly(both, 'stormglass');
    wear(both, 'stormglass_charm');
    expect(both.heroMods.effects.stormglass).toBe(tree.heroMods.effects.stormglass);
    expect(both.heroMods.keystones.filter((k) => k === 'stormglass')).toHaveLength(1);
  });
});

describe('Pyre Hood', () => {
  it('+1 to Fire rune levels and fire you create spreads 30% faster', () => {
    const s = arena();
    wear(s, 'pyre_hood');
    expect(s.heroMods.runeLevelAdd.fire).toBe(1);
    expect(s.heroMods.fireSpreadInc).toBeCloseTo(0.3);
  });

  it('you take 10% more Fire damage, from hits and from Ignite', () => {
    const s = arena();
    wear(s, 'pyre_hood');
    const bare = arena();
    const before = s.player.life;
    hitWith(s, s.player, 20, 'fire', { sourceId: 9 });
    hitWith(bare, bare.player, 20, 'fire', { sourceId: 9 });
    const taken = before - s.player.life;
    const bareTaken = before - bare.player.life;
    expect(taken).toBeCloseTo(bareTaken * 1.1);
    const l0 = s.player.life;
    const b0 = bare.player.life;
    run(s, 60);
    run(bare, 60);
    expect(l0 - s.player.life).toBeCloseTo((b0 - bare.player.life) * 1.1);
    // Other damage types are unchanged.
    const p = arena();
    wear(p, 'pyre_hood');
    const q = arena();
    hitWith(p, p.player, 20, 'frost', { sourceId: 9 });
    hitWith(q, q.player, 20, 'frost', { sourceId: 9 });
    expect(p.player.life).toBeCloseTo(q.player.life);
  });
});

describe('The Unraveling', () => {
  it('branches nest 4 deep', () => {
    const s = arena();
    expect(compiled(s, DEPTH4).ok).toBe(false);
    wear(s, 'the_unraveling');
    s.weaves.capacity = 99;
    refreshHero(s);
    const c = compiled(s, DEPTH4);
    expect(c.ok, c.ok ? '' : c.error.message).toBe(true);
  });

  it('spawn cap per cast is 96 and spells cost 40% more mana', () => {
    const s = arena();
    const n = 'Cast > Bolt[Fire]';
    const plain = compiled(s, n);
    wear(s, 'the_unraveling');
    const c = compiled(s, n);
    expect(c.ok && c.program.spawnCap).toBe(96);
    expect(plain.ok && plain.program.spawnCap).toBe(weaveLimits.spawnCapPerCast);
    expect(c.costs!.mana).toBeCloseTo(plain.costs!.mana * 1.4);
  });

  it("The First Thread's 2-deep cap beats The Unraveling's 4", () => {
    const s = arena();
    wear(s, 'the_first_thread', 'the_unraveling');
    expect(s.heroMods.maxDepth).toBe(2);
  });
});

describe('uniques and saves', () => {
  it('a unique keeps its id and name through describe', async () => {
    const { describeItem } = await import('../../../src/sim/items/describe');
    const s = arena();
    const it = makeUnique(s.hero, 'pyre_hood', 4);
    const d = describeItem(it);
    expect(d.name).toBe('Pyre Hood');
    expect(d.rarity).toBe('unique');
    expect(d.lines).toContain('+1 to Fire rune levels');
    expect(gridTicks(1)).toBe(20);
  });
});
