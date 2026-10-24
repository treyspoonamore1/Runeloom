import { describe, expect, it } from 'vitest';
import { Button, hashState, type GameState } from '../../../src/sim';
import { applyHeroEdit } from '../../../src/sim/hero/edits';
import { refreshHero } from '../../../src/sim/hero/hero';
import { createHeroFx } from '../../../src/sim/hero/effects';
import { NO_RULES } from '../../../src/sim/weave/rules';
import { hitWith } from '../combat/helpers';
import { addEnemy, arena, ofType, setWeaves, tick, ticks } from '../weave/runtimeHelpers';
import { allocateExactly, fuse } from '../hero/helpers';

/** Compile rules (weave/rules.ts) and trigger rules (hero/effects.ts). */

const program = (s: GameState, slot = 0) => s.weaves.slots[slot]!.program!;

describe('Tinder Tooth: the first Fire rune in each weave costs 0 complexity', () => {
  it('one Fire rune is free, a second one is not; weaves without Fire are unchanged', () => {
    const s = arena();
    fuse(s, ['tinder_tooth', 1]);
    setWeaves(s, [
      'Cast > Bolt[Fire]',
      'Cast > Lob[Fire] > OnExpire > Nova[Fire, Wide]',
      'Cast > Bolt[Storm]',
    ]);
    expect(program(s, 0).complexity).toBe(1);
    expect(program(s, 1).complexity).toBe(7);
    expect(program(s, 2).complexity).toBe(2);
  });

  it('a weave one over the Capacity fits with it', () => {
    const s = arena();
    setWeaves(s, ['Cast > Bolt[Fire, Split, Pierce]'], 5);
    expect(s.weaves.slots[0]!.program).not.toBeNull();
    const t = arena();
    fuse(t, ['tinder_tooth', 1]);
    setWeaves(t, ['Cast > Bolt[Fire, Split, Pierce, Heavy]'], 5);
    expect(t.weaves.slots[0]!.error).toBeNull();
  });
});

describe('Ember Feather: Bolt and Lob projectiles are 25% faster', () => {
  it('bolt speed × 1.25, lob flight time ÷ 1.25 (× 1.5 at tier II); Nova untouched', () => {
    const s = arena();
    setWeaves(s, ['Cast > Bolt[Fire]', 'Cast > Lob[Fire]', 'Cast > Nova[Fire]']);
    const bolt = (program(s, 0).root.params as { speed: number }).speed;
    const lob = (program(s, 1).root.params as { flightTime: number }).flightTime;
    const nova = program(s, 2).root.params;
    for (const [tier, k] of [
      [1, 1.25],
      [2, 1.375],
    ] as const) {
      const t = arena();
      fuse(t, ['ember_feather', tier]);
      setWeaves(t, ['Cast > Bolt[Fire]', 'Cast > Lob[Fire]', 'Cast > Nova[Fire]']);
      expect((program(t, 0).root.params as { speed: number }).speed).toBeCloseTo(bolt * k);
      expect((program(t, 1).root.params as { flightTime: number }).flightTime).toBeCloseTo(lob / k);
      expect(program(t, 2).root.params).toEqual(nova);
    }
  });

  it('a fired bolt flies at the faster speed', () => {
    const s = arena();
    fuse(s, ['ember_feather', 1]);
    setWeaves(s, ['Cast > Bolt[Fire]']);
    const ev = ticks(s, 20, Button.Cast1);
    const spawn = ofType(ev, 'projectileSpawn')[0]!;
    expect(spawn.vx).toBeCloseTo(70 * 1.25);
  });
});

describe('Single Thread: weaves with no modifiers deal 70% more', () => {
  it('adds a 1.7 more to every spell of a modifier-free weave, branches included', () => {
    const s = arena();
    allocateExactly(s, 'single_thread');
    setWeaves(s, ['Cast > Bolt[Fire] > OnHit > Nova[Fire]', 'Cast > Bolt[Fire, Heavy]']);
    const root = program(s, 0).root;
    expect(root.more.at(-1)).toEqual({ source: 'single_thread', label: 'Single Thread', mult: 1.7 });
    expect(root.moreProduct).toBeCloseTo(1.7);
    expect(root.children[0]!.spec.moreProduct).toBeCloseTo(0.65 * 1.7);
    expect(program(s, 1).root.more.map((m) => m.source)).toEqual(['heavy']);
  });

  it('a hit deals 70% more than without it', () => {
    const hit = (keystone: boolean) => {
      const s = arena();
      if (keystone) allocateExactly(s, 'single_thread');
      setWeaves(s, ['Cast > Bolt[Frost]']);
      addEnemy(s, 'dummy', 95, 60);
      return ofType(ticks(s, 30, Button.Cast1), 'hit')[0]!.amount;
    };
    expect(hit(true) / hit(false)).toBeCloseTo(1.7);
  });

  it("its −3 Capacity is aggregated into capacityAdd (applied by the hero's compile context)", () => {
    const s = arena();
    allocateExactly(s, 'single_thread');
    expect(s.heroMods.capacityAdd).toBe(-3);
  });
});

