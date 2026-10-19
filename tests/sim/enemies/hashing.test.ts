import { describe, expect, it } from 'vitest';
import { hashState, spawnEnemy } from '../../../src/sim';
import { arena } from './helpers';

/** Every M4 enemy field is part of the state hash (replays and the determinism tests rely on it). */

describe('M4 enemy state is hashed', () => {
  const edits: [string, (e: ReturnType<typeof spawnEnemy>) => void][] = [
    ['mods', (e) => e.mods.push('hasted')],
    ['ai.cooldowns', (e) => (e.ai.cooldowns[1] = 2)],
    ['special.fuseLeft', (e) => (e.special.fuseLeft = 1)],
    ['special.submerged', (e) => (e.special.submerged = !e.special.submerged)],
    ['special.trapped', (e) => (e.special.trapped = true)],
    ['special.dash', (e) => (e.special.dashSpeed = 10)],
    ['special.parentId', (e) => (e.special.parentId = 7)],
    ['special.trailCell', (e) => (e.special.trailCell = 99)],
    ['boss.phase', (e) => (e.boss!.phase = 2)],
    ['boss.superheated', (e) => (e.boss!.superheated = true)],
    ['boss.breakLeft', (e) => (e.boss!.breakLeft = 1)],
    ['boss.inWater', (e) => (e.boss!.inWater = true)],
    ['boss.stormLeft', (e) => (e.boss!.stormLeft = 3)],
    ['boss.glowing', (e) => (e.boss!.glowing = true)],
  ];
  for (const [name, edit] of edits) {
    it(name, () => {
      const s = arena();
      const e = spawnEnemy(s, 'cinder_warden', 40, 40);
      const before = hashState(s);
      edit(e);
      expect(hashState(s)).not.toBe(before);
    });
  }
});
