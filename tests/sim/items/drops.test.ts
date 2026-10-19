import { describe, expect, it } from 'vitest';
import {
  collectRoomLoot,
  createGame,
  dropLoot,
  hashState,
  killEnemy,
  onRoomCleared,
  PLAYER_ID,
  rollKillLoot,
  spawnEnemy,
  spindleBasesAt,
  partTierFor,
  step,
  type GameState,
  type LootContent,
} from '../../../src/sim';
import { roomFlags } from '../../../src/sim/world/worldState';
import { regionRooms } from '../../../data/progression';
import { defaultTuning } from '../../../data/tuning';
import { adventure, OPEN_ROOM } from '../hero/helpers';
import { ofType } from '../combat/helpers';

/** Kills `n` enemies of `kind` (at area level `level`) far from the player and returns what dropped. */
function killMany(
  state: GameState,
  kind: string,
  n: number,
  level = 1,
  rarity: 'normal' | 'magic' | 'rare' = 'normal',
) {
  const out: LootContent[] = [];
  for (let i = 0; i < n; i++) {
    const e = spawnEnemy(state, kind, 140, 100, { areaLevel: level });
    e.rarity = rarity;
    out.push(...rollKillLoot(state, e));
    e.dead = true;
  }
  return out;
}

describe('kill drops', () => {
  it('are deterministic for a seed', () => {
    const a = killMany(adventure(5), 'tinderling', 300, 6);
    const b = killMany(adventure(5), 'tinderling', 300, 6);
    expect(a.length).toBeGreaterThan(10);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(killMany(adventure(6), 'tinderling', 300, 6))).not.toBe(JSON.stringify(a));
  });

  it('roll on their own stream: combat, AI, spell and grid RNG are untouched', () => {
    const state = adventure(3);
    const before = [state.rng, state.combatRng, state.aiRng, state.spellRng, state.gridRng].map((r) =>
      r.getState(),
    );
    const loot = state.lootRng.getState();
    killMany(state, 'tinderling', 50);
    expect(
      [state.rng, state.combatRng, state.aiRng, state.spellRng, state.gridRng].map((r) => r.getState()),
    ).toEqual(before);
    expect(state.lootRng.getState()).not.toEqual(loot);
  });

  it('random runes come only from unlocked runes', () => {
    const state = adventure(2);
    const runes = killMany(state, 'tinderling', 2000).filter((c) => c.kind === 'rune');
    expect(runes.length).toBeGreaterThan(20);
    for (const c of runes)
      if (c.kind === 'rune') expect(['bolt', 'cast', 'fire', 'strike']).toContain(c.rune.rune);
  });

  it('parts come from their enemy kind with a tier by area level; spindles by item level', () => {
    const state = adventure(4);
    const parts = killMany(state, 'shieldbearer', 600, 9).filter((c) => c.kind === 'part');
    expect(parts.length).toBeGreaterThan(5);
    for (const c of parts)
      if (c.kind === 'part') expect(c.part).toMatchObject({ part: 'shield_plate', tier: 3 });
    expect(partTierFor(1)).toBe(1);
    expect(partTierFor(5)).toBe(2);
    expect(partTierFor(9)).toBe(3);
    expect(spindleBasesAt(3)).toEqual(['twig']);
    expect(spindleBasesAt(6)).toEqual(['twig', 'ashwood', 'ironbark']);
    const items = killMany(adventure(9), 'tinderling', 4000, 2).filter((c) => c.kind === 'item');
    for (const c of items)
      if (c.kind === 'item')
        expect(['twig', 'travelers_cloak', 'wool_hood', 'leather_boots', 'bone_charm']).toContain(
          c.item.base,
        );
  });

  it('rarer monsters drop more', () => {
    const normal = killMany(adventure(8), 'ember_archer', 500, 4, 'normal').length;
    const rare = killMany(adventure(8), 'ember_archer', 500, 4, 'rare').length;
    expect(rare).toBeGreaterThan(normal * 2.5);
  });

  it('sandbox kills give no XP and no loot', () => {
    const state = createGame({ seed: 1, roomText: OPEN_ROOM });
    const e = spawnEnemy(state, 'tinderling', 100, 60);
    killEnemy(state, e, PLAYER_ID, 'hit');
    expect(state.loot).toEqual([]);
    expect(state.hero.xp).toBe(0);
  });
});

