/** M7: Embers drops (kills, chests, rift completion), lighting the Hearth, and the loot filter. */
import { describe, expect, it } from 'vitest';
import { embers, hearthStone } from '../../../data/hearth';
import {
  createGame,
  killEnemy,
  newGameHero,
  PLAYER_ID,
  rollKillLoot,
  spawnEnemy,
  step,
  NEUTRAL_INPUT,
  type GameState,
  type LootContent,
} from '../../../src/sim';
import { applyHeroEdit } from '../../../src/sim/hero/edits';
import { makeSigil } from '../../../src/sim/items/sigils';
import { lootAction } from '../../../src/sim/items/lootFilter';
import { killEmbersFor } from '../../../src/sim/meta/embers';
import { lightHearth } from '../../../src/sim/meta/hearth';
import { loomStoneId } from '../../../src/sim/world/worldState';
import { adventure, inlineRoom, obj, run, T, teleport } from '../world/worldHelpers';
import { hub, roomText } from './helpers';

const emberDrops = (c: LootContent[]) => c.filter((x) => x.kind === 'embers');

describe('kill Embers', () => {
  it('scale by rarity and area level like kill XP, and drop only once the Hearth is lit', () => {
    expect(killEmbersFor('tinderling', 'normal', 1)).toBe(embers.perKill.normal);
    expect(killEmbersFor('tinderling', 'rare', 10)).toBe(
      Math.round(embers.perKill.rare * embers.growth ** 9),
    );
    expect(killEmbersFor('rift_warden', 'normal', 20)).toBe(
      Math.round(embers.perKill.boss * embers.growth ** 19),
    );
    for (const lit of [false, true]) {
      const s = hub({ lit });
      const e = spawnEnemy(s, 'tinderling', 140, 100, { areaLevel: 10 });
      e.rarity = 'magic';
      const drops = emberDrops(rollKillLoot(s, e));
      expect(drops).toEqual(
        lit ? [{ kind: 'embers', amount: killEmbersFor('tinderling', 'magic', 10) }] : [],
      );
    }
  });

  it('a kill puts them on the floor and walking over them adds them to the Hearth', () => {
    const s = hub();
    const e = spawnEnemy(s, 'tinderling', 84, 60, { areaLevel: 1 });
    killEnemy(s, e, PLAYER_ID, 'hit');
    const drop = s.loot.find((d) => d.content.kind === 'embers')!;
    teleport(s, drop.x, drop.y);
    for (let i = 0; i < 60; i++) step(s, NEUTRAL_INPUT);
    expect(s.hero.hearth.embers).toBe(embers.onLit + embers.perKill.normal);
  });

  it('spawned Kiln Mites and non-adventure games pay none', () => {
    const s = hub();
    const parent = spawnEnemy(s, 'brood_kiln', 120, 100);
    const mite = spawnEnemy(s, 'kiln_mite', 140, 100, { parentId: parent.id });
    killEnemy(s, mite, PLAYER_ID, 'hit');
    expect(s.loot.filter((d) => d.content.kind === 'embers')).toEqual([]);
    const sandbox = createGame({ seed: 1, roomText: roomText('test/sb'), hero: newGameHero() });
    sandbox.hero.hearth.lit = true;
    killEnemy(sandbox, spawnEnemy(sandbox, 'tinderling', 140, 100), PLAYER_ID, 'hit');
    expect(sandbox.loot).toEqual([]);
  });

  it('the loot filter never hides them', () => {
    const hideAll = { rules: [{ what: 'any' as const, action: 'hide' as const }] };
    expect(lootAction(hideAll, { kind: 'embers', amount: 3 })).toBe('show');
    expect(lootAction(hideAll, { kind: 'scrap', amount: 3 })).toBe('hide');
  });
});

describe('chest Embers', () => {
  const ROOM = `@id kiln/t_ember_chest
@level 1
#######
#.k...#
#.....#
#######
`;
  function openChest(lit: boolean): GameState {
    const s = inlineRoom(ROOM);
    if (lit) lightHearth(s);
    teleport(s, T(2), T(1) + 2.5);
    run(s, 2, { moveX: 0, moveY: -1, aimX: 0, aimY: 0, buttons: 0 });
    expect(obj(s, 'key_chest').on).toBe(true);
    return s;
  }
  it('a chest opening drops embers.chest once the Hearth is lit', () => {
    const lit = openChest(true);
    const got =
      lit.hero.hearth.embers + lit.loot.filter((d) => d.content.kind === 'embers').length * embers.chest;
    expect(got).toBe(embers.onLit + embers.chest);
    expect(openChest(false).loot.filter((d) => d.content.kind === 'embers')).toEqual([]);
  });
});

describe('rift completion Embers', () => {
  function completeRift(tier: number, lit: boolean): GameState {
    const s = adventure('test/world_a');
    run(s, 1);
    if (lit) lightHearth(s);
    const g = makeSigil(s.hero, tier, []);
    s.hero.sigils.push(g);
    s.hero.riftTier = tier - 1;
    expect(applyHeroEdit(s, { kind: 'openRift', uid: g.uid })).toBeNull();
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
    return s;
  }
  it('pays riftPerTier × tier around the boss, lit only', () => {
    const s = completeRift(3, true);
    const amounts = s.loot.flatMap((d) => (d.content.kind === 'embers' ? [d.content.amount] : []));
    expect(amounts).toContain(embers.riftPerTier * 3);
    const dark = completeRift(3, false);
    expect(dark.loot.filter((d) => d.content.kind === 'embers')).toEqual([]);
  });
});

describe('lighting the Hearth', () => {
  it("the Cinder Warden's first death lights it: onLit Embers, the Hearth's Loom Stone, hearthLit", () => {
    const s = hub({ lit: false, roomId: 'kiln/k10_test' });
    const w = spawnEnemy(s, 'cinder_warden', 120, 60);
    killEnemy(s, w, PLAYER_ID, 'hit');
    step(s, NEUTRAL_INPUT);
    const seen = [...s.events];
    step(s, NEUTRAL_INPUT);
    seen.push(...s.events);
    const h = s.hero.hearth;
    expect(h.lit).toBe(true);
    expect(h.embers).toBe(embers.onLit);
    expect(s.world.loomStones).toContain(loomStoneId(hearthStone.roomId, hearthStone.key));
    expect(seen).toContainEqual({ type: 'hearthLit', embers: embers.onLit });
    // Lighting again does nothing.
    lightHearth(s);
    expect(h.embers).toBe(embers.onLit);
    expect(s.world.loomStones.filter((id) => id.startsWith('hearth/')).length).toBe(1);
  });
});
