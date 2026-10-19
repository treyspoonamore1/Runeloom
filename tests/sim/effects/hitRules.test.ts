import { describe, expect, it } from 'vitest';
import {
  applyHit,
  applyShock,
  Button,
  freezeTarget,
  makePacket,
  PLAYER_ID,
  type Enemy,
  type GameState,
} from '../../../src/sim';
import { OWNER, SURFACE } from '../../../data/materials';
import { addEnemy, arena, hitWith, ofType, ticks } from '../combat/helpers';
import { setWeaves } from '../weave/runtimeHelpers';
import { allocateExactly, fuse } from '../hero/helpers';

/** Per-hit keystone, notable and Fuse rules on the player's hits (hero/effectsCombat.ts). */

function setup(...ids: Parameters<typeof allocateExactly>[1][]): { s: GameState; d: Enemy } {
  const s = arena();
  allocateExactly(s, ...ids);
  return { s, d: addEnemy(s, 'dummy', 100, 60) };
}

const amount = (s: GameState) => ofType(s.events, 'hit').at(-1)!.amount;

describe('Wildheart', () => {
  it('your Fire hits deal 30% less; other damage is untouched', () => {
    const { s, d } = setup('wildheart');
    hitWith(s, d, 100, 'fire');
    expect(amount(s)).toBeCloseTo(70);
    hitWith(s, d, 100, 'storm');
    expect(amount(s)).toBeCloseTo(100);
  });

  it("enemies' fire hits are untouched", () => {
    const { s } = setup('wildheart');
    s.cheats.god = false;
    const res = hitWith(s, s.player, 10, 'fire', { sourceId: 5 });
    expect(res!.total).toBeCloseTo(10);
  });
});

describe('Oilcraft', () => {
  it('Oiled enemies take 25% more Fire damage from you; clean ones and other types take normal damage', () => {
    const { s, d } = setup('oilcraft');
    hitWith(s, d, 100, 'fire');
    expect(amount(s)).toBeCloseTo(100);
    d.terrain.oiledLeft = 2;
    hitWith(s, d, 100, 'fire');
    expect(amount(s)).toBeCloseTo(125);
    hitWith(s, d, 100, 'frost');
    expect(amount(s)).toBeCloseTo(100);
  });
});

describe('Rainshadow', () => {
  it('Wet enemies take 15% more Storm damage', () => {
    const { s, d } = setup('rainshadow');
    hitWith(s, d, 100, 'storm');
    const dry = amount(s);
    const shock = d.ailments.shock.effect;
    d.terrain.wetLeft = 3;
    hitWith(s, d, 100, 'storm');
    expect(dry).toBeCloseTo(100);
    expect(amount(s)).toBeCloseTo(100 * (1 + shock) * 1.15);
  });
});

describe('Stormglass (damage)', () => {
  it('Shocked and Frozen enemies take 40% more Storm damage; only one of the two is not enough', () => {
    const { s, d } = setup('stormglass');
    freezeTarget(s, d, 5, PLAYER_ID);
    hitWith(s, d, 100, 'storm');
    expect(amount(s)).toBeCloseTo(100); // frozen, not yet shocked
    const shock = d.ailments.shock.effect;
    expect(shock).toBeGreaterThan(0);
    hitWith(s, d, 100, 'storm');
    expect(amount(s)).toBeCloseTo(100 * (1 + shock) * 1.4);
    const shock2 = d.ailments.shock.effect; // the stronger hit raised it
    hitWith(s, d, 100, 'fire');
    expect(amount(s)).toBeCloseTo(100 * (1 + shock2));
  });

  it('without the keystone the same hit is plain', () => {
    const { s, d } = setup();
    freezeTarget(s, d, 5, PLAYER_ID);
    applyShock(s, d, 0.2, 4, PLAYER_ID);
    hitWith(s, d, 100, 'storm');
    expect(amount(s)).toBeCloseTo(120);
  });
});

