import { describe, expect, it } from 'vitest';
import {
  buildPacket,
  createGame,
  emptyHeroMods,
  hashState,
  makePacket,
  previewFor,
  previewWeave,
  recompileWeaves,
  referenceWeaves,
  runReadout,
  refreshHero,
  spawnProjectile,
  specPacket,
  step,
  type GameState,
  type HeroMods,
} from '../../../src/sim';
import { syncPlayerToHero } from '../../../src/sim/actors/playerVitals';
import { spindles, type SpindleId } from '../../../data/spindles';
import { zeroAmounts } from '../../../src/sim/combat/damage';
import { damageTypes } from '../../../data/combatTypes';
import { adventure, giveRune, OPEN_ROOM } from './helpers';
import { setSlotWeave } from '../../../src/sim';

/** Replaces HeroMods with neutral mods plus `patch` and updates the systems that cache them. */
function withMods(state: GameState, patch: (m: HeroMods) => void): void {
  const m = emptyHeroMods();
  patch(m);
  state.heroMods = m;
  syncPlayerToHero(state);
  recompileWeaves(state);
}

const idle = (s: GameState) => ({ moveX: 0, moveY: 0, aimX: s.player.x + 10, aimY: s.player.y, buttons: 0 });

describe('HeroMods Core group: weaves', () => {
  it('adds Capacity, cast speed and reduced mana cost to compiled weaves', () => {
    const state = adventure();
    withMods(state, (m) => {
      m.capacityAdd = 2;
      m.castSpeedInc = 0.25;
      m.manaCostReduced = 0.2;
    });
    const c = state.weaves.slots[0]!.compiled!;
    expect(c.costs!.capacity).toBe(10);
    expect(c.ok && c.program.castTime).toBeCloseTo(0.45 / 1.25, 12);
    expect(c.ok && c.program.mana).toBeCloseTo(6 * 1.1 * 0.8, 12);
  });

  it('adds flat Strike damage and rune levels (all, and by element on spells with it)', () => {
    const state = adventure();
    withMods(state, (m) => {
      m.strikeFlatAdd = 5;
      m.runeLevelAdd.all = 2;
      m.runeLevelAdd.fire = 1;
    });
    expect(state.weaves.slots[1]!.program!.root.baseDamage).toBeCloseTo(16 * 1.11 ** 2 + 5, 9);
    expect(state.weaves.slots[0]!.program!.root.baseDamage).toBeCloseTo(12 * 1.11 ** 3, 9);
  });

  it('adds increased damage by type, branch damage (depth ≥ 1 only) and crit to hit packets', () => {
    const state = adventure();
    giveRune(state, 'cast');
    giveRune(state, 'bolt');
    giveRune(state, 'fire');
    giveRune(state, 'on_hit');
    giveRune(state, 'nova');
    giveRune(state, 'fire');
    withMods(state, (m) => {
      m.capacityAdd = 10;
      m.damageInc.fire = 0.3;
      m.branchDamageInc = 0.15;
      m.critChanceAdd = 0.02;
    });
    expect(setSlotWeave(state, 2, 'Cast > Bolt[Fire] > OnHit > Nova[Fire]').applied).toBe(true);
    const root = state.weaves.slots[2]!.program!.root;
    const p0 = buildPacket(state, root, 1);
    expect(p0.increasedByType!.fire).toBeCloseTo(0.3, 12);
    expect(p0.increased).toBe(0);
    expect(p0.critChance).toBeCloseTo(root.critChance + 0.02, 12);
    const p1 = buildPacket(state, root.children[0]!.spec, 1);
    expect(p1.increased).toBeCloseTo(0.15, 12);
  });
});