describe("Echoing Thread: Echo's repeat deals full damage", () => {
  it('the compiled echo multiplier becomes 1, and the repeat hits as hard as the first', () => {
    const s = arena();
    allocateExactly(s, 'echoing_thread');
    setWeaves(s, ['Cast > Strike[Echo]']);
    expect(program(s).root.echo!.damageMult).toBe(1);
    addEnemy(s, 'dummy', 83, 60);
    const hits = ofType(ticks(s, 40, Button.Cast1, [90, 60]), 'hit').filter((h) => !h.crit);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[1]!.amount).toBeCloseTo(hits[0]!.amount);
  });

  it('allocating it through a HeroEdit recompiles the slots; refunding restores 0.8', () => {
    const s = arena();
    setWeaves(s, ['Cast > Strike[Echo]']);
    s.hero.level = 9;
    for (const n of ['weaver_sw', 'weaver_nw', 'weaver_nw1', 'echoing_thread'])
      expect(applyHeroEdit(s, { kind: 'allocate', node: n })).toBeNull();
    expect(program(s).root.echo!.damageMult).toBe(1);
    expect(applyHeroEdit(s, { kind: 'refund', node: 'echoing_thread' })).toBeNull();
    expect(program(s).root.echo!.damageMult).toBe(0.8);
    expect(s.weaves.rules).toBe(NO_RULES);
  });
});

describe('Living Loom: automatic triggers cost no mana and share a 0.4 s cooldown', () => {
  it('Pulse weaves fire for free', () => {
    const s = arena();
    allocateExactly(s, 'living_loom');
    setWeaves(s, [null, 'Pulse > Bolt[Fire]']);
    addEnemy(s, 'dummy', 110, 60);
    s.player.mana = 0;
    const ev = ticks(s, 5);
    expect(ofType(ev, 'triggerFired')).toHaveLength(1);
  });

  it('two Pulse weaves due together fire 0.4 s apart', () => {
    const s = arena();
    allocateExactly(s, 'living_loom');
    setWeaves(s, ['Pulse > Bolt[Fire]', 'Pulse > Bolt[Frost]']);
    addEnemy(s, 'dummy', 110, 60);
    const at: number[] = [];
    for (let i = 0; i < 200; i++) if (ofType(tick(s), 'triggerFired').length > 0) at.push(i);
    // Both are due on tick 0; only one may fire, and nothing fires inside 0.4 s (24 ticks) of it.
    expect(at[0]).toBe(0);
    for (let k = 1; k < at.length; k++) expect(at[k]! - at[k - 1]!).toBeGreaterThanOrEqual(24);
  });

  it('Cast weaves still pay', () => {
    const s = arena();
    allocateExactly(s, 'living_loom');
    setWeaves(s, ['Cast > Bolt[Fire]']);
    ticks(s, 15, Button.Cast1);
    expect(s.player.mana).toBeLessThan(s.player.maxMana);
  });

  it('without it, an automatic weave pays and two pulses fire on the same tick', () => {
    const s = arena();
    setWeaves(s, ['Pulse > Bolt[Fire]', 'Pulse > Bolt[Frost]']);
    addEnemy(s, 'dummy', 110, 60);
    const ev = tick(s);
    expect(ofType(ev, 'triggerFired')).toHaveLength(2);
    expect(s.player.mana).toBeLessThan(s.player.maxMana);
  });
});

describe('Cinder Heart: Harvest > Nova[Fire] as an extra weave', () => {
  it('uses no slot; a kill fires it as slot −1 from the dead enemy, with its own ICD', () => {
    const s = arena();
    setWeaves(s, ['Cast > Bolt[Fire]', null, null, null]);
    fuse(s, ['cinder_heart', 1]);
    expect(s.weaves.slots.map((x) => x.notation)).toEqual(['Cast > Bolt[Fire]', null, null, null, null]);
    expect(s.heroFx.bonus.map((b) => b.notation)).toEqual(['Harvest > Nova[Fire]']);
    const e = addEnemy(s, 'tinderling', 100, 60);
    hitWith(s, e, 1000, 'physical');
    const ev = tick(s);
    expect(ofType(ev, 'triggerFired')).toMatchObject([{ slot: -1, trigger: 'harvest', x: 100, y: 60 }]);
    expect(ofType(ev, 'spellSpawn')).toMatchObject([{ slot: -1, form: 'nova', elements: ['fire'] }]);
    expect(s.heroFx.bonus[0]!.cooldownLeft).toBeCloseTo(0.25);
  });

  it('its timers are hashed; unequipping the spindle removes it', () => {
    const s = arena();
    fuse(s, ['cinder_heart', 1]);
    const withPart = hashState(s);
    s.heroFx.bonus[0]!.cooldownLeft = 0.1;
    expect(hashState(s)).not.toBe(withPart);
    s.hero.equipped.spindle = null;
    refreshHero(s);
    expect(s.heroFx.bonus).toEqual([]);
    const h = hashState(s);
    s.heroFx = createHeroFx();
    expect(hashState(s)).toBe(h); // nothing of heroFx is hashed in its neutral state
  });

  it('Living Loom makes it free too', () => {
    const s = arena();
    allocateExactly(s, 'living_loom');
    fuse(s, ['cinder_heart', 1]);
    s.player.mana = 0;
    const e = addEnemy(s, 'tinderling', 100, 60);
    hitWith(s, e, 1000, 'physical');
    expect(ofType(tick(s), 'triggerFired')).toHaveLength(1);
  });
});

describe('neutral rules', () => {
  it('no passives and no parts: NO_RULES, no extra weaves, and refreshing changes no hash', () => {
    const s = arena();
    setWeaves(s, ['Cast > Bolt[Fire]', 'Pulse > Lob[Storm]']);
    const before = hashState(s);
    const prog = program(s);
    refreshHero(s);
    expect(s.weaves.rules).toBe(NO_RULES);
    expect(s.heroFx).toEqual({ bonus: [], autoCooldownLeft: 0 });
    // refreshHero recompiles every slot (hero/hero.ts); neutral rules compile to the same program.
    expect(program(s)).toEqual(prog);
    expect(hashState(s)).toBe(before);
  });
});
