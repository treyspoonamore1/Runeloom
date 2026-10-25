/** M8: the deep-rift gate (tiers 9+ wait for the Glasswater Coil) and the Fen's storm door. */
import { describe, expect, it } from 'vitest';
import { riftGate } from '../../../data/riftGate';
import { applyHeroEdit } from '../../../src/sim/hero/edits';
import {
  applyElement,
  createAdventure,
  loadSave,
  makeSave,
  parseSave,
  PLAYER_ID,
  type GameState,
} from '../../../src/sim';
import { makeSigil } from '../../../src/sim/items/sigils';
import { applyRekindle } from '../../../src/sim/meta/rekindle';
import { deepRiftsOpen, maxRiftTier, riftOpenCap } from '../../../src/sim/meta/view';
import { parseLinkCondition } from '../../../src/sim';
import { maxOpenTier, openRiftError } from '../../../src/sim/world/rift/run';
import { adventure, inlineRoom, obj, ROOMS, run, T, types } from './worldHelpers';
import { OWNER } from '../../../data/materials';

const COIL = riftGate.boss;

/** At test/world_a's Loom Stone with a sigil of `tier`, the ladder at `best`, `rekindles` done. */
function atStone(tier: number, best: number, rekindles: number) {
  const s = adventure('test/world_a');
  run(s, 1);
  s.hero.riftTier = best;
  s.hero.hearth.rekindles = rekindles;
  const g = makeSigil(s.hero, tier, []);
  s.hero.sigils.push(g);
  return { s, uid: g.uid };
}

describe('the deep-rift gate', () => {
  it('refuses tier 9+ before the Coil, with its line, and allows it after', () => {
    const { s, uid } = atStone(9, 8, 0);
    expect(openRiftError(s, uid)).toBe(riftGate.lockedText);
    expect(applyHeroEdit(s, { kind: 'openRift', uid })).toMatch(/^The deep rifts are flooded\./);
    expect(s.hero.sigils).toHaveLength(1); // not spent
    s.world.bossesDefeated.push(COIL);
    expect(openRiftError(s, uid)).toBeNull();
    expect(applyHeroEdit(s, { kind: 'openRift', uid })).toBeNull();
  });

  it('keeps tier 8 and below open before the Coil', () => {
    const { s, uid } = atStone(8, 7, 0);
    expect(openRiftError(s, uid)).toBeNull();
  });

  it('a rift boss of the same name in a rift does not count: only bossesDefeated does', () => {
    const { s, uid } = atStone(9, 8, 0);
    s.world.bossesDefeated.push('cinder_warden');
    expect(openRiftError(s, uid)).toBe(riftGate.lockedText);
  });

  it('cap math: 10 at no Rekindle but 8 until the Coil; 12 after one Rekindle but 8 until the Coil', () => {
    const { s } = atStone(1, 20, 0);
    expect(maxRiftTier(s.hero)).toBe(10);
    expect(riftOpenCap(s.hero, s.world)).toBe(8);
    expect(maxOpenTier(s)).toBe(8); // ladder far above, gate holds
    s.hero.hearth.rekindles = 1;
    expect(maxRiftTier(s.hero)).toBe(12);
    expect(riftOpenCap(s.hero, s.world)).toBe(8);
    s.world.bossesDefeated.push(COIL);
    expect(deepRiftsOpen(s.world)).toBe(true);
    expect(riftOpenCap(s.hero, s.world)).toBe(12);
    expect(maxOpenTier(s)).toBe(12);
  });

  it('tier 11 after the Coil still needs the Rekindle (cap 10)', () => {
    const { s, uid } = atStone(11, 10, 0);
    s.world.bossesDefeated.push(COIL);
    expect(openRiftError(s, uid)).toBe('Rekindle to open tiers above 10');
  });

  it('Rekindle keeps the Coil defeat', () => {
    const { s } = atStone(1, 10, 0);
    s.world.bossesDefeated.push(COIL);
    expect(applyRekindle(s)).toBeNull();
    expect(s.hero.hearth.rekindles).toBe(1);
    expect(s.world.bossesDefeated).toContain(COIL);
    expect(riftOpenCap(s.hero, s.world)).toBe(12);
  });

  it('an old save past tier 8 loads with its tier 9+ sigils locked', () => {
    const { s, uid } = atStone(10, 9, 1);
    expect(s.world.bossesDefeated).not.toContain(COIL);
    const old = parseSave(JSON.stringify(makeSave(s)));
    expect(old.hero.riftTier).toBe(9);
    expect(old.hero.sigils.map((g) => g.tier)).toEqual([10]);
    expect(old.world.bossesDefeated).not.toContain(COIL);
    expect(old.world.stormDoorHinted).toBe(false);
    const loaded = loadSave(old, (init) => createAdventure({ ...init, rooms: ROOMS }));
    expect(openRiftError(loaded, uid)).toBe(riftGate.lockedText);
    expect(maxOpenTier(loaded)).toBe(8);
  });
});

