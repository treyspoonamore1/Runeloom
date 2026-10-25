import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hearthRoom, hearthStone } from '../../data/hearth';
import { regionRooms } from '../../data/progression';
import { loomStoneHere } from '../../src/sim/world/adventure';
import { createAdventure, loadSave, parseSave, type GameState, type SaveData } from '../../src/sim';
import { loadAllRooms } from '../../tools/lib/rooms';

const rooms = loadAllRooms();
const read = (name: string) =>
  readFileSync(new URL(`../../data/playtest/${name}.json`, import.meta.url), 'utf8');
const load = (save: SaveData): GameState =>
  loadSave(save, (init) => createAdventure({ seed: init.seed, rooms, hero: init.hero, world: init.world }));

describe('bundled playtest saves (npm run sim -- --playtest-saves)', () => {
  it('after_warden parses and loads: Hearth lit, level about 12, at K10 beside its Loom Stone', () => {
    const save = parseSave(read('after_warden'));
    const s = load(save);
    const h = s.hero.hearth;
    expect(h.lit).toBe(true);
    expect(h.embers).toBe(500);
    expect(s.hero.level).toBeGreaterThanOrEqual(11);
    expect(s.hero.level).toBeLessThanOrEqual(14);
    expect(s.room.id).toBe(regionRooms.k10);
    expect(loomStoneHere(s)).not.toBeNull();
    expect(s.hero.riftTier).toBe(0);
  });

  it('mid_climb parses and loads: in the hub at tier 7 with buildings, an expedition out and a sigil to open', () => {
    const save = parseSave(read('mid_climb'));
    const s = load(save);
    const h = s.hero.hearth;
    expect(s.room.id).toBe(hearthRoom);
    expect(s.world.respawn?.key).toBe(hearthStone.key);
    expect(loomStoneHere(s)).not.toBeNull();
    expect(s.world.rift).toBeNull();
    expect(s.hero.riftTier).toBeGreaterThanOrEqual(6);
    expect(s.hero.riftTier).toBeLessThanOrEqual(8);
    expect(Object.values(h.buildings).some((l) => l > 0)).toBe(true);
    expect(h.embers).toBeGreaterThan(0);
    expect(h.expeditions.length).toBeGreaterThan(0);
    expect(h.rekindles).toBe(0);
    // Close to Rekindle: its unlock tier is one past the best tier cleared.
    expect(s.hero.sigils.some((g) => g.tier >= s.hero.riftTier)).toBe(true);
  });
});