describe('HeroMods Core and Defense groups: the player', () => {
  it('max life and mana: (level formula + flat) × (1 + increased); mana regen adds flat', () => {
    const state = adventure();
    withMods(state, (m) => {
      m.maxLifeAdd = 20;
      m.maxLifeInc = 0.5;
      m.maxManaAdd = 10;
      m.maxManaInc = 0.1;
      m.manaRegenAdd = 6;
    });
    const p = state.player;
    expect(p.maxLife).toBe(150);
    expect(p.maxMana).toBeCloseTo(66, 12);
    p.mana = 0;
    for (let i = 0; i < 60; i++) step(state, idle(state));
    expect(p.mana).toBeCloseTo(66 * 0.08 + 6, 6);
  });

  it('resistances are capped at 75%', () => {
    const state = adventure();
    withMods(state, (m) => {
      m.resistAdd.fire = 0.9;
      m.resistAdd.storm = 0.2;
    });
    expect(state.player.resist.fire).toBe(0.75);
    expect(state.player.resist.storm).toBeCloseTo(0.2, 12);
  });

  it('move speed, dodge recharge and dodge charges', () => {
    const state = adventure();
    withMods(state, (m) => {
      m.moveSpeedInc = 0.2;
      m.dodgeRechargeInc = 0.4;
      m.dodgeChargesAdd = 1;
    });
    for (let i = 0; i < 30; i++) step(state, { ...idle(state), moveX: 1 });
    expect(state.player.vx).toBeCloseTo(26 * 1.2, 9);
    // A third charge appears once it recharges (1.4 s ÷ 1.4 = 1 s per charge).
    expect(state.player.dodgeCharges).toBe(2);
    for (let i = 0; i < 61; i++) step(state, idle(state));
    expect(state.player.dodgeCharges).toBe(3);
  });

  it('takes less damage from enemy projectiles', () => {
    const hitFor = (less: number): number => {
      const state = adventure();
      withMods(state, (m) => (m.projectileDamageTakenLess = less));
      const p = state.player;
      const def = { kind: 'test_arrow', speed: 45, radius: 0.6, life: 1, pierce: 0 };
      spawnProjectile(state, {
        team: 'enemy',
        ownerId: 99,
        x: p.x - 6,
        y: p.y,
        dirX: 1,
        dirY: 0,
        def,
        damage: makePacket(10, { physical: 1 }, 0, 1.5),
        knockback: 0,
      });
      const before = p.life;
      for (let i = 0; i < 20; i++) step(state, idle(state));
      return before - p.life;
    };
    expect(hitFor(0)).toBeCloseTo(10, 9);
    expect(hitFor(0.2)).toBeCloseTo(8, 9);
  });
});

describe('neutral HeroMods change nothing', () => {
  it('sandbox weaves compile exactly as before M4 on every spindle', () => {
    for (const id of Object.keys(spindles) as SpindleId[]) {
      const state = createGame({ seed: 1, roomText: OPEN_ROOM, loadout: { spindleId: id, notations: [] } });
      for (const w of referenceWeaves)
        expect(previewWeave(state, w.notation)).toEqual(previewFor(id, null, state.tuning, w.notation));
    }
  });

  it('packets carry exactly the spindle implicit, as before M4', () => {
    for (const id of ['twig', 'ashwood', 'rimeglass'] as SpindleId[]) {
      const state = createGame({
        seed: 1,
        roomText: OPEN_ROOM,
        loadout: { spindleId: id, notations: ['Cast > Bolt[Fire]'] },
      });
      const spec = state.weaves.slots[0]!.program!.root;
      const expected = specPacket(spec);
      expected.ailmentDuration = spec.ailmentDurationMult;
      const imp = spindles[id].implicit as { increased?: Record<string, number>; chillGain?: number };
      if (imp.increased) {
        const by = zeroAmounts();
        for (const t of damageTypes) by[t] = imp.increased[t] ?? 0;
        expected.increasedByType = by;
      }
      if (imp.chillGain) expected.chillGain = 1 + imp.chillGain;
      expect(buildPacket(state, spec, 1)).toEqual(expected);
    }
  });

  it('refreshing a hero with nothing leaves the player and the state hash unchanged', () => {
    const a = createGame({ seed: 4, roomText: OPEN_ROOM });
    const b = createGame({ seed: 4, roomText: OPEN_ROOM });
    refreshHero(b);
    refreshHero(b);
    expect(b.player).toEqual(a.player);
    expect(hashState(b)).toBe(hashState(a));
    expect(a.player.maxLife).toBe(80);
    expect(a.player.maxMana).toBe(50);
    expect(a.player.resist).toEqual({ physical: 0, fire: 0, frost: 0, storm: 0 });
  });
});

describe('the DPS readout with a character', () => {
  it('counts the socketed rune levels and HeroMods of the hero it is given', () => {
    const state = adventure();
    const bolt = state.hero.runes.find((r) => r.rune === 'bolt')!;
    bolt.level = 5;
    const runes = state.weaves.slots[0]!.runes!;
    const base = {
      notation: 'Cast > Bolt[Fire]',
      spindleId: 'twig' as const,
      scene: 'dummy_single' as const,
      seconds: 3,
      runs: 2,
      seed: 1,
    };
    const plain = runReadout(base);
    const hero = runReadout({ ...base, hero: state.hero, runes });
    expect(plain.ok && hero.ok).toBe(true);
    if (plain.ok && hero.ok) expect(hero.hitDps / plain.hitDps).toBeCloseTo(1.11 ** 4, 6);
  });
});
