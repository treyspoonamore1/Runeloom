import { describe, expect, it } from 'vitest';
import {
  createGame,
  hashState,
  regionScaling,
  scaleByLevel,
  spawnEnemy,
  type GameState,
} from '../../../src/sim';
import { packs } from '../../../data/packs';
import { regionDifficulty } from '../../../data/progression';
import { defaultTuning } from '../../../data/tuning';
import { fromFile, isWaterCode, groundAt, ofType, run } from './helpers';

/**
 * M8: the Fen's tier 8 difficulty (data/progression.ts regionDifficulty), the Fen pack tables
 * (CONTENT §5) and the new enemy state in the hash.
 */

function roomWithId(id: string, level = 18): GameState {
  const rows = ['##########', ...Array.from({ length: 8 }, () => '#........#'), '##########'];
  const s = createGame({
    seed: 1,
    roomText: `@id ${id}\n@level ${level}\n${rows.join('\n')}\n`,
    spawnRoomEnemies: false,
  });
  s.cheats.noAI = true;
  return s;
}

const growth = defaultTuning.combat;

describe('regionDifficulty', () => {
  it('Fen and Foundry rooms apply the tier 8 rift scaling: life ×1.50, hit damage ×1.32', () => {
    expect(regionDifficulty).toEqual([
      { prefix: 'fen/', tier: 8 },
      { prefix: 'foundry/', tier: 8 },
    ]);
    for (const id of ['fen/g2_glass_reeds', 'foundry/f7_furnace_row']) {
      const r = regionScaling(roomWithId(id));
      expect(r.life).toBeCloseTo(1.06 ** 7);
      expect(r.life).toBeCloseTo(1.5, 2);
      expect(r.damage).toBeCloseTo(1.04 ** 7);
      expect(r.damage).toBeCloseTo(1.32, 2);
    }
    expect(regionScaling(roomWithId('kiln/k1_gate'))).toEqual({ life: 1, damage: 1 });
  });

  it('monsters spawned in a Fen room have the extra life; elsewhere they do not', () => {
    const fen = spawnEnemy(roomWithId('fen/g1'), 'copperback', 10, 10);
    const kiln = spawnEnemy(roomWithId('kiln/k1'), 'copperback', 10, 10);
    const base = scaleByLevel(110, growth.enemyLifeGrowth, 18);
    expect(kiln.maxLife).toBeCloseTo(base);
    expect(fen.maxLife).toBeCloseTo(base * 1.06 ** 7);
  });

  it('their hits on the player deal ×1.32; bosses keep their absolute numbers', () => {
    const hit = (id: string) => {
      const s = roomWithId(id);
      const p = s.player;
      p.x = 20;
      p.y = 20;
      const e = spawnEnemy(s, 'copperback', 23, 20);
      e.ai.cooldown = 0;
      s.cheats.noAI = false;
      const ev = run(s, 60);
      return ofType(ev, 'hit').find((h) => h.target === 'player' && h.sourceId === e.id)!.amount;
    };
    expect(hit('fen/g1') / hit('test/plain')).toBeCloseTo(1.04 ** 7);
    const boss = spawnEnemy(roomWithId('foundry/f10'), 'cinder_warden', 20, 20);
    expect(boss.maxLife).toBe(5000);
  });
});

describe('Fen packs', () => {
  it('has the 7 pack tables with their leaders and minions (CONTENT §5)', () => {
    expect(packs.pike_shoal).toMatchObject({ leader: 'glasspike', minion: 'glasspike', waterOnly: true });
    expect(packs.crab_cast).toMatchObject({ leader: 'spark_heron', minion: 'copperback' });
    expect(packs.heron_wade).toMatchObject({ leader: 'bellshell', minion: 'spark_heron' });
    expect(packs.sparkfly_cloud).toMatchObject({ leader: 'sparkfly', minion: 'sparkfly' });
    expect(packs.mire_herd).toMatchObject({ leader: 'mire_bull', minion: 'bellows_toad' });
    expect(packs.foundry_crew).toMatchObject({ leader: 'slagshell', minion: 'copperback' });
    expect(packs.toad_chorus).toMatchObject({ leader: 'bellows_toad', minion: 'sparkfly' });
  });

  it('the Fen test room spawns every pack: 2–3 pikes in water, 3 crabs + a heron, 8–12 sparkflies, ...', () => {
    const s = fromFile('test/enemies_fen');
    const count = (k: string) => s.enemies.filter((e) => e.kind === k).length;
    expect(count('glasspike')).toBeGreaterThanOrEqual(2);
    expect(count('glasspike')).toBeLessThanOrEqual(3);
    for (const e of s.enemies.filter((x) => x.kind === 'glasspike'))
      expect(isWaterCode(groundAt(s, e.x, e.y))).toBe(true);
    // crab_cast 3 + foundry_crew 2.
    expect(count('copperback')).toBe(5);
    // crab_cast 1 + heron_wade 2.
    expect(count('spark_heron')).toBe(3);
    expect(count('bellshell')).toBe(1);
    expect(count('mire_bull')).toBe(2);
    // mire_herd 2 + toad_chorus 3.
    expect(count('bellows_toad')).toBe(5);
    expect(count('slagshell')).toBe(1);
    // sparkfly_cloud 8–12 + foundry_crew 4 + toad_chorus 6.
    expect(count('sparkfly')).toBeGreaterThanOrEqual(18);
    expect(count('sparkfly')).toBeLessThanOrEqual(22);
  });
});

describe('M8 enemy state is hashed', () => {
  const edits: [string, (e: ReturnType<typeof spawnEnemy>) => void][] = [
    ['stranded', (e) => (e.special.stranded = true)],
    ['strandTime', (e) => (e.special.strandTime = 1)],
    ['drying', (e) => (e.special.drying = true)],
    ['routeCell', (e) => (e.special.routeCell = 5)],
    ['leapLeft', (e) => (e.special.leapLeft = 0.2)],
    ['leapTo', (e) => (e.special.leapToX = 9)],
    ['chargedLeft', (e) => (e.special.chargedLeft = 1)],
    ['hot', (e) => (e.special.hot = !e.special.hot)],
    ['crackedLeft', (e) => (e.special.crackedLeft = 2)],
    ['popKiller', (e) => (e.special.popKiller = 0)],
    ['lureLeft', (e) => (e.special.lureLeft = 1)],
    ['boggedLeft', (e) => (e.special.boggedLeft = 1)],
    ['chargeWall', (e) => (e.special.chargeWall = true)],
    ['openLeft', (e) => (e.special.openLeft = 1)],
    ['ringCooldown', (e) => (e.special.ringCooldown = 1)],
  ];
  for (const [name, edit] of edits) {
    it(name, () => {
      const s = roomWithId('fen/g1');
      const e = spawnEnemy(s, 'slagshell', 20, 20);
      const before = hashState(s);
      edit(e);
      expect(hashState(s)).not.toBe(before);
    });
  }
});
