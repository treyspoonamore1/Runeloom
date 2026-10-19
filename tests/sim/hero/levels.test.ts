import { describe, expect, it } from 'vitest';
import {
  addHeartSeed,
  addLoomShard,
  baseKillXp,
  grantRuneXp,
  grantXp,
  killEnemy,
  killXpFor,
  passivePointsEarned,
  PLAYER_ID,
  spawnEnemy,
  type SimEvent,
} from '../../../src/sim';
import { maxRuneLevel, runeXpToNext, xpToNext } from '../../../data/progression';
import { adventure, giveRune } from './helpers';
import { ofType } from '../combat/helpers';

const events = (s: { events: SimEvent[] }) => s.events;

describe('XP per kill (DESIGN §7)', () => {
  it('is base life × 1.12^(area level − 1) × rarity, with boss overrides', () => {
    expect(baseKillXp('tinderling')).toBe(14);
    expect(killXpFor('tinderling', 1, 'normal')).toBe(14);
    expect(killXpFor('tinderling', 5, 'normal')).toBe(Math.round(14 * 1.12 ** 4));
    expect(killXpFor('shieldbearer', 3, 'magic')).toBe(Math.round(90 * 1.12 * 1.12 * 1.7));
    expect(killXpFor('ember_archer', 2, 'rare')).toBe(Math.round(40 * 1.12 * 4));
    expect(killXpFor('dummy', 9, 'normal')).toBe(0);
  });

  it('kills in adventure mode pay XP to the hero and to every socketed rune', () => {
    const state = adventure();
    const e = spawnEnemy(state, 'shieldbearer', 100, 60);
    state.events.length = 0;
    killEnemy(state, e, PLAYER_ID, 'hit');
    const xp = ofType(events(state), 'xpGained');
    expect(xp).toHaveLength(1);
    expect(xp[0]!.amount).toBe(90);
    // Level 1 → 2 needs 30, 2 → 3 needs 138: 90 XP is one level and 60 over.
    expect(state.hero.level).toBe(2);
    expect(state.hero.xp).toBe(90 - xpToNext(1));
    const socketed = new Set(state.weaves.slots.flatMap((s) => s.runes ?? []));
    for (const r of state.hero.runes) {
      if (socketed.has(r.uid)) expect(r.level > 1 || r.xp > 0).toBe(true);
    }
  });
});

describe('levels and vitals', () => {
  it('levels up as often as the XP covers, with a full heal and one passive point per level', () => {
    const state = adventure();
    const p = state.player;
    expect(p.maxLife).toBe(80);
    expect(p.maxMana).toBe(50);
    p.life = 10;
    p.mana = 3;
    state.events.length = 0;
    grantXp(state, xpToNext(1) + xpToNext(2) + xpToNext(3) + 5, 0, 0);
    expect(state.hero.level).toBe(4);
    expect(state.hero.xp).toBe(5);
    expect(ofType(state.events, 'levelUp').map((e) => e.level)).toEqual([2, 3, 4]);
    expect(p.level).toBe(4);
    expect(p.maxLife).toBe(80 + 12 * 3);
    expect(p.maxMana).toBe(50 + 4 * 3);
    expect(p.life).toBe(p.maxLife);
    expect(p.mana).toBe(p.maxMana);
    expect(passivePointsEarned(state.hero)).toBe(3);
  });

  it('XP short of a level changes no vitals', () => {
    const state = adventure();
    state.player.life = 40;
    grantXp(state, 10, 0, 0);
    expect(state.hero.level).toBe(1);
    expect(state.player.life).toBe(40);
  });

  it('Heart Seeds add 8 max life each (arriving filled); Loom Shards add 1 Capacity', () => {
    const state = adventure();
    state.player.life = 50;
    addHeartSeed(state);
    expect(state.player.maxLife).toBe(88);
    expect(state.player.life).toBe(58);
    const cap = state.weaves.slots[0]!.compiled!.costs!.capacity;
    addLoomShard(state);
    expect(state.weaves.slots[0]!.compiled!.costs!.capacity).toBe(cap + 1);
  });
});

describe('rune XP', () => {
  it('socketed runes level through runeXpToNext up to level 20; pouch runes gain nothing', () => {
    const state = adventure();
    const pouch = giveRune(state, 'nova');
    const bolt = state.hero.runes.find((r) => r.rune === 'bolt')!;
    state.events.length = 0;
    grantRuneXp(state, runeXpToNext(1) + runeXpToNext(2) + 7);
    expect(bolt.level).toBe(3);
    expect(bolt.xp).toBe(7);
    expect(pouch.level).toBe(1);
    expect(pouch.xp).toBe(0);
    const ups = ofType(state.events, 'runeLevelUp').filter((e) => e.uid === bolt.uid);
    expect(ups.map((e) => e.level)).toEqual([2, 3]);
    grantRuneXp(state, 10_000_000);
    expect(bolt.level).toBe(maxRuneLevel);
    expect(bolt.xp).toBe(0);
  });

  it('a rune level-up from a kill recompiles its weave', () => {
    const state = adventure();
    const before = state.weaves.slots[0]!.program!.root.baseDamage;
    grantXp(state, runeXpToNext(1), 0, 0);
    const bolt = state.hero.runes.find((r) => r.rune === 'bolt')!;
    expect(bolt.level).toBe(2);
    expect(state.weaves.slots[0]!.program!.root.baseDamage).toBeCloseTo(before * 1.11, 9);
  });

  it('the curve is increasing and positive', () => {
    for (let l = 1; l < maxRuneLevel; l++) expect(runeXpToNext(l + 1)).toBeGreaterThan(runeXpToNext(l));
    expect(runeXpToNext(1)).toBeGreaterThan(0);
  });
});

describe('Brood Kiln mites (M4 balance pass)', () => {
  it('pay no XP and drop nothing when a kiln spawned them; placed mites still pay', () => {
    const state = adventure();
    const kiln = spawnEnemy(state, 'brood_kiln', 40, 40);
    const spawned = spawnEnemy(state, 'kiln_mite', 100, 60, { parentId: kiln.id });
    const placed = spawnEnemy(state, 'kiln_mite', 110, 60);
    state.events.length = 0;
    for (let i = 0; i < 50; i++) {
      const m = spawnEnemy(state, 'kiln_mite', 100, 60, { parentId: kiln.id });
      killEnemy(state, m, PLAYER_ID, 'hit');
    }
    killEnemy(state, spawned, PLAYER_ID, 'hit');
    expect(ofType(events(state), 'xpGained')).toHaveLength(0);
    expect(state.loot).toHaveLength(0);
    killEnemy(state, placed, PLAYER_ID, 'hit');
    expect(ofType(events(state), 'xpGained')).toHaveLength(1);
  });
});
