import { describe, expect, it } from 'vitest';
import {
  applyHeroEdit,
  Button,
  parseWeave,
  rotationDeg,
  spindleBasesAt,
  step,
  type GameState,
} from '../../../src/sim';
import { rollDiscovery } from '../../../src/sim/items/drops';
import { runeDiscovery } from '../../../data/progression';
import { runes } from '../../../data/runes';
import { compileWeave } from '../../../src/sim/weave/compile';
import {
  addEnemy,
  castFor,
  hitsByTarget,
  ofType,
  releaseTick,
  spawnsOf,
  ticks,
  weaveArena,
} from './runtimeHelpers';
import { adventure } from '../hero/helpers';

/** CONTENT §1: the M5 runes (Fork, Return, Infuse, Focus, Swift, Channel), Heartwood and Loomsteel. */

const LMB = Button.Cast1;

function compiled(notation: string) {
  const p = parseWeave(notation);
  if (!p.ok) throw new Error(p.error.message);
  const c = compileWeave(p.tree, { capacity: 99, allowShips: 'all' });
  if (!c.ok) throw new Error(c.error.message);
  return c.program;
}

describe('M5 runes in the runtime', () => {
  it('Fork: the first hit splits the bolt into 2 bolts at ±40° that fly 0.5 s and skip that target', () => {
    const state = weaveArena(['Cast > Bolt[Fire, Fork]']);
    const a = addEnemy(state, 'dummy', 95, 60);
    const ev = castFor(state, LMB, releaseTick(0.45), [95, 60], 14);
    const bolts = spawnsOf(ev, 'bolt');
    expect(bolts).toHaveLength(3);
    const r = rotationDeg(40);
    expect(bolts[1]!.dirX).toBeCloseTo(r.cos, 9);
    expect(bolts[1]!.dirY).toBeCloseTo(-r.sin, 9);
    expect(bolts[2]!.dirY).toBeCloseTo(r.sin, 9);
    // The fork bolts don't hit the dummy they split from, and end after 0.5 s.
    const after = ticks(state, 40);
    expect(hitsByTarget([...ev, ...after]).get(a.id)).toBe(1);
    const ends = ofType(after, 'spellEnd').filter((e) => e.id === bolts[1]!.id || e.id === bolts[2]!.id);
    expect(ends.map((e) => e.reason)).toEqual(['expired', 'expired']);
  });

  it('Fork: fork bolts never fork again, and hit what they reach', () => {
    const state = weaveArena(['Cast > Bolt[Fire, Fork]']);
    addEnemy(state, 'dummy', 95, 60);
    const r = rotationDeg(40);
    const b = addEnemy(state, 'dummy', 95 + 12 * r.cos, 60 + 12 * r.sin);
    const ev = castFor(state, LMB, releaseTick(0.45), [95, 60], 40);
    expect(spawnsOf(ev, 'bolt')).toHaveLength(3);
    expect(hitsByTarget(ev).get(b.id)).toBe(1);
  });

  it('Return: at the end of its life the bolt flies back to the player and can hit again', () => {
    const state = weaveArena(['Cast > Bolt[Fire, Return, Pierce]']);
    const d = addEnemy(state, 'dummy', 100, 60);
    const ev = castFor(state, LMB, releaseTick(0.45), [100, 60], 150);
    expect(hitsByTarget(ev).get(d.id)).toBe(2);
    const end = ofType(ev, 'spellEnd').find((e) => e.form === 'bolt')!;
    expect(end.reason).toBe('expired');
    // It ended at the player.
    expect(Math.hypot(end.x - state.player.x, end.y - state.player.y)).toBeLessThan(3);
  });

  it('Return: without it, the bolt just ends where its life runs out', () => {
    const state = weaveArena(['Cast > Bolt[Fire, Pierce]']);
    const d = addEnemy(state, 'dummy', 100, 60);
    const ev = castFor(state, LMB, releaseTick(0.45), [100, 60], 150);
    expect(hitsByTarget(ev).get(d.id)).toBe(1);
    expect(ofType(ev, 'spellEnd').find((e) => e.form === 'bolt')!.x).toBeGreaterThan(130);
  });

  it('Channel: fires every 0.2 s while held, from the press, at 30% of the mana each', () => {
    const state = weaveArena(['Channel > Bolt[Fire]']);
    state.player.mana = 1000;
    state.player.maxMana = 1000;
    const prog = state.weaves.slots[0]!.program!;
    expect(prog.castTime).toBe(0);
    expect(prog.mana).toBeCloseTo(6 * 1.1 * 0.3, 9);
    const ev = ticks(state, 60, LMB, [120, 60]);
    const fires = ofType(ev, 'triggerFired');
    expect(fires.map((f) => f.slot)).toEqual([0, 0, 0, 0, 0]);
    expect(spawnsOf(ev, 'bolt')).toHaveLength(5);
    for (const f of fires) expect(f.mana).toBeCloseTo(prog.mana, 9);
    // Released, nothing more; pressed again, it fires at once.
    expect(ofType(ticks(state, 30, 0), 'triggerFired')).toHaveLength(0);
    expect(ofType(ticks(state, 1, LMB, [120, 60]), 'triggerFired')).toHaveLength(1);
  });

  it('Channel: you move 40% slower while holding it, and it fires while you walk', () => {
    const walkSpeed = (notation: string, buttons: number): number => {
      const s = weaveArena([notation]);
      s.player.mana = s.player.maxMana = 1000;
      for (let i = 0; i < 40; i++)
        step(s, { moveX: 1, moveY: 0, aimX: s.player.x + 10, aimY: s.player.y, buttons });
      return Math.hypot(s.player.vx, s.player.vy);
    };
    const free = walkSpeed('Channel > Bolt[Fire]', 0);
    expect(walkSpeed('Channel > Bolt[Fire]', LMB)).toBeCloseTo(free * 0.6, 6);
    expect(walkSpeed('Cast > Bolt[Fire]', LMB)).toBeCloseTo(free, 6);
  });

  it('Channel: short on mana, it skips the beat', () => {
    const state = weaveArena(['Channel > Bolt[Fire]']);
    state.player.mana = 0;
    expect(ofType(ticks(state, 30, LMB, [120, 60]), 'triggerFired')).toHaveLength(0);
  });

  it('Swift: +50% bolt speed; a Lob lands 30% sooner', () => {
    expect(compiled('Cast > Bolt[Fire, Swift]').root.params).toMatchObject({ speed: 105 });
    const lob = compiled('Cast > Lob[Fire, Swift]').root.params;
    expect(lob.form === 'lob' && lob.flightTime).toBeCloseTo(0.35, 9);
    const state = weaveArena(['Cast > Bolt[Fire, Swift]']);
    const d = addEnemy(state, 'dummy', 150, 60);
    const ev = castFor(state, LMB, releaseTick(0.45), [150, 60], 60);
    expect(hitsByTarget(ev).get(d.id)).toBe(1); // 70 cells away: Fire Bolt's 63-cell reach becomes 94.5
  });

  it('Focus: 30% less area, 40% more damage', () => {
    const plain = compiled('Cast > Nova[Fire]').root;
    const f = compiled('Cast > Nova[Fire, Focus]').root;
    expect(f.params.form === 'nova' && f.params.radius).toBeCloseTo(
      (plain.params.form === 'nova' ? plain.params.radius : 0) * Math.sqrt(0.7),
      9,
    );
    expect(f.moreProduct / plain.moreProduct).toBeCloseTo(1.4, 9);
  });

  it("Infuse: the spell's elements are added to every branch spell below it", () => {
    const p = compiled('Cast > Bolt[Fire, Infuse] > OnHit > Nova[Frost] > OnExpire > Lob[Storm]').root;
    const nova = p.children[0]!.spec;
    const lob = nova.children[0]!.spec;
    expect(nova.elements.map((e) => [e.element, e.source])).toEqual([
      ['frost', 'own'],
      ['fire', 'infused'],
    ]);
    expect(lob.elements.map((e) => e.element).sort()).toEqual(['fire', 'storm']);
    const plain = compiled('Cast > Bolt[Fire] > OnHit > Nova[Frost]').root.children[0]!.spec;
    expect(plain.elements.map((e) => e.element)).toEqual(['frost']);
  });
});

