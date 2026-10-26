/** M7: the Mutations the meta agent hooks in (CONTENT §11), and the Rekindle rift tier cap. */
import { describe, expect, it } from 'vitest';
import { mutationEffects, rekindle } from '../../../data/hearth';
import { OWNER } from '../../../data/materials';
import { runeDiscovery } from '../../../data/progression';
import { weaveLimits } from '../../../data/runes';
import { heroModsOf, killEnemy, PLAYER_ID, rollKillLoot, spawnEnemy, type GameState } from '../../../src/sim';
import { applyHeroEdit } from '../../../src/sim/hero/edits';
import { iceConducts } from '../../../src/sim/hero/effectsTerrain';
import { rollDiscovery } from '../../../src/sim/items/drops';
import { makeSigil } from '../../../src/sim/items/sigils';
import { makeUnique } from '../../../src/sim/items/uniqueItems';
import { expeditionSeconds, maxRiftTier } from '../../../src/sim/meta/view';
import { maxOpenTier, openRiftError } from '../../../src/sim/world/rift/run';
import { adventure, run } from '../world/worldHelpers';
import { build, hub, ok } from './helpers';

function buy(s: GameState, mutation: Parameters<typeof applyHeroEdit>[1] & { kind: 'mutationBuy' }): void {
  s.hero.hearth.ash += 10;
  ok(s, mutation);
}

describe('Deeper Weave', () => {
  it('lets branches nest 4 deep; The First Thread still caps it at 2', () => {
    const s = hub();
    expect(s.heroMods.maxDepth).toBe(weaveLimits.maxDepth);
    buy(s, { kind: 'mutationBuy', mutation: 'deeper_weave' });
    expect(s.heroMods.maxDepth).toBe(mutationEffects.deeperDepth);
    const t = makeUnique(s.hero, 'the_first_thread', 3);
    s.hero.items.push(t);
    s.hero.equipped.spindle = t.uid;
    expect(heroModsOf(s.hero).maxDepth).toBe(2);
  });
});

describe('Stormglass Memory', () => {
  it("makes ice conduct the player's Storm, without Stormglass's damage", () => {
    const s = hub();
    expect(iceConducts(s, OWNER.player)).toBe(false);
    buy(s, { kind: 'mutationBuy', mutation: 'stormglass_memory' });
    expect(iceConducts(s, OWNER.player)).toBe(true);
    expect(iceConducts(s, OWNER.enemy)).toBe(false);
    expect(s.heroMods.effects.stormglass).toBeUndefined();
  });
});

describe('Shatterpoint', () => {
  it('adds the Shatter trigger to rune discovery only when owned', () => {
    const s = hub();
    s.hero.unlockedRunes.push(...(Object.keys(runeDiscovery.from) as never[]));
    expect(rollDiscovery(s, 30, [])).toBeNull();
    buy(s, { kind: 'mutationBuy', mutation: 'shatterpoint' });
    expect(rollDiscovery(s, 30, [])).toBe('shatter');
    s.hero.unlockedRunes.push('shatter');
    expect(rollDiscovery(s, 30, [])).toBeNull();
  });

  it('a boss can drop it then', () => {
    const s = hub();
    s.hero.unlockedRunes.push(...(Object.keys(runeDiscovery.from) as never[]));
    buy(s, { kind: 'mutationBuy', mutation: 'shatterpoint' });
    const boss = spawnEnemy(s, 'tar_matriarch', 120, 60, { areaLevel: 12 });
    const runes = rollKillLoot(s, boss).flatMap((c) => (c.kind === 'rune' ? [c.rune.rune] : []));
    expect(runes).toContain('shatter');
  });
});

describe('Swift Expeditions', () => {
  it('expeditions sent after the purchase take ÷ 1.5; ones already out keep their time', () => {
    const s = hub();
    build(s, { expedition_board: 6 });
    ok(s, { kind: 'expeditionSend', tier: 1 });
    const slow = s.hero.hearth.expeditions[0]!.duration;
    buy(s, { kind: 'mutationBuy', mutation: 'swift_expeditions' });
    ok(s, { kind: 'expeditionSend', tier: 1 });
    expect(s.hero.hearth.expeditions[0]!.duration).toBe(slow);
    expect(s.hero.hearth.expeditions[1]!.duration).toBeCloseTo(slow / mutationEffects.swiftSpeed);
    expect(expeditionSeconds(s.hero, 1)).toBeCloseTo(slow / mutationEffects.swiftSpeed);
  });
});

describe('the Rekindle rift tier cap', () => {
  function atStone(tier: number, riftTier: number, rekindles: number) {
    const s = adventure('test/world_a');
    run(s, 1);
    s.hero.riftTier = riftTier;
    s.hero.hearth.rekindles = rekindles;
    s.world.bossesDefeated.push('glasswater_coil'); // this block tests the Rekindle cap alone
    const g = makeSigil(s.hero, tier, []);
    s.hero.sigils.push(g);
    return { s, uid: g.uid };
  }

  it('tier 10 before the first Rekindle, +2 per Rekindle, up to 16', () => {
    expect([0, 1, 2, 3, 4].map((n) => maxRiftTier({ hearth: { rekindles: n } } as never))).toEqual([
      10, 12, 14, 16, 16,
    ]);
    const { s, uid } = atStone(11, 10, 0);
    expect(maxOpenTier(s)).toBe(rekindle.baseMaxTier);
    expect(openRiftError(s, uid)).toBe('Rekindle to open tiers above 10');
    s.hero.hearth.rekindles = 1;
    expect(maxOpenTier(s)).toBe(11);
    expect(openRiftError(s, uid)).toBeNull();
    const ladder = atStone(5, 3, 2);
    expect(openRiftError(ladder.s, ladder.uid)).toMatch(/Complete a tier 4 rift first/);
  });

  it("a boss's next-tier sigil drops at the cap, and so do rift kill sigils", () => {
    const { s, uid } = atStone(10, 9, 0);
    expect(applyHeroEdit(s, { kind: 'openRift', uid })).toBeNull();
    let killSigils = 0;
    for (let i = 0; i < 400; i++) {
      const e = spawnEnemy(s, 'tinderling', s.player.x + 10, s.player.y, { areaLevel: 22 });
      e.rarity = 'rare';
      for (const c of rollKillLoot(s, e))
        if (c.kind === 'sigil') {
          killSigils++;
          expect(c.sigil.tier).toBeLessThanOrEqual(10);
        }
      e.dead = true;
    }
    expect(killSigils).toBeGreaterThan(0);
    s.enemies.length = 0;
    s.world.pending = { roomId: 'rift/0/boss', arrival: { kind: 'edge', from: 'n' }, reason: 'exit' };
    run(s, 1);
    s.cheats.noAI = true;
    killEnemy(
      s,
      s.enemies.find((e) => e.kind.startsWith('rift_'))!,
      PLAYER_ID,
      'hit',
    );
    run(s, 2);
    const tiers = s.loot.flatMap((d) => (d.content.kind === 'sigil' ? [d.content.sigil.tier] : []));
    expect(tiers.length).toBeGreaterThan(0);
    expect(Math.max(...tiers)).toBe(10);
  });
});
