/** M6 rift bot: the reference character and one full clear. */
import { describe, expect, it } from 'vitest';
import { affixes } from '../../../data/affixes';
import { referenceAffixes, riftCharacter, runRiftBot } from '../../../src/sim/bots/riftBot';
import { loadAllRooms } from '../../../tools/lib/rooms';

const rooms = loadAllRooms();

describe('rift bot', () => {
  it('builds Rares with at most 3 prefixes and 3 suffixes at the best tier the item level allows', () => {
    for (const kind of ['spindle', 'cloak', 'hood', 'boots', 'charm'] as const) {
      const list = referenceAffixes(kind, 12);
      const defs = list.map((a) => affixes[a.id as keyof typeof affixes]);
      expect(defs.filter((d) => d.kind === 'prefix').length).toBeLessThanOrEqual(3);
      expect(defs.filter((d) => d.kind === 'suffix').length).toBeLessThanOrEqual(3);
      expect(new Set(defs.map((d) => d.group)).size).toBe(defs.length);
      for (const [i, a] of list.entries())
        expect(a.tier).toBe(defs[i]!.tiers.find((t) => t.itemLevel <= 12)!.tier);
    }
    const hero = riftCharacter(4);
    expect(hero.level).toBe(15);
    expect(hero.items.filter((it) => it.rarity === 'rare').length).toBe(6);
  });

  it('clears a tier 1 rift, the same way every time', () => {
    const a = runRiftBot({ rooms, seed: 3, tier: 1, mods: ['drought'], build: 'fire' });
    const b = runRiftBot({ rooms, seed: 3, tier: 1, mods: ['drought'], build: 'fire' });
    expect(a.completed).toBe(true);
    expect(a.cleared).toBe(a.rooms);
    expect(a.bossSeconds).toBeGreaterThan(0);
    expect(b).toEqual(a);
  });
});
