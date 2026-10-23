import { describe, expect, it } from 'vitest';
import { createGame, spawnEnemy, type GameState } from '../../../src/sim';
import { rollMods, shippedMods } from '../../../src/sim/actors/rarity';
import { monsterMods } from '../../../data/monsterMods';
import { OWNER } from '../../../data/materials';
import { applyHit } from '../../../src/sim/combat/hits';
import { makePacket } from '../../../src/sim/combat/damage';
import { PLAYER_ID } from '../../../src/sim/actors/enemies';
import { enemyAttackPacket } from '../../../src/sim/combat/enemyAttacks';
import { enemyDef } from '../../../data/enemies';
import { hitWith } from '../combat/helpers';
import { arena, idx, ofType, run } from './helpers';

/** CONTENT §5: the M5 monster mods (Waterlogged, Frostbound, Grounded, Volatile, Swarming). */

function still(s: GameState): GameState {
  s.cheats.noAI = true;
  return s;
}

describe('M5 monster mods', () => {
  it('all eight mods can roll; Waterlogged never on Tinderlings or Bog Lurkers', () => {
    expect([...shippedMods].sort()).toEqual(Object.keys(monsterMods).sort());
    const s = arena();
    const seen = new Set<string>();
    for (let k = 0; k < 400; k++) {
      for (const m of rollMods(s, 'rare', ['shieldbearer'])) seen.add(m);
      expect(rollMods(s, 'rare', ['tinderling'])).not.toContain('waterlogged');
      expect(rollMods(s, 'magic', ['tar_hulk', 'bog_lurker'])).not.toContain('waterlogged');
    }
    expect(seen.size).toBe(8);
  });

  it('Waterlogged: always Wet, so Ignite never takes and Shock arcs to it', () => {
    const s = still(arena());
    const w = spawnEnemy(s, 'shieldbearer', 30, 30, { rarity: 'magic', mods: ['waterlogged'] });
    const dry = spawnEnemy(s, 'shieldbearer', 34, 30);
    run(s, 1);
    expect(w.terrain.wetLeft).toBeGreaterThan(0);
    expect(dry.terrain.wetLeft).toBe(0);
    hitWith(s, w, 20, 'fire');
    expect(w.ailments.ignite.timeLeft).toBe(0);
    hitWith(s, dry, 20, 'fire');
    expect(dry.ailments.ignite.timeLeft).toBeGreaterThan(0);
    // A second Waterlogged beside it: a Storm hit on one arcs to the other (rule 19).
    const w2 = spawnEnemy(s, 'shieldbearer', 30, 36, { rarity: 'magic', mods: ['waterlogged'] });
    run(s, 1);
    s.events.length = 0;
    hitWith(s, w, 40, 'storm');
    expect(ofType(s.events, 'arc').map((a) => a.to)).toContain(w2.id);
  });

  it("Frostbound: can't be chilled or frozen", () => {
    const s = still(arena());
    const f = spawnEnemy(s, 'shieldbearer', 30, 30, { rarity: 'magic', mods: ['frostbound'] });
    const n = spawnEnemy(s, 'shieldbearer', 40, 30);
    hitWith(s, f, 500, 'frost');
    hitWith(s, n, 10, 'frost');
    expect(f.ailments.chill).toBe(0);
    expect(f.ailments.freeze.timeLeft).toBe(0);
    expect(n.ailments.chill).toBeGreaterThan(0);
  });

  it('Grounded: immune to Shock, and arcs skip it', () => {
    const s = still(arena());
    const g = spawnEnemy(s, 'shieldbearer', 30, 30, { rarity: 'magic', mods: ['grounded', 'waterlogged'] });
    hitWith(s, g, 40, 'storm');
    expect(g.ailments.shock.timeLeft).toBe(0);
    const src = spawnEnemy(s, 'shieldbearer', 30, 36, { rarity: 'magic', mods: ['waterlogged'] });
    run(s, 1);
    s.events.length = 0;
    hitWith(s, src, 40, 'storm');
    expect(ofType(s.events, 'arc').map((a) => a.to)).not.toContain(g.id);
    expect(src.ailments.shock.timeLeft).toBeGreaterThan(0);
  });

  it('Volatile: 1 s after death, a 4-cell enemy-owned blast for 3× its attack as Fire (M6.5)', () => {
    const s = still(arena(100, 40));
    const v = spawnEnemy(s, 'shieldbearer', 100, 43, { rarity: 'rare', mods: ['volatile', 'thick_skinned'] });
    const bystander = spawnEnemy(s, 'shieldbearer', 101, 40);
    // Its own attack at its area level: rarity and Thick-skinned's life don't raise it.
    const blast = 3 * enemyAttackPacket(s, v, enemyDef('shieldbearer').attack!).base.physical;
    const life = s.player.life;
    hitWith(s, v, 10_000, 'physical');
    expect(s.volatiles).toHaveLength(1);
    expect(ofType(s.events, 'volatileArmed')[0]).toMatchObject({ radius: 4, delay: 1 });
    run(s, 59);
    expect(s.player.life).toBe(life);
    const ev = run(s, 1);
    expect(s.volatiles).toHaveLength(0);
    expect(ofType(ev, 'explosion')[0]).toMatchObject({ owner: OWNER.enemy, damage: blast });
    // Fire through the player's resistance (0 at level 1); enemies are safe from enemy fire.
    expect(life - s.player.life).toBeCloseTo(blast * (1 - s.player.resist.fire), 6);
    expect(bystander.life).toBe(bystander.maxLife);
    expect(s.grid.fire[idx(s, 100, 43)]).toBeGreaterThan(0);
    expect(s.grid.owner[idx(s, 100, 43)]).toBe(OWNER.enemy);
  });

  it('Volatile: blasts armed on top of each other hit once', () => {
    const s = still(arena(100, 40));
    const a = spawnEnemy(s, 'shieldbearer', 100, 43, { rarity: 'magic', mods: ['volatile'] });
    const b = spawnEnemy(s, 'shieldbearer', 101, 43, { rarity: 'magic', mods: ['volatile'] });
    hitWith(s, a, 10_000, 'physical');
    run(s, 10);
    hitWith(s, b, 10_000, 'physical');
    expect(s.volatiles.map((v) => v.harmless)).toEqual([false, true]);
    const ev = run(s, 70);
    // Two explosions show, one hits (burning ground after it is a separate, small damage).
    expect(ofType(ev, 'explosion')).toHaveLength(2);
    const blastHits = ofType(ev, 'hit').filter(
      (h) => h.target === 'player' && (h.sourceId === a.id || h.sourceId === b.id),
    );
    expect(blastHits).toHaveLength(1);
  });

  it('Volatile: out of reach, nothing; leaving the room disarms it', () => {
    const s = still(arena(100, 40));
    const v = spawnEnemy(s, 'shieldbearer', 60, 40, { rarity: 'magic', mods: ['volatile'] });
    const life = s.player.life;
    applyHit(s, v, makePacket(10_000, { physical: 1 }, 0, 1.5), {
      sourceId: PLAYER_ID,
      dirX: 1,
      dirY: 0,
      knockback: 0,
    });
    run(s, 70);
    expect(s.player.life).toBe(life);
  });

  it('Swarming: a Magic pack brings 2 extra minions of a weaker kind, once per pack', () => {
    const room = (rarity: string) =>
      [
        '@id test/swarm',
        `@spawn 1 pack:archer_line ${rarity}`,
        '#'.repeat(30),
        ...Array.from(
          { length: 18 },
          (_, y) => `#${y === 9 ? '.'.repeat(13) + '1' + '.'.repeat(14) : '.'.repeat(28)}#`,
        ),
        '#'.repeat(30),
        '',
      ].join('\n');
    // Find a seed whose Magic pack rolls Swarming, and one whose doesn't.
    let withSwarm: GameState | null = null;
    let without: GameState | null = null;
    for (let seed = 1; seed < 200 && (!withSwarm || !without); seed++) {
      const g = createGame({ seed, roomText: room('magic') });
      const swarming = g.enemies.some((e) => e.mods.includes('swarming'));
      if (swarming && !withSwarm) withSwarm = g;
      if (!swarming && !without) without = g;
    }
    expect(withSwarm && without).toBeTruthy();
    const count = (g: GameState, kind: string) => g.enemies.filter((e) => e.kind === kind).length;
    // archer_line: 3 Ember Archers and 1 Shieldbearer; the leader's weaker kind is the Tinderling.
    expect(count(without!, 'tinderling')).toBe(0);
    expect(count(withSwarm!, 'tinderling')).toBe(2);
    expect(
      withSwarm!.enemies.filter((e) => e.kind === 'tinderling').every((e) => e.rarity === 'normal'),
    ).toBe(true);
  });
});
