import { describe, expect, it } from 'vitest';
import { createAdventure, dealDirectDamage, loadSave, makeSave, PLAYER_ID } from '../../../src/sim';
import { regionRooms } from '../../../data/progression';
import { ROOMS, run } from './worldHelpers';

/** Integration of the M4 bosses (enemies agent) with room clears, rewards and saves (world, hero). */
describe('boss rooms', () => {
  const killBoss = (kind: string, roomId: string) => {
    const s = createAdventure({ seed: 4, rooms: ROOMS, startRoomId: roomId });
    s.cheats.god = true;
    const boss = s.enemies.find((e) => e.kind === kind)!;
    expect(boss).toBeDefined();
    dealDirectDamage(s, boss, boss.life + 1e6, PLAYER_ID);
    run(s, 10);
    return s;
  };

  it('the Tar Matriarch clears K5 and pays its runes', () => {
    const s = killBoss('tar_matriarch', regionRooms.k5);
    expect(s.world.bossesDefeated).toContain('tar_matriarch');
    expect(s.world.flags[regionRooms.k5]!.cleared).toBe(true);
    const runes = s.hero.runes.map((r) => r.rune);
    expect(runes).toEqual(expect.arrayContaining(['on_kill', 'harvest']));
  });

  it('the Cinder Warden clears K10 and pays Storm, Chain, Sigil and On Crit', () => {
    const s = killBoss('cinder_warden', regionRooms.k10);
    expect(s.world.bossesDefeated).toContain('cinder_warden');
    expect(s.world.flags[regionRooms.k10]!.cleared).toBe(true);
    const runes = s.hero.runes.map((r) => r.rune);
    expect(runes).toEqual(expect.arrayContaining(['storm', 'chain', 'sigil', 'on_crit']));
  });

  it('a save made in K10 with the Warden alive loads at the respawn Loom Stone (K6)', () => {
    const s = createAdventure({ seed: 4, rooms: ROOMS, startRoomId: regionRooms.k10 });
    const k6 = createAdventure({ seed: 4, rooms: ROOMS, startRoomId: regionRooms.k6 });
    const stone = k6.objects.find((o) => o.kind === 'loom_stone')!;
    s.world.loomStones.push(`${regionRooms.k6}#${stone.key}`);
    s.world.respawn = { roomId: regionRooms.k6, key: stone.key };
    const loaded = loadSave(makeSave(s), (init) => createAdventure({ ...init, rooms: ROOMS }));
    expect(loaded.room.id).toBe(regionRooms.k6);
    // Once the Warden is dead, the save loads in K10.
    s.world.bossesDefeated.push('cinder_warden');
    const after = loadSave(makeSave(s), (init) => createAdventure({ ...init, rooms: ROOMS }));
    expect(after.room.id).toBe(regionRooms.k10);
  });
});

describe("K10's Loom Stone", () => {
  it('sleeps while the Warden lives, then wakes as the respawn point when he dies', () => {
    const s = createAdventure({ seed: 4, rooms: ROOMS, startRoomId: regionRooms.k10 });
    s.cheats.god = true;
    s.cheats.noAI = true;
    const stone = s.objects.find((o) => o.kind === 'loom_stone')!;
    expect(stone).toBeDefined();
    // Standing on it during the fight does nothing.
    s.player.x = s.player.prevX = (stone.tx + 0.5) * 4;
    s.player.y = s.player.prevY = (stone.ty + 0.5) * 4;
    run(s, 5);
    expect(stone.on).toBe(false);
    expect(s.world.respawn?.roomId).not.toBe(regionRooms.k10);
    const warden = s.enemies.find((e) => e.kind === 'cinder_warden')!;
    dealDirectDamage(s, warden, warden.life + 1e6, PLAYER_ID);
    run(s, 2);
    expect(stone.on).toBe(true);
    expect(s.world.respawn).toEqual({ roomId: regionRooms.k10, key: stone.key });
    expect(s.world.loomStones).toContain(`${regionRooms.k10}#${stone.key}`);
  });
});