describe('Heartwood and Loomsteel, and finding the M5 runes', () => {
  it('Heartwood drops from item level 18, Loomsteel from 30', () => {
    expect(spindleBasesAt(17)).not.toContain('heartwood');
    expect(spindleBasesAt(18)).toContain('heartwood');
    expect(spindleBasesAt(29)).not.toContain('loomsteel');
    expect(spindleBasesAt(30)).toContain('loomsteel');
  });

  it("Loomsteel's +1 to all rune levels reaches the weaves", () => {
    const s: GameState = adventure();
    const lvl = s.weaves.slots[0]!.program!.runeLevel;
    const it = {
      uid: s.hero.nextUid++,
      base: 'loomsteel',
      rarity: 'normal' as const,
      itemLevel: 30,
      affixes: [],
      fused: [null, null],
    };
    s.hero.items.push(it);
    expect(s.hero.items.length).toBeGreaterThan(0);
    expect(applyHeroEdit(s, { kind: 'equip', uid: it.uid, slot: 'spindle' })).toBeNull();
    expect(s.weaves.slots[0]!.program!.runeLevel).toBe(lvl + 1);
    expect(s.weaves.slots[0]!.program!.complexity).toBeLessThanOrEqual(15);
  });

  it('every discoverable rune is an M5 rune', () => {
    for (const id of Object.keys(runeDiscovery.from))
      expect(runes[id as keyof typeof runes].ships).toBe('M5');
  });

  it('discovery picks only locked runes the area level allows, never one already pending', () => {
    const s = adventure();
    s.hero.unlockedRunes = [...s.hero.unlockedRunes, 'fork'];
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const r = rollDiscovery(s, 5, [])!;
      seen.add(r);
    }
    expect([...seen].sort()).toEqual(['return', 'swift']);
    expect(rollDiscovery(s, 2, [])).toBeNull();
    const pending = [
      { kind: 'rune' as const, rune: { uid: 1, rune: 'swift' as const, level: 1, xp: 0, quality: 0 } },
    ];
    for (let i = 0; i < 50; i++) expect(rollDiscovery(s, 5, pending)).toBe('return');
  });
});