describe('Brittle', () => {
  const strike = (s: GameState, d: Enemy) =>
    applyHit(s, d, makePacket(100, { physical: 1 }, 0, 1.5), {
      sourceId: PLAYER_ID,
      dirX: 1,
      dirY: 0,
      knockback: 0,
      form: 'strike',
    })!.total;

  it('Chilled or Frozen enemies take 25% more Strike damage; other forms and unchilled targets normal', () => {
    const { s, d } = setup('brittle');
    expect(strike(s, d)).toBeCloseTo(100);
    d.ailments.chill = 10;
    expect(strike(s, d)).toBeCloseTo(125);
    hitWith(s, d, 100, 'physical'); // no form: not a Strike
    expect(amount(s)).toBeCloseTo(100);
    d.ailments.chill = 0;
    freezeTarget(s, d, 2, PLAYER_ID);
    expect(strike(s, d)).toBeCloseTo(125);
  });

  it('a real Strike cast passes its form through', () => {
    const run = (brittle: boolean) => {
      const s = arena();
      if (brittle) allocateExactly(s, 'brittle');
      setWeaves(s, ['Cast > Strike[]']);
      const d = addEnemy(s, 'dummy', 83, 60);
      d.ailments.chill = 50;
      const ev = ticks(s, 20, Button.Cast1, [90, 60]);
      return ofType(ev, 'hit')[0]!.amount;
    };
    expect(run(true) / run(false)).toBeCloseTo(1.25);
  });
});

describe('Pyre Walker (damage)', () => {
  it('you deal 20% more damage while standing on burning ground', () => {
    const { s, d } = setup('pyre_walker');
    hitWith(s, d, 100, 'frost');
    expect(amount(s)).toBeCloseTo(100);
    const i = Math.floor(s.player.y) * s.grid.width + Math.floor(s.player.x);
    s.grid.fire[i] = 128;
    s.grid.owner[i] = OWNER.enemy;
    hitWith(s, d, 100, 'frost');
    expect(amount(s)).toBeCloseTo(120);
  });
});

describe("Matriarch's Sac", () => {
  it('your hits apply Oiled for 2 s (4 s at tier III)', () => {
    for (const [tier, secs] of [
      [1, 2],
      [3, 4],
    ] as const) {
      const s = arena();
      fuse(s, ['matriarchs_sac', tier]);
      const d = addEnemy(s, 'dummy', 100, 60);
      hitWith(s, d, 10, 'physical');
      expect(d.terrain.oiledLeft).toBe(secs);
      expect(ofType(s.events, 'oiledChanged')).toMatchObject([{ target: d.id, oiled: true }]);
    }
  });

  it('enemy hits on the player apply nothing', () => {
    const s = arena();
    fuse(s, ['matriarchs_sac', 1]);
    hitWith(s, s.player, 1, 'physical', { sourceId: 7 });
    expect(s.player.terrain.oiledLeft).toBe(0);
  });
});

describe('Tar Gland', () => {
  const cell = (s: GameState, x: number, y: number) => Math.floor(y) * s.grid.width + Math.floor(x);

  it('your Fire hits leave a 2-cell oil patch and ignite it (player-owned)', () => {
    const s = arena();
    fuse(s, ['tar_gland', 1]);
    const d = addEnemy(s, 'dummy', 100.5, 60.5);
    hitWith(s, d, 10, 'fire');
    for (const [x, y] of [
      [100.5, 60.5],
      [102.5, 60.5],
      [100.5, 58.5],
    ]) {
      const i = cell(s, x, y);
      expect(s.grid.surface[i], `${x},${y}`).toBe(SURFACE.oil);
      expect(s.grid.fire[i]).toBe(s.tuning.grid.fireIntensity.oil);
      expect(s.grid.owner[i]).toBe(OWNER.player);
    }
    expect(s.grid.surface[cell(s, 103.5, 60.5)]).toBe(0);
  });

  it('non-Fire hits leave nothing; tier III makes a 4-cell patch', () => {
    const s = arena();
    fuse(s, ['tar_gland', 3]);
    const d = addEnemy(s, 'dummy', 100.5, 60.5);
    hitWith(s, d, 10, 'storm');
    expect(s.grid.surface[cell(s, 100.5, 60.5)]).toBe(0);
    hitWith(s, d, 10, 'fire');
    expect(s.grid.surface[cell(s, 104.5, 60.5)]).toBe(SURFACE.oil);
  });
});
