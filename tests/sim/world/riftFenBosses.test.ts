import { describe, expect, it } from 'vitest';
import { enemyDef, lookKind } from '../../../data/enemies';
import { MAT } from '../../../data/materials';
import { regionBossKinds, riftBossKinds } from '../../../data/progression';
import { riftBossesAt, type RiftModId } from '../../../data/rift';
import { createGame, generateRift, parseRoom, solveRift, spawnEnemy, type RiftSpec } from '../../../src/sim';
import { ROOMS } from './worldHelpers';

/**
 * CONTENT §10.1: the Fen's rift bosses, rift_bellwether in `belfry` and rift_coil in `glass_eye`,
 * from tier 9, drawn as their region originals (lookAs), scaling from their own levels, separate
 * kinds so a rift kill is never the region's boss kill. The Coil's arena keeps its water.
 */

function spec(seed: number, tier: number, mods: RiftModId[] = []): RiftSpec {
  return { index: 3, seed, tier, mods, home: { roomId: 'emberwood/e1_glade', key: 'stone' } };
}

describe('Fen rift bosses', () => {
  it('rift_bellwether and rift_coil: the same fights, drawn as the originals, separate kinds', () => {
    for (const [rift, orig] of [
      ['rift_bellwether', 'bellwether'],
      ['rift_coil', 'glasswater_coil'],
    ] as const) {
      expect(lookKind(rift)).toBe(orig);
      expect(enemyDef(rift).behavior).toEqual(enemyDef(orig).behavior);
      expect(enemyDef(rift).isBoss).toBe(true);
      expect(riftBossKinds).toContain(rift);
      expect(regionBossKinds).not.toContain(rift);
    }
  });

  it('join the pool from tier 9; below it the M6 pick is unchanged', () => {
    expect(riftBossesAt(8).map((b) => b.boss)).toEqual(['rift_matriarch', 'rift_warden']);
    expect(riftBossesAt(9).map((b) => b.boss)).toEqual([
      'rift_matriarch',
      'rift_warden',
      'rift_bellwether',
      'rift_coil',
    ]);
    const seen = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      expect(['rift_matriarch', 'rift_warden']).toContain(generateRift(spec(seed, 8), ROOMS).bossKind);
      seen.add(generateRift(spec(seed, 12), ROOMS).bossKind);
    }
    expect(seen).toEqual(new Set(['rift_matriarch', 'rift_warden', 'rift_bellwether', 'rift_coil']));
  });

  it('their rifts are connected and completable; the Coil is fought from the Eye\'s shore', () => {
    let fen = 0;
    for (let seed = 0; seed < 80; seed++) {
      const r = generateRift(spec(seed, 10 + (seed % 7)), ROOMS);
      if (r.bossKind !== 'rift_bellwether' && r.bossKind !== 'rift_coil') continue;
      fen++;
      expect(solveRift(r).problems).toEqual([]);
    }
    expect(fen).toBeGreaterThan(20);
  });

  it('the Glass Eye keeps its water under Drought and Permafrost', () => {
    let checked = 0;
    for (let seed = 0; seed < 200 && checked < 4; seed++)
      for (const mods of [['drought'], ['permafrost']] as RiftModId[][]) {
        const r = generateRift(spec(seed, 11, mods), ROOMS);
        if (r.bossKind !== 'rift_coil') continue;
        const data = parseRoom(r.rooms[r.bossId]!);
        expect(data.rows.join('')).toContain('w');
        // Other rooms of the same rift do dry out or freeze.
        const other = Object.entries(r.rooms).find(([id]) => id !== r.bossId && r.rooms[id]!.includes('~'));
        expect(other).toBeUndefined();
        checked++;
      }
    expect(checked).toBeGreaterThan(0);
  });

  it('scale from their own levels (22 and 24) with the rift; a rift Coil keeps its water ways', () => {
    const s = createGame({ seed: 1, roomText: ROOMS['rift/bosses/glass_eye']!.replace('@name', '@level 21\n@name') });
    const c = spawnEnemy(s, 'rift_coil', 62, 46);
    expect(c.maxLife).toBeCloseTo(enemyDef('glasswater_coil').life * 1.12 ** (21 - 24), 3);
    expect(s.grid.ground[46 * s.grid.width + 62]).toBe(MAT.deep_water);
    expect(c.boss!.fen).not.toBeNull();
  });
});
