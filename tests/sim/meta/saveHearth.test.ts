/** M7: the Hearth in saves (version 3): round trip, the v2 → v3 migration, validation. */
import { describe, expect, it } from 'vitest';
import { embers, hearthStone } from '../../../data/hearth';
import {
  createGame,
  hashProgress,
  loadSave,
  makeSave,
  parseSave,
  type GameState,
  type SaveData,
} from '../../../src/sim';
import { makeSigil } from '../../../src/sim/items/sigils';
import { loomStoneId } from '../../../src/sim/world/worldState';
import { build, HUB_ROOM, hub, plant } from './helpers';

function load(save: SaveData): GameState {
  return loadSave(save, (init) =>
    createGame({
      seed: init.seed,
      mode: 'adventure',
      roomText: HUB_ROOM,
      hero: init.hero,
      world: init.world,
    }),
  );
}

function busyHearth(): GameState {
  const s = hub({ seed: 3 });
  const h = s.hero.hearth;
  build(s, { kindling_pit: 7, rune_garden: 9, expedition_board: 11, salvage_loom: 4 });
  h.embers = 321;
  h.embersSpent = 4567;
  h.scrapCarry = 0.375;
  h.salvage = 'magic';
  h.ash = 3;
  h.rekindles = 2;
  h.mutations = { bright_hearth: 4, sigil_cache: 1 };
  h.playSeconds = 777;
  h.clock = 31;
  plant(s, ['nova', 'wide'], 6, 10);
  s.hero.unlockedRunes.sort();
  h.expeditions.push(
    { uid: s.hero.nextUid++, tier: 3, left: 0, duration: 960 },
    { uid: s.hero.nextUid++, tier: 2, left: 300.5, duration: 840 },
  );
  s.hero.riftTier = 6;
  s.hero.sigils.push(makeSigil(s.hero, 7, []));
  return s;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;
const raw = (s: GameState): Raw => JSON.parse(JSON.stringify(makeSave(s))) as Raw;

describe('the Hearth in saves', () => {
  it('a v3 save round-trips: same data, same hashProgress', () => {
    const s = busyHearth();
    const json = JSON.stringify(makeSave(s));
    const save = parseSave(json);
    expect(save).toEqual(JSON.parse(json));
    const loaded = load(save);
    expect(hashProgress(loaded)).toBe(hashProgress(s));
    expect(loaded.hero.hearth).toEqual(s.hero.hearth);
  });

  it('a v2 save that beat the Cinder Warden gets a lit Hearth, its Embers and its Loom Stone', () => {
    const v2 = raw(hub({ lit: false }));
    v2.version = 2;
    delete v2.hero.hearth;
    v2.world.bossesDefeated = ['tar_matriarch', 'cinder_warden'];
    const save = parseSave(v2);
    expect(save.version).toBe(3);
    expect(save.hero.hearth.lit).toBe(true);
    expect(save.hero.hearth.embers).toBe(embers.onLit);
    expect(save.world.loomStones).toContain(loomStoneId(hearthStone.roomId, hearthStone.key));
    const loaded = load(save);
    expect(hashProgress(load(parseSave(JSON.stringify(makeSave(loaded)))))).toBe(hashProgress(loaded));
  });

  it("a v2 save before the Warden gets an unlit Hearth; a v3 one isn't lit again", () => {
    const v2 = raw(hub({ lit: false }));
    v2.version = 2;
    delete v2.hero.hearth;
    expect(parseSave(v2).hero.hearth.lit).toBe(false);
    const v3 = raw(hub({ lit: false }));
    v3.world.bossesDefeated = ['cinder_warden'];
    expect(parseSave(v3).hero.hearth.lit).toBe(false);
  });

  it('garden runes a weave socketed go back to the pouch', () => {
    const s = busyHearth();
    const save = raw(s);
    const socketed = save.weaves.runes[0][0] as number;
    save.hero.hearth.garden.push(socketed);
    const parsed = parseSave(save);
    expect(parsed.hero.hearth.garden).toEqual(s.hero.hearth.garden);
  });

  it('rejects broken Hearth data, naming the field', () => {
    const bad = (edit: (h: Raw) => void, msg: RegExp) => {
      const save = raw(busyHearth());
      edit(save.hero.hearth);
      expect(() => parseSave(save)).toThrow(msg);
    };
    bad((h) => (h.buildings.kindling_pit = 99), /hero\.hearth\.buildings\.kindling_pit/);
    bad((h) => (h.buildings.forge = 1), /buildings\.forge is not a building/);
    bad((h) => h.garden.push(987654), /hero\.hearth\.garden\[2\] is not one of the hero's runes/);
    bad((h) => h.garden.push(h.garden[0]), /garden lists a rune twice/);
    bad((h) => (h.expeditions[1].uid = h.expeditions[0].uid), /expeditions repeats a uid/);
    bad((h) => (h.expeditions[0].left = 5000), /expeditions\[0\]\.left/);
    bad((h) => (h.mutations.bright_hearth = 11), /mutations\.bright_hearth/);
    bad((h) => (h.mutations.wings = 1), /mutations\.wings is not a mutation/);
    bad((h) => (h.salvage = 'unique'), /hero\.hearth\.salvage/);
    bad((h) => (h.embers = -1), /hero\.hearth\.embers/);
    bad((h) => (h.lit = 'yes'), /hero\.hearth\.lit/);
  });
});