describe("K10's storm door (rifttier:6)", () => {
  const ROOM = (exit: boolean) => `@id t/storm
@level 1
${exit ? '@exit n t/landing' : ''}
@link D switch:S
@link D rifttier:6
@note S !rifttier:6 The Fen isn't woven yet.
@note S ?rifttier:6 The storm door hums open.
#########
#...x...#
#.mMS...#
#.......#
####D####
#.......#
#########
`;
  const LANDING = '@id t/landing\n@level 1\n###\n#.#\n###\n';
  const power = (s: GameState) =>
    applyElement(s, {
      element: 'storm',
      shape: { kind: 'circle', x: T(4), y: T(2), r: 1 },
      owner: OWNER.player,
      sourceId: PLAYER_ID,
      hitDamage: 10,
      durationMult: 1,
    });

  it('parses', () => {
    expect(parseLinkCondition('rifttier:6')).toEqual({ kind: 'rifttier', tier: 6 });
    expect(parseLinkCondition('rifttier:x')).toBeNull();
  });

  it('stays shut and says "not woven yet" below best tier 6', () => {
    const s = inlineRoom(ROOM(true), { 't/landing': LANDING });
    s.hero.hearth.bestEverTier = 5;
    power(s);
    expect(s.events.filter((e) => e.type === 'note')).toMatchObject([{ text: "The Fen isn't woven yet." }]);
    run(s, 5);
    expect(obj(s, 'door').on).toBe(false);
  });

  it('opens at best tier ever 6, also after a Rekindle reset the ladder', () => {
    const s = inlineRoom(ROOM(true), { 't/landing': LANDING });
    s.hero.riftTier = 0; // a Rekindle reset it
    s.hero.hearth.bestEverTier = 6;
    power(s);
    expect(s.events.filter((e) => e.type === 'note')).toMatchObject([{ text: 'The storm door hums open.' }]);
    run(s, 5);
    expect(obj(s, 'door').on).toBe(true);
  });

  it('stays shut when the target room does not exist yet', () => {
    const s = inlineRoom(ROOM(true));
    s.hero.hearth.bestEverTier = 8;
    power(s);
    run(s, 5);
    expect(obj(s, 'door').on).toBe(false);
  });

  it('K10 today still has no exit to the Fen', () => {
    expect(ROOMS['fen/g1_storm_landing']).toBeUndefined();
  });
});

describe('the storm door hint', () => {
  it('is sent once when the best tier ever reaches 6, and remembered in the save', () => {
    const { s } = atStone(1, 5, 0);
    run(s, 3);
    expect(types(s)).not.toContain('stormDoorWoke');
    s.hero.riftTier = 6;
    run(s, 1);
    expect(types(s)).toContain('stormDoorWoke');
    expect(s.world.stormDoorHinted).toBe(true);
    run(s, 3);
    expect(types(s)).not.toContain('stormDoorWoke');
    expect(parseSave(JSON.stringify(makeSave(s))).world.stormDoorHinted).toBe(true);
  });

  it('is sent on the first tick after loading a save already past tier 6', () => {
    const { s } = atStone(1, 7, 0);
    const old = JSON.parse(JSON.stringify(makeSave(s))) as { world: Record<string, unknown> };
    delete old.world.stormDoorHinted;
    const parsed = parseSave(JSON.stringify(old));
    expect(parsed.world.stormDoorHinted).toBe(false);
    s.world.stormDoorHinted = false;
    run(s, 1);
    expect(types(s)).toContain('stormDoorWoke');
  });
});
