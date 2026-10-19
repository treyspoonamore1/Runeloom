import { describe, expect, it } from 'vitest';
import { circleOverlapsSolid, createGame, hashState, isWaterAt, parseRoom } from '../../../src/sim';
import { enemies } from '../../../data/enemies';
import { packs, type PackDef } from '../../../data/packs';
import { shippedMods } from '../../../src/sim/actors/rarity';
import { fromFile } from './helpers';

/** CONTENT §5 pack tables and room spawns (`@spawn <d> pack:<id> [magic|rare]`). */

function roomWith(spawns: string[], seed = 1) {
  const rows = [
    '#'.repeat(30),
    ...Array.from(
      { length: 18 },
      (_, i) => `#${i === 9 ? '.'.repeat(13) + '1' + '.'.repeat(14) : '.'.repeat(28)}#`,
    ),
    '#'.repeat(30),
  ];
  return createGame({
    seed,
    roomText: `@id test/packs\n@level 4\n${spawns.join('\n')}\n${rows.join('\n')}\n`,
  });
}

describe('room spawn headers', () => {
  it('parse a pack, an enemy count and a trailing rarity', () => {
    const h = parseRoom(
      '@id t/x\n@spawn 1 pack:archer_line rare\n@spawn 2 enemy:shieldbearer 2 magic\n@spawn 3 enemy:tinderling 4\n#\n',
    ).header;
    expect(h.spawns).toEqual([
      { marker: '1', kind: 'pack', id: 'archer_line', count: 1, rarity: 'rare' },
      { marker: '2', kind: 'enemy', id: 'shieldbearer', count: 2, rarity: 'magic' },
      { marker: '3', kind: 'enemy', id: 'tinderling', count: 4 },
    ]);
    expect(() => parseRoom('@id t/x\n@spawn 1 enemy:tinderling lots\n#\n')).toThrow(/count/);
  });
});

describe('packs', () => {
  it('spawn every table with counts in range, each member on open ground near its marker', () => {
    for (const [id, pack] of Object.entries(packs as Record<string, PackDef>)) {
      if (pack.waterOnly) continue;
      for (let seed = 1; seed <= 5; seed++) {
        const s = roomWith([`@spawn 1 pack:${id}`], seed);
        for (const m of pack.members) {
          const n = s.enemies.filter((e) => e.kind === m.kind).length;
          expect(n).toBeGreaterThanOrEqual(m.min);
          expect(n).toBeLessThanOrEqual(m.max);
        }
        for (const e of s.enemies) {
          expect(circleOverlapsSolid(s.room, e.x, e.y, e.radius)).toBe(false);
          expect(Math.hypot(e.x - 58, e.y - 42)).toBeLessThan(25);
          expect(e.rarity).toBe('normal');
        }
      }
    }
  });

  it('tinderling_swarm rolls 6–10 from the AI stream, deterministically', () => {
    const sizes = new Set<number>();
    for (let seed = 1; seed <= 30; seed++)
      sizes.add(roomWith(['@spawn 1 pack:tinderling_swarm'], seed).enemies.length);
    expect([...sizes].every((n) => n >= 6 && n <= 10)).toBe(true);
    expect(sizes.size).toBeGreaterThan(2);
    const a = roomWith(['@spawn 1 pack:tinderling_swarm'], 7);
    const b = roomWith(['@spawn 1 pack:tinderling_swarm'], 7);
    expect(hashState(a)).toBe(hashState(b));
  });

  it('bog_nest spawns only on water markers, its 2–3 Lurkers on water', () => {
    // test/enemies_bog: two `1` markers in the pond, one `2` marker on land.
    const s = fromFile('test/enemies_bog');
    const lurkers = s.enemies.filter((e) => e.kind === 'bog_lurker');
    expect(lurkers.length).toBeGreaterThanOrEqual(4);
    expect(lurkers.length).toBeLessThanOrEqual(6);
    for (const l of lurkers) {
      expect(isWaterAt(s, l.x, l.y)).toBe(true);
      expect(l.y).toBeLessThan(60); // none from the land marker at y 66
    }
  });
});

describe('monster rarity in packs', () => {
  it('a Magic pack: every member Magic with the same 1–2 mods and ×1.7 life (×1.4 more if Thick-skinned)', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = roomWith(['@spawn 1 pack:tar_crew magic'], seed);
      const mods = s.enemies[0]!.mods;
      expect(mods.length).toBeGreaterThanOrEqual(1);
      expect(mods.length).toBeLessThanOrEqual(2);
      expect(new Set(mods).size).toBe(mods.length);
      for (const e of s.enemies) {
        expect(e.rarity).toBe('magic');
        expect(e.mods).toEqual(mods);
        const base = enemies[e.kind].life * 1.12 ** 3;
        const thick = mods.includes('thick_skinned') ? 1.4 : 1;
        expect(e.maxLife).toBeCloseTo(base * 1.7 * thick, 6);
      }
    }
  });

  it('a Rare pack: its leader Rare with 2–3 distinct shipped mods and ×4 life, plus 2 normal minions', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const s = roomWith(['@spawn 1 pack:archer_line rare'], seed);
      const rares = s.enemies.filter((e) => e.rarity === 'rare');
      expect(rares).toHaveLength(1);
      const r = rares[0]!;
      expect(r.kind).toBe('shieldbearer');
      expect(r.mods.length).toBeGreaterThanOrEqual(2);
      expect(r.mods.length).toBeLessThanOrEqual(shippedMods.length);
      expect(new Set(r.mods).size).toBe(r.mods.length);
      for (const m of r.mods) {
        expect(shippedMods).toContain(m);
        seen.add(m);
      }
      const thick = r.mods.includes('thick_skinned') ? 1.4 : 1;
      expect(r.maxLife).toBeCloseTo(90 * 1.12 ** 3 * 4 * thick, 6);
      // 3 archers + 1 Shieldbearer + 2 minion archers.
      expect(s.enemies.filter((e) => e.kind === 'ember_archer')).toHaveLength(5);
      expect(s.enemies.filter((e) => e.rarity === 'normal')).toHaveLength(5);
    }
    expect([...seen].sort()).toEqual(['hasted', 'incendiary', 'thick_skinned']);
  });

  it('an enemy line can be Rare too: each gets 2 minions of its kind', () => {
    const s = roomWith(['@spawn 1 enemy:shieldbearer 1 rare']);
    expect(s.enemies.map((e) => e.rarity)).toEqual(['rare', 'normal', 'normal']);
    expect(s.enemies.every((e) => e.kind === 'shieldbearer')).toBe(true);
  });

  it('bosses never get a rarity', () => {
    const s = roomWith(['@spawn 1 enemy:tar_matriarch 1 rare']);
    const m = s.enemies.find((e) => e.kind === 'tar_matriarch')!;
    expect(m.rarity).toBe('normal');
    expect(m.mods).toEqual([]);
    expect(m.maxLife).toBe(900);
    expect(s.enemies).toHaveLength(1);
  });
});
