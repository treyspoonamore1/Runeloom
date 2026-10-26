import { describe, expect, it } from 'vitest';
import {
  applyElement,
  applyShock,
  chargeDamageMult,
  PLAYER_ID,
  playerGustScale,
  setGround,
  step,
  type GameState,
} from '../../../src/sim';
import { MAT, OWNER } from '../../../data/materials';
import { fuseEffectLines } from '../../../data/fuseEffects';
import { fuseParts, partDroppedBy } from '../../../data/fuseParts';
import { addEnemy, arena, hitWith, ofType } from '../combat/helpers';
import { fuse } from '../hero/helpers';

/** The M8 Glasswater Fen Fuse parts (CONTENT §4; hero/effectsFen.ts). */

const amount = (s: GameState) => ofType(s.events, 'hit').at(-1)!.amount;

function paint(s: GameState, x0: number, y0: number, x1: number, y1: number, code: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setGround(s, y * s.grid.width + x, code);
}

describe('Fen Fuse parts', () => {
  it('each drops from its Fen enemy', () => {
    expect(partDroppedBy('glasspike')).toBe('pike_scale');
    expect(partDroppedBy('copperback')).toBe('copper_carapace');
    expect(partDroppedBy('spark_heron')).toBe('heron_plume');
    expect(partDroppedBy('slagshell')).toBe('slag_core');
    expect(partDroppedBy('sparkfly')).toBe('sparkfly_lantern');
    expect(partDroppedBy('mire_bull')).toBe('mire_horn');
    expect(partDroppedBy('bellows_toad')).toBe('toad_bellows');
    expect(partDroppedBy('bellshell')).toBe('bell_bronze');
    for (const id of Object.keys(fuseParts)) expect(fuseEffectLines(id, 1).length, id).toBeGreaterThan(0);
  });

  it("Pike Scale: you aren't slowed by shallow water or mud (oil still slows)", () => {
    const top = (withPart: boolean, mat: number) => {
      const s = arena();
      if (withPart) fuse(s, ['pike_scale', 1]);
      paint(s, 70, 50, 120, 70, mat);
      for (let k = 0; k < 30; k++) step(s, { moveX: 1, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });
      return s.player.vx;
    };
    const free = top(false, MAT.stone);
    expect(top(false, MAT.shallow_water)).toBeCloseTo(free * 0.8);
    expect(top(true, MAT.shallow_water)).toBeCloseTo(free);
    expect(top(false, MAT.mud)).toBeCloseTo(free * 0.6);
    expect(top(true, MAT.mud)).toBeCloseTo(free);
  });

  it('Copper Carapace: 30% less damage from charged water and metal that is not yours', () => {
    const s = arena();
    expect(chargeDamageMult(s, s.player, OWNER.enemy)).toBe(1);
    fuse(s, ['copper_carapace', 1]);
    expect(chargeDamageMult(s, s.player, OWNER.enemy)).toBeCloseTo(0.7);
    expect(chargeDamageMult(s, s.player, OWNER.world)).toBeCloseTo(0.7);
    fuse(s, ['copper_carapace', 2]);
    expect(chargeDamageMult(s, s.player, OWNER.enemy)).toBeCloseTo(0.55);
  });

  it('Copper Carapace on a charge hit: enemy charge in your water hurts 30% less', () => {
    const hurt = (withPart: boolean) => {
      const s = arena();
      s.cheats.god = false;
      if (withPart) fuse(s, ['copper_carapace', 1]);
      paint(s, 70, 50, 90, 70, MAT.shallow_water);
      const e = addEnemy(s, 'copperback', 140, 100);
      applyElement(s, {
        element: 'storm',
        shape: { kind: 'circle', x: 85, y: 60, r: 0.6 },
        owner: OWNER.enemy,
        sourceId: e.id,
        hitDamage: 20,
        durationMult: 1,
      });
      step(s, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });
      return ofType(s.events, 'hit').find((h) => h.target === 'player')!.amount;
    };
    expect(hurt(true)).toBeCloseTo(hurt(false) * 0.7);
  });

  it('Heron Plume: 25% more damage with charge you create', () => {
    const s = arena();
    const d = addEnemy(s, 'dummy', 100, 60);
    fuse(s, ['heron_plume', 1]);
    expect(chargeDamageMult(s, d, OWNER.player)).toBeCloseTo(1.25);
    expect(chargeDamageMult(s, d, OWNER.world)).toBe(1);
  });

  it('Slag Core: your Fire hits on Wet enemies deal 30% more', () => {
    const s = arena();
    fuse(s, ['slag_core', 1]);
    const d = addEnemy(s, 'dummy', 100, 60);
    hitWith(s, d, 100, 'fire');
    expect(amount(s)).toBeCloseTo(100);
    d.terrain.wetLeft = 2;
    hitWith(s, d, 100, 'fire');
    expect(amount(s)).toBeCloseTo(130);
    hitWith(s, d, 100, 'frost');
    expect(amount(s)).toBeCloseTo(100);
  });

  it('Mire Horn: enemies on mud or in shallow water take 15% more from you', () => {
    const s = arena();
    fuse(s, ['mire_horn', 1]);
    const d = addEnemy(s, 'dummy', 100.5, 60.5);
    hitWith(s, d, 100, 'frost');
    expect(amount(s)).toBeCloseTo(100);
    setGround(s, 60 * s.grid.width + 100, MAT.mud);
    hitWith(s, d, 100, 'frost');
    expect(amount(s)).toBeCloseTo(115);
    setGround(s, 60 * s.grid.width + 100, MAT.shallow_water);
    hitWith(s, d, 100, 'physical');
    expect(amount(s)).toBeCloseTo(115);
  });

  it('Bell Bronze: Shocked enemies take 15% more Physical damage from you', () => {
    const s = arena();
    fuse(s, ['bell_bronze', 1]);
    const d = addEnemy(s, 'dummy', 100, 60);
    hitWith(s, d, 100, 'physical');
    expect(amount(s)).toBeCloseTo(100);
    applyShock(s, d, 0.1, 4, PLAYER_ID);
    hitWith(s, d, 100, 'physical');
    expect(amount(s)).toBeCloseTo(100 * 1.1 * 1.15);
    hitWith(s, d, 100, 'fire');
    expect(amount(s)).toBeCloseTo(100 * 1.1);
  });

  it('Sparkfly Lantern: enemies you kill while they stand in water release your charge (50% of the killing hit)', () => {
    const s = arena();
    fuse(s, ['sparkfly_lantern', 1]);
    paint(s, 90, 50, 110, 70, MAT.shallow_water);
    const e = addEnemy(s, 'copperback', 100.5, 60.5);
    e.life = 10;
    s.events.length = 0;
    hitWith(s, e, 40, 'physical');
    expect(e.dead).toBe(true);
    const w = ofType(s.events, 'waterElectrified').filter((x) => x.owner === OWNER.player);
    expect(w).toHaveLength(1);
    const ev = s.grid.chargeEvents.find((c) => c.id === w[0]!.chargeId)!;
    expect(ev.damage).toBeCloseTo(20);
    // On dry ground: nothing.
    const t = arena();
    fuse(t, ['sparkfly_lantern', 1]);
    const f = addEnemy(t, 'copperback', 100.5, 60.5);
    f.life = 10;
    t.events.length = 0;
    hitWith(t, f, 40, 'physical');
    expect(ofType(t.events, 'waterElectrified')).toHaveLength(0);
  });

  it('Toad Bellows: your gusts last 1 s longer and cover 30% more area', () => {
    const s = arena();
    expect(playerGustScale(s)).toEqual({ secondsAdd: 0, radiusMult: 1 });
    fuse(s, ['toad_bellows', 1]);
    const g = playerGustScale(s);
    expect(g.secondsAdd).toBe(1);
    expect(g.radiusMult * g.radiusMult).toBeCloseTo(1.3);
  });
});
