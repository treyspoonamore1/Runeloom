import { describe, expect, it } from 'vitest';
import {
  applyHeroEdit,
  createGame,
  grantXp,
  hashProgress,
  killEnemy,
  loadSave,
  makeSave,
  onRoomCleared,
  parseSave,
  PLAYER_ID,
  refreshHero,
  rollGear,
  rollSpindle,
  Rng,
  setSlotWeave,
  spawnEnemy,
  step,
  type GameState,
  type SaveData,
} from '../../src/sim';
import { makePart } from '../../src/sim/items/items';
import { guaranteedRunes, regionRooms, type RegionRoomId } from '../../data/progression';
import { fuseParts } from '../../data/fuseParts';
import { roomFlags } from '../../src/sim/world/worldState';
import { adventure, OPEN_ROOM } from './hero/helpers';

const WEAVES = [
  'Cast > Bolt[Fire]',
  'Cast > Strike[]',
  'Cast > Lob[Fire] > OnExpire > Nova[Fire, Wide]',
  'Pulse > Nova[Fire]',
  'Cast > Swath[Fire]',
];

/** A hero and world with a bit of everything, built through the game's own systems. */
function randomGame(seed: number): GameState {
  const state = adventure(seed);
  const r = new Rng(seed * 7 + 1);
  const rooms = Object.values(regionRooms) as RegionRoomId[];
  for (let i = 0; i < 6; i++) onRoomCleared(state, rooms[r.int(rooms.length)]!);
  grantXp(state, r.int(4000), 0, 0);
  for (let i = 0; i < 40; i++) {
    const e = spawnEnemy(state, r.chance(0.5) ? 'tinderling' : 'shieldbearer', 120, 90, {
      areaLevel: 1 + r.int(10),
    });
    killEnemy(state, e, PLAYER_ID, 'hit');
  }
  for (let i = 0; i < 4; i++) state.hero.items.push(rollGear(state, 1 + r.int(10)));
  state.hero.items.push(rollSpindle(state, 8, 1));
  const ids = Object.keys(fuseParts);
  for (let i = 0; i < 3; i++)
    state.hero.parts.push(makePart(state.hero, ids[r.int(ids.length)]!, (1 + r.int(3)) as 1 | 2 | 3));
  for (const it of state.hero.items) {
    if (it.base === 'twig') continue;
    const slot = {
      travelers_cloak: 'cloak',
      wool_hood: 'hood',
      leather_boots: 'boots',
      bone_charm: 'charm1',
    }[it.base];
    applyHeroEdit(state, { kind: 'equip', uid: it.uid, slot: (slot ?? 'spindle') as 'cloak' });
  }
  const spindle = state.hero.equipped.spindle!;
  applyHeroEdit(state, { kind: 'fuse', partUid: state.hero.parts[0]!.uid, spindleUid: spindle, socket: 0 });
  state.hero.heartSeeds = r.int(4);
  state.hero.loomShards = r.int(3);
  state.hero.threadScrap += r.int(30);
  state.hero.patternSeeds = r.int(2);
  refreshHero(state);
  for (let slot = 2; slot < 4; slot++) setSlotWeave(state, slot, WEAVES[r.int(WEAVES.length)]!);
  const w = state.world;
  for (const id of rooms.slice(0, 5)) {
    const f = roomFlags(w, id);
    f.visited = true;
    f.cleared = r.chance(0.5);
    f.opened.push(`door${r.int(9)}`);
    f.taken.push(`chest${r.int(9)}`);
  }
  w.keys.kiln = r.int(3);
  w.bigKeys.push('kiln');
  w.loomStones.push(`${regionRooms.e1}#stone0`, `${regionRooms.e8}#stone1`);
  w.respawn = { roomId: regionRooms.e8, key: 'stone1' };
  w.bossesDefeated.push('tar_matriarch');
  for (let i = 0; i < 30; i++) step(state, { moveX: 1, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });
  return state;
}

function load(save: SaveData): GameState {
  return loadSave(save, (init) =>
    createGame({
      seed: init.seed,
      mode: 'adventure',
      roomText: OPEN_ROOM,
      hero: init.hero,
      world: init.world,
    }),
  );
}

describe('save round-trip (M4 acceptance)', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`random hero and world, seed ${seed}: save → JSON → load gives the same hashProgress`, () => {
      const state = randomGame(seed);
      expect(state.hero.runes.length).toBeGreaterThan(5);
      const json = JSON.stringify(makeSave(state));
      const save = parseSave(json);
      expect(save).toEqual(JSON.parse(json));
      const loaded = load(save);
      expect(hashProgress(loaded)).toBe(hashProgress(state));
      expect(loaded.heroMods).toEqual(state.heroMods);
      expect(loaded.player.maxLife).toBe(state.player.maxLife);
      expect(loaded.weaves.slots.map((s) => s.program?.notation)).toEqual(
        state.weaves.slots.map((s) => s.program?.notation),
      );
      // Loot keeps rolling the same sequence after a load.
      expect(loaded.lootRng.getState()).toEqual(state.lootRng.getState());
    });
  }

  it('hashProgress changes with the hero', () => {
    const state = randomGame(9);
    const h = hashProgress(state);
    state.hero.threadScrap++;
    expect(hashProgress(state)).not.toBe(h);
  });
});

describe('parseSave', () => {
  // Raw JSON, edited freely to break it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const good = () => JSON.parse(JSON.stringify(makeSave(randomGame(6)))) as Record<string, any>;

  it('rejects other files and newer versions', () => {
    expect(() => parseSave('{oops')).toThrow(/Not a save file/);
    expect(() => parseSave({ format: 'x' })).toThrow(/Not a Runeloom save/);
    expect(() => parseSave({ ...good(), version: 99 })).toThrow(/newer version/);
  });

  it('fills fields an older save lacks with defaults', () => {
    const s = good();
    delete s.hero.patternSeeds;
    delete s.world.bigKeys;
    delete s.tick;
    const save = parseSave(s);
    expect(save.hero.patternSeeds).toBe(0);
    expect(save.world.bigKeys).toEqual([]);
    expect(save.tick).toBe(0);
  });

  it('rejects broken references', () => {
    const a = good();
    a.hero.equipped.hood = 123456;
    expect(() => parseSave(a)).toThrow(/hero.equipped.hood/);
    const b = good();
    b.hero.items[0].affixes = [{ id: 'nope', tier: 1, value: 1 }];
    expect(() => parseSave(b)).toThrow(/not an affix/);
    const c = good();
    c.hero.runes[0].rune = 'fireball';
    expect(() => parseSave(c)).toThrow(/not a rune/);
    const d = good();
    d.rngs.lootRng = [1, 2];
    expect(() => parseSave(d)).toThrow(/rngs.lootRng/);
  });

  it('empties a weave whose socketed runes don’t match it', () => {
    const s = good();
    s.weaves.runes[0] = [...s.weaves.runes[0]].reverse();
    s.weaves.runes[1] = s.weaves.runes[0];
    const save = parseSave(s);
    expect(save.weaves.notations[0]).toBeNull();
    expect(save.weaves.runes[0]).toBeNull();
  });

  it('guaranteed runes for every region room are real runes', () => {
    for (const list of Object.values(guaranteedRunes)) expect(list!.length).toBeGreaterThan(0);
  });
});
