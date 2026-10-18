import { describe, expect, it } from 'vitest';
import {
  castProgress,
  dodgePips,
  fmtCost,
  fmtCountdown,
  fmtVital,
  plural,
  quantize,
  readSnap,
  snapEqual,
  waveText,
} from '../../src/ui/hudModel';
import { enemiesRemaining } from '../../src/ui/arena';
import { createGame, spawnEnemy, type GameState } from '../../src/sim';
import arenaText from '../../data/rooms/test/arena.txt?raw';

const game = (): GameState => createGame({ seed: 1, roomText: arenaText, spawnRoomEnemies: false });

describe('formatting', () => {
  it('rounds life up and mana down so 0 only shows when truly empty', () => {
    expect(fmtVital(0.2, 'ceil')).toBe(1);
    expect(fmtVital(0, 'ceil')).toBe(0);
    expect(fmtVital(79.9999999, 'ceil')).toBe(80);
    expect(fmtVital(7.9, 'floor')).toBe(7);
    expect(fmtVital(-3, 'floor')).toBe(0);
  });

  it('formats mana costs, countdowns and plurals', () => {
    expect(fmtCost(4)).toBe('4');
    expect(fmtCost(6.6000000000000005)).toBe('6.6');
    expect(fmtCountdown(2.01)).toBe(3);
    expect(fmtCountdown(2)).toBe(2);
    expect(fmtCountdown(-1)).toBe(0);
    expect(plural(1, 'enemy left', 'enemies left')).toBe('1 enemy left');
    expect(plural(3, 'enemy left', 'enemies left')).toBe('3 enemies left');
  });
});

describe('quantize (DOM update throttling)', () => {
  it('snaps to steps and clamps', () => {
    expect(quantize(0.504, 100)).toBe(0.5);
    expect(quantize(1.7, 10)).toBe(1);
    expect(quantize(-1, 10)).toBe(0);
    // Two frames of a slow drift land on the same value.
    expect(quantize(0.5001, 50)).toBe(quantize(0.5009, 50));
  });
});

describe('dodgePips', () => {
  it('shows whole charges, the recharging one partly filled, and the rest empty', () => {
    expect(dodgePips(2, 2, 0, 1.4)).toEqual([1, 1]);
    expect(dodgePips(1, 3, 0.7, 1.4)).toEqual([1, 0.5, 0]);
    expect(dodgePips(0, 2, 1.4, 1.4)).toEqual([0, 0]);
  });
});

describe('castProgress', () => {
  it('is 0 for other slots and sweeps 0 to 1 for the casting slot', () => {
    expect(castProgress(-1, 0, 0, 0)).toBe(0);
    expect(castProgress(1, 0.2, 0.4, 0)).toBe(0);
    expect(castProgress(0, 0.4, 0.4, 0)).toBe(0);
    expect(castProgress(0, 0.2, 0.4, 0)).toBe(0.5);
    expect(castProgress(0, 0, 0.4, 0)).toBe(1);
  });
});

describe('readSnap', () => {
  it('reads life, mana, slots with costs, and dodge pips from a new game', () => {
    const s = readSnap(game());
    expect(s.life).toBe(80);
    expect(s.maxLife).toBe(80);
    expect(s.lifeFrac).toBe(1);
    expect(s.mana).toBe(50);
    expect(s.dead).toBe(false);
    expect(s.pips).toEqual([1, 1]);
    expect(s.slots.map((x) => [x.key, x.name, fmtCost(x.cost)])).toEqual([
      ['LMB', 'Fire Bolt', '6.6'],
      ['RMB', 'Strike', '4'],
    ]);
    expect(s.wave).toBeNull();
  });

  it('flags unaffordable spells, an active cast and death', () => {
    const g = game();
    g.player.mana = 5;
    g.player.castSlot = 1;
    g.player.castLeft = 0.1;
    g.player.castTime = 0.4;
    let s = readSnap(g);
    expect(s.slots[0]!.affordable).toBe(false);
    expect(s.slots[1]!.affordable).toBe(true);
    expect(s.slots[1]!.casting).toBe(true);
    expect(s.slots[1]!.progress).toBe(0.75);
    g.player.dead = true;
    g.player.life = 0;
    g.player.respawnLeft = 1.2;
    s = readSnap(g);
    expect(s.dead).toBe(true);
    expect(s.respawnSec).toBe(2);
  });

  it('reads the arena defensively and counts enemies except dummies', () => {
    const g = game() as GameState & { arena?: unknown };
    spawnEnemy(g, 'tinderling', 30, 30);
    spawnEnemy(g, 'dummy', 40, 30);
    expect(enemiesRemaining(g)).toBe(1);
    g.arena = { wave: 2, phase: 'fighting', timer: 0, spawnedTotal: 4, killedTotal: 3 };
    expect(readSnap(g).wave).toEqual({ wave: 2, phase: 'fighting', countdown: 0, remaining: 1 });
  });
});

describe('snapEqual', () => {
  it('ignores identical frames and notices any visible change', () => {
    const g = game();
    g.player.mana = 30.5;
    const a = readSnap(g);
    expect(snapEqual(a, readSnap(g))).toBe(true);
    g.player.mana -= 0.001; // below display resolution
    expect(snapEqual(a, readSnap(g))).toBe(true);
    g.player.mana -= 3;
    expect(snapEqual(a, readSnap(g))).toBe(false);
    const g2 = game();
    g2.player.dodgeCharges = 1;
    g2.player.dodgeRechargeLeft = 0.7;
    expect(snapEqual(a, readSnap(g2))).toBe(false);
    const g3 = game() as GameState & { arena?: unknown };
    g3.arena = { wave: 1, phase: 'fighting', timer: 0, spawnedTotal: 0, killedTotal: 0 };
    expect(snapEqual(a, readSnap(g3))).toBe(false);
    expect(snapEqual(readSnap(g3), readSnap(g3))).toBe(true);
  });
});

describe('waveText', () => {
  it('describes fighting and intermission', () => {
    expect(waveText({ wave: 3, phase: 'fighting', countdown: 0, remaining: 7 })).toEqual({
      title: 'Wave 3',
      detail: '7 enemies left',
    });
    expect(waveText({ wave: 3, phase: 'fighting', countdown: 0, remaining: 1 }).detail).toBe('1 enemy left');
    expect(waveText({ wave: 0, phase: 'intermission', countdown: 4, remaining: 0 })).toEqual({
      title: 'Wave 1',
      detail: 'Starting in 4…',
    });
  });
});
