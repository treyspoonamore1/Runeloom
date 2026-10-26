import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hearthRoom, hearthStone } from '../../data/hearth';
import { fenRooms, regionRooms } from '../../data/progression';
import { riftGate } from '../../data/riftGate';
import { maxOpenTier } from '../../src/sim/world/rift/run';
import { loomStoneHere } from '../../src/sim/world/adventure';
import { createAdventure, loadSave, NEUTRAL_INPUT, parseSave, step, type GameState, type SaveData } from '../../src/sim';
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
    // M8: the deep rifts stay shut (an older progression route marked the Coil dead).
    expect(s.world.bossesDefeated).not.toContain('glasswater_coil');
    // Close to Rekindle: its unlock tier is one past the best tier cleared.
    expect(s.hero.sigils.some((g) => g.tier >= s.hero.riftTier)).toBe(true);
  });

  it('fen_start parses and loads: tier 8 done, the Coil alive, at K10\'s Loom Stone with the storm door open', () => {
    const save = parseSave(read('fen_start'));
    const s = load(save);
    expect(s.room.id).toBe(regionRooms.k10);
    expect(loomStoneHere(s)).not.toBeNull();
    expect(s.hero.riftTier).toBe(8);
    expect(s.hero.hearth.rekindles).toBe(0);
    expect(s.world.bossesDefeated).toContain('cinder_warden');
    expect(s.world.bossesDefeated).not.toContain(riftGate.boss);
    expect(maxOpenTier(s)).toBe(8);
    expect(s.objects.find((o) => o.kind === 'door')!.on).toBe(true);
    expect(s.hero.level).toBeGreaterThanOrEqual(25);
    // One walk north: through the open door and the exit into G1.
    const exit = s.objects.find((o) => o.kind === 'door')!;
    const p = s.player;
    p.x = p.prevX = (exit.tx + 0.5) * 4;
    p.y = p.prevY = (exit.ty + 0.5) * 4;
    for (let i = 0; i < 120 && s.room.id !== fenRooms.g1; i++)
      step(s, { ...NEUTRAL_INPUT, moveY: -1, aimX: p.x, aimY: p.y - 10 });
    expect(s.room.id).toBe(fenRooms.g1);
  });
});
