import { describe, expect, it } from 'vitest';
import {
  createGame,
  kiterInput,
  playerMaxLife,
  playerMaxMana,
  spawnEnemy,
  step,
  SIM_HZ,
  type GameState,
} from '../../../src/sim';
import { loadRoomText } from '../../../tools/lib/rooms';

/**
 * The kiter bot (src/sim/bots/kiter.ts, default Fire Bolt + Strike, level 1 runes) against every
 * M4 enemy at the area level it first appears around (CONTENT §9), with the player at that level,
 * god mode off. The Cinder Warden is fought with a Frost Bolt too (bots/kiterBoss.ts breaks his
 * Superheat with it); without Frost the bot only wins in god mode.
 */

/** The default weaves plus a Frost Bolt in Q, on Heartwood (Capacity for all three). */
const FROST_LOADOUT = {
  spindleId: 'heartwood' as const,
  notations: ['Cast > Bolt[Fire]', 'Cast > Strike[]', 'Cast > Bolt[Frost]', null],
};

interface Result {
  clearedAt: number;
  damage: number;
  deaths: number;
}

function setLevel(s: GameState, level: number): void {
  const p = s.player;
  p.level = level;
  p.maxLife = p.life = playerMaxLife(s.tuning.combat, level);
  p.maxMana = p.mana = playerMaxMana(s.tuning.combat, level);
}

function fight(name: string, s: GameState, limitSeconds: number): Result {
  const r: Result = { clearedAt: -1, damage: 0, deaths: 0 };
  for (let i = 0; i < limitSeconds * SIM_HZ; i++) {
    step(s, kiterInput(s));
    for (const e of s.events) {
      if ((e.type === 'hit' || e.type === 'dot') && e.target === 'player') r.damage += e.amount;
      if (e.type === 'playerDeath') r.deaths++;
    }
    if (s.enemies.length === 0) {
      r.clearedAt = s.tick / SIM_HZ;
      break;
    }
  }
  console.log(
    `kiter bot vs ${name}${s.cheats.god ? ' (god mode)' : ''}: cleared in ${r.clearedAt.toFixed(1)} s, ` +
      `took ${r.damage.toFixed(0)} damage, ${r.deaths} deaths`,
  );
  return r;
}

/** test/enemies_yard with one pack (or none) at marker 2, at area level `level`. */
function yard(level: number, pack: string | null, seed = 1): GameState {
  const text = loadRoomText('test/enemies_yard')
    .replace(/@spawn[^\n]*\n/g, '')
    .replace('@level 5', `@level ${level}${pack ? `\n@spawn 2 pack:${pack}` : ''}`);
  const s = createGame({ seed, roomText: text });
  setLevel(s, level);
  return s;
}

function expectWin(r: Result, limit: number): void {
  expect(r.deaths).toBe(0);
  expect(r.clearedAt).toBeGreaterThan(0);
  expect(r.clearedAt).toBeLessThanOrEqual(limit);
}

describe('kiter bot vs the M4 enemies', () => {
  it('bog_nest ×2 (Bog Lurkers) at area level 3', () => {
    const s = createGame({ seed: 1, roomText: loadRoomText('test/enemies_bog') });
    setLevel(s, 3);
    expectWin(fight('2 bog_nests (5 Bog Lurkers), L3', s, 90), 90);
  });

  it('2 Tar Hulks at area level 4, and the tar_crew pack', () => {
    const s = yard(4, null);
    spawnEnemy(s, 'tar_hulk', 110, 40);
    spawnEnemy(s, 'tar_hulk', 120, 70);
    expectWin(fight('2 Tar Hulks, L4', s, 60), 60);
    expectWin(fight('tar_crew, L4', yard(4, 'tar_crew'), 60), 60);
  });

  it('3 Frost Wisps at area level 9, and the wisp_flight pack', () => {
    const s = yard(9, null);
    for (const [x, y] of [
      [110, 40],
      [120, 70],
      [100, 20],
    ] as const)
      spawnEnemy(s, 'frost_wisp', x, y);
    expectWin(fight('3 Frost Wisps, L9', s, 60), 60);
    expectWin(fight('wisp_flight, L9', yard(9, 'wisp_flight'), 60), 60);
  });

  it('2 Stormcallers at area level 10, and the caller_guard pack', () => {
    const s = yard(10, null);
    spawnEnemy(s, 'stormcaller', 110, 40);
    spawnEnemy(s, 'stormcaller', 120, 70);
    expectWin(fight('2 Stormcallers, L10', s, 60), 60);
    expectWin(fight('caller_guard, L10', yard(10, 'caller_guard'), 90), 90);
  });

  it('a Brood Kiln and its Kiln Mites at area level 7', () => {
    const s = createGame({ seed: 1, roomText: loadRoomText('test/enemies_kiln') });
    setLevel(s, 7);
    expectWin(fight('Brood Kiln + mites, L7', s, 90), 90);
  });

  it('a Rare archer_line at area level 6 and a Magic tinderling_swarm at area level 5', () => {
    expectWin(fight('Rare archer_line, L6', yard(6, 'archer_line rare'), 120), 120);
    expectWin(fight('Magic tinderling_swarm, L5', yard(5, 'tinderling_swarm magic'), 60), 60);
  });

  it('the Tar Matriarch in K5 at level 8', () => {
    const s = createGame({ seed: 1, roomText: loadRoomText('kiln/k5_matriarch_pit') });
    setLevel(s, 8);
    s.player.x = 12;
    s.player.y = 30;
    expectWin(fight('Tar Matriarch (K5), L8', s, 180), 180);
  });

  it('the Cinder Warden in K10 at level 10: with a Frost Bolt, god mode off; without, in god mode', () => {
    const make = (god: boolean, frost: boolean) => {
      const s = createGame({
        seed: 1,
        roomText: loadRoomText('kiln/k10_wardens_hearth'),
        loadout: frost ? FROST_LOADOUT : undefined,
      });
      setLevel(s, 10);
      s.player.x = 60;
      s.player.y = 72;
      s.cheats.god = god;
      return s;
    };
    // Frost breaks his Superheat when he stands in water (the bot fights from the water).
    expectWin(fight('Cinder Warden (K10), L10, Frost Bolt in Q', make(false, true), 300), 300);
    // Fire Bolt and Strike only: Superheat is never broken.
    expectWin(fight('Cinder Warden (K10), L10, no Frost', make(true, false), 400), 400);
  });
}, 120_000);
