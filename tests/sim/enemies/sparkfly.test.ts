import { describe, expect, it } from 'vitest';
import { aggro, killEnemy, nearestLight, PLAYER_ID, type GameState } from '../../../src/sim';
import { OWNER } from '../../../data/materials';
import { apply } from '../terrain/helpers';
import { arena, idx, ofType, paintRect, run, spawn } from './helpers';

/**
 * CONTENT §5 Sparkfly: swarms in clouds, zaps 3 Storm after a 0.25 s flicker. Drawn to light: a
 * lit brazier or burning cell within 12 cells pulls it to circle there for 3 s. Dying over water
 * it pops enemy charge into its water within 8 cells for 0.5 s (6 Storm), so one Storm hit pops a
 * cloud over water.
 */

function pond(px = 140, py = 40): GameState {
  const s = arena(px, py, 1);
  paintRect(s, 20, 30, 59, 49, 'shallow_water');
  return s;
}

describe('Sparkfly', () => {
  it('zaps for 3 Storm after a 0.25 s flicker', () => {
    const s = arena(50, 40);
    s.cheats.god = true;
    const f = spawn(s, 'sparkfly', 48, 40);
    aggro(s, f);
    f.ai.cooldown = 0;
    expect(ofType(run(s, 2), 'telegraph')).toMatchObject([{ id: f.id, attack: 'spark_zap', windup: 0.25 }]);
    const hit = ofType(run(s, 20), 'hit').filter((h) => h.target === 'player');
    expect(hit).toHaveLength(1);
    expect(hit[0]!.damageType).toBe('storm');
    expect(hit[0]!.amount).toBeCloseTo(3);
  });

  it('is drawn to a burning cell within 12 cells and circles it instead of the player', () => {
    const s = arena(120, 40);
    const f = spawn(s, 'sparkfly', 40, 40);
    aggro(s, f);
    apply(s, 'fire', { kind: 'circle', x: 48, y: 40, r: 1 }, { durationMult: 20 });
    expect(nearestLight(s, 40, 40, 12)).not.toBeNull();
    const ev = run(s, 8);
    expect(ofType(ev, 'sparkflyLured').filter((l) => l.id === f.id)).toHaveLength(1);
    expect(f.ai.mode).toBe('lured');
    let far = 0;
    for (let t = 0; t < 150; t++) {
      run(s, 1);
      far = Math.max(far, Math.hypot(f.x - f.special.lureX, f.y - f.special.lureY));
    }
    // It circles the light, never heading off to the player 70 cells away.
    expect(far).toBeLessThan(8);
  });

  it('is drawn to a lit brazier', () => {
    const s = arena(120, 40);
    s.objects.push({
      key: 'brazier@11,10',
      kind: 'brazier',
      tx: 11,
      ty: 10,
      on: true,
      timer: 0,
      vx: 0,
      vy: 0,
      link: '',
      push: 0,
      pushDir: 0,
    });
    expect(nearestLight(s, 40, 40, 12)).toEqual({ x: 46, y: 42 });
    s.objects[0]!.on = false;
    expect(nearestLight(s, 40, 40, 12)).toBeNull();
  });

  it('dying over water it pops: enemy charge in its water, 8 cells of reach, 0.5 s', () => {
    const s = pond(140, 40);
    const f = spawn(s, 'sparkfly', 40, 40);
    killEnemy(s, f, PLAYER_ID, 'hit');
    expect(ofType(s.events, 'sparkflyPop')).toMatchObject([{ id: f.id, reach: 8, damage: 6 }]);
    const w = ofType(s.events, 'waterElectrified').filter((e) => e.sourceId === f.id);
    expect(w).toHaveLength(1);
    expect(w[0]!.owner).toBe(OWNER.enemy);
    expect(s.grid.charge[idx(s, 47, 40)]).toBeGreaterThan(0);
    expect(s.grid.charge[idx(s, 50, 40)]).toBe(0);
    run(s, 33);
    expect(s.grid.charge[idx(s, 40, 40)]).toBe(0);
  });

  it('does not pop over dry ground', () => {
    const s = arena();
    const f = spawn(s, 'sparkfly', 40, 40);
    killEnemy(s, f, PLAYER_ID, 'hit');
    expect(ofType(s.events, 'sparkflyPop')).toHaveLength(0);
  });

  it('hovers low: one Storm hit on the water pops a cloud over it, each pop popping the next', () => {
    const s = pond(140, 40);
    s.cheats.noAI = true;
    const cloud = [30, 34, 38, 42, 46].map((x) => spawn(s, 'sparkfly', x, 40));
    run(s, 1);
    apply(s, 'storm', { kind: 'circle', x: 22, y: 40, r: 0.6 }, { hitDamage: 200 });
    const ev = run(s, 2);
    expect(cloud.every((f) => f.dead)).toBe(true);
    expect(ofType(ev, 'sparkflyPop').length).toBe(cloud.length);
  });

  it("pops in a chain: a pop's charge pops the Sparkflies within its 8 cells, credited to the first killer", () => {
    const s = pond(140, 40);
    s.cheats.noAI = true;
    // Far apart along the water: only the chain reaches the far ones (pops reach 8 cells).
    const cloud = [24, 30, 36, 42].map((x) => spawn(s, 'sparkfly', x, 40));
    killEnemy(s, cloud[0]!, PLAYER_ID, 'hit');
    const ev = [...s.events, ...run(s, 4)];
    expect(cloud.every((f) => f.dead)).toBe(true);
    const deaths = ofType(ev, 'death');
    expect(deaths.length).toBe(4);
    expect(deaths.filter((d) => d.killerId === PLAYER_ID).length).toBeGreaterThanOrEqual(2);
  });

  it("other enemies' charge (a Copperback's pulse) passes it by", () => {
    const s = pond(140, 40);
    s.cheats.noAI = true;
    const f = spawn(s, 'sparkfly', 30, 40);
    const crab = spawn(s, 'copperback', 50, 40);
    run(s, 1);
    apply(
      s,
      'storm',
      { kind: 'circle', x: 50, y: 40, r: 0.6 },
      { owner: OWNER.enemy, sourceId: crab.id, hitDamage: 50 },
    );
    run(s, 2);
    expect(f.dead).toBe(false);
  });
});
