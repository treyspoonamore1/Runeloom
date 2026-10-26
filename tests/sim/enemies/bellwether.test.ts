import { describe, expect, it } from 'vitest';
import { aggro, applyHit, Button, startEnemyAttack, enemyTakenMult, makePacket, PLAYER_ID, type Enemy, type GameState } from '../../../src/sim';
import { MAT, OWNER } from '../../../data/materials';
import { attackByName } from '../../../data/enemies';
import { apply } from '../terrain/helpers';
import { fromFile, groundAt, ofType, place, run } from './helpers';

/**
 * CONTENT §5, §13.2 Old Bellwether (F5; test/boss_bellwether is the Belfry's layout): shelled (80%
 * less damage) until charge of another team or the world through what it stands on rings it
 * (stunned 1.5 s, open 5 s at 25% more, then 8 s before it rings again; never while rolling); Snap,
 * Toll ring and Shell roll; at half life it tolls the Foundry: a sparkfly_cloud, then a self-toll
 * every 7 s that sends its own charge into the ring and pools and never rings it.
 */

function belfry(px = 52, py = 72): { s: GameState; b: Enemy } {
  const s = fromFile('test/boss_bellwether');
  place(s, px, py);
  s.cheats.god = true;
  const b = s.enemies.find((e) => e.kind === 'bellwether')!;
  aggro(s, b);
  return { s, b };
}

const physical = (s: GameState, n = 100) => makePacket(n, { physical: 1 }, 0, s.tuning.combat.critMultiplier);
const hit = (s: GameState, b: Enemy, n = 100) =>
  applyHit(s, b, physical(s, n), { sourceId: PLAYER_ID, dirX: 0, dirY: 0, knockback: 0 });
const storm = (s: GameState, x: number, y: number, owner: number = OWNER.player, sourceId: number = PLAYER_ID) =>
  apply(s, 'storm', { kind: 'circle', x, y, r: 0.6 }, { owner, sourceId, hitDamage: 40 });

/** Moves the bell to (x, y) and holds it there (AI off). */
function hold(s: GameState, b: Enemy, x: number, y: number): void {
  s.cheats.noAI = true;
  b.x = b.prevX = x;
  b.y = b.prevY = y;
  b.vx = b.vy = 0;
}