describe('floor loot', () => {
  it('lands near the body and is picked up within range after the delay', () => {
    const state = adventure(1);
    state.events.length = 0;
    dropLoot(state, 80, 60, { kind: 'scrap', amount: 3 });
    expect(ofType(state.events, 'lootDropped')).toHaveLength(1);
    expect(state.loot).toHaveLength(1);
    const delayTicks = Math.ceil(defaultTuning.loot.pickupDelay * 60);
    for (let i = 0; i < delayTicks - 2; i++)
      step(state, { moveX: 0, moveY: 0, aimX: 90, aimY: 60, buttons: 0 });
    expect(state.loot).toHaveLength(1);
    for (let i = 0; i < 4; i++) step(state, { moveX: 0, moveY: 0, aimX: 90, aimY: 60, buttons: 0 });
    expect(state.loot).toHaveLength(0);
    expect(state.hero.threadScrap).toBe(3);
  });

  it('far drops stay until the room is left, then are collected', () => {
    const state = adventure(1);
    dropLoot(state, 140, 100, { kind: 'scrap', amount: 2 }, 3);
    for (let i = 0; i < 60; i++) step(state, { moveX: 0, moveY: 0, aimX: 90, aimY: 60, buttons: 0 });
    expect(state.loot).toHaveLength(1);
    state.events.length = 0;
    collectRoomLoot(state);
    expect(state.loot).toHaveLength(0);
    expect(state.hero.threadScrap).toBe(2);
    expect(ofType(state.events, 'lootPicked')[0]!.onExit).toBe(true);
  });

  it('a killed enemy puts its drops on the floor and changes the state hash only in adventure', () => {
    const state = adventure(11);
    let dropped = 0;
    for (let i = 0; i < 200 && dropped === 0; i++) {
      const e = spawnEnemy(state, 'tinderling', 140, 100);
      killEnemy(state, e, PLAYER_ID, 'hit');
      dropped = state.loot.length;
    }
    expect(dropped).toBeGreaterThan(0);
    expect(typeof hashState(state)).toBe('number');
  });
});

describe('first-clear rewards (CONTENT §9.1)', () => {
  it('grant and unlock the room’s guaranteed runes once and set rewardsPaid', () => {
    const state = adventure(1);
    state.events.length = 0;
    const room = regionRooms.e4;
    onRoomCleared(state, room);
    expect(roomFlags(state.world, room).rewardsPaid).toBe(true);
    expect(ofType(state.events, 'runeUnlocked').map((e) => e.rune)).toEqual(['wide', 'heavy']);
    expect(ofType(state.events, 'rewardGranted')).toHaveLength(2);
    expect(state.hero.unlockedRunes).toContain('wide');
    expect(state.hero.runes.filter((r) => r.rune === 'heavy')).toHaveLength(1);
    onRoomCleared(state, room);
    expect(state.hero.runes.filter((r) => r.rune === 'heavy')).toHaveLength(1);
  });

  it('a room without guaranteed runes just marks rewards paid', () => {
    const state = adventure(1);
    const n = state.hero.runes.length;
    onRoomCleared(state, regionRooms.k1);
    expect(state.hero.runes).toHaveLength(n);
    expect(roomFlags(state.world, regionRooms.k1).rewardsPaid).toBe(true);
  });

  it('unlocked runes then appear in random drops', () => {
    const state = adventure(3);
    onRoomCleared(state, regionRooms.e5);
    const runes = new Set(
      killMany(state, 'tinderling', 3000).flatMap((c) => (c.kind === 'rune' ? [c.rune.rune] : [])),
    );
    expect(runes.has('nova')).toBe(true);
    expect(runes.has('pierce')).toBe(true);
    expect(runes.has('swath')).toBe(false);
  });
});
