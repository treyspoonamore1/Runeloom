import { describe, expect, it } from 'vitest';
import {
  createAdventure,
  dealDirectDamage,
  PLAYER_ID,
  spawnEnemy,
  step,
  type GameState,
  type SimEvent,
} from '../../../src/sim';
import { deepRiftsOpen } from '../../../src/sim/meta/view';
import { ofType } from '../terrain/helpers';
import { ROOMS } from './worldHelpers';

/** The arena as an adventure room (rewards, boss records, the deep-rift gate). */
function fromFile(id: string): GameState {
  const s = createAdventure({ seed: 4, rooms: ROOMS, startRoomId: id });
  s.cheats.god = true;
  return s;
}

/**
 * The Fen bosses' rewards (CONTENT §13.1–13.3, DESIGN §10.4–10.5): the Bellwether pays On Hit and
 * Infuse copies and its Clapper; the Coil pays Gale (an element "item get") and Nova, a Pattern
 * Seed, the Coil Dynamo, loot and, the first time, a tier 9 Rift Sigil, and it opens the deep rifts.
 */

function killBoss(s: GameState, kind: string): SimEvent[] {
  const b = s.enemies.find((e) => e.kind === kind)!;
  s.events.length = 0;
  dealDirectDamage(s, b, b.life + 1e6, PLAYER_ID);
  // The kill's own drops come with the blow, before the next step.
  const ev: SimEvent[] = [...s.events];
  for (let i = 0; i < 10; i++) {
    step(s, { moveX: 0, moveY: 0, aimX: s.player.x + 1, aimY: s.player.y, buttons: 0 });
    ev.push(...s.events);
  }
  return ev;
}

const drops = (ev: SimEvent[]) => ofType(ev, 'lootDropped').map((d) => d.content);

describe('Fen boss rewards', () => {
  it('the Old Bellwether: On Hit and Infuse at rune level 10, its Clapper, loot', () => {
    const s = fromFile('test/boss_bellwether');
    const ev = killBoss(s, 'bellwether');
    expect(ofType(ev, 'bossDefeated')).toMatchObject([{ kind: 'bellwether' }]);
    const runes = ofType(ev, 'rewardGranted').map((r) => r.content);
    expect(runes).toMatchObject([
      { kind: 'rune', rune: { rune: 'on_hit', level: 10 } },
      { kind: 'rune', rune: { rune: 'infuse', level: 10 } },
    ]);
    expect(ofType(ev, 'elementUnlocked')).toHaveLength(0);
    expect(drops(ev)).toContainEqual(expect.objectContaining({ kind: 'part', part: expect.objectContaining({ part: 'bellwethers_clapper' }) }));
    expect(drops(ev).some((c) => c.kind === 'sigil')).toBe(false);
    expect(s.world.bossesDefeated).toContain('bellwether');
  });

  it('the Glasswater Coil: Gale (item get, from the boss) and Nova, a Pattern Seed, the Coil Dynamo, a tier 9 sigil, and the deep rifts open', () => {
    const s = fromFile('test/boss_coil');
    expect(deepRiftsOpen(s.world)).toBe(false);
    const seeds = s.hero.patternSeeds;
    const ev = killBoss(s, 'glasswater_coil');
    expect(ofType(ev, 'bossDefeated')).toMatchObject([{ kind: 'glasswater_coil' }]);
    const runes = ofType(ev, 'rewardGranted').map((r) => r.content);
    expect(runes).toMatchObject([
      { kind: 'rune', rune: { rune: 'gale', level: 10 } },
      { kind: 'rune', rune: { rune: 'nova', level: 10 } },
    ]);
    expect(ofType(ev, 'elementUnlocked')).toMatchObject([{ rune: 'gale', source: 'boss' }]);
    expect(s.hero.unlockedRunes).toContain('gale');
    expect(s.hero.patternSeeds).toBe(seeds + 1);
    expect(ofType(ev, 'patternSeedGained')).toMatchObject([{ amount: 1, total: seeds + 1 }]);
    const d = drops(ev);
    expect(d).toContainEqual(expect.objectContaining({ kind: 'part', part: expect.objectContaining({ part: 'coil_dynamo' }) }));
    expect(d.filter((c) => c.kind === 'sigil')).toMatchObject([{ kind: 'sigil', sigil: { tier: 9 } }]);
    expect(s.world.bossesDefeated).toContain('glasswater_coil');
    expect(deepRiftsOpen(s.world)).toBe(true);
  });

  it('the tier 9 sigil and the rewards come only once: a second Coil (the dev console) pays nothing', () => {
    const s = fromFile('test/boss_coil');
    killBoss(s, 'glasswater_coil');
    const seeds = s.hero.patternSeeds;
    spawnEnemy(s, 'glasswater_coil', 62, 46);
    const ev = killBoss(s, 'glasswater_coil');
    expect(ofType(ev, 'bossDefeated')).toHaveLength(0);
    expect(ofType(ev, 'rewardGranted')).toHaveLength(0);
    expect(drops(ev).some((c) => c.kind === 'sigil')).toBe(false);
    expect(s.hero.patternSeeds).toBe(seeds);
  });

  it('the Gale moment fires only for the first Gale in the save', () => {
    const s = fromFile('test/boss_coil');
    s.hero.unlockedRunes.push('gale');
    const ev = killBoss(s, 'glasswater_coil');
    expect(ofType(ev, 'elementUnlocked')).toHaveLength(0);
    expect(ofType(ev, 'rewardGranted')).toHaveLength(2);
  });
});