describe('Old Bellwether', () => {
  it('the Belfry: 104×80, a stone center, a metal ring with four pools at the diagonals and two pylons, stone islands', () => {
    const { s, b } = belfry();
    expect([s.room.width, s.room.height]).toEqual([104, 80]);
    expect([b.maxLife, b.areaLevel, b.radius]).toEqual([18000, 22, 4.5]);
    expect(groundAt(s, 52, 40)).toBe(MAT.stone);
    expect(groundAt(s, 52, 18)).toBe(MAT.metal_floor);
    expect(groundAt(s, 28, 15)).toBe(MAT.shallow_water);
    expect(groundAt(s, 76, 64)).toBe(MAT.shallow_water);
    expect(groundAt(s, 10, 40)).toBe(MAT.stone);
    let pylons = 0;
    for (const t of s.room.tiles) if (t === 'M'.charCodeAt(0)) pylons++;
    expect(pylons).toBe(2);
  });

  it('shelled it takes 80% less; the player Storming the ring it stands on rings it: stunned 1.5 s, open 5 s at 25% more, then 8 s before it rings again', () => {
    const { s, b } = belfry();
    hold(s, b, 52, 18);
    expect(enemyTakenMult(s, b)).toBeCloseTo(0.2);
    const life = b.life;
    hit(s, b);
    expect(life - b.life).toBeCloseTo(20);
    storm(s, 72, 40); // the far side of the ring: the whole network carries it
    const ev = run(s, 2);
    expect(ofType(ev, 'bellRung')).toMatchObject([{ id: b.id, stun: 1.5, open: 5 }]);
    expect(b.terrain.stunLeft).toBeGreaterThan(1.4);
    expect(b.special.openLeft).toBeGreaterThan(4.9);
    const closing = run(s, 5 * 60);
    expect(ofType(closing, 'bellClosed')).toMatchObject([{ id: b.id, cooldown: 8 }]);
    expect(enemyTakenMult(s, b)).toBeCloseTo(0.2);
    storm(s, 72, 40);
    expect(ofType(run(s, 2), 'bellRung')).toHaveLength(0);
    run(s, 8 * 60);
    storm(s, 72, 40);
    expect(ofType(run(s, 2), 'bellRung')).toHaveLength(1);
  });

  it('on the stone center it can not be rung, and enemy charge never rings it', () => {
    const { s, b } = belfry();
    hold(s, b, 52, 40);
    storm(s, 52, 18);
    expect(ofType(run(s, 3), 'bellRung')).toHaveLength(0);
    run(s, 120); // that charge ends
    hold(s, b, 52, 18);
    storm(s, 72, 40, OWNER.enemy, b.id + 99);
    expect(ofType(run(s, 3), 'bellRung')).toHaveLength(0);
    run(s, 120);
    storm(s, 72, 40, OWNER.world, -1);
    expect(ofType(run(s, 3), 'bellRung')).toHaveLength(1);
  });

  it('Snap: a 0.8 s telegraph, then a 9-cell 70° cone for 110 with knockback', () => {
    const { s, b } = belfry(52, 50);
    hold(s, b, 52, 40);
    s.cheats.noAI = false;
    b.ai.cooldowns[1] = b.ai.cooldowns[2] = 99;
    const ev = run(s, 70);
    expect(ofType(ev, 'telegraph').find((t) => t.attack === 'bell_snap')).toMatchObject({ windup: 0.8 });
    const h = ofType(ev, 'hit').find((e) => e.target === 'player' && e.sourceId === b.id)!;
    expect(h.amount).toBe(110);
    expect(b.attack.shape).toMatchObject({ kind: 'cone', r: 9 });
  });

  it('Toll ring: a 1.2 s telegraph out to 18 cells, then a wave that hits a player as its front passes them, once', () => {
    const { s, b } = belfry(52, 52);
    hold(s, b, 52, 40);
    s.cheats.noAI = false;
    b.ai.cooldowns[0] = b.ai.cooldowns[2] = 99;
    let ev = run(s, 1);
    for (let i = 0; i < 120 && ofType(ev, 'telegraph').length === 0; i++) ev = run(s, 1);
    expect(ofType(ev, 'telegraph')).toMatchObject([{ attack: 'toll_ring', windup: 1.2 }]);
    s.cheats.noAI = true; // hold the bell; its attack still runs
    const wind = run(s, 71);
    expect(ofType(wind, 'bellWave')).toMatchObject([{ id: b.id, radius: 18, seconds: 0.4 }]);
    // The front is still short of the player (12 cells away) right after it starts.
    expect(ofType(wind, 'hit').filter((h) => h.target === 'player')).toHaveLength(0);
    const after = run(s, 30);
    const hits = ofType(after, 'hit').filter((h) => h.target === 'player' && h.sourceId === b.id);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.amount).toBe(90);
  });

  it('Toll ring: a player outside 18 cells, or dodging through the front, takes nothing', () => {
    for (const dodge of [false, true]) {
      const { s, b } = belfry(52, dodge ? 50 : 62);
      hold(s, b, 52, 40);
      expect(startEnemyAttack(s, b, 0, 1, attackByName('bellwether', 'toll_ring'))).toBe(true);
      const all = [];
      for (let i = 0; i < 120; i++) {
        // Dodge toward the bell as the front comes (it reaches 10 cells ~0.2 s after the windup).
        const f = b.boss!.fen!;
        const go = dodge && f.waveR > 5 && f.waveR < 7;
        all.push(...run(s, 1, go ? Button.Dodge : 0, undefined, go ? [0, -1] : [0, 0]));
      }
      expect(ofType(all, 'bellWave')).toHaveLength(1);
      expect(ofType(all, 'hit').filter((h) => h.target === 'player' && h.sourceId === b.id)).toHaveLength(0);
    }
  });

  it('Shell roll: at a far player, a 0.9 s line, a roll at 40 cells/s for 120 on contact; into a wall it is stunned 1 s; it can not be rung while rolling', () => {
    const { s, b } = belfry(52, 72);
    hold(s, b, 52, 40);
    s.cheats.noAI = false;
    b.ai.cooldowns[0] = b.ai.cooldowns[1] = 99;
    let ev = run(s, 1);
    for (let i = 0; i < 60 && !ofType(ev, 'telegraph').length; i++) ev = run(s, 1);
    expect(ofType(ev, 'telegraph')).toMatchObject([{ attack: 'shell_roll', windup: 0.9 }]);
    run(s, 56);
    expect(b.special.dashSpeed).toBe(40);
    // Mid-roll it doesn't ring.
    storm(s, 72, 40);
    const roll = run(s, 60);
    expect(ofType(roll, 'bellRung')).toHaveLength(0);
    const h = ofType(roll, 'hit').find((e) => e.target === 'player' && e.sourceId === b.id)!;
    expect(h.amount).toBe(120);
    expect(b.y).toBeGreaterThan(60);
  });

  it('a roll planned into a wall stuns it 1 s where it ends', () => {
    const { s, b } = belfry(52, 75);
    hold(s, b, 52, 52);
    s.cheats.noAI = false;
    s.cheats.god = true;
    b.ai.cooldowns[0] = b.ai.cooldowns[1] = 99;
    const ev = run(s, 150);
    expect(ofType(ev, 'telegraph').some((t) => t.attack === 'shell_roll')).toBe(true);
    expect(ofType(ev, 'bellRollStunned')).toMatchObject([{ id: b.id, seconds: 1 }]);
  });

  it('phase 2 at half life: it tolls the Foundry (one sparkfly_cloud), then self-tolls every 7 s, its own charge on the ring that never rings it', () => {
    const { s, b } = belfry(10, 40);
    s.cheats.noAI = false;
    b.life = b.maxLife * 0.5;
    const ev = run(s, 4 * 60);
    expect(ofType(ev, 'telegraph').some((t) => t.attack === 'toll_foundry')).toBe(true);
    expect(ofType(ev, 'bossPhase')).toMatchObject([{ id: b.id, phase: 2 }]);
    const summon = ofType(ev, 'bossSummon')[0]!;
    expect(summon).toMatchObject({ id: b.id, kind: 'sparkfly' });
    expect(summon.spawned.length).toBeGreaterThanOrEqual(8);
    expect(summon.spawned.length).toBeLessThanOrEqual(12);
    const later = run(s, 16 * 60);
    const tolls = ofType(later, 'telegraph').filter((t) => t.attack === 'self_toll');
    expect(tolls.length).toBeGreaterThanOrEqual(2);
    expect(tolls[0]!.windup).toBe(1.2);
    const landed = ofType(later, 'bellSelfToll');
    expect(landed.length).toBe(tolls.length - (b.attack.name === 'self_toll' && b.attack.phase === 'windup' ? 1 : 0));
    expect(landed[0]!.damage).toBe(90);
    // Enemy charge on the metal it stood on, and it never rang itself.
    expect(ofType(later, 'metalElectrified').some((e) => e.owner === OWNER.enemy && e.sourceId === b.id)).toBe(true);
    expect(ofType(later, 'bellRung')).toHaveLength(0);
  });

  it('phase 2: on the stone center it walks back onto conducting ground to self-toll', () => {
    const { s, b } = belfry(52, 40);
    b.life = b.maxLife * 0.5;
    s.cheats.noAI = false;
    run(s, 4 * 60);
    expect(b.boss!.phase).toBe(2);
    // The player hides in the middle of the center; the bell leaves it to toll.
    place(s, 52, 40);
    b.x = 50;
    b.y = 42;
    b.boss!.fen!.tollLeft = 0;
    let tolled = false;
    for (let i = 0; i < 10 * 60 && !tolled; i++)
      tolled = ofType(run(s, 1), 'telegraph').some((t) => t.attack === 'self_toll');
    expect(tolled).toBe(true);
    expect(s.grid.ground[Math.floor(b.y) * s.grid.width + Math.floor(b.x)]).not.toBe(MAT.stone);
  });
});
